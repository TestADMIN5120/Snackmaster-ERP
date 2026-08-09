import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { 
  collection, query, where, getDocs, doc, writeBatch, serverTimestamp, updateDoc, deleteDoc, setDoc 
} from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAdmin } from "../../../contexts/AdminContext";
import { generateInvoicePDF } from "../../../utils/pdfGenerator";

/* ─────────────────────────────────────────────────────────────
   VENDOR CSV FORMATS
   Each column entry is a group of accepted header names — at
   least one per group must exist. Headers outside `columns`
   are rejected so a wrong/edited export fails loudly.
──────────────────────────────────────────────────────────── */
const VENDOR_FORMATS = {
  daalchini: {
    label: "Daalchini — Detailed Sales Report",
    columns: [
      ["id"], ["order_id"], ["slot_identifier"], ["manufacturer_variant_id"],
      ["name"], ["mrp"], ["offer_price"], ["created_at_tz"], ["updated_at_tz"],
      ["status"], ["success"], ["failed"], ["pendng"], ["hold_reset_done"],
      ["vend_remaining"], ["sub_status"], ["refund_count"],
      ["vending_machine_id"], ["machine_name"], ["street"]
    ],
    signature: ["order_id", "vending_machine_id", "offer_price"]
  },
  vendvittor: {
    label: "VendVittor — Daily Device Summary",
    columns: [
      ["Date"], ["Day of Week"], ["Device ID"], ["Location"], ["Revenue"],
      ["Transactions"], ["Cash Transactions"], ["PG Transactions"], ["Refund Count"]
    ],
    signature: ["Device ID", "Revenue", "PG Transactions"]
  }
};

// "85,121,548" → 85121548; "" → 0
const cleanNum = (v) => Number(String(v ?? "").replace(/,/g, "").trim()) || 0;

// Compares the file's headers against the selected vendor's format and
// returns a list of human-readable differences (empty = valid).
function validateVendorFormat(vendorKey, fields) {
  const spec = VENDOR_FORMATS[vendorKey];
  const found = (fields || []).map((f) => (f || "").trim()).filter(Boolean);
  const problems = [];

  const missing = spec.columns
    .filter((group) => !group.some((h) => found.includes(h)))
    .map((group) => group.join('" or "'));
  if (missing.length) {
    problems.push(`Missing required column${missing.length > 1 ? "s" : ""}: "${missing.join('", "')}"`);
  }

  const known = new Set(spec.columns.flat());
  const extra = found.filter((f) => !known.has(f));
  if (extra.length) {
    problems.push(`Unexpected column${extra.length > 1 ? "s" : ""} for this format: "${extra.join('", "')}"`);
  }

  if (problems.length) {
    const lcFound = new Set(found.map((f) => f.toLowerCase()));
    for (const [key, other] of Object.entries(VENDOR_FORMATS)) {
      if (key !== vendorKey && other.signature.every((h) => lcFound.has(h.toLowerCase()))) {
        problems.push(`Hint: these columns match the "${other.label}" format — check the vendor selection.`);
        break;
      }
    }
  }
  return problems;
}

export default function AdminNewSalesLedger() {
  const { orgId, user } = useAdmin();
  
  const [machines, setMachines] = useState([]);
  
  // Upload State
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [formatError, setFormatError] = useState(null); // { vendorLabel, problems: [] }

  // History & View State
  const [uploadLogs, setUploadLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [viewingBatch, setViewingBatch] = useState(null); 
  const [batchTransactions, setBatchTransactions] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  
  const [viewMode, setViewMode] = useState("active"); 

  useEffect(() => {
    if (!orgId) return;
    const fetchMachines = async () => {
      const q = query(collection(db, "machines"), where("orgId", "==", orgId), where("deleted", "==", false));
      const snap = await getDocs(q);
      setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchMachines();
  }, [orgId]);

  const fetchUploadLogs = async () => {
    if (!orgId) return;
    setLoadingLogs(true);
    try {
      const q = query(collection(db, "sales_upload_logs"), where("orgId", "==", orgId));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
      setUploadLogs(logs);
    } catch (error) {
      console.error("Error fetching upload logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchUploadLogs();
  }, [orgId, uploadStats]);

  const toggleBatchView = async (batchId) => {
    if (viewingBatch === batchId) {
        setViewingBatch(null);
        return;
    }
    setLoadingTxns(true);
    setViewingBatch(batchId);
    try {
      const q = query(
          collection(db, "sales_transactions"), 
          where("orgId", "==", orgId), 
          where("uploadBatchId", "==", batchId)
      );
      const snap = await getDocs(q);
      let txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      txns.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
      setBatchTransactions(txns);
    } catch (error) {
      console.error("Error fetching batch txns:", error);
      alert("Permission Error. Make sure Firebase Rules are updated.");
    } finally {
      setLoadingTxns(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     VENDOR ROW NORMALIZATION
     Converts raw CSV rows into common "item lines":
     { txnId, name, slotId, price (line total), qty, parsedDate }
     plus the batch's refunded amount.
  ───────────────────────────────────────────────────────── */
  function normalizeRows(vendorKey, rawData) {
    const lines = [];
    let totalRefunded = 0;

    if (vendorKey === "daalchini") {
      // One row per order line. Only "completed" orders are money events:
      // `success` = units vended, `refund_count` = units refunded back.
      // Txn amount = money paid; refunds are subtracted via totalRefunded,
      // so Net Revenue = value of items actually delivered.
      rawData.forEach(row => {
        const status = (row["status"] || "").trim().toLowerCase();
        if (status !== "completed") return;

        const txnId = (row["order_id"] || "").replace(/[^a-zA-Z0-9]/g, '');
        const unitPrice = cleanNum(row["offer_price"]);
        if (!txnId || unitPrice <= 0) return;

        const qtySold = cleanNum(row["success"]);
        const qtyRefunded = cleanNum(row["refund_count"]);
        const name = (row["name"] || "Unknown").trim();
        const slotId = (row["slot_identifier"] || "").toString().trim();
        const d = new Date((row["created_at_tz"] || "").trim()); // e.g. "June 1, 2026"
        const parsedDate = isNaN(d) ? null : d;

        if (qtySold > 0) {
          lines.push({
            txnId, slotId, parsedDate,
            name: qtySold > 1 ? `${name} x${qtySold}` : name,
            price: unitPrice * qtySold, qty: qtySold
          });
        }
        if (qtyRefunded > 0) {
          totalRefunded += unitPrice * qtyRefunded;
          lines.push({
            txnId, slotId, parsedDate,
            name: `${name} (Refunded x${qtyRefunded})`,
            price: unitPrice * qtyRefunded, qty: qtyRefunded
          });
        }
      });

    } else if (vendorKey === "vendvittor") {
      // One row = one device's daily summary; no per-sale detail exists.
      // Deterministic txnId (device + date) makes re-uploads dedup cleanly.
      rawData.forEach(row => {
        const deviceId = (row["Device ID"] || "").trim();
        const dateStr = (row["Date"] || "").trim();
        const revenue = cleanNum(row["Revenue"]);
        if (!deviceId || !dateStr || revenue <= 0) return;

        const txnCount = cleanNum(row["Transactions"]);
        const refundCount = cleanNum(row["Refund Count"]);
        const d = new Date(`${dateStr}T12:00:00`); // midday avoids timezone date-shift

        lines.push({
          txnId: `VV${deviceId}${dateStr}`.replace(/[^a-zA-Z0-9]/g, ''),
          name: `Daily Summary — ${txnCount} sales${refundCount > 0 ? `, ${refundCount} refunds` : ""}`,
          slotId: deviceId,
          price: revenue, qty: 1,
          parsedDate: isNaN(d) ? null : d
        });
      });
    }

    return { lines, totalRefunded };
  }

  // 🟢 MASSIVELY UPGRADED UPLOAD HANDLER
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedVendor) return alert("Please select the vendor format first.");
    if (!selectedMachine) return alert("Please select a machine first.");
    if (!fromDate || !toDate) return alert("Please select the From and To dates for this report.");

    setUploading(true);
    setUploadStats(null);
    setFormatError(null);

    const batchId = `BATCH_${Date.now()}`;
    const selectedMachineName = machines.find(m => m.id === selectedMachine)?.name || selectedMachine;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => (h || "").trim(),
      complete: async (results) => {
        try {
          // 🟢 0. VENDOR FORMAT VALIDATION — abort before touching the database
          const problems = validateVendorFormat(selectedVendor, results.meta.fields);
          if (problems.length) {
            setFormatError({ vendorLabel: VENDOR_FORMATS[selectedVendor].label, problems });
            e.target.value = null;
            setUploading(false);
            return;
          }

          const rawData = results.data;
          const { lines, totalRefunded } = normalizeRows(selectedVendor, rawData);
          let batchTotalRefunded = totalRefunded;

          // 🟢 1. IN-MEMORY GROUPING (Solves the Multi-Item Issue)
          const groupedTxns = {};

          lines.forEach(line => {
            // If this is the first time seeing this TxnID, create the base record
            if (!groupedTxns[line.txnId]) {
               groupedTxns[line.txnId] = {
                  txnId: line.txnId,
                  uploadBatchId: batchId,
                  machineId: selectedMachine,
                  orgId: orgId,
                  vendor: selectedVendor,
                  amount: 0, // We will sum this up
                  productName: line.name,
                  slotId: line.slotId,
                  items: [], // Array to hold individual products
                  dateISO: line.parsedDate ? line.parsedDate.toISOString() : null,
                  createdAt: serverTimestamp(),
                  deleted: false
               };
            }

            // Add the amount to the total transaction
            groupedTxns[line.txnId].amount += line.price;

            // Push the specific item details to the items array
            groupedTxns[line.txnId].items.push({
               productName: line.name,
               slotId: line.slotId,
               price: line.price,
               qty: line.qty
            });

            // If there are multiple items, update the top-level name for older UI compatibility
            if (groupedTxns[line.txnId].items.length > 1) {
               groupedTxns[line.txnId].productName = "Multiple Items";
               groupedTxns[line.txnId].slotId = "Mixed";
            }
          });

          const validRecords = Object.values(groupedTxns);

          // 🟢 2. GLOBAL DEDUPLICATION (Checks whole org, not just machine)
          const existingTxnIds = new Set();
          const txnIdsToCheck = validRecords.map(r => r.txnId);
          
          // Query Firestore in batches of 10 to avoid limits and performance hits
          for (let i = 0; i < txnIdsToCheck.length; i += 10) {
            const chunk = txnIdsToCheck.slice(i, i + 10);
            const q = query(
                collection(db, "sales_transactions"), 
                where("orgId", "==", orgId), 
                where("txnId", "in", chunk)
            );
            const snap = await getDocs(q);
            snap.docs.forEach(d => existingTxnIds.add(d.data().txnId));
          }

          let batchTotalRevenue = 0;
          const newRecords = validRecords.filter(r => {
             if (existingTxnIds.has(r.txnId)) return false; // Skip if already exists anywhere in org
             batchTotalRevenue += r.amount; 
             return true;
          });

          // 🟢 3. SAVE DATA
          if (newRecords.length === 0 && batchTotalRefunded === 0) {
            setUploading(false);
            setUploadStats({ total: rawData.length, added: 0, ignored: rawData.length, refunded: 0 });
            return;
          }

          const batchRef = doc(db, "sales_upload_logs", batchId);
          const batchData = {
              id: batchId,
              orgId: orgId,
              vendor: selectedVendor,
              vendorLabel: VENDOR_FORMATS[selectedVendor].label,
              machineId: selectedMachine,
              machineName: selectedMachineName,
              fromDate: fromDate,
              toDate: toDate,
              totalRevenue: batchTotalRevenue, 
              totalRefunded: batchTotalRefunded, 
              netRevenue: batchTotalRevenue - batchTotalRefunded, 
              transactionCount: newRecords.length,
              uploadedBy: user.email,
              uploadedAt: serverTimestamp(),
              deleted: false 
          };

          const chunks = [];
          for (let i = 0; i < newRecords.length; i += 499) { 
            chunks.push(newRecords.slice(i, i + 499));
          }

          if (chunks.length === 0 && batchTotalRefunded > 0) {
             await setDoc(batchRef, batchData);
          } else {
             for (let i = 0; i < chunks.length; i++) {
               const batch = writeBatch(db);
               if (i === 0) batch.set(batchRef, batchData);
               
               chunks[i].forEach(record => {
                 const docRef = doc(db, "sales_transactions", record.txnId);
                 batch.set(docRef, record);
               });
               await batch.commit();
             }
          }

          setUploadStats({ 
              total: rawData.length, 
              added: newRecords.length, 
              ignored: rawData.length - newRecords.length, // Show total ignored from raw
              refundAmount: batchTotalRefunded
          });
          
          e.target.value = null;
          setFromDate(""); setToDate(""); setSelectedMachine("");

        } catch (err) {
          console.error("Upload error:", err);
          alert("Error processing file. Check console.");
        } finally {
          setUploading(false);
        }
      }
    });
  };

  const downloadBatchCSV = async (batchId, mName, fDate, tDate) => {
      const q = query(collection(db, "sales_transactions"), where("orgId", "==", orgId), where("uploadBatchId", "==", batchId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
          const t = d.data();
          // Unroll multi-item names for the CSV export
          const itemNames = t.items && t.items.length > 1 
                ? t.items.map(i => `${i.productName} (${i.slotId})`).join(" + ") 
                : t.productName;
          
          return {
              "Date & Time": t.dateISO ? new Date(t.dateISO).toLocaleString('en-IN') : "Unknown",
              "Txn ID": t.txnId,
              "Machine": mName,
              "Items Purchased": itemNames,
              "Total Amount (Rs)": t.amount
          }
      });

      if (data.length === 0) return alert("No transactions found for this batch to download.");

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Sales_${mName}_${fDate}_to_${tDate}.csv`;
      link.click();
  };

  // --- DELETION HANDLERS --- 
  const handleSoftDelete = async (batchId) => {
      if (!window.confirm("Move this batch to trash?")) return;
      setLoadingLogs(true);
      try {
          await updateDoc(doc(db, "sales_upload_logs", batchId), { deleted: true });
          const q = query(collection(db, "sales_transactions"), where("orgId", "==", orgId), where("uploadBatchId", "==", batchId));
          const snap = await getDocs(q);
          let temp = [];
          snap.docs.forEach(d => temp.push(d.ref));
          while(temp.length > 0) {
              const chunk = temp.splice(0, 500);
              const batch = writeBatch(db);
              chunk.forEach(ref => batch.update(ref, { deleted: true }));
              await batch.commit();
          }
          setViewingBatch(null);
          await fetchUploadLogs();
      } catch (e) {
          console.error(e);
          alert("Error moving to trash.");
      }
  };

  const handleRestore = async (batchId) => {
      setLoadingLogs(true);
      try {
          await updateDoc(doc(db, "sales_upload_logs", batchId), { deleted: false });
          const q = query(collection(db, "sales_transactions"), where("orgId", "==", orgId), where("uploadBatchId", "==", batchId));
          const snap = await getDocs(q);
          let temp = [];
          snap.docs.forEach(d => temp.push(d.ref));
          while(temp.length > 0) {
              const chunk = temp.splice(0, 500);
              const batch = writeBatch(db);
              chunk.forEach(ref => batch.update(ref, { deleted: false }));
              await batch.commit();
          }
          await fetchUploadLogs();
      } catch (e) {
          console.error(e);
          alert("Error restoring batch.");
      }
  };

  const handlePermanentDelete = async (batchId) => {
      if (!window.confirm("PERMANENTLY DELETE this batch and all its transactions? This CANNOT be undone!")) return;
      setLoadingLogs(true);
      try {
          const q = query(collection(db, "sales_transactions"), where("orgId", "==", orgId), where("uploadBatchId", "==", batchId));
          const snap = await getDocs(q);
          let temp = [];
          snap.docs.forEach(d => temp.push(d.ref));
          while(temp.length > 0) {
              const chunk = temp.splice(0, 500);
              const batch = writeBatch(db);
              chunk.forEach(ref => batch.delete(ref));
              await batch.commit();
          }
          await deleteDoc(doc(db, "sales_upload_logs", batchId));
          setViewingBatch(null);
          await fetchUploadLogs();
      } catch (e) {
          console.error(e);
          alert("Error deleting permanently.");
      }
  };

  const filteredLogs = uploadLogs.filter(log => viewMode === "trash" ? log.deleted === true : !log.deleted);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1 style={{ color: "#1e293b", marginBottom: 5 }}>🧾 New Transaction Ledger</h1>
      <p style={{ color: "#64748b", marginBottom: 25 }}>Upload telemetry reports, track daily sales history, and generate tax invoices.</p>

      <div style={controlPanel}>
        <h3 style={{marginTop: 0, color: "#334155", marginBottom: 15}}>📤 Upload New Sales Report</h3>
        <div style={{ display: "flex", gap: 15, flexWrap: "wrap", alignItems: "flex-end" }}>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Vendor Format</label>
            <select
              value={selectedVendor}
              onChange={(e) => { setSelectedVendor(e.target.value); setFormatError(null); }}
              style={inputStyle}
            >
              <option value="">-- Choose Vendor --</option>
              {Object.entries(VENDOR_FORMATS).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Machine</label>
            <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} style={inputStyle}>
              <option value="">-- Choose Machine --</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 140 }}>
            <label style={labelStyle}>Report From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 140 }}>
            <label style={labelStyle}>Report To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Select Telemetry CSV</label>
            <input
              type="file" accept=".csv" onChange={handleFileUpload}
              disabled={!selectedVendor || !selectedMachine || !fromDate || !toDate || uploading}
              style={{...inputStyle, background: (!selectedVendor || !selectedMachine || !fromDate || !toDate || uploading) ? "#f1f5f9" : "#fff", cursor: (!selectedVendor || !selectedMachine || !fromDate || !toDate || uploading) ? "not-allowed" : "pointer"}}
            />
          </div>

        </div>
      </div>

      {formatError && (
        <div style={{...alertBox, background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca"}}>
          <b>❌ Invalid format for {formatError.vendorLabel}</b> — nothing was uploaded.
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
            {formatError.problems.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {uploading && <div style={{...alertBox, background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd"}}>⏳ Processing CSV, checking for global duplicates, and saving batch...</div>}
      
      {uploadStats && (
        <div style={{...alertBox, background: uploadStats.added > 0 ? "#f0fdf4" : "#fffbeb", color: uploadStats.added > 0 ? "#166534" : "#b45309", borderColor: uploadStats.added > 0 ? "#bbf7d0" : "#fcd34d"}}>
          <b>{uploadStats.added > 0 ? "✅ Upload Complete!" : "⚠️ No New Data Added"}</b><br/>
          Processed Rows: {uploadStats.total} | <b>{uploadStats.added} New Unique Transactions Saved.</b> | {uploadStats.ignored} Ignored (Duplicates). <br/>
          {uploadStats.refundAmount > 0 && <span style={{color: "#ef4444", fontWeight: "bold", display:"block", marginTop: 4}}>📉 ₹{uploadStats.refundAmount} in Refunds successfully detected and subtracted!</span>}
        </div>
      )}

      <div style={tableCard}>
        <div style={{ padding: 20, borderBottom: "1px solid #e2e8f0", background: viewMode === "trash" ? "#fee2e2" : "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: viewMode === "trash" ? "#991b1b" : "#334155" }}>
            {viewMode === "trash" ? "🗑️ Trash Bin" : "🗄️ Upload History & Batch Reports"}
          </h3>
          <button 
             onClick={() => { setViewMode(viewMode === "active" ? "trash" : "active"); setViewingBatch(null); }} 
             style={viewMode === "active" ? btnDangerOutline : btnPrimaryOutline}
          >
             {viewMode === "active" ? "🗑️ View Trash" : "⬅️ Back to Active"}
          </button>
        </div>

        {loadingLogs ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading history...</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              {viewMode === "trash" ? "Trash is empty." : "No active sales reports found."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "#fff", color: "#475569", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                <tr>
                  <th style={th}>Report Period</th>
                  <th style={th}>Machine</th>
                  <th style={th}>Gross Revenue</th>
                  <th style={th}>Refunds</th>
                  <th style={th}>Net Revenue</th>
                  <th style={th}>Txns</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9", background: viewingBatch === log.id ? "#eff6ff" : "transparent" }}>
                    <td style={{...td, fontWeight: "bold"}}>
                        {log.fromDate} <span style={{color:"#94a3b8"}}>to</span> {log.toDate}
                        <div style={{fontSize: 11, color: "#94a3b8", fontWeight: "normal", marginTop: 4}}>Uploaded: {log.uploadedAt?.seconds ? new Date(log.uploadedAt.seconds * 1000).toLocaleString() : ""}</div>
                    </td>
                    <td style={td}>
                        {log.machineName}
                        {log.vendorLabel && <div style={{fontSize: 11, color: "#94a3b8", marginTop: 4}}>{log.vendorLabel}</div>}
                    </td>
                    <td style={{...td, color: "#475569"}}>₹{(log.totalRevenue || 0).toFixed(2)}</td>
                    <td style={{...td, color: "#ef4444"}}>₹{(log.totalRefunded || 0).toFixed(2)}</td>
                    <td style={{...td, color: "#16a34a", fontWeight: "bold", fontSize: 15}}>₹{(log.netRevenue || log.totalRevenue || 0).toFixed(2)}</td>
                    <td style={td}>{log.transactionCount}</td>
                    <td style={td}>
                      <div style={{display: "flex", gap: 10}}>
                          {viewMode === "active" ? (
                              <>
                                <button onClick={() => toggleBatchView(log.id)} style={viewingBatch === log.id ? btnPrimaryActive : btnPrimary}>
                                  {viewingBatch === log.id ? "🙈 Hide Invoices" : "👁️ View Invoices"}
                                </button>
                                <button onClick={() => downloadBatchCSV(log.id, log.machineName, log.fromDate, log.toDate)} style={btnSecondary}>
                                  📥 CSV
                                </button>
                                <button onClick={() => handleSoftDelete(log.id)} style={btnDangerSmall} title="Move to Trash">🗑️</button>
                              </>
                          ) : (
                              <>
                                <button onClick={() => handleRestore(log.id)} style={btnSuccessSmall}>♻️ Restore</button>
                                <button onClick={() => handlePermanentDelete(log.id)} style={btnDangerSmall}>❌ Delete Forever</button>
                              </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingBatch && (
        <div style={{...tableCard, marginTop: 20, border: "2px solid #3b82f6"}}>
          <div style={{ padding: 20, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#eff6ff" }}>
            <h3 style={{ margin: 0, color: "#1e3a8a" }}>🧾 Invoices for Selected Batch</h3>
            <button onClick={() => setViewingBatch(null)} style={{background: "none", border: "none", cursor: "pointer", fontSize: 16}}>❌</button>
          </div>

          {loadingTxns ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading transactions...</div>
          ) : batchTransactions.length === 0 ? (
             <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No valid transactions to display for this batch.</div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#fff", color: "#475569", textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={th}>Date & Time</th>
                    <th style={th}>Txn ID</th>
                    <th style={th}>Purchased Items</th>
                    <th style={th}>Total Paid</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchTransactions.map(txn => {
                    const formattedDate = txn.dateISO ? new Date(txn.dateISO).toLocaleString('en-IN') : "Unknown Date";
                    return (
                      <tr key={txn.id} style={{ borderBottom: "1px solid #f1f5f9", opacity: txn.deleted ? 0.5 : 1 }}>
                        <td style={{...td, verticalAlign: "top"}}>{formattedDate}</td>
                        <td style={{...td, fontFamily: "monospace", color: "#64748b", verticalAlign: "top"}}>{txn.txnId}</td>
                        
                        {/* 🟢 DYNAMIC MULTI-ITEM RENDERING */}
                        <td style={{...td, verticalAlign: "top"}}>
                          {txn.items && txn.items.length > 1 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontWeight: "bold", color: "#0f172a" }}>Multiple Items</span>
                              {txn.items.map((it, idx) => (
                                <span key={idx} style={{ fontSize: 12, color: "#475569" }}>
                                  - {it.productName} <span style={{color: "#94a3b8"}}>({it.slotId})</span> : ₹{it.price.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{fontWeight: "bold"}}>{txn.productName} <span style={{fontWeight:"normal", color:"#94a3b8", fontSize: 11}}>({txn.slotId})</span></span>
                          )}
                        </td>

                        <td style={{...td, color: "#16a34a", fontWeight: "bold", verticalAlign: "top"}}>₹{txn.amount.toFixed(2)}</td>
                        <td style={{...td, verticalAlign: "top"}}>
                          <button onClick={() => generateInvoicePDF({ ...txn, date: formattedDate })} style={btnDownloadSmall}>
                            📄 Invoice
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}

// STYLES
const controlPanel = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 25, boxShadow: "0 4px 6px rgba(0,0,0,0.02)" };
const labelStyle = { fontSize: 13, fontWeight: "bold", color: "#475569" };
const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", fontSize: 14, boxSizing: "border-box" };
const alertBox = { padding: 15, borderRadius: 8, marginBottom: 20, fontSize: 14, border: "1px solid transparent" };
const tableCard = { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" };
const th = { padding: "12px 20px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e2e8f0" };
const td = { padding: "12px 20px", color: "#334155" };

const btnPrimary = { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12, transition: "0.2s" };
const btnPrimaryActive = { background: "#2563eb", color: "#fff", border: "1px solid #1d4ed8", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12, transition: "0.2s" };
const btnSecondary = { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12, transition: "0.2s" };
const btnDownloadSmall = { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1", padding: "6px 10px", borderRadius: 4, fontWeight: "bold", cursor: "pointer", fontSize: 11 };

const btnDangerOutline = { background: "#fff", color: "#ef4444", border: "1px solid #fca5a5", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12 };
const btnPrimaryOutline = { background: "#fff", color: "#3b82f6", border: "1px solid #93c5fd", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12 };
const btnDangerSmall = { background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", padding: "8px 10px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12 };
const btnSuccessSmall = { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12 };
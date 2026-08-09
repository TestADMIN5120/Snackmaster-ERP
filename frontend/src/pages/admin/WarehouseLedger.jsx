import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { generateBulkReportPDF } from "../../utils/pdfGenerator"; 

export default function WarehouseLedger() {
  const { orgId } = useAdmin();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (!orgId) return;

    const q = query(collection(db, "warehouse_movements"), where("orgId", "==", orgId), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Ledger Read Error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  // Filtering
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = (m.productName || "").toLowerCase().includes(search.toLowerCase()) || 
                          (m.batchId || "").toLowerCase().includes(search.toLowerCase()) ||
                          (m.referenceId || "").toLowerCase().includes(search.toLowerCase()) ||
                          (m.issuedTo || "").toLowerCase().includes(search.toLowerCase()) ||
                          (m.issuedBy || "").toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "ALL" || m.type === filterType;
      return matchSearch && matchType;
    });
  }, [movements, search, filterType]);

  // Pagination
  const paginatedMovements = filteredMovements.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  function formatDate(ts) {
    if (!ts?.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getBadgeStyle(type) {
    switch (type) {
      case "INWARD": return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
      case "OUTWARD_KIT": return { background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" };
      case "OUTWARD_MANUAL": return { background: "#ffedd5", color: "#c2410c", border: "1px solid #fed7aa" };
      case "RETURN": return { background: "#fef08a", color: "#854d0e", border: "1px solid #fde047" };
      case "EXPIRED_DAMAGED": return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }; // 🟢 UPDATED TYPE
      default: return { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
    }
  }

  // 🟢 Bulk Export Function Updated with Traceability
  const exportLedgerPDF = () => {
    const columns = ["Date", "Type", "Product", "Qty", "From -> To (Location)", "Performed By"];
    const rows = filteredMovements.map(m => {
      const traceString = m.issuedBy ? `${m.issuedBy} -> ${m.issuedTo} (${m.destination})` : (m.batchId ? `B:${m.batchId} ` : "") + (m.referenceId ? `R:${m.referenceId}` : "");
      return [
        formatDate(m.createdAt),
        m.type.replace("_", " "),
        m.productName,
        (m.type === "INWARD" || m.type === "RETURN" ? "+" : "-") + m.quantity.toString(),
        traceString,
        m.performedBy
      ];
    });
    generateBulkReportPDF("Full Stock Ledger Audit", columns, rows, orgId);
  };

  if (loading) return <div style={{ padding: 30 }}>Loading ledger...</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
        <div>
          <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📋 Stock Ledger</h1>
          <p style={{ color: "#64748b", marginBottom: 20 }}>Immutable record of all inventory movements with full traceability.</p>
        </div>
        <button onClick={exportLedgerPDF} style={btnPrimary}>📄 Export Ledger Sheet</button>
      </div>

      <div style={filterBar}>
        <input type="text" placeholder="Search product, person, or reference..." value={search} onChange={(e) => {setSearch(e.target.value); setPage(1);}} style={inputStyle} />
        <select value={filterType} onChange={(e) => {setFilterType(e.target.value); setPage(1);}} style={inputStyle}>
          <option value="ALL">All Movements</option>
          <option value="INWARD">Inward (Received)</option>
          <option value="OUTWARD_KIT">Outward (Kit Issued)</option>
          <option value="OUTWARD_MANUAL">Outward (Manual)</option>
          <option value="RETURN">Returned</option>
          <option value="EXPIRED_DAMAGED">Expired / Damaged</option> {/* 🟢 UPDATED LABEL */}
        </select>
      </div>

      <div style={tableContainer}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ background: "#f8fafc", textTransform: "uppercase", fontSize: 12, color: "#64748b" }}>
            <tr>
              <th style={th}>Date & Time</th>
              <th style={th}>Type</th>
              <th style={th}>Product Details</th>
              <th style={th}>Qty</th>
              <th style={th}>Traceability Info</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMovements.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{...td, verticalAlign: "top"}}>{formatDate(m.createdAt)}</td>
                <td style={{...td, verticalAlign: "top"}}><span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold", ...getBadgeStyle(m.type) }}>{m.type.replace("_", " ")}</span></td>
                
                <td style={{...td, verticalAlign: "top"}}>
                  <div style={{fontWeight: "600", color: "#1e293b", marginBottom: 4}}>{m.productName}</div>
                  <div style={{fontSize: 12, color: "#64748b"}}>Logged By: {m.performedBy}</div>
                </td>
                
                <td style={{...td, verticalAlign: "top", fontWeight: "bold", color: m.type === "INWARD" || m.type === "RETURN" ? "#10b981" : "#ef4444"}}>
                  {m.type === "INWARD" || m.type === "RETURN" ? "+" : "-"}{m.quantity}
                </td>
                
                <td style={{...td, verticalAlign: "top"}}>
                  {/* 🟢 NEW: Traceability Block */}
                  {m.issuedBy || m.issuedTo || m.destination ? (
                    <div style={{fontSize: 12, background: "#f8fafc", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0"}}>
                      {m.issuedBy && <div><b style={{color: "#475569"}}>From:</b> {m.issuedBy}</div>}
                      {m.issuedTo && <div><b style={{color: "#475569"}}>To:</b> {m.issuedTo}</div>}
                      {m.destination && <div><b style={{color: "#475569"}}>Dest:</b> {m.destination}</div>}
                      {m.remarks && <div style={{marginTop: 4, color: "#64748b", fontStyle: "italic"}}>"{m.remarks}"</div>}
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 12 }}>
                      {m.batchId && <div>B: {m.batchId}</div>}
                      {m.referenceId && <div>Ref: {m.referenceId}</div>}
                      {m.remarks && <div style={{color: "#94a3b8", fontStyle: "italic", marginTop: 4}}>{m.remarks}</div>}
                    </div>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
        {filteredMovements.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No movements recorded yet.</div>}
      </div>

      {/* PAGINATION */}
      <div style={paginationRow}>
        <span style={{ fontSize: 13, color: "#64748b" }}>Showing {paginatedMovements.length} of {filteredMovements.length} records</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={btnPage}>Previous</button>
          <button disabled={page * ITEMS_PER_PAGE >= filteredMovements.length} onClick={() => setPage(p => p + 1)} style={btnPage}>Next</button>
        </div>
      </div>

    </div>
  );
}

const filterBar = { display: "flex", gap: 15, marginBottom: 20, background: "#fff", padding: 15, borderRadius: 12, border: "1px solid #e2e8f0" };
const inputStyle = { padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", flex: 1, maxWidth: 300 };
const tableContainer = { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" };
const th = { padding: "14px 16px", textAlign: "left", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "14px 16px" };
const btnPrimary = { padding: "10px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold", height: "fit-content" };
const paginationRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15 };
const btnPage = { padding: "6px 12px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontWeight: "bold", color: "#475569" };
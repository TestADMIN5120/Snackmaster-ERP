import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAdmin } from "../../../contexts/AdminContext";
import Papa from "papaparse"; 

export default function AdminSalesAnalytics() {
  const { orgId } = useAdmin();
  
  const [machines, setMachines] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedMachine, setSelectedMachine] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 1️⃣ Fetch Machines
  useEffect(() => {
    if (!orgId) return;
    const fetchMachines = async () => {
      const q = query(collection(db, "machines"), where("orgId", "==", orgId));
      const snap = await getDocs(q);
      setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchMachines();
  }, [orgId]);

  // 2️⃣ Fetch Transactions 
  // Wrapped in useCallback so we can call it manually with the Reset button
  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      let qTxns;
      
      if (selectedMachine === "ALL") {
        qTxns = query(collection(db, "sales_transactions"), where("orgId", "==", orgId));
      } else {
        qTxns = query(collection(db, "sales_transactions"), where("orgId", "==", orgId), where("machineId", "==", selectedMachine));
      }
      
      const txnsSnap = await getDocs(qTxns);
      
      // 🟢 CRITICAL: This strictly ignores anything that was moved to Trash in the Ledger
      const validTxns = txnsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.deleted !== true);

      setTransactions(validTxns);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedMachine]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTERING & AGGREGATION LOGIC ---
  const getFilteredData = () => {
    let filtered = transactions;

    // Date Filters
    if (startDate) {
      filtered = filtered.filter(t => t.dateISO && t.dateISO >= startDate);
    }
    if (endDate) {
      const endOfDay = `${endDate}T23:59:59`; 
      filtered = filtered.filter(t => t.dateISO && t.dateISO <= endOfDay);
    }

    const aggregated = {};
    let grandTotalRevenue = 0;
    let grandTotalGST = 0;
    let grandTotalItems = 0;

    filtered.forEach(txn => {
      const name = txn.productName || "Unknown Product";
      const amt = Number(txn.amount) || 0;
      
      const basePrice = amt / 1.05;
      const gstAmount = amt - basePrice;

      if (!aggregated[name]) {
        aggregated[name] = { name, qty: 0, revenue: 0, gst: 0, base: 0 };
      }
      
      aggregated[name].qty += 1;
      aggregated[name].revenue += amt;
      aggregated[name].base += basePrice;
      aggregated[name].gst += gstAmount;

      grandTotalRevenue += amt;
      grandTotalGST += gstAmount;
      grandTotalItems += 1;
    });

    const tableData = Object.values(aggregated).sort((a, b) => b.qty - a.qty);

    return { tableData, grandTotalRevenue, grandTotalGST, grandTotalItems };
  };

  const { tableData, grandTotalRevenue, grandTotalGST, grandTotalItems } = getFilteredData();

  // --- QUICK FILTERS & RESET ---
  const setQuickDate = (type) => {
    const today = new Date();
    if (type === "today") {
      const dateStr = today.toISOString().split("T")[0];
      setStartDate(dateStr); setEndDate(dateStr);
    } else if (type === "week") {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(new Date().toISOString().split("T")[0]);
    } else if (type === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0]);
    } else {
      setStartDate(""); setEndDate("");
    }
  };

  // 🟢 NEW: Reset Dashboard Button
  const handleReset = () => {
      setStartDate("");
      setEndDate("");
      setSelectedMachine("ALL");
      fetchData(); // Hard re-fetch from Firebase
  };

  // --- CSV EXPORT ---
  const downloadReport = () => {
    if (tableData.length === 0) return alert("No data to download.");
    
    const exportData = tableData.map(row => ({
      "Product Name": row.name,
      "Quantity Sold": row.qty,
      "Base Revenue (Rs)": row.base.toFixed(2),
      "Total GST Collected 5% (Rs)": row.gst.toFixed(2),
      "Total Gross Revenue (Rs)": row.revenue.toFixed(2)
    }));

    exportData.push({
      "Product Name": "GRAND TOTAL",
      "Quantity Sold": grandTotalItems,
      "Base Revenue (Rs)": (grandTotalRevenue - grandTotalGST).toFixed(2),
      "Total GST Collected 5% (Rs)": grandTotalGST.toFixed(2),
      "Total Gross Revenue (Rs)": grandTotalRevenue.toFixed(2)
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Sales_Analytics_${startDate || "All"}_to_${endDate || "All"}.csv`;
    link.click();
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#1e293b", margin: "0 0 5px 0" }}>📈 Product Sales & GST Analytics</h1>
          <p style={{ color: "#64748b", margin: 0 }}>Track product performance based on Active Ledger records.</p>
        </div>
        <div style={{display: "flex", gap: 10}}>
            {/* 🟢 NEW RESET BUTTON */}
            <button onClick={handleReset} style={btnReset}>🔄 Sync & Reset Data</button>
            <button onClick={downloadReport} style={btnExport}>📥 Download CSV</button>
        </div>
      </div>

      {/* CONTROL PANEL */}
      <div style={controlPanel}>
        <div style={{ display: "flex", gap: 15, flexWrap: "wrap", alignItems: "flex-end" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Filter by Machine</label>
            <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} style={inputStyle}>
              <option value="ALL">All Machines Combined</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={labelStyle}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>

        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          <span style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", marginRight: 10 }}>Quick Filters:</span>
          <button onClick={() => setQuickDate("today")} style={btnQuick}>Today</button>
          <button onClick={() => setQuickDate("week")} style={btnQuick}>This Week</button>
          <button onClick={() => setQuickDate("month")} style={btnQuick}>This Month</button>
          <button onClick={() => setQuickDate("all")} style={btnQuick}>All Time</button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={summaryGrid}>
        <div style={{...summaryCard, borderTop: "4px solid #3b82f6"}}>
          <div style={summaryLabel}>Gross Revenue (Inc. GST)</div>
          <div style={summaryValue}>₹{grandTotalRevenue.toFixed(2)}</div>
        </div>
        <div style={{...summaryCard, borderTop: "4px solid #10b981"}}>
          <div style={summaryLabel}>Base Revenue (Exc. GST)</div>
          <div style={summaryValue}>₹{(grandTotalRevenue - grandTotalGST).toFixed(2)}</div>
        </div>
        <div style={{...summaryCard, borderTop: "4px solid #f59e0b", background: "#fffbeb"}}>
          <div style={summaryLabel}>Total GST Collected (5%)</div>
          <div style={{...summaryValue, color: "#b45309"}}>₹{grandTotalGST.toFixed(2)}</div>
        </div>
        <div style={{...summaryCard, borderTop: "4px solid #8b5cf6"}}>
          <div style={summaryLabel}>Total Items Sold</div>
          <div style={summaryValue}>{grandTotalItems} units</div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div style={tableCard}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Syncing live database...</div>
        ) : tableData.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No active sales found for the selected filters.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                <tr>
                  <th style={th}>Product Name</th>
                  <th style={th}>Qty Sold</th>
                  <th style={th}>Base Rev (Rs)</th>
                  <th style={th}>GST Collected (Rs)</th>
                  <th style={th}>Gross Rev (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{...td, fontWeight: "bold", color: "#1e293b"}}>{row.name}</td>
                    <td style={{...td, fontWeight: "bold"}}>{row.qty}</td>
                    <td style={td}>₹{row.base.toFixed(2)}</td>
                    <td style={{...td, color: "#b45309"}}>₹{row.gst.toFixed(2)}</td>
                    <td style={{...td, color: "#16a34a", fontWeight: "bold"}}>₹{row.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// STYLES
const controlPanel = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20, boxShadow: "0 2px 5px rgba(0,0,0,0.02)" };
const labelStyle = { fontSize: 12, fontWeight: "bold", color: "#475569", textTransform: "uppercase" };
const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", fontSize: 14, minWidth: 150 };
const btnQuick = { padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: "bold", color: "#475569" };
const btnExport = { padding: "12px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 14 };
const btnReset = { padding: "12px 20px", background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 14 };

const summaryGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15, marginBottom: 20 };
const summaryCard = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 2px 5px rgba(0,0,0,0.02)" };
const summaryLabel = { fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: "bold", marginBottom: 5 };
const summaryValue = { fontSize: 24, fontWeight: "900", color: "#1e293b" };

const tableCard = { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 5px rgba(0,0,0,0.02)" };
const th = { padding: "15px 20px", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 };
const td = { padding: "15px 20px", color: "#334155" };
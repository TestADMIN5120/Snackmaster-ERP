import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { generateBulkReportPDF } from "../../utils/pdfGenerator";

export default function WarehouseDashboard() {
  const { orgId } = useAdmin();
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]); // Restored products state

  // Section 1: Movements UI State
  const [activeTab, setActiveTab] = useState("INWARD");
  const [movSearch, setMovSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [movPage, setMovPage] = useState(1);

  // Section 2: Current Stock UI State (Restored)
  const [stockSearch, setStockSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (orgId) loadAllData();
  }, [orgId]);

  async function loadAllData() {
    setLoading(true);
    try {
      // Fetch Movements
      const movQ = query(collection(db, "warehouse_movements"), where("orgId", "==", orgId), orderBy("createdAt", "desc"));
      const movSnap = await getDocs(movQ);
      setMovements(movSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Current Stock (Restored)
      const prodQ = query(collection(db, "products"), where("orgId", "==", orgId));
      const prodSnap = await getDocs(prodQ);
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Helper: Get Date from either manual movementDate or fallback to createdAt
  const getRecordDate = (m) => {
    if (m.movementDate?.seconds) return new Date(m.movementDate.seconds * 1000);
    if (m.createdAt?.seconds) return new Date(m.createdAt.seconds * 1000);
    return new Date(); 
  };

  // --- FILTERING LOGIC ---

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // 1. Tab Filter
      if (activeTab === "OUTWARD" && m.type !== "OUTWARD_KIT" && m.type !== "OUTWARD_MANUAL") return false;
      if (activeTab !== "OUTWARD" && m.type !== activeTab) return false;

      // 2. Search Filter
      if (movSearch && !(m.productName || "").toLowerCase().includes(movSearch.toLowerCase())) return false;

      // 3. Date Filter
      const recDate = getRecordDate(m);
      if (startDate && recDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include the whole end day
        if (recDate > end) return false;
      }
      return true;
    });
  }, [movements, activeTab, movSearch, startDate, endDate]);

  // 🟢 UPDATED: Alphanumeric SKU sorting applied to Active Stock!
  const filteredStock = useMemo(() => {
    return products
      .filter(p => (p.name || "").toLowerCase().includes(stockSearch.toLowerCase()))
      .sort((a, b) => {
        const skuA = (a.sku || "").toString().toLowerCase();
        const skuB = (b.sku || "").toString().toLowerCase();
        return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [products, stockSearch]);

  // --- PAGINATION LOGIC ---

  const paginatedMovements = filteredMovements.slice((movPage - 1) * ITEMS_PER_PAGE, movPage * ITEMS_PER_PAGE);
  const paginatedStock = filteredStock.slice((stockPage - 1) * ITEMS_PER_PAGE, stockPage * ITEMS_PER_PAGE);

  // --- EXPORT LOGIC ---

  const exportMovementsPDF = () => {
    const columns = ["Date", "Product", "Qty", "Reference / Remarks", "Performed By"];
    const rows = filteredMovements.map(m => [
      getRecordDate(m).toLocaleDateString('en-IN'),
      m.productName,
      m.quantity.toString(),
      m.referenceId || m.remarks || "-",
      m.performedBy || "Admin"
    ]);
    generateBulkReportPDF(`${activeTab} Data Sheet`, columns, rows, orgId);
  };

  const exportStockPDF = () => {
    const columns = ["Product Name", "SKU", "Available Stock", "Last Updated"];
    const rows = filteredStock.map(p => [
      p.name,
      p.sku || "-",
      (p.warehouseStock || 0).toString(),
      p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleDateString('en-IN') : "-"
    ]);
    generateBulkReportPDF("Current Active Stock Data Sheet", columns, rows, orgId);
  };

  if (loading) return <div style={{ padding: 40, color: "#64748b" }}>Loading Warehouse Data...</div>;

  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📊 Warehouse Data Sheets</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Interactive drill-down reports for all stock operations.</p>

      {/* ==========================================
          SECTION 1: MOVEMENT DRILL-DOWN
      ========================================== */}
      <div style={card}>
        {/* TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 15 }}>
          <TabButton active={activeTab === "INWARD"} onClick={() => {setActiveTab("INWARD"); setMovPage(1);}} icon="📥" label="Inward Products" color="#10b981" />
          <TabButton active={activeTab === "OUTWARD"} onClick={() => {setActiveTab("OUTWARD"); setMovPage(1);}} icon="📤" label="Outward Products" color="#3b82f6" />
          <TabButton active={activeTab === "RETURN"} onClick={() => {setActiveTab("RETURN"); setMovPage(1);}} icon="🔄" label="Returned Stock" color="#eab308" />
          <TabButton active={activeTab === "EXPIRED_DAMAGED"} onClick={() => {setActiveTab("EXPIRED_DAMAGED"); setMovPage(1);}} icon="⚠️" label="Expired/Damaged" color="#ef4444" />
        </div>

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 15, marginBottom: 15, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={label}>Search Product <input type="text" value={movSearch} onChange={e => {setMovSearch(e.target.value); setMovPage(1);}} style={input} placeholder="Search..." /></label>
          <label style={label}>From Date <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setMovPage(1);}} style={input} /></label>
          <label style={label}>To Date <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setMovPage(1);}} style={input} /></label>
          
          <button onClick={exportMovementsPDF} style={{...btnPrimary, marginLeft: "auto"}}>📄 Export PDF Data Sheet</button>
        </div>

        {/* TABLE */}
        <div style={tableWrapper}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f8fafc", color: "#64748b" }}>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Product Name</th>
                <th style={th}>Qty</th>
                <th style={th}>Ref / Remarks</th>
                <th style={th}>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMovements.map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={td}>{getRecordDate(m).toLocaleDateString('en-IN')}</td>
                  <td style={{...td, fontWeight: "bold"}}>{m.productName}</td>
                  <td style={td}>
                    <span style={{ fontWeight: "bold", color: activeTab==="INWARD" || activeTab==="RETURN" ? "#16a34a" : "#dc2626" }}>
                      {activeTab==="INWARD" || activeTab==="RETURN" ? "+" : "-"}{m.quantity}
                    </span>
                  </td>
                  <td style={{...td, color: "#64748b"}}>{m.referenceId || m.remarks || "-"}</td>
                  <td style={td}>{m.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMovements.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No records found for this filter.</div>}
        </div>

        {/* PAGINATION */}
        <div style={paginationRow}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Showing {paginatedMovements.length} of {filteredMovements.length} records</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={movPage === 1} onClick={() => setMovPage(p => p - 1)} style={btnPage}>Previous</button>
            <button disabled={movPage * ITEMS_PER_PAGE >= filteredMovements.length} onClick={() => setMovPage(p => p + 1)} style={btnPage}>Next</button>
          </div>
        </div>
      </div>

      {/* ==========================================
          SECTION 2: CURRENT STOCK OVERVIEW (RESTORED & SORTED)
      ========================================== */}
      <div style={{ ...card, marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: 15, marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>📦 Current Active Stock</h2>
          <button onClick={exportStockPDF} style={btnPrimary}>📄 Export Stock Sheet</button>
        </div>

        <div style={{ display: "flex", marginBottom: 15 }}>
          <label style={{...label, flex: 1, maxWidth: 300}}>Search Inventory <input type="text" value={stockSearch} onChange={e => {setStockSearch(e.target.value); setStockPage(1);}} style={input} placeholder="Search product..." /></label>
        </div>

        <div style={tableWrapper}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f8fafc", color: "#64748b" }}>
              <tr>
                <th style={th}>Product Name</th>
                <th style={th}>SKU</th>
                <th style={th}>Current Available Qty</th>
                <th style={th}>Last Updated / Received</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStock.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{...td, fontWeight: "bold"}}>{p.name}</td>
                  <td style={{...td, color: "#64748b"}}>{p.sku || "-"}</td>
                  <td style={td}>
                    <span style={{ fontWeight: "bold", padding: "4px 10px", borderRadius: 12, background: (p.warehouseStock||0) > 20 ? "#dcfce7" : "#fee2e2", color: (p.warehouseStock||0) > 20 ? "#166534" : "#991b1b" }}>
                      {p.warehouseStock || 0}
                    </span>
                  </td>
                  <td style={{...td, color: "#64748b"}}>
                    {p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStock.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No products found.</div>}
        </div>

        <div style={paginationRow}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Showing {paginatedStock.length} of {filteredStock.length} products</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={stockPage === 1} onClick={() => setStockPage(p => p - 1)} style={btnPage}>Previous</button>
            <button disabled={stockPage * ITEMS_PER_PAGE >= filteredStock.length} onClick={() => setStockPage(p => p + 1)} style={btnPage}>Next</button>
          </div>
        </div>
      </div>

    </div>
  );
}

// Sub-components & Styles
const TabButton = ({ active, onClick, icon, label, color }) => (
  <button onClick={onClick} style={{
    padding: "10px 16px", borderRadius: 8, fontWeight: "bold", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
    background: active ? `${color}15` : "#f1f5f9",
    color: active ? color : "#64748b",
    border: `1px solid ${active ? color : "transparent"}`,
    transition: "all 0.2s"
  }}>
    <span>{icon}</span> {label}
  </button>
);

const card = { background: "#fff", padding: 25, borderRadius: 12, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const input = { padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
const btnPrimary = { padding: "10px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const tableWrapper = { border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" };
const th = { padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "12px 16px" };
const paginationRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15 };
const btnPage = { padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontWeight: "bold", color: "#475569" };
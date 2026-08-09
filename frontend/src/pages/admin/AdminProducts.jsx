// frontend/src/pages/admin/AdminProducts.jsx
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext"; 
import { generateBulkReportPDF } from "../../utils/pdfGenerator";

export default function AdminProducts() {
  const { user, orgId } = useAdmin(); 
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  
  // Modal State for Stock Adjustment
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [newQty, setNewQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [orgId]);

  // 🟢 Alphanumeric Sorting by SKU
  const filtered = useMemo(() => {
    const txt = search.toLowerCase();
    const list = products.filter(
      (p) => (p.name || "").toLowerCase().includes(txt) || (p.sku || "").toLowerCase().includes(txt)
    );

    return list.sort((a, b) => {
      const skuA = (a.sku || "").toString().toLowerCase();
      const skuB = (b.sku || "").toString().toLowerCase();
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [products, search]);

  // --- EXPORT FUNCTIONS ---
  const exportPDF = () => {
    const cols = ["SKU", "Product Name", "Current Warehouse Stock", "Last Updated"];
    const rows = filtered.map(p => [
      p.sku || "N/A", 
      p.name, 
      (p.warehouseStock || 0).toString(), 
      p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleDateString('en-IN') : "N/A"
    ]);
    generateBulkReportPDF("Warehouse Current Stock Inventory", cols, rows, orgId);
  };

  const exportCSV = () => {
    const header = "SKU,Product Name,Warehouse Stock,Last Updated\n";
    const rows = filtered.map(p => {
      const date = p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleDateString('en-IN') : "N/A";
      return `"${p.sku || 'N/A'}","${p.name}","${p.warehouseStock || 0}","${date}"`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Warehouse_Stock_${orgId}.csv`;
    link.click();
  };

  // --- STOCK ADJUSTMENT LOGIC ---
  function openAdjustModal(product) {
    setAdjustProduct(product);
    setNewQty(product.warehouseStock || 0);
    setAdjustReason("");
  }

  async function handleSaveAdjustment(e) {
    e.preventDefault();
    const finalQty = Number(newQty);
    if (finalQty < 0) return alert("Stock cannot be negative.");
    
    const diff = finalQty - (adjustProduct.warehouseStock || 0);
    if (diff === 0) return setAdjustProduct(null); // No change made

    if (!window.confirm(`Update stock for ${adjustProduct.name} to ${finalQty}?`)) return;

    setSaving(true);
    try {
      // 1. Update Product Stock
      await updateDoc(doc(db, "products", adjustProduct.id), {
        warehouseStock: finalQty,
        updatedAt: serverTimestamp()
      });

      // 2. Silently write an audit log so traceability is maintained
      await addDoc(collection(db, "warehouse_movements"), {
        type: "MANUAL_ADJUSTMENT",
        productId: adjustProduct.id,
        productName: adjustProduct.name,
        quantity: diff, // Will show as +2 or -2
        movementDate: serverTimestamp(),
        purpose: "Stock Correction",
        remarks: adjustReason || "Admin manual stock correction",
        issuedBy: user.email,
        orgId: orgId,
        performedBy: user.email,
        createdAt: serverTimestamp()
      });

      alert("✅ Stock Adjusted Successfully");
      setAdjustProduct(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 15 }}>
        <div>
          <h1 style={{ margin: 0, color: "#1e293b" }}>📦 Current Warehouse Stock</h1>
          <p style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: 14 }}>
            Manage and export your physical inventory. To create or delete products, please use the <b>Master Catalog</b>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
            <button onClick={exportCSV} style={btnSecondary}>📊 Export CSV</button>
            <button onClick={exportPDF} style={btnPrimary}>📄 Export PDF</button>
        </div>
      </div>

      <div style={{ marginBottom: 20, background: "#fff", padding: 15, borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="🔍 Search by SKU or Name..." 
            style={inputStyle} 
        />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ background: "#f8fafc", color: "#64748b" }}>
            <tr>
              <th style={th}>SKU</th>
              <th style={th}>Product Name</th>
              <th style={th}>Physical Stock</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{...td, color: "#0284c7", fontWeight: "bold", fontFamily: "monospace"}}>{p.sku || "-"}</td>
                <td style={{...td, fontWeight: "bold", color: "#1e293b"}}>{p.name}</td>
                <td style={td}>
                  <span style={{ 
                      fontWeight: "bold", padding: "6px 12px", borderRadius: 12, 
                      background: (p.warehouseStock || 0) > 10 ? "#dcfce7" : "#fee2e2", 
                      color: (p.warehouseStock || 0) > 10 ? "#166534" : "#991b1b" 
                  }}>
                    {p.warehouseStock || 0}
                  </span>
                </td>
                <td style={td}>
                  <button onClick={() => openAdjustModal(p)} style={btnEdit}>✏️ Adjust Stock</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                No active products found. Check your Master Catalog.
            </div>
        )}
      </div>

      {/* STOCK ADJUSTMENT MODAL */}
      {adjustProduct && (
        <div style={modalBackdrop}>
           <div style={modalBox}>
              <h3 style={{marginTop: 0, color: "#1e293b"}}>Adjust Inventory Count</h3>
              <p style={{color: "#64748b", margin: "0 0 15px 0"}}>
                  Product: <b>[{adjustProduct.sku}] {adjustProduct.name}</b>
              </p>
              
              <form onSubmit={handleSaveAdjustment}>
                  <div style={{marginBottom: 15}}>
                      <label style={{display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: '#475569'}}>New Actual Stock Count</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={newQty} 
                        onChange={e => setNewQty(e.target.value)} 
                        onFocus={e => e.target.select()}
                        style={{...inputStyle, width: "100%", boxSizing: "border-box", fontSize: 18, fontWeight: "bold"}} 
                        required
                      />
                  </div>

                  <div style={{marginBottom: 20}}>
                      <label style={{display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: '#475569'}}>Reason for Adjustment</label>
                      <input 
                        type="text" 
                        value={adjustReason} 
                        onChange={e => setAdjustReason(e.target.value)} 
                        style={{...inputStyle, width: "100%", boxSizing: "border-box"}} 
                        placeholder="e.g. Found extra box during audit"
                        required
                      />
                  </div>

                  <div style={{display:'flex', gap: 10}}>
                    <button type="button" onClick={() => setAdjustProduct(null)} style={{...btnSecondary, flex: 1}}>Cancel</button>
                    <button type="submit" disabled={saving} style={{...btnPrimary, flex: 1}}>{saving ? "Updating..." : "💾 Save Count"}</button>
                  </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}

// Styles
const inputStyle = { width: "100%", maxWidth: 400, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none" };
const btnPrimary = { padding: "10px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnSecondary = { padding: "10px 16px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnEdit = { padding: "6px 12px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const th = { padding: "15px", textAlign: "left", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: 12 };
const td = { padding: "15px" };
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 16, width: 350, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };
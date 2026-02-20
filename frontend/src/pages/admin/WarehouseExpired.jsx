import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function WarehouseExpired() {
  const { orgId, user } = useAdmin();
  const [products, setProducts] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState("");
  const [dateExpired, setDateExpired] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orgId) loadProducts();
  }, [orgId]);

  async function loadProducts() {
    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    setProducts(list);
  }

  async function handleExpire(e) {
    e.preventDefault();
    if (!selectedProduct || !qty || !dateExpired) return alert("Fill required fields.");

    const targetProduct = products.find(p => p.id === selectedProduct);
    const currentStock = targetProduct.warehouseStock || 0;

    if (Number(qty) > currentStock) return alert(`Only ${currentStock} available in stock.`);
    if (!window.confirm(`Remove ${qty} units of [${targetProduct.sku || 'N/A'}] ${targetProduct.name} as EXPIRED? This cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const movementDate = new Date(dateExpired);

      await addDoc(collection(db, "warehouse_movements"), {
        type: "EXPIRED",
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantity: Number(qty),
        movementDate: Timestamp.fromDate(movementDate),
        remarks: remarks || "Expired in warehouse",
        orgId: orgId,
        performedBy: user.email,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "products", targetProduct.id), {
        warehouseStock: increment(-Number(qty)),
        updatedAt: serverTimestamp()
      });

      alert("✅ Expired stock removed from inventory!");
      setQty(""); setRemarks("");
      loadProducts(); 
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>⚠️ Manual Expiry</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Mark active stock as expired or damaged. This will deduct it from available inventory.</p>

      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={card}>
          <form onSubmit={handleExpire} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <label style={label}>Date Expired / Logged * <input type="date" value={dateExpired} onChange={(e) => setDateExpired(e.target.value)} style={input} required /></label>
            
            {/* 🟢 UPDATED DROPDOWN */}
            <label style={label}>
              Select Active Product *
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={input} required>
                <option value="">-- Choose Item --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={(p.warehouseStock || 0) === 0}>
                    [{p.sku || "N/A"}] {p.name} (Available: {p.warehouseStock || 0})
                  </option>
                ))}
              </select>
            </label>

            <label style={label}>Qty Expired * <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={input} required /></label>
            <label style={label}>Remarks <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} style={input} rows="2" placeholder="e.g. Found expired during audit..." /></label>

            <button type="submit" disabled={loading} style={btnDanger}>{loading ? "Processing..." : "⚠️ Mark as Expired"}</button>
          </form>
        </div>

        <div style={{ ...card, flex: 1, minWidth: 300, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0, color: "#334155" }}>Current Stock</h3>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {/* 🟢 UPDATED LIST */}
            {products.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 14, fontWeight: "500" }}><span style={{color: "#0284c7", fontFamily: "monospace"}}>[{p.sku || "N/A"}]</span> {p.name}</span>
                <span style={{ fontWeight: "bold" }}>{p.warehouseStock || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const card = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0", flex: 1.5 };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: "bold", color: "#475569" };
const input = { padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
const btnDanger = { padding: 16, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
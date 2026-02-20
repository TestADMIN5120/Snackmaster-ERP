import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function WarehouseOutward() {
  const { orgId, user } = useAdmin();
  const [products, setProducts] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState("");
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]); 
  const [purpose, setPurpose] = useState("Manual Adjustment");
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

  async function handleOutward(e) {
    e.preventDefault();
    if (!selectedProduct || !qty || !dateIssued) return alert("Fill required fields.");

    const targetProduct = products.find(p => p.id === selectedProduct);
    const currentStock = targetProduct.warehouseStock || 0;

    if (Number(qty) > currentStock) return alert(`Only ${currentStock} available.`);
    if (!window.confirm(`Deduct ${qty} units of [${targetProduct.sku || 'N/A'}] ${targetProduct.name}?`)) return;
    
    setLoading(true);
    try {
      const movementDate = new Date(dateIssued);

      await addDoc(collection(db, "warehouse_movements"), {
        type: "OUTWARD_MANUAL",
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantity: Number(qty),
        movementDate: Timestamp.fromDate(movementDate), 
        purpose: purpose,
        remarks: remarks || "",
        orgId: orgId,
        performedBy: user.email,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "products", targetProduct.id), {
        warehouseStock: increment(-Number(qty)),
        updatedAt: serverTimestamp()
      });

      alert("✅ Stock deducted!");
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
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📤 Manual Outward Stock</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Manually deduct active stock for transfers, damages, or manual adjustments.</p>
      
      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={card}>
          <form onSubmit={handleOutward} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <label style={label}>Date Issued * <input type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} style={input} required /></label>
            
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

            <label style={label}>Qty * <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={input} required /></label>
            <label style={label}>Purpose *
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={input}>
                <option value="Manual Adjustment">Manual Adjustment</option>
                <option value="Transfer">Transfer</option>
                <option value="Damaged">Damaged</option>
              </select>
            </label>
            <label style={label}>Remarks <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} style={input} rows="2" /></label>

            <button type="submit" disabled={loading} style={btnDanger}>{loading ? "Processing..." : "📤 Deduct Stock"}</button>
          </form>
        </div>

        <div style={{ ...card, flex: 1, minWidth: 300, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0, color: "#334155" }}>Available Stock</h3>
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
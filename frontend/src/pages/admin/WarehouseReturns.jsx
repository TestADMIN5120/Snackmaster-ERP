import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function WarehouseReturns() {
  const { orgId, user } = useAdmin();
  const [products, setProducts] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState("");
  const [dateReturned, setDateReturned] = useState(new Date().toISOString().split('T')[0]);
  const [machineId, setMachineId] = useState("");
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

  async function handleReturn(e) {
    e.preventDefault();
    if (!selectedProduct || !qty || !dateReturned) return alert("Fill required fields.");

    const targetProduct = products.find(p => p.id === selectedProduct);
    if (!window.confirm(`Add ${qty} units of [${targetProduct.sku || 'N/A'}] ${targetProduct.name} back to usable stock?`)) return;
    setLoading(true);

    try {
      const movementDate = new Date(dateReturned);

      await addDoc(collection(db, "warehouse_movements"), {
        type: "RETURN",
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantity: Number(qty),
        movementDate: Timestamp.fromDate(movementDate),
        referenceId: machineId || "N/A",
        remarks: remarks || "Returned from field",
        orgId: orgId,
        performedBy: user.email,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "products", targetProduct.id), {
        warehouseStock: increment(Number(qty)),
        updatedAt: serverTimestamp()
      });

      alert("✅ Returned stock added to warehouse!");
      setQty(""); setRemarks(""); setMachineId("");
      loadProducts(); 
    } catch (err) {
      console.error(err);
      alert("Failed to save return.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>🔄 Manual Returns</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Log usable stock that has been brought back from machines to add it back to inventory.</p>

      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={card}>
          <form onSubmit={handleReturn} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <label style={label}>Date Returned * <input type="date" value={dateReturned} onChange={(e) => setDateReturned(e.target.value)} style={input} required /></label>
            
            {/* 🟢 UPDATED DROPDOWN */}
            <label style={label}>
              Select Active Product *
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={input} required>
                <option value="">-- Choose Item --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>[{p.sku || "N/A"}] {p.name} (Current: {p.warehouseStock || 0})</option>
                ))}
              </select>
            </label>

            <label style={label}>Qty Returned * <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={input} required /></label>
            <label style={label}>From Machine ID (Optional) <input type="text" value={machineId} onChange={(e) => setMachineId(e.target.value)} style={input} placeholder="e.g. SNACK-001" /></label>
            <label style={label}>Reason / Remarks <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} style={input} rows="2" placeholder="e.g. Unsold, machine broken..." /></label>

            <button type="submit" disabled={loading} style={btnWarning}>{loading ? "Processing..." : "🔄 Process Return"}</button>
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
const btnWarning = { padding: 16, background: "#eab308", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
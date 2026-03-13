import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc, increment, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function WarehouseOutward() {
  const { orgId, user } = useAdmin();
  const [products, setProducts] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productSearch, setProductSearch] = useState(""); // 🟢 NEW: Searchable Text
  const [qty, setQty] = useState("");
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]); 
  const [purpose, setPurpose] = useState("Manual Adjustment");
  const [remarks, setRemarks] = useState("");

  const [issuedBy, setIssuedBy] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [destination, setDestination] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orgId) loadProducts();
  }, [orgId]);

  async function loadProducts() {
    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // 🟢 UPDATED: Alphanumeric sorting by SKU
    list.sort((a, b) => {
      const skuA = (a.sku || "").toString().toLowerCase();
      const skuB = (b.sku || "").toString().toLowerCase();
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    setProducts(list);
  }

  // 🟢 Helper for dropdown text
  const getProductLabel = (p) => `[${p.sku || 'N/A'}] ${p.name} (Available: ${p.warehouseStock || 0})`;

  async function handleOutward(e) {
    e.preventDefault();
    if (!selectedProduct || !qty || !dateIssued || !issuedBy || !issuedTo || !destination) {
      return alert("Fill all required fields, including tracking information. Make sure a valid product is selected.");
    }

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
        issuedBy: issuedBy,       
        issuedTo: issuedTo,       
        destination: destination, 
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
      setIssuedBy(""); setIssuedTo(""); setDestination("");
      setSelectedProduct(""); setProductSearch(""); // Clear selection
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
            
            {/* 🟢 Searchable Datalist */}
            <label style={label}>
              Select Active Product (Search by SKU or Name) *
              <input 
                type="text" 
                list="outward-products" 
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  const matched = products.find(p => getProductLabel(p) === e.target.value);
                  setSelectedProduct(matched ? matched.id : "");
                }}
                onFocus={(e) => e.target.select()}
                style={input} 
                required 
                placeholder="Type e.g. SM 101..."
              />
              <datalist id="outward-products">
                {products.map(p => (
                  <option key={p.id} value={getProductLabel(p)} />
                ))}
              </datalist>
            </label>

            <label style={label}>Qty * <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={input} required /></label>
            
            <label style={label}>Purpose *
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={input}>
                <option value="Manual Adjustment">Manual Adjustment</option>
                <option value="Transfer">Transfer</option>
                <option value="Damaged">Damaged</option>
              </select>
            </label>

            <div style={{ padding: 15, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
               <h4 style={{ margin: 0, color: "#334155" }}>Traceability Details</h4>
               <label style={label}>Issued By * <input type="text" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} style={input} required placeholder="Name of person handing over" /></label>
               <label style={label}>Issued To * <input type="text" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} style={input} required placeholder="Name of person receiving" /></label>
               <label style={label}>Destination / For Where * <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} style={input} required placeholder="e.g. Kiosk 3, Floor 2" /></label>
            </div>

            <label style={label}>General Remarks <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} style={input} rows="2" /></label>

            <button type="submit" disabled={loading} style={btnDanger}>{loading ? "Processing..." : "📤 Deduct Stock"}</button>
          </form>
        </div>

        <div style={{ ...card, flex: 1, minWidth: 300, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0, color: "#334155" }}>Available Stock</h3>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
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
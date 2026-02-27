import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, setDoc, increment, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function WarehouseInward() {
  const { orgId, user } = useAdmin();
  const [masterProducts, setMasterProducts] = useState([]);
  
  // Form State
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [batchId, setBatchId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [remarks, setRemarks] = useState("");
  
  // 🟢 NEW MANDATORY TRACEABILITY FIELDS
  const [issuedBy, setIssuedBy] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [destination, setDestination] = useState("");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orgId) loadCatalog();
  }, [orgId]);

  async function loadCatalog() {
    const masterQ = query(collection(db, "master_products"), where("orgId", "==", orgId));
    const masterSnap = await getDocs(masterQ);
    
    const prodQ = query(collection(db, "products"), where("orgId", "==", orgId));
    const prodSnap = await getDocs(prodQ);
    const stockMap = {};
    prodSnap.docs.forEach(d => { stockMap[d.id] = d.data().warehouseStock || 0; });

    const combined = masterSnap.docs.map(d => ({
      id: d.id,
      name: d.data().name,
      sku: d.data().sku || "N/A",
      currentStock: stockMap[d.id] || 0
    }));
    
    combined.sort((a, b) => a.name.localeCompare(b.name));
    setMasterProducts(combined);
  }

  async function handleInward(e) {
    e.preventDefault();
    // 🟢 UPDATED VALIDATION
    if (!selectedProduct || !qty || !dateReceived || !issuedBy || !issuedTo || !destination) {
      return alert("Fill all required fields, including tracking information.");
    }

    const targetProduct = masterProducts.find(p => p.id === selectedProduct);
    if (!window.confirm(`Add ${qty} units of [${targetProduct.sku}] ${targetProduct.name}?`)) return;
    
    setLoading(true);
    try {
      const movementDate = new Date(dateReceived);

      await addDoc(collection(db, "warehouse_movements"), {
        type: "INWARD",
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantity: Number(qty),
        movementDate: Timestamp.fromDate(movementDate), 
        batchId: batchId || "N/A",
        invoiceNumber: invoice || "N/A",
        supplier: supplier || "N/A",
        remarks: remarks || "",
        issuedBy: issuedBy,       // 🟢 SAVING TRACEABILITY
        issuedTo: issuedTo,       // 🟢 SAVING TRACEABILITY
        destination: destination, // 🟢 SAVING TRACEABILITY
        orgId: orgId,
        performedBy: user.email,
        createdAt: serverTimestamp() 
      });

      const productRef = doc(db, "products", targetProduct.id);
      await setDoc(productRef, {
        name: targetProduct.name,
        sku: targetProduct.sku,
        orgId: orgId,
        warehouseStock: increment(Number(qty)),
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("✅ Stock Received!");
      setQty(""); setBatchId(""); setInvoice(""); setSupplier(""); setRemarks("");
      setIssuedBy(""); setIssuedTo(""); setDestination("");
      loadCatalog(); 
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📥 Inward Stock Receipt</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Receive new stock based on the Master Product list.</p>

      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={card}>
          <form onSubmit={handleInward} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <label style={label}>Date Received * <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} style={input} required /></label>
            
            <label style={label}>
              Select Master Product *
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={input} required>
                <option value="">-- Choose from Master Catalog --</option>
                {masterProducts.map(p => (
                  <option key={p.id} value={p.id}>[{p.sku}] {p.name} (Current Stock: {p.currentStock})</option>
                ))}
              </select>
            </label>

            <label style={label}>Quantity Received * <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={input} required /></label>

            <div style={{ display: "flex", gap: 15 }}>
              <label style={{...label, flex: 1}}>Batch / Lot # <input type="text" value={batchId} onChange={(e) => setBatchId(e.target.value)} style={input} /></label>
              <label style={{...label, flex: 1}}>Invoice # <input type="text" value={invoice} onChange={(e) => setInvoice(e.target.value)} style={input} /></label>
            </div>
            
            <label style={label}>Supplier <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} style={input} /></label>

            {/* 🟢 NEW TRACEABILITY FIELDS */}
            <div style={{ padding: 15, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
               <h4 style={{ margin: 0, color: "#334155" }}>Traceability Details</h4>
               <label style={label}>Issued By * <input type="text" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} style={input} required placeholder="Name of person handing over" /></label>
               <label style={label}>Issued To * <input type="text" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} style={input} required placeholder="Name of person receiving" /></label>
               <label style={label}>Destination / For Where * <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} style={input} required placeholder="e.g. Main Warehouse Shelf A" /></label>
            </div>

            <label style={label}>General Remarks <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{...input, resize: "vertical"}} rows="2" /></label>

            <button type="submit" disabled={loading} style={btnPrimary}>{loading ? "Processing..." : "💾 Record Inward"}</button>
          </form>
        </div>

        <div style={{ ...card, flex: 1, minWidth: 300, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0, color: "#334155" }}>Quick Stock View</h3>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {masterProducts.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 14, fontWeight: "500" }}><span style={{color: "#0284c7", fontFamily: "monospace"}}>[{p.sku}]</span> {p.name}</span>
                <span style={{ fontWeight: "bold", color: p.currentStock > 20 ? "#10b981" : "#ef4444" }}>{p.currentStock}</span>
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
const btnPrimary = { padding: 16, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
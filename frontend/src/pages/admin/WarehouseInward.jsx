import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, setDoc, increment, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function WarehouseInward() {
  const { orgId, user } = useAdmin();
  const [masterProducts, setMasterProducts] = useState([]);
  
  // Form State
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productSearch, setProductSearch] = useState(""); // 🟢 NEW: State for searchable dropdown
  const [qty, setQty] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [batchId, setBatchId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [remarks, setRemarks] = useState("");
  
  // Barcode and Expiry State
  const [barcodeInput, setBarcodeInput] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // TRACEABILITY FIELDS
  const [issuedBy, setIssuedBy] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [destination, setDestination] = useState("");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orgId) loadCatalog();
  }, [orgId]);

  // Auto-Calculate Expiry Date whenever Product or Received Date changes
  useEffect(() => {
    if (selectedProduct && dateReceived) {
      const p = masterProducts.find(x => x.id === selectedProduct);
      if (p && p.shelfLifeDays > 0) {
        const d = new Date(dateReceived);
        d.setDate(d.getDate() + p.shelfLifeDays);
        setExpiryDate(d.toISOString().split('T')[0]);
      } else {
        setExpiryDate(""); 
      }
    }
  }, [selectedProduct, dateReceived, masterProducts]);

  async function loadCatalog() {
    const masterQ = query(collection(db, "master_products"), where("orgId", "==", orgId));
    const masterSnap = await getDocs(masterQ);
    
    const prodQ = query(collection(db, "products"), where("orgId", "==", orgId));
    const prodSnap = await getDocs(prodQ);
    const stockMap = {};
    prodSnap.docs.forEach(d => { stockMap[d.id] = d.data().warehouseStock || 0; });

    // 🟢 UPDATED: Filter out inactive products
    const combined = masterSnap.docs
      .filter(d => d.data().isActive !== false) 
      .map(d => ({
        id: d.id,
        name: d.data().name,
        sku: d.data().sku || "N/A",
        barcode: d.data().barcode || "",          
        shelfLifeDays: d.data().shelfLifeDays || 0, 
        currentStock: stockMap[d.id] || 0
      }));
    
    // 🟢 UPDATED: Alphanumeric sorting by SKU
    combined.sort((a, b) => {
      const skuA = (a.sku || "").toString().toLowerCase();
      const skuB = (b.sku || "").toString().toLowerCase();
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    });

    setMasterProducts(combined);
  }

  // 🟢 NEW: Helper function to display product labels
  const getProductLabel = (p) => `[${p.sku}] ${p.name}`;

  // Handle Barcode Scanner Input
  function handleBarcodeKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault(); 
      const scannedCode = barcodeInput.trim();
      if (!scannedCode) return;

      const foundProduct = masterProducts.find(p => p.barcode === scannedCode);
      if (foundProduct) {
        setSelectedProduct(foundProduct.id);
        setProductSearch(getProductLabel(foundProduct)); // Update searchable text box too
        setBarcodeInput(""); 
      } else {
        alert("Barcode not found in Active Master Catalog. Please select manually or update Master Data.");
      }
    }
  }

  async function handleInward(e) {
    e.preventDefault();
    if (!selectedProduct || !qty || !dateReceived || !issuedBy || !issuedTo || !destination) {
      return alert("Fill all required fields, including tracking information. Make sure you selected a valid product from the dropdown.");
    }

    const targetProduct = masterProducts.find(p => p.id === selectedProduct);
    if (!window.confirm(`Add ${qty} units of [${targetProduct.sku}] ${targetProduct.name}?`)) return;
    
    setLoading(true);
    try {
      const movementDate = new Date(dateReceived);
      const expDate = expiryDate ? new Date(expiryDate) : null;

      await addDoc(collection(db, "warehouse_movements"), {
        type: "INWARD",
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantity: Number(qty),
        movementDate: Timestamp.fromDate(movementDate), 
        expiryDate: expDate ? Timestamp.fromDate(expDate) : null,
        batchId: batchId || "N/A",
        invoiceNumber: invoice || "N/A",
        supplier: supplier || "N/A",
        remarks: remarks || "",
        issuedBy: issuedBy,       
        issuedTo: issuedTo,       
        destination: destination, 
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
      setIssuedBy(""); setIssuedTo(""); setDestination(""); setExpiryDate("");
      setSelectedProduct(""); 
      setProductSearch(""); // Clear Search
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
      <p style={{ color: "#64748b", marginBottom: 30 }}>Receive new stock based on the Active Master Product list.</p>

      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={card}>
          <form onSubmit={handleInward} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            
            <div style={{ background: "#f0f9ff", padding: 15, borderRadius: 8, border: "1px dashed #0284c7" }}>
              <label style={{...label, color: "#0369a1"}}>
                📷 Scan Barcode to Auto-Select (Optional)
                <input 
                  type="text" 
                  value={barcodeInput} 
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  style={{...input, borderColor: "#bae6fd"}} 
                  placeholder="Click here and scan barcode..." 
                />
              </label>
            </div>

            <label style={label}>Date Received * <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} style={input} required /></label>
            
            {/* 🟢 UPDATED: Searchable Datalist Dropdown */}
            <label style={label}>
              Select Master Product (Search by SKU or Name) *
              <input 
                type="text" 
                list="inward-products" 
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  const matched = masterProducts.find(p => getProductLabel(p) === e.target.value);
                  setSelectedProduct(matched ? matched.id : "");
                }}
                onFocus={(e) => e.target.select()}
                style={input} 
                required 
                placeholder="Type e.g. SM 101 or Lays..."
              />
              <datalist id="inward-products">
                {masterProducts.map(p => (
                  <option key={p.id} value={getProductLabel(p)} />
                ))}
              </datalist>
            </label>

            <div style={{ display: "flex", gap: 15 }}>
              <label style={{...label, flex: 1}}>Quantity Received * <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={input} required /></label>
              
              <label style={{...label, flex: 1}}>
                Expiration Date {expiryDate ? "✨ (Auto)" : ""}
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={input} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 15 }}>
              <label style={{...label, flex: 1}}>Batch / Lot # <input type="text" value={batchId} onChange={(e) => setBatchId(e.target.value)} style={input} /></label>
              <label style={{...label, flex: 1}}>Invoice # <input type="text" value={invoice} onChange={(e) => setInvoice(e.target.value)} style={input} /></label>
            </div>
            
            <label style={label}>Supplier <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} style={input} /></label>

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
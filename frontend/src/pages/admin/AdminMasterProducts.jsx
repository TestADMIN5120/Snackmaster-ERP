import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminMasterProducts() {
  const { orgId } = useAdmin();
  const [masterList, setMasterList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State (Original Fields)
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [mrp, setMrp] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [unitSize, setUnitSize] = useState("");
  const [margin, setMargin] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [costWithGst, setCostWithGst] = useState("");
  const [costWithoutGst, setCostWithoutGst] = useState("");

  // 🟢 NEW: Barcode & Expiry Fields (Optional)
  const [barcode, setBarcode] = useState("");
  const [shelfLifeDays, setShelfLifeDays] = useState("");

  useEffect(() => {
    if (orgId) loadMasterProducts();
  }, [orgId]);

  async function loadMasterProducts() {
    setLoading(true);
    try {
      const q = query(collection(db, "master_products"), where("orgId", "==", orgId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setMasterList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 🟢 NEW: Helper to strictly prevent negative values in inputs
  const handlePositiveNumber = (setter) => (e) => {
    const val = e.target.value;
    if (val === "" || Number(val) >= 0) {
      setter(val);
    }
  };

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return alert("Product Name and SKU are required.");

    try {
      await addDoc(collection(db, "master_products"), {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim() || "General",
        brand: brand.trim() || "N/A",
        unitSize: unitSize.trim() || "N/A",
        
        // Ensure no negative values reach the database
        mrp: Math.max(0, Number(mrp) || 0),
        marginPercent: Math.max(0, Number(margin) || 0),
        gstRatePercent: Math.max(0, Number(gstRate) || 0),
        costWithGst: Math.max(0, Number(costWithGst) || 0),
        costWithoutGst: Math.max(0, Number(costWithoutGst) || 0),
        
        // 🟢 NEW: Save optional barcode and shelf life data
        barcode: barcode.trim() || "",
        shelfLifeDays: Math.max(0, Number(shelfLifeDays) || 0),

        orgId: orgId,
        createdAt: serverTimestamp()
      });
      
      // Reset form
      setSku(""); setName(""); setMrp(""); setCategory(""); setBrand(""); 
      setUnitSize(""); setMargin(""); setGstRate(""); setCostWithGst(""); setCostWithoutGst("");
      setBarcode(""); setShelfLifeDays("");
      
      loadMasterProducts();
      alert("✅ Added to Master Catalog");
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this from Master Catalog? (This won't delete existing physical stock)")) return;
    try {
      await deleteDoc(doc(db, "master_products", id));
      loadMasterProducts();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📖 Master Product Data</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Define your core financial and catalog attributes. This data populates everywhere else.</p>

      {/* ADD FORM GRID */}
      <div style={{ ...card, marginBottom: 30 }}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Add New Item to Master Data</h3>
        <form onSubmit={handleAdd}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15, marginBottom: 20 }}>
            {/* Essential Fields */}
            <label style={label}>Product ID / SKU * <input type="text" value={sku} onChange={e=>setSku(e.target.value)} style={input} required placeholder="e.g. LAYS-001" /></label>
            <label style={label}>Product Name * <input type="text" value={name} onChange={e=>setName(e.target.value)} style={input} required placeholder="e.g. Lays Classic 50g" /></label>
            <label style={label}>Category <input type="text" value={category} onChange={e=>setCategory(e.target.value)} style={input} placeholder="Chips" /></label>
            <label style={label}>Brand Name <input type="text" value={brand} onChange={e=>setBrand(e.target.value)} style={input} placeholder="Frito-Lay" /></label>
            <label style={label}>Unit Size (GMs/ML) <input type="text" value={unitSize} onChange={e=>setUnitSize(e.target.value)} style={input} placeholder="50g" /></label>
            
            {/* 🟢 UPDATED: Financial fields blocking negative values */}
            <label style={label}>Selling Price (MRP) ₹ <input type="number" step="0.01" min="0" value={mrp} onChange={handlePositiveNumber(setMrp)} style={input} placeholder="20.00" /></label>
            <label style={label}>Cost Price (+GST) ₹ <input type="number" step="0.01" min="0" value={costWithGst} onChange={handlePositiveNumber(setCostWithGst)} style={input} placeholder="15.00" /></label>
            <label style={label}>Cost Price (W/O GST) ₹ <input type="number" step="0.01" min="0" value={costWithoutGst} onChange={handlePositiveNumber(setCostWithoutGst)} style={input} placeholder="13.50" /></label>
            <label style={label}>GST Rate (%) <input type="number" step="0.01" min="0" value={gstRate} onChange={handlePositiveNumber(setGstRate)} style={input} placeholder="12" /></label>
            <label style={label}>Margin (%) <input type="number" step="0.01" min="0" value={margin} onChange={handlePositiveNumber(setMargin)} style={input} placeholder="25" /></label>
          </div>

          {/* 🟢 NEW: Barcode & Shelf Life Option Block */}
          <div style={{ background: "#f8fafc", padding: 15, borderRadius: 8, border: "1px dashed #cbd5e1", marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#3b82f6" }}>📷 Optional: Expiration & Barcode Tracking</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
              <label style={label}>
                Product Barcode / UPC
                <input type="text" value={barcode} onChange={e=>setBarcode(e.target.value)} style={input} placeholder="Scan or type barcode" />
              </label>
              <label style={label}>
                Standard Shelf Life (Days)
                <input type="number" min="0" value={shelfLifeDays} onChange={handlePositiveNumber(setShelfLifeDays)} style={input} placeholder="e.g. 180" />
              </label>
            </div>
          </div>

          <button type="submit" style={btnPrimary}>+ Save to Master List</button>
        </form>
      </div>

      {/* LIST TABLE */}
      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 15 }}>Master Catalog List</h3>
        {loading ? <p>Loading...</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", color: "#64748b" }}>
                  <th style={th}>SKU & Barcode</th>
                  <th style={th}>Product Name</th>
                  <th style={th}>Category / Brand</th>
                  <th style={th}>MRP ₹</th>
                  <th style={th}>Cost (+GST) ₹</th>
                  <th style={th}>Shelf Life</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {masterList.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{...td, fontFamily: "monospace"}}>
                      <div style={{color: "#0284c7", fontWeight: "bold"}}>{p.sku}</div>
                      {p.barcode && <div style={{fontSize: 11, color: "#64748b"}}>BC: {p.barcode}</div>}
                    </td>
                    <td style={{...td, fontWeight: "bold"}}>{p.name} <span style={{fontSize: 11, color: "#94a3b8", marginLeft: 5}}>({p.unitSize})</span></td>
                    <td style={td}>{p.category} <br/><span style={{fontSize: 11, color: "#64748b"}}>{p.brand}</span></td>
                    <td style={{...td, fontWeight: "bold", color: "#16a34a"}}>{p.mrp}</td>
                    <td style={td}>{p.costWithGst}</td>
                    
                    {/* 🟢 NEW: Display Shelf Life if available */}
                    <td style={td}>
                      {p.shelfLifeDays ? <span style={{background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold"}}>{p.shelfLifeDays} Days</span> : <span style={{color: "#cbd5e1"}}>N/A</span>}
                    </td>

                    <td style={td}>
                      <button onClick={() => handleDelete(p.id)} style={btnDangerGhost}>Del</button>
                    </td>
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
const card = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none", fontSize: 14, background: "#f8fafc" };
const btnPrimary = { padding: "14px 20px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnDangerGhost = { padding: "6px 12px", background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const th = { padding: "12px", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "12px" };
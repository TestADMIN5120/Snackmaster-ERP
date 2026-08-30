import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminMasterProducts() {
  const { orgId } = useAdmin();
  const [masterList, setMasterList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);

  // Form State
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
  const [hsnCode, setHsnCode] = useState("");
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
      
      list.sort((a, b) => {
        const skuA = a.sku || "";
        const skuB = b.sku || "";
        return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
      });
      
      setMasterList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handlePositiveNumber = (setter) => (e) => {
    const val = e.target.value;
    if (val === "" || Number(val) >= 0) {
      setter(val);
    }
  };

  function resetForm() {
    setEditingId(null);
    setSku(""); setName(""); setMrp(""); setCategory(""); setBrand("");
    setUnitSize(""); setMargin(""); setGstRate(""); setHsnCode(""); setCostWithGst(""); setCostWithoutGst("");
    setBarcode(""); setShelfLifeDays("");
  }

  function handleEditClick(product) {
    setEditingId(product.id);
    setSku(product.sku || "");
    setName(product.name || "");
    setMrp(product.mrp || "");
    setCategory(product.category || "");
    setBrand(product.brand || "");
    setUnitSize(product.unitSize || "");
    setMargin(product.marginPercent || "");
    setGstRate(product.gstRatePercent || "");
    setHsnCode(product.hsnCode || "");
    setCostWithGst(product.costWithGst || "");
    setCostWithoutGst(product.costWithoutGst || "");
    setBarcode(product.barcode || "");
    setShelfLifeDays(product.shelfLifeDays || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 🟢 UPDATED: Toggle Status and instantly sync to Active Products Collection
  async function handleToggleActive(product) {
    const newStatus = product.isActive === false ? true : false; 
    if (!window.confirm(`Mark this product as ${newStatus ? 'ACTIVE' : 'INACTIVE'}?`)) return;
    
    try {
      // 1. Update Master Catalog
      await updateDoc(doc(db, "master_products", product.id), {
        isActive: newStatus,
        updatedAt: serverTimestamp()
      });

      // 2. Sync to Active Products Database
      if (newStatus === true) {
          // Add back to active products
          await setDoc(doc(db, "products", product.id), {
              name: product.name,
              sku: product.sku,
              orgId: orgId,
              updatedAt: serverTimestamp()
          }, { merge: true }); // Merge keeps existing warehouseStock if it was previously 0
      } else {
          // Remove from active products
          await deleteDoc(doc(db, "products", product.id));
      }

      loadMasterProducts();
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return alert("Product Name and SKU are required.");

    const cleanSku = sku.trim();
    const isDuplicate = masterList.some(p => p.sku.toLowerCase() === cleanSku.toLowerCase() && p.id !== editingId);
    if (isDuplicate) {
        return alert(`Duplicate Error: The SKU "${cleanSku}" is already used by another product. Each product must have a unique SKU.`);
    }

    try {
      const payload = {
        sku: cleanSku,
        name: name.trim(),
        category: category.trim() || "General",
        brand: brand.trim() || "N/A",
        unitSize: unitSize.trim() || "N/A",
        mrp: Math.max(0, Number(mrp) || 0),
        marginPercent: Math.max(0, Number(margin) || 0),
        gstRatePercent: Math.max(0, Number(gstRate) || 0),
        hsnCode: hsnCode.trim() || "",
        costWithGst: Math.max(0, Number(costWithGst) || 0),
        costWithoutGst: Math.max(0, Number(costWithoutGst) || 0),
        barcode: barcode.trim() || "",
        shelfLifeDays: Math.max(0, Number(shelfLifeDays) || 0),
        orgId: orgId,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
          // 1. Update Master
          await updateDoc(doc(db, "master_products", editingId), payload);
          
          // 2. Sync Name/SKU changes to Active Products (if it is currently active)
          const existingProd = masterList.find(p => p.id === editingId);
          if (existingProd && existingProd.isActive !== false) {
              await setDoc(doc(db, "products", editingId), {
                  name: payload.name,
                  sku: payload.sku,
                  updatedAt: serverTimestamp()
              }, { merge: true });
          }
          alert("✅ Product Updated Successfully");
      } else {
          // 1. Create New Master
          payload.createdAt = serverTimestamp();
          payload.isActive = true; 
          const docRef = await addDoc(collection(db, "master_products"), payload);
          
          // 2. Push to Active Products automatically
          await setDoc(doc(db, "products", docRef.id), {
              name: payload.name,
              sku: payload.sku,
              orgId: orgId,
              warehouseStock: 0,
              createdAt: serverTimestamp()
          });
          alert("✅ Added to Master Catalog & Active List");
      }
      
      resetForm();
      loadMasterProducts();
    } catch (err) {
      console.error(err);
      alert("Failed to save product.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this from Master Catalog? This will completely remove it from the Active Products list too.")) return;
    try {
      await deleteDoc(doc(db, "master_products", id));
      await deleteDoc(doc(db, "products", id)); // Clean up from active products
      loadMasterProducts();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📖 Master Product Data</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Define your core financial and catalog attributes. This data populates everywhere else.</p>

      <div style={{ ...card, marginBottom: 30, border: editingId ? "2px solid #3b82f6" : "1px solid #e2e8f0" }}>
        <h3 style={{ marginTop: 0, marginBottom: 20, color: editingId ? "#1d4ed8" : "#1e293b" }}>
            {editingId ? "✏️ Edit Product Data" : "➕ Add New Item to Master Data"}
        </h3>
        
        <form onSubmit={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15, marginBottom: 20 }}>
            <label style={label}>Product ID / SKU * <input type="text" value={sku} onChange={e=>setSku(e.target.value)} style={input} required placeholder="e.g. LAYS-001" /></label>
            <label style={label}>Product Name * <input type="text" value={name} onChange={e=>setName(e.target.value)} style={input} required placeholder="e.g. Lays Classic 50g" /></label>
            <label style={label}>Category <input type="text" value={category} onChange={e=>setCategory(e.target.value)} style={input} placeholder="Chips" /></label>
            <label style={label}>Brand Name <input type="text" value={brand} onChange={e=>setBrand(e.target.value)} style={input} placeholder="Frito-Lay" /></label>
            <label style={label}>Unit Size (GMs/ML) <input type="text" value={unitSize} onChange={e=>setUnitSize(e.target.value)} style={input} placeholder="50g" /></label>
            
            <label style={label}>Selling Price (MRP) ₹ <input type="number" step="0.01" min="0" value={mrp} onChange={handlePositiveNumber(setMrp)} style={input} placeholder="20.00" /></label>
            <label style={label}>Cost Price (+GST) ₹ <input type="number" step="0.01" min="0" value={costWithGst} onChange={handlePositiveNumber(setCostWithGst)} style={input} placeholder="15.00" /></label>
            <label style={label}>Cost Price (W/O GST) ₹ <input type="number" step="0.01" min="0" value={costWithoutGst} onChange={handlePositiveNumber(setCostWithoutGst)} style={input} placeholder="13.50" /></label>
            <label style={label}>GST Rate (%) <input type="number" step="0.01" min="0" value={gstRate} onChange={handlePositiveNumber(setGstRate)} style={input} placeholder="12" /></label>
            <label style={label}>HSN / SAC Code <input type="text" value={hsnCode} onChange={e=>setHsnCode(e.target.value)} style={input} placeholder="e.g. 21069099" /></label>
            <label style={label}>Margin (%) <input type="number" step="0.01" min="0" value={margin} onChange={handlePositiveNumber(setMargin)} style={input} placeholder="25" /></label>
          </div>

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

          <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={editingId ? btnPrimaryEdit : btnPrimary}>
                  {editingId ? "💾 Update Product" : "+ Save to Master List"}
              </button>
              {editingId && (
                  <button type="button" onClick={resetForm} style={btnCancel}>Cancel Edit</button>
              )}
          </div>
        </form>
      </div>

      {/* LIST TABLE */}
      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 15 }}>Master Catalog List</h3>
        {loading ? <p>Loading...</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", color: "#64748b" }}>
                  <th style={th}>SKU & Barcode</th>
                  <th style={th}>Product Name</th>
                  <th style={th}>Status</th> 
                  <th style={th}>MRP ₹</th>
                  <th style={th}>Cost (+GST) ₹</th>
                  <th style={th}>GST %</th>
                  <th style={th}>HSN Code</th>
                  <th style={th}>Shelf Life</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterList.map(p => {
                  const isActive = p.isActive !== false; // True by default
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", background: editingId === p.id ? "#eff6ff" : (isActive ? "transparent" : "#fef2f2") }}>
                      <td style={{...td, fontFamily: "monospace"}}>
                        <div style={{color: "#0284c7", fontWeight: "bold", textDecoration: isActive ? "none" : "line-through"}}>{p.sku}</div>
                        {p.barcode && <div style={{fontSize: 11, color: "#64748b"}}>BC: {p.barcode}</div>}
                      </td>
                      <td style={{...td, fontWeight: "bold", color: isActive ? "#0f172a" : "#94a3b8"}}>{p.name} <span style={{fontSize: 11, color: "#94a3b8", marginLeft: 5}}>({p.unitSize})</span></td>
                      
                      <td style={td}>
                        <span style={{
                            padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: "bold",
                            background: isActive ? "#dcfce7" : "#fee2e2",
                            color: isActive ? "#166534" : "#991b1b"
                        }}>
                            {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td style={{...td, fontWeight: "bold", color: isActive ? "#16a34a" : "#94a3b8"}}>{p.mrp}</td>
                      <td style={{...td, color: isActive ? "#0f172a" : "#94a3b8"}}>{p.costWithGst}</td>
                      <td style={{...td, color: isActive ? "#0f172a" : "#94a3b8"}}>{p.gstRatePercent ? `${p.gstRatePercent}%` : "-"}</td>
                      <td style={{...td, fontFamily: "monospace", color: isActive ? "#0f172a" : "#94a3b8"}}>{p.hsnCode || "-"}</td>
                      <td style={td}>
                        {p.shelfLifeDays ? <span style={{background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: "bold"}}>{p.shelfLifeDays} Days</span> : <span style={{color: "#cbd5e1"}}>N/A</span>}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => handleEditClick(p)} style={btnEditGhost}>Edit</button>
                            
                            {/* 🟢 NEW: Toggle Button passes the whole product object */}
                            <button onClick={() => handleToggleActive(p)} style={isActive ? btnWarningGhost : btnSuccessGhost}>
                                {isActive ? "Deactivate" : "Activate"}
                            </button>
                            
                            <button onClick={() => handleDelete(p.id)} style={btnDangerGhost}>Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
const btnPrimaryEdit = { padding: "14px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnCancel = { padding: "14px 20px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnDangerGhost = { padding: "6px 12px", background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const btnEditGhost = { padding: "6px 12px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const btnWarningGhost = { padding: "6px 12px", background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const btnSuccessGhost = { padding: "6px 12px", background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const th = { padding: "12px", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "12px" };
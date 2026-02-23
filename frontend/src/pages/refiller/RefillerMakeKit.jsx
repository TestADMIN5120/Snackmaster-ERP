import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { doc, onSnapshot, setDoc, updateDoc, collection, query, where, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useParams, useNavigate } from "react-router-dom";

export default function RefillerMakeKit() {
  const { machineId } = useParams();
  const { user, orgId } = useAdmin();
  const navigate = useNavigate();

  const [machine, setMachine] = useState(null);
  const [catalog, setCatalog] = useState([]); // Warehouse stock
  const [masterCatalog, setMasterCatalog] = useState([]); // Full catalog for swapping
  const [slots, setSlots] = useState([]); 
  const [calculated, setCalculated] = useState([]); 
  
  const [masterData, setMasterData] = useState([]); 
  const [salesData, setSalesData] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState("csv"); 

  const [selectedSlotForAdd, setSelectedSlotForAdd] = useState(null);
  const [manualQty, setManualQty] = useState(1);

  useEffect(() => {
    if (!orgId || !machineId) return;

    // Real-time listeners
    const unsubMachine = onSnapshot(doc(db, "machines", machineId), (d) => {
      if (d.exists()) setMachine({ id: d.id, ...d.data() });
    });

    const unsubSlots = onSnapshot(collection(db, "machines", machineId, "slots"), (snap) => {
      setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubProd = onSnapshot(query(collection(db, "products"), where("orgId", "==", orgId)), (snap) => {
      setCatalog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const fetchMaster = async () => {
        const qMaster = query(collection(db, "master_products"), where("orgId", "==", orgId));
        const snap = await getDocs(qMaster);
        setMasterCatalog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchMaster();

    return () => { unsubMachine(); unsubSlots(); unsubProd(); };
  }, [machineId, orgId]);

  // --- CSV PARSING ---
  function parseCSV(file, setter) {
    if(!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => setter(results.data),
    });
  }

  // ⚡ MODE 1: CSV Auto-Engine (Slot-to-Product Mapping)
  function calculateCSVKit() {
    if (masterData.length === 0 || salesData.length === 0) return alert("Upload both CSVs.");
    const salesCounts = {}; 
    salesData.forEach(row => {
      const slotVal = row["Selection"] || row["Slot"] || row["slot"] || row["selection"];
      if (slotVal) salesCounts[slotVal] = (salesCounts[slotVal] || 0) + 1;
    });

    const output = [];
    masterData.forEach(row => {
      const slotId = row["slot"] || row["Slot"]; 
      const soldCount = salesCounts[slotId] || 0;
      if (soldCount > 0) {
        const csvName = row["name"] || row["Name"] || "Unknown";
        const catProd = catalog.find(p => p.name.toLowerCase().trim() === csvName.toLowerCase().trim());
        output.push({
          slotId, 
          name: catProd ? `[${catProd.sku || 'N/A'}] ${catProd.name}` : csvName,
          requiredQty: soldCount,
          productId: catProd?.id || null,
          sku: catProd?.sku || null, 
          stockAvailable: catProd?.warehouseStock || 0,
          status: (catProd?.warehouseStock || 0) < soldCount ? "SHORTAGE" : "OK", 
          swapped: false
        });
      }
    });
    setCalculated(output);
  }

  // 📊 MODE 2: Bulk Sales Summary
  function calculateBulkSalesKit() {
    if (salesData.length === 0) return alert("Please upload Sales CSV.");
    const summary = {};
    salesData.forEach(row => {
        const pName = row["Product"] || row["Name"] || row["name"] || row["Item"];
        if (pName) summary[pName] = (summary[pName] || 0) + 1;
    });

    const output = Object.entries(summary).map(([name, qty]) => {
        const catProd = catalog.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
        return {
            slotId: "Bulk", 
            name: catProd ? `[${catProd.sku || 'N/A'}] ${catProd.name}` : name,
            requiredQty: qty,
            productId: catProd?.id || null,
            sku: catProd?.sku || null, 
            stockAvailable: catProd?.warehouseStock || 0,
            status: (catProd?.warehouseStock || 0) < qty ? "SHORTAGE" : "OK", 
            swapped: false
        };
    });
    setCalculated(output);
  }

  // 📋 MODE 3: Manual Mirror Mode Helpers
  const trays = Array.from(new Set(slots.map(s => s.tray))).sort((a, b) => a - b);
  const slotsForTray = (t) => slots.filter(s => s.tray === t && !s.merged_into).sort((a,b) => a.slot_number - b.slot_number);
  const getCode = (root) => {
    const group = [root, ...slots.filter(s => s.merged_into === root.id)];
    const codes = group.map(s => 110 + (s.tray-1)*10 + s.slot_number);
    return group.length === 1 ? String(codes[0]) : `${Math.min(...codes)}-${Math.max(...codes)}`;
  };

  const handleManualAdd = () => {
    const catProd = catalog.find(p => p.id === selectedSlotForAdd.product_id);
    const newItem = {
      slotId: getCode(selectedSlotForAdd),
      name: selectedSlotForAdd.product_name || "Empty",
      requiredQty: Number(manualQty),
      productId: selectedSlotForAdd.product_id,
      sku: catProd?.sku || "N/A",
      stockAvailable: catProd?.warehouseStock || 0,
      status: (catProd?.warehouseStock || 0) < Number(manualQty) ? "SHORTAGE" : "OK",
      swapped: false
    };
    setCalculated(prev => [...prev, newItem]);
    setSelectedSlotForAdd(null);
  };

  // --- UNIVERSAL SWAP & QTY EDIT LOGIC ---
  function handleSwapItem(index, masterProdId) {
    const target = masterCatalog.find(p => p.id === masterProdId);
    const warehouseStock = catalog.find(p => p.name.toLowerCase() === target.name.toLowerCase())?.warehouseStock || 0;
    setCalculated(prev => {
        const updated = [...prev];
        updated[index] = {
            ...updated[index],
            productId: target.id,
            name: `[${target.sku}] ${target.name}`,
            sku: target.sku,
            stockAvailable: warehouseStock,
            status: warehouseStock < updated[index].requiredQty ? "SHORTAGE" : "OK",
            swapped: true
        };
        return updated;
    });
  }

  // 🟢 NEW: Logic to edit quantity of calculated rows
  function handleUpdateQty(index, newQty) {
    const val = Number(newQty);
    setCalculated(prev => {
        const updated = [...prev];
        updated[index] = {
            ...updated[index],
            requiredQty: val,
            status: updated[index].stockAvailable < val ? "SHORTAGE" : "OK"
        };
        return updated;
    });
  }

  async function saveKit() {
    if (!calculated.length) return alert("Pack list is empty.");
    if (calculated.some(i => i.status === "SHORTAGE")) return alert("Please resolve shortages or reduce quantity to match warehouse stock.");
    try {
      const kitRef = doc(collection(db, "kits"));
      await setDoc(kitRef, {
        machineId, orgId, refillerId: user.uid, refillerEmail: user.email,
        products: calculated, status: "prepared", createdAt: serverTimestamp(), type: activeMode
      });
      await updateDoc(doc(db, "machines", machineId), { activeKitId: kitRef.id, kitStatus: "prepared" });
      alert("✅ Kit saved and sent for Admin approval!");
      navigate(`/refiller/machines/${machineId}`);
    } catch (e) { alert("Error saving kit."); }
  }

  if (loading) return <div style={{padding: 20}}>Loading machine layout...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <button onClick={() => navigate(-1)} style={btnBack}>← Back</button>
      <h2 style={{marginTop: 0, color: "#1e293b"}}>📦 Prepare Refill Kit</h2>

      <div style={modeTabs}>
        <button onClick={() => setActiveMode("csv")} style={activeMode === "csv" ? activeTab : tab}>⚡ CSV Auto-Engine</button>
        <button onClick={() => setActiveMode("bulk_sales")} style={activeMode === "bulk_sales" ? activeTab : tab}>📊 Bulk Sales Summary</button>
        <button onClick={() => setActiveMode("manual")} style={activeMode === "manual" ? activeTab : tab}>📋 Manual Mirror</button>
      </div>

      <div style={card}>
        {activeMode === "csv" && (
            <>
                <div style={csvUploadGrid}>
                    <div style={uploadBox}><label style={uploadLabel}>📄 Planogram CSV</label><input type="file" onChange={e => parseCSV(e.target.files[0], setMasterData)} /></div>
                    <div style={uploadBox}><label style={uploadLabel}>📉 Sales Report</label><input type="file" onChange={e => parseCSV(e.target.files[0], setSalesData)} /></div>
                </div>
                <button onClick={calculateCSVKit} style={btnPrimary}>Generate Pack List</button>
            </>
        )}

        {activeMode === "bulk_sales" && (
            <>
                <div style={uploadBox}><label style={uploadLabel}>📉 Upload Sales CSV</label><input type="file" onChange={e => parseCSV(e.target.files[0], setSalesData)} /></div>
                <button onClick={calculateBulkSalesKit} style={{...btnPrimary, marginTop: 15}}>Calculate Total Sales Count</button>
            </>
        )}

        {activeMode === "manual" && (
            <div style={{display:'flex', flexDirection:'column', gap: 12}}>
                {trays.map(t => (
                    <div key={t} style={{display:'flex', gap: 10, alignItems:'center'}}>
                        <div style={{fontWeight:'bold', minWidth: 60, color: '#64748b'}}>Tray {t}</div>
                        <div style={{display:'flex', flexWrap:'wrap', gap: 8}}>
                            {slotsForTray(t).map(s => (
                                <div key={s.id} style={slotPill} onClick={() => setSelectedSlotForAdd(s)}>
                                    <div style={{fontWeight:'bold'}}>{getCode(s)}</div>
                                    <div style={{fontSize: 10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.product_name || "Empty"}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {selectedSlotForAdd && (
        <div style={modalBackdrop}>
           <div style={modalBox}>
              <h3>Add to Kit</h3>
              <p>Slot: <b>{getCode(selectedSlotForAdd)}</b></p>
              <input type="number" value={manualQty} onChange={e => setManualQty(e.target.value)} style={inputStyle} />
              <div style={{display:'flex', gap: 10, marginTop: 20}}>
                <button onClick={() => setSelectedSlotForAdd(null)} style={btnCancel}>Cancel</button>
                <button onClick={handleManualAdd} style={btnPrimary}>Add</button>
              </div>
           </div>
        </div>
      )}

      {calculated.length > 0 && (
        <div style={{...card, marginTop: 20}}>
           <h3 style={{marginTop: 0}}>Refill Basket ({calculated.length} items)</h3>
           <p style={{fontSize: 12, color: '#64748b', marginBottom: 15}}>You can edit quantity for swapped items or shortages.</p>
           
           <table style={{width: '100%', borderCollapse:'collapse', fontSize: 13}}>
              <thead><tr style={{textAlign:'left', background:'#f8fafc'}}><th style={th}>Target</th><th style={th}>Product Item</th><th style={th}>Qty to Pack</th><th style={th}>Wh Stock</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {calculated.map((item, i) => (
                  <tr key={i} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={td}>{item.slotId}</td>
                    <td style={td}>
                        {item.name} 
                        {item.swapped && <div style={{color:'#3b82f6', fontSize: 10, fontWeight:'bold'}}>🔄 Swapped</div>}
                    </td>
                    <td style={td}>
                        {/* 🟢 ENHANCEMENT: Input for quantity editing if swapped or shortage */}
                        <input 
                            type="number" 
                            value={item.requiredQty} 
                            style={item.swapped || item.status === "SHORTAGE" ? editableQtyInput : staticQtyDisplay}
                            onChange={(e) => handleUpdateQty(i, e.target.value)}
                            disabled={!item.swapped && item.status !== "SHORTAGE"}
                        />
                    </td>
                    <td style={{...td, color: item.stockAvailable < item.requiredQty ? '#ef4444' : '#10b981'}}>
                        <b>{item.stockAvailable}</b>
                    </td>
                    <td style={td}>
                        {(item.status === "SHORTAGE" || item.swapped) && (
                             <select style={swapSelect} onChange={(e) => handleSwapItem(i, e.target.value)}>
                                <option value="">🔄 Swap Item</option>
                                {masterCatalog.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>)}
                             </select>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
           <button onClick={saveKit} style={btnSuccess}>💾 Save Kit & Request Admin Approval</button>
        </div>
      )}
    </div>
  );
}

// STYLES
const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", marginBottom: 15, fontWeight: "bold" };
const card = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const modeTabs = { display: "flex", gap: 10, marginBottom: 15 };
const tab = { flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontSize: 12, fontWeight: 'bold' };
const activeTab = { ...tab, background: "#1e293b", color: "#fff" };
const csvUploadGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15 };
const uploadBox = { background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px dashed #ccc' };
const uploadLabel = { fontSize: 11, fontWeight: 'bold', display: 'block', marginBottom: 5 };
const btnPrimary = { width: '100%', padding: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' };
const btnSuccess = { width: '100%', padding: 15, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, marginTop: 20, fontWeight: 'bold', cursor: 'pointer' };
const slotPill = { padding: 8, background: "#f1f5f9", borderRadius: 8, cursor: "pointer", textAlign: 'center', border: "1px solid #e2e8f0", minWidth: 70 };
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 25, borderRadius: 12, width: 300 };
const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", textAlign: 'center' };
const btnCancel = { flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#eee' };
const th = { padding: 10, color: '#64748b' };
const td = { padding: 10 };
const swapSelect = { padding: 4, fontSize: 11, borderRadius: 4, background: '#fff' };

// 🟢 New Qty Input Styles
const editableQtyInput = { width: '50px', padding: '5px', borderRadius: '4px', border: '1px solid #3b82f6', textAlign: 'center', fontWeight: 'bold', background: '#eff6ff' };
const staticQtyDisplay = { width: '50px', border: 'none', background: 'none', textAlign: 'center', fontWeight: 'bold' };
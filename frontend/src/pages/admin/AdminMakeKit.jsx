import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { doc, onSnapshot, setDoc, updateDoc, collection, query, where, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useParams, useNavigate } from "react-router-dom";
import { generateKitPDF } from "../../utils/pdfGenerator";

export default function AdminMakeKit() {
  const { machineId } = useParams();
  const { user, orgId } = useAdmin();
  const navigate = useNavigate();

  const [machine, setMachine] = useState(null);
  const [catalog, setCatalog] = useState([]); 
  const [masterCatalog, setMasterCatalog] = useState([]); 
  const [slots, setSlots] = useState([]); 
  const [calculated, setCalculated] = useState([]); 
  
  const [masterData, setMasterData] = useState([]); 
  const [salesData, setSalesData] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState("csv"); 

  const [selectedSlotForAdd, setSelectedSlotForAdd] = useState(null);
  const [manualQty, setManualQty] = useState(1);
  // 🟢 NEW: Track selected product inside the manual modal
  const [manualSelectedProductId, setManualSelectedProductId] = useState("");

  const [filterStats, setFilterStats] = useState(null);

  useEffect(() => {
    if (!orgId || !machineId) return;

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

  // --- HELPERS ---
  const trays = Array.from(new Set(slots.map(s => s.tray))).sort((a, b) => a - b);
  const slotsForTray = (t) => slots.filter(s => s.tray === t && !s.merged_into).sort((a,b) => a.slot_number - b.slot_number);
  
  const getCode = (root) => {
    if (!root) return "Unknown";
    const group = [root, ...slots.filter(s => s.merged_into === root.id)];
    const codes = group.map(s => 110 + (Number(s.tray)-1)*10 + (Number(s.slot_number)-1));
    return group.length === 1 ? String(codes[0]) : `${Math.min(...codes)}-${Math.max(...codes)}`;
  };

  const findSlotForProduct = (productName) => {
      const match = slots.find(s => s.product_name?.toLowerCase().trim() === productName.toLowerCase().trim() && !s.merged_into);
      return match ? getCode(match) : "Unassigned";
  };

  function parseCSV(file, setter) {
    if(!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => setter(results.data) });
  }

  function parseCSVDate(dateStr) {
      if (!dateStr) return null;
      try {
          const parts = dateStr.split(" ");
          if (parts.length < 2) return new Date(dateStr); 
          
          const dateParts = parts[0].split("/");
          if (dateParts.length !== 3) return new Date(dateStr); 
          
          const timeParts = parts[1].split(":");
          
          const day = parseInt(dateParts[0], 10);
          const monthStr = dateParts[1];
          const year = parseInt(dateParts[2], 10);
          
          const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
          const month = months[monthStr] !== undefined ? months[monthStr] : 0;
          
          const hour = parseInt(timeParts[0] || 0, 10);
          const min = parseInt(timeParts[1] || 0, 10);
          const sec = parseInt(timeParts[2] || 0, 10);
          
          return new Date(year, month, day, hour, min, sec);
      } catch (e) {
          return null;
      }
  }

  function calculateCSVKit() {
    if (masterData.length === 0 || salesData.length === 0) return alert("Upload both CSVs.");
    
    const lastRefillDate = machine?.lastRefillCompletedAt?.toDate() || null;
    let ignored = 0;
    let processed = 0;
    
    const salesCounts = {}; 
    salesData.forEach(row => {
      const rowDateStr = row["Date"] || row["date"] || row["Time"];
      const rowDate = parseCSVDate(rowDateStr);
      
      if (lastRefillDate && rowDate && rowDate <= lastRefillDate) {
          ignored++;
          return; 
      }
      processed++;

      const slotVal = row["Selection"] || row["Slot"] || row["slot"] || row["selection"];
      if (slotVal) salesCounts[slotVal] = (salesCounts[slotVal] || 0) + 1;
    });

    setFilterStats({ ignored, processed, cutoffDate: lastRefillDate });

    const output = [];
    masterData.forEach(row => {
      const slotId = row["slot"] || row["Slot"]; 
      const soldCount = salesCounts[slotId] || 0;
      if (soldCount > 0) {
        const csvName = row["name"] || row["Name"] || "Unknown";
        const catProd = catalog.find(p => p.name.toLowerCase().trim() === csvName.toLowerCase().trim());
        output.push({
          slotId, name: catProd ? `[${catProd.sku || 'N/A'}] ${catProd.name}` : csvName,
          requiredQty: soldCount, productId: catProd?.id || null, sku: catProd?.sku || null, 
          stockAvailable: catProd?.warehouseStock || 0, status: (catProd?.warehouseStock || 0) < soldCount ? "SHORTAGE" : "OK", swapped: false
        });
      }
    });
    setCalculated(output);
  }

  function calculateBulkSalesKit() {
    if (salesData.length === 0) return alert("Please upload Sales CSV.");
    
    const lastRefillDate = machine?.lastRefillCompletedAt?.toDate() || null;
    let ignored = 0;
    let processed = 0;

    const summary = {};
    
    salesData.forEach(row => {
        const rowDateStr = row["Date"] || row["date"] || row["Time"];
        const rowDate = parseCSVDate(rowDateStr);
        
        if (lastRefillDate && rowDate && rowDate <= lastRefillDate) {
            ignored++;
            return; 
        }
        processed++;

        const slotVal = row["Selection"] || row["selection"] || row["Slot"] || row["slot"];
        const pName = row["Name"] || row["name"] || row["Product"] || row["Item"] || "Unknown Product";
        
        if (slotVal || pName !== "Unknown Product") {
            const key = slotVal ? String(slotVal).trim() : pName.trim();
            if (!summary[key]) summary[key] = { slotId: slotVal || null, name: pName, qty: 0 };
            summary[key].qty += 1;
        }
    });

    setFilterStats({ ignored, processed, cutoffDate: lastRefillDate });

    const output = Object.values(summary).map(data => {
        const catProd = catalog.find(p => p.name.toLowerCase().trim() === data.name.toLowerCase().trim());
        let finalSlotId = data.slotId;
        if (!finalSlotId) finalSlotId = findSlotForProduct(data.name);

        return {
            slotId: finalSlotId, 
            name: catProd ? `[${catProd.sku || 'N/A'}] ${catProd.name}` : data.name, 
            requiredQty: data.qty,
            productId: catProd?.id || null, 
            sku: catProd?.sku || null, 
            stockAvailable: catProd?.warehouseStock || 0, 
            status: (catProd?.warehouseStock || 0) < data.qty ? "SHORTAGE" : "OK", 
            swapped: false
        };
    });
    
    setCalculated(output);
  }

  // 🟢 UPDATED: Handle Manual Add with Dropdown Swap support
  const handleManualAdd = () => {
    let val = Number(manualQty);
    if (val < 0) val = 0;
    if (!manualSelectedProductId) return alert("Please select a product from the list.");

    const targetMasterProd = masterCatalog.find(p => p.id === manualSelectedProductId);
    const catProd = catalog.find(p => p.sku === targetMasterProd?.sku || p.name?.toLowerCase() === targetMasterProd?.name?.toLowerCase());
    
    const stock = catProd?.warehouseStock || 0;
    const isSwapped = manualSelectedProductId !== selectedSlotForAdd.product_id;

    const newItem = {
      slotId: getCode(selectedSlotForAdd), 
      name: targetMasterProd ? `[${targetMasterProd.sku}] ${targetMasterProd.name}` : "Unknown Product", 
      requiredQty: val,
      productId: targetMasterProd?.id || null, 
      sku: targetMasterProd?.sku || "N/A", 
      stockAvailable: stock,
      status: stock < val ? "SHORTAGE" : "OK", 
      swapped: isSwapped
    };
    
    setCalculated(prev => [...prev, newItem]);
    setSelectedSlotForAdd(null);
    setManualSelectedProductId(""); // Reset
  };

  function handleSwapItem(index, masterProdId) {
    const target = masterCatalog.find(p => p.id === masterProdId);
    const warehouseStock = catalog.find(p => p.name.toLowerCase() === target.name.toLowerCase())?.warehouseStock || 0;
    setCalculated(prev => {
        const updated = [...prev];
        updated[index] = {
            ...updated[index], productId: target.id, name: `[${target.sku}] ${target.name}`, sku: target.sku,
            stockAvailable: warehouseStock, status: warehouseStock < updated[index].requiredQty ? "SHORTAGE" : "OK", swapped: true
        };
        return updated;
    });
  }

  function handleUpdateQty(index, newQty) {
    let val = Number(newQty);
    if (val < 0) val = 0;

    setCalculated(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], requiredQty: val, status: updated[index].stockAvailable < val ? "SHORTAGE" : "OK" };
        return updated;
    });
  }

  const handleDownload = () => {
    const tempKitObj = {
        id: "DRAFT", machineId: machine.id, refillerEmail: machine.assignedEmail || "Unassigned",
        orgId: orgId, createdAt: new Date(), status: "draft", products: calculated
    };
    generateKitPDF(tempKitObj);
  };

  async function saveKit() {
    if (!calculated.length) return alert("Pack list is empty.");
    if (calculated.some(i => i.status === "SHORTAGE")) return alert("Please resolve shortages or reduce quantity to match warehouse stock.");
    try {
      const kitRef = doc(collection(db, "kits"));
      await setDoc(kitRef, {
        machineId, 
        orgId, 
        createdByAdmin: user.email,
        refillerId: machine.refillerId || "unassigned",
        refillerEmail: machine.assignedEmail || "unassigned",
        products: calculated, 
        status: "pending_acceptance", 
        createdAt: serverTimestamp(), 
        type: activeMode
      });
      await updateDoc(doc(db, "machines", machineId), { 
        activeKitId: kitRef.id, 
        kitStatus: "pending_acceptance" 
      });
      alert("✅ Kit Prepared! It has been pushed to the Refiller's dashboard for acceptance.");
      navigate(`/admin/machines`);
    } catch (e) { alert("Error saving kit."); }
  }

  if (loading) return <div style={{padding:20}}>Loading machine layout...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <button onClick={() => navigate(-1)} style={btnBack}>← Back</button>
      <h2 style={{marginTop: 0, color: "#1e293b"}}>📦 Admin Kit Preparation: {machine?.name}</h2>
      
      <div style={{fontSize: 13, color: '#64748b', marginBottom: 20, background: '#f8fafc', padding: '10px 15px', borderRadius: 8, border: '1px solid #e2e8f0'}}>
        <b>Machine Last Refilled:</b> {machine?.lastRefillCompletedAt ? machine.lastRefillCompletedAt.toDate().toLocaleString() : "Never refilled yet. All sales will be counted."}
      </div>

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
                                <div key={s.id} style={slotPill} onClick={() => {
                                  setSelectedSlotForAdd(s);
                                  setManualSelectedProductId(s.product_id || ""); // Load existing product
                                  setManualQty(1);
                                }}>
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

      {/* 🟢 UPDATED: Modal now includes Swap Dropdown */}
      {selectedSlotForAdd && (
        <div style={modalBackdrop}>
           <div style={modalBox}>
              <h3 style={{marginTop: 0, color: "#1e293b"}}>Add Item to Kit</h3>
              <p style={{color: "#64748b", margin: "0 0 15px 0"}}>Target Slot: <b>{getCode(selectedSlotForAdd)}</b></p>
              
              <div style={{marginBottom: 15}}>
                <label style={{display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: '#475569'}}>Product to Pack</label>
                <select 
                  value={manualSelectedProductId} 
                  onChange={e => setManualSelectedProductId(e.target.value)} 
                  style={{...inputStyle, padding: "8px", appearance: "auto"}}
                >
                  <option value="">-- Select Product --</option>
                  {masterCatalog.map(p => (
                    <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{marginBottom: 15}}>
                <label style={{display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: '#475569'}}>Quantity Needed</label>
                <input 
                  type="number" min="0" 
                  value={manualQty} 
                  onChange={e => setManualQty(e.target.value)} 
                  onFocus={e => e.target.select()}
                  style={inputStyle} 
                />
              </div>

              <div style={{display:'flex', gap: 10, marginTop: 20}}>
                <button onClick={() => setSelectedSlotForAdd(null)} style={btnCancel}>Cancel</button>
                <button onClick={handleManualAdd} style={btnPrimary}>+ Add to List</button>
              </div>
           </div>
        </div>
      )}

      {filterStats && (
          <div style={{marginTop: 20, padding: 15, background: filterStats.ignored > 0 ? '#fffbeb' : '#f0fdf4', border: filterStats.ignored > 0 ? '1px solid #fcd34d' : '1px solid #bbf7d0', borderRadius: 8}}>
              <h4 style={{margin: '0 0 5px 0', color: filterStats.ignored > 0 ? '#b45309' : '#166534'}}>🛡️ Data Protection Active</h4>
              <div style={{fontSize: 13, color: '#475569'}}>
                  <b>{filterStats.processed}</b> new sales calculated. <br/>
                  {filterStats.ignored > 0 && <span style={{color: '#ef4444'}}><b>{filterStats.ignored}</b> old sales were ignored because they occurred before the last refill.</span>}
              </div>
          </div>
      )}

      {calculated.length > 0 && (
        <div style={{...card, marginTop: 20}}>
           <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
             <h3 style={{margin: 0}}>Kit Details ({calculated.length} items)</h3>
             <button onClick={handleDownload} style={{background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 12}}>
                📥 Download Draft PDF
             </button>
           </div>
           
           <table style={{width: '100%', borderCollapse:'collapse', fontSize: 13}}>
              <thead><tr style={{textAlign:'left', background:'#f8fafc'}}><th style={th}>Target Slot</th><th style={th}>Product Item</th><th style={th}>Qty to Pack</th><th style={th}>Wh Stock</th><th style={th}>Action</th></tr></thead>
              <tbody>
                {calculated.map((item, i) => (
                  <tr key={i} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={td}>
                        {item.slotId === "Unassigned" ? <span style={{color: '#ef4444', fontWeight: 'bold'}}>{item.slotId}</span> : <b>{item.slotId}</b>}
                    </td>
                    <td style={td}>{item.name} {item.swapped && <div style={{color:'#3b82f6', fontSize: 10, fontWeight:'bold'}}>🔄 Swapped</div>}</td>
                    <td style={td}>
                        <input type="number" min="0" value={item.requiredQty} style={item.swapped || item.status === "SHORTAGE" ? editableQtyInput : staticQtyDisplay} onChange={(e) => handleUpdateQty(i, e.target.value)} disabled={!item.swapped && item.status !== "SHORTAGE"} />
                    </td>
                    <td style={{...td, color: item.stockAvailable < item.requiredQty ? '#ef4444' : '#10b981'}}><b>{item.stockAvailable}</b></td>
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
           <button onClick={saveKit} style={btnSuccess}>💾 Save Kit & Push to Refiller</button>
        </div>
      )}
    </div>
  );
}

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
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 25, borderRadius: 12, width: 320, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", textAlign: 'left', boxSizing: 'border-box' };
const btnCancel = { flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 'bold', cursor: 'pointer' };
const th = { padding: 10, color: '#64748b' };
const td = { padding: 10 };
const swapSelect = { padding: 4, fontSize: 11, borderRadius: 4, background: '#fff' };
const editableQtyInput = { width: '50px', padding: '5px', borderRadius: '4px', border: '1px solid #3b82f6', textAlign: 'center', fontWeight: 'bold', background: '#eff6ff' };
const staticQtyDisplay = { width: '50px', border: 'none', background: 'none', textAlign: 'center', fontWeight: 'bold' };
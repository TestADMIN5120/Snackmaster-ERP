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
  const [catalog, setCatalog] = useState([]); // Warehouse products (for stock checks)
  const [masterCatalog, setMasterCatalog] = useState([]); // All master products (for swapping)
  const [slots, setSlots] = useState([]); 
  const [calculated, setCalculated] = useState([]); // Unified Pack List
  
  const [masterData, setMasterData] = useState([]); // CSV Master
  const [salesData, setSalesData] = useState([]); // CSV Sales
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState("csv"); 
  const [selectedSlotForAdd, setSelectedSlotForAdd] = useState(null);
  const [manualQty, setManualQty] = useState(1);

  useEffect(() => {
    if (!orgId || !machineId) return;

    const unsubMachine = onSnapshot(doc(db, "machines", machineId), (d) => {
      if (d.exists()) setMachine({ id: d.id, ...d.data() });
    });

    const unsubSlots = onSnapshot(collection(db, "machines", machineId, "slots"), (snap) => {
      setSlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const qProd = query(collection(db, "products"), where("orgId", "==", orgId));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setCatalog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 🟢 FETCH MASTER CATALOG FOR SWAPPING
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
  const groupForRoot = (root) => [root, ...slots.filter(s => s.merged_into === root.id)];
  const getCode = (root) => {
    const g = groupForRoot(root);
    const codes = g.map(s => 110 + (s.tray-1)*10 + s.slot_number);
    return g.length === 1 ? String(codes[0]) : `${Math.min(...codes)}-${Math.max(...codes)}`;
  };

  // --- CSV LOGIC ---
  function parseCSV(file, setter) {
    if(!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        setter(results.data);
        console.log(`✅ Loaded ${file.name}: ${results.data.length} rows.`);
      },
    });
  }

  function calculateCSVKit() {
    if (masterData.length === 0 || salesData.length === 0) return alert("Please upload both Planogram and Sales CSVs.");
    
    const salesCounts = {}; 
    salesData.forEach((row) => {
      const slotVal = row["Selection"] || row["selection"] || row["Slot"] || row["slot"];
      if (slotVal) salesCounts[slotVal] = (salesCounts[slotVal] || 0) + 1;
    });

    const output = [];
    masterData.forEach((row) => {
      const slotId = row["slot"] || row["Slot"]; 
      const soldCount = salesCounts[slotId] || 0;
      if (soldCount > 0) {
        const csvName = row["name"] || "Unknown";
        const catProd = catalog.find(p => p.name.toLowerCase().trim() === csvName.toLowerCase().trim());
        output.push({
          slotId,
          originalName: csvName,
          requiredQty: soldCount,
          assignedProductId: catProd?.id || null,
          assignedProductName: catProd ? `[${catProd.sku || 'N/A'}] ${catProd.name}` : csvName,
          sku: catProd?.sku || null,
          stockAvailable: catProd?.warehouseStock || 0,
          status: (catProd?.warehouseStock || 0) < soldCount ? "SHORTAGE" : "OK",
          swapped: false
        });
      }
    });
    setCalculated(output);
  }

  // --- MANUAL LOGIC ---
  const handleAddToBasket = () => {
    const slot = selectedSlotForAdd;
    const catProd = catalog.find(p => p.id === slot.product_id);
    const newItem = {
      slotId: getCode(slot),
      originalName: slot.product_name || "Empty",
      requiredQty: Number(manualQty),
      assignedProductId: slot.product_id,
      assignedProductName: slot.product_name,
      sku: catProd?.sku || "N/A",
      stockAvailable: catProd?.warehouseStock || 0,
      status: (catProd?.warehouseStock || 0) < Number(manualQty) ? "SHORTAGE" : "OK",
      swapped: false
    };

    setCalculated(prev => {
      const idx = prev.findIndex(i => i.slotId === newItem.slotId);
      if (idx > -1) {
        const up = [...prev]; up[idx] = newItem; return up;
      }
      return [...prev, newItem];
    });
    setSelectedSlotForAdd(null);
    setManualQty(1);
  };

  // --- SWAP LOGIC (For CSV Shortages) ---
  function handleSwapItem(index, masterProdId) {
    const target = masterCatalog.find(p => p.id === masterProdId);
    const warehouseStock = catalog.find(p => p.name === target.name)?.warehouseStock || 0;

    setCalculated(prev => {
        const updated = [...prev];
        updated[index] = {
            ...updated[index],
            assignedProductId: target.id,
            assignedProductName: `[${target.sku}] ${target.name}`,
            sku: target.sku,
            stockAvailable: warehouseStock,
            status: warehouseStock < updated[index].requiredQty ? "SHORTAGE" : "SWAPPED",
            swapped: true
        };
        return updated;
    });
  }

  async function saveKit() {
    if (!calculated.length) return alert("Pack list is empty.");
    if (calculated.some(item => item.status === "SHORTAGE")) return alert("Please resolve shortages by swapping items before saving.");
    
    try {
      const kitRef = doc(collection(db, "kits"));
      await setDoc(kitRef, {
        machineId, orgId, refillerId: user.uid, refillerEmail: user.email,
        products: calculated, status: "prepared", createdAt: serverTimestamp(),
        type: activeMode
      });
      await updateDoc(doc(db, "machines", machineId), { activeKitId: kitRef.id, kitStatus: "prepared", status: "kit_prepared" });
      navigate(`/refiller/machines/${machineId}`);
    } catch (e) { alert("Error saving kit."); }
  }

  if (loading) return <div>Syncing layout...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <button onClick={() => navigate(-1)} style={btnBack}>← Back</button>
      <h2>📦 Prepare Refill Kit</h2>

      {/* Mode Switcher */}
      <div style={modeTabs}>
        <button onClick={() => setActiveMode("csv")} style={activeMode === "csv" ? activeTab : tab}>⚡ CSV Auto-Engine</button>
        <button onClick={() => setActiveMode("manual")} style={activeMode === "manual" ? activeTab : tab}>📋 Manual Mirror Mode</button>
      </div>

      {/* 🟢 CSV ENGINE UI */}
      {activeMode === "csv" && (
        <div style={card}>
          <h3 style={{marginTop:0}}>1. Upload Reports</h3>
          <div style={csvUploadGrid}>
            <div style={uploadBox}>
                <label style={uploadLabel}>📄 Planogram/Master CSV</label>
                <input type="file" accept=".csv" onChange={(e) => parseCSV(e.target.files[0], setMasterData)} />
            </div>
            <div style={uploadBox}>
                <label style={uploadLabel}>📉 Sales Report CSV</label>
                <input type="file" accept=".csv" onChange={(e) => parseCSV(e.target.files[0], setSalesData)} />
            </div>
          </div>
          <button onClick={calculateCSVKit} style={btnPrimary}>Generate Kit from CSV</button>
        </div>
      )}

      {/* 🟢 MANUAL MIRROR UI */}
      {activeMode === "manual" && (
        <div style={card}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 15}}>
            {trays.map(t => (
              <div key={t} style={{display:'flex', gap: 10, alignItems:'center'}}>
                <div style={{fontWeight: 'bold', minWidth: 60, fontSize: 13, color: '#64748b'}}>Tray {t}</div>
                <div style={{display:'flex', flexWrap:'wrap', gap: 8}}>
                  {slotsForTray(t).map(s => (
                    <div key={s.id} style={slotPill} onClick={() => setSelectedSlotForAdd(s)}>
                       <div style={{fontWeight: 'bold', fontSize: 14}}>{getCode(s)}</div>
                       <div style={{fontSize: 10, overflow:'hidden', whiteSpace:'nowrap', width: '100%'}}>{s.product_name || "Empty"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {selectedSlotForAdd && (
        <div style={modalBackdrop}>
           <div style={modalBox}>
              <h3>Add to Basket</h3>
              <p style={{fontSize: 14}}>Slot: <b>{getCode(selectedSlotForAdd)}</b></p>
              <p style={{fontSize: 14, marginBottom: 15}}>Item: {selectedSlotForAdd.product_name}</p>
              <label style={{fontSize: 12, fontWeight:'bold', display:'block', marginBottom: 5}}>Quantity to Pack</label>
              <input type="number" value={manualQty} min="1" onChange={e => setManualQty(e.target.value)} style={inputStyle} />
              <div style={{display:'flex', gap: 10, marginTop: 20}}>
                <button onClick={() => setSelectedSlotForAdd(null)} style={btnCancel}>Cancel</button>
                <button onClick={handleAddToBasket} style={btnSave}>Confirm</button>
              </div>
           </div>
        </div>
      )}

      {/* UNIFIED PACK LIST PREVIEW */}
      {calculated.length > 0 && (
        <div style={{...card, marginTop: 20}}>
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
             <h3 style={{margin: 0}}>Pack List Preview ({calculated.length} slots)</h3>
             <button onClick={() => setCalculated([])} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize: 12}}>Clear All</button>
           </div>
           
           <table style={{width: '100%', borderCollapse:'collapse', fontSize: 13}}>
              <thead><tr style={{textAlign:'left', background:'#f8fafc', color: '#64748b'}}><th style={th}>Slot</th><th style={th}>Item</th><th style={th}>Qty</th><th style={th}>Wh Stock</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {calculated.map((item, i) => (
                  <tr key={i} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={td}><b>{item.slotId}</b></td>
                    <td style={td}>
                        {item.assignedProductName}
                        {item.swapped && <div style={{fontSize: 10, color: '#3b82f6'}}>🔄 Swapped</div>}
                    </td>
                    <td style={td}><b>{item.requiredQty}</b></td>
                    <td style={{...td, color: item.stockAvailable < item.requiredQty ? '#ef4444' : '#10b981'}}><b>{item.stockAvailable}</b></td>
                    <td style={td}>
                        {item.status === "SHORTAGE" ? (
                             <select style={swapSelect} onChange={(e) => handleSwapItem(i, e.target.value)}>
                                <option value="">⚠️ Swap Item</option>
                                {masterCatalog.map(p => (
                                    <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                                ))}
                             </select>
                        ) : (
                            <span style={{fontSize: 11, color: '#10b981'}}>OK</span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
           <button onClick={saveKit} style={btnSuccess}>💾 Save Kit & Send to Admin</button>
        </div>
      )}
    </div>
  );
}

const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", marginBottom: 15, fontWeight: "bold" };
const card = { background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const modeTabs = { display: "flex", gap: 10, marginBottom: 15 };
const tab = { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontWeight: "bold", color: "#475569" };
const activeTab = { ...tab, background: "#1e293b", color: "#fff", borderColor: "#1e293b" };
const csvUploadGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 };
const uploadBox = { background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px dashed #cbd5e1' };
const uploadLabel = { fontSize: 12, fontWeight: 'bold', display: 'block', marginBottom: 5 };
const slotPill = { padding: 8, background: "#f1f5f9", borderRadius: 8, cursor: "pointer", textAlign: 'center', border: "1px solid #e2e8f0", minWidth: 80, transition: '0.1s' };
const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 25, borderRadius: 16, width: 340, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const inputStyle = { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 20, textAlign: 'center', fontWeight: 'bold' };
const btnCancel = { flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight:'bold' };
const btnSave = { flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 'bold' };
const btnSuccess = { width: '100%', padding: 18, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, marginTop: 20, fontWeight: 'bold', fontSize: 16, cursor: 'pointer' };
const btnPrimary = { background: "#3b82f6", color: "#fff", border: "none", padding: "12px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", width: "100%" };
const th = { padding: 10 };
const td = { padding: 10 };
const swapSelect = { padding: 4, fontSize: 11, borderRadius: 4, background: '#fff' };
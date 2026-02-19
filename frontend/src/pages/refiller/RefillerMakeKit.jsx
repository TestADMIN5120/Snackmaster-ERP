import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useParams, useNavigate } from "react-router-dom";

export default function RefillerMakeKit() {
  const { machineId } = useParams();
  const { user } = useAdmin();
  const navigate = useNavigate();

  const [machine, setMachine] = useState(null);
  const [masterData, setMasterData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [calculated, setCalculated] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function loadMachine() {
      const docSnap = await getDoc(doc(db, "machines", machineId));
      if (docSnap.exists()) {
        setMachine({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Machine not found.");
        navigate("/refiller");
      }
    }
    loadMachine();
  }, [machineId, navigate]);

  function addLog(msg) { setLogs(prev => [...prev, msg]); }

  function parseCustomDate(dateStr) {
    if (!dateStr) return null;
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    try {
      const parts = dateStr.split(' '); 
      if (parts.length < 2) return null;
      const dateParts = parts[0].split('/'); 
      const timeParts = parts[1].split(':'); 
      const day = parseInt(dateParts[0], 10);
      const months = { "Jan":0, "Feb":1, "Mar":2, "Apr":3, "May":4, "Jun":5, "Jul":6, "Aug":7, "Sep":8, "Oct":9, "Nov":10, "Dec":11 };
      const month = months[dateParts[1]];
      const year = parseInt(dateParts[2], 10);
      return new Date(year, month, day, timeParts[0], timeParts[1], timeParts[2]);
    } catch (e) { return null; }
  }

  function parseCSV(file, setter) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        setter(results.data);
        addLog(`✅ Loaded ${file.name}: ${results.data.length} rows.`);
      },
    });
  }

  function calculateKit() {
    setLogs([]);
    if (!machine) return alert("Machine data not loaded.");
    if (masterData.length === 0) return alert("Please upload Master CSV.");
    if (salesData.length === 0) return alert("Please upload Sales CSV.");

    const lastRefill = machine.lastRefillCompletedAt?.toDate ? machine.lastRefillCompletedAt.toDate() : new Date(0); 
    addLog(`🕒 Last Refill: ${lastRefill.toLocaleString()}`);

    const salesCounts = {}; 
    let validSales = 0, oldSales = 0;

    salesData.forEach((row) => {
      const slotVal = row["Selection"] || row["selection"] || row["Slot"] || row["slot"];
      if (!slotVal) return;
      const dateVal = row["Date"] || row["date"] || row["Time"];
      const saleDate = parseCustomDate(dateVal);

      if (saleDate && saleDate > lastRefill) {
        salesCounts[slotVal] = (salesCounts[slotVal] || 0) + 1;
        validSales++;
      } else { oldSales++; }
    });

    addLog(`📊 Sales Analysis: ${validSales} new sales. (${oldSales} ignored before last refill).`);

    const output = [];
    masterData.forEach((row) => {
      const slotId = row["slot"] || row["Slot"]; 
      if (!slotId) return;
      const soldCount = salesCounts[slotId] || 0;
      if (soldCount > 0) {
        output.push({
          productId: slotId, 
          name: row["name"] || "Unknown Product",
          capacity: Number(row["capacity"] || row["count"] || 20),
          soldSinceRefill: soldCount,
          requiredQty: soldCount, 
        });
      }
    });

    setCalculated(output);
    addLog(`✅ Plan Generated: ${output.length} slots need refilling.`);
  }

  async function saveKit() {
    if (!calculated.length) return alert("No items calculated.");

    setLoading(true);
    try {
      const kitRef = doc(collection(db, "kits"));
      
      await setDoc(kitRef, {
        machineId,
        orgId: machine.orgId, 
        refillerId: user.uid,
        refillerEmail: user.email,
        products: calculated,
        status: "prepared", 
        type: "csv_automated",
        sourceLogs: logs,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "machines", machineId), {
        activeKitId: kitRef.id,
        kitStatus: "prepared",
        status: "kit_prepared",
        updatedAt: serverTimestamp(),
      });

      alert("✅ Kit Created Successfully! Please proceed to the machine.");
      navigate(`/refiller/machines/${machineId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save kit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)} style={btnBack}>← Back</button>
      <h2 style={{marginTop: 0, color: "#1e293b"}}>⚡ Auto-Calculate Kit</h2>
      
      <div style={card}>
        <h3 style={{marginTop:0, marginBottom: 15, color: "#334155"}}>1. Upload Data Files</h3>
        
        <div style={uploadRow}>
          <label style={label}>
            <div style={{fontSize: 16, marginBottom: 4}}>📄 <strong>Master Data</strong> (Planogram)</div>
            <div style={{color:'#64748b', fontSize: 13, fontWeight: "normal"}}>Required columns: "slot", "name"</div>
          </label>
          <input type="file" accept=".csv" onChange={(e) => parseCSV(e.target.files[0], setMasterData)} style={{maxWidth: "200px"}} />
        </div>

        <div style={uploadRow}>
          <label style={label}>
            <div style={{fontSize: 16, marginBottom: 4}}>📉 <strong>Sales Report</strong></div>
            <div style={{color:'#64748b', fontSize: 13, fontWeight: "normal"}}>Required columns: "Selection", "Date"</div>
          </label>
          <input type="file" accept=".csv" onChange={(e) => parseCSV(e.target.files[0], setSalesData)} style={{maxWidth: "200px"}} />
        </div>

        <button onClick={calculateKit} style={btnPrimary}>🚀 Run Calculation</button>

        {logs.length > 0 && (
          <div style={logBox}>
            {logs.map((l, i) => <div key={i} style={{marginBottom: 4}}>{l}</div>)}
          </div>
        )}
      </div>

      {calculated.length > 0 && (
        <div style={{...card, marginTop: 20}}>
          <h3 style={{marginTop:0, marginBottom: 15, color: "#334155"}}>2. Review Kit Requirements</h3>
          
          <div style={tableWrapper}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{background: "#f1f5f9", textAlign: "left"}}>
                  <th style={th}>Slot</th>
                  <th style={th}>Product</th>
                  <th style={th}>Pack Qty</th>
                </tr>
              </thead>
              <tbody>
                {calculated.map((p) => (
                  <tr key={p.productId} style={{borderBottom: "1px solid #e2e8f0"}}>
                    <td style={td}><b>{p.productId}</b></td>
                    <td style={td}>{p.name}</td>
                    <td style={{...td, color: "#16a34a", fontWeight: "bold", fontSize: 16}}>+{p.requiredQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={saveKit} disabled={loading} style={btnSuccess}>
            {loading ? "Saving..." : "💾 Create Kit & Mark Prepared"}
          </button>
        </div>
      )}
    </div>
  );
}

// Styles
const card = { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" };
const label = { display: "block", color: "#333", flex:1 };
const uploadRow = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20, background: "#f8fafc", padding: 15, borderRadius: 8, border: "1px solid #e2e8f0" };
const btnBack = { border: "none", background: "none", color: "#3b82f6", cursor: "pointer", marginBottom: 15, fontSize: 15, fontWeight: "bold", padding: 0 };
const btnPrimary = { background: "#3b82f6", color: "#fff", border: "none", padding: "14px 20px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 16, width:'100%', boxShadow: "0 4px 6px rgba(59, 130, 246, 0.2)" };
const btnSuccess = { background: "#10b981", color: "#fff", border: "none", padding: "14px 20px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 16, width: "100%", marginTop: 20, boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)" };
const tableWrapper = { maxHeight: "300px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 };
const th = { padding: "12px", position: "sticky", top: 0, background: "#f1f5f9", color: "#64748b" };
const td = { padding: "12px" };
const logBox = { marginTop: 20, padding: 15, background: "#1e293b", color: "#4ade80", fontFamily: "monospace", fontSize: 13, borderRadius: 8, maxHeight: 150, overflowY: 'auto' };
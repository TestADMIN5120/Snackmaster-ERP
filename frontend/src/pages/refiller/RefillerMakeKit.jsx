import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
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
      }
    }
    loadMachine();
  }, [machineId]);

  function addLog(msg) {
    setLogs(prev => [...prev, msg]);
  }

  // 🛠️ CUSTOM DATE PARSER for "16/Feb/2026 0:56:08"
  function parseCustomDate(dateStr) {
    if (!dateStr) return null;
    
    // Try standard first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    // Custom Parse: "16/Feb/2026 0:56:08"
    try {
      const parts = dateStr.split(' '); 
      if (parts.length < 2) return null;

      const dateParts = parts[0].split('/'); 
      const timeParts = parts[1].split(':'); 

      const day = parseInt(dateParts[0], 10);
      const monthStr = dateParts[1];
      const year = parseInt(dateParts[2], 10);
      
      const months = {
        "Jan":0, "Feb":1, "Mar":2, "Apr":3, "May":4, "Jun":5,
        "Jul":6, "Aug":7, "Sep":8, "Oct":9, "Nov":10, "Dec":11
      };
      const month = months[monthStr];

      return new Date(year, month, day, timeParts[0], timeParts[1], timeParts[2]);
    } catch (e) {
      return null;
    }
  }

  function parseCSV(file, setter) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
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

    // 1. Cutoff Time (Last Refill)
    const lastRefill = machine.lastRefillCompletedAt?.toDate 
      ? machine.lastRefillCompletedAt.toDate() 
      : new Date(0); 

    addLog(`🕒 Last Refill: ${lastRefill.toLocaleString()}`);

    // 2. Count Sales (Filtering by Date)
    const salesCounts = {}; 
    let validSales = 0;
    let oldSales = 0;

    salesData.forEach((row) => {
      const slotVal = row["Selection"] || row["selection"] || row["Slot"] || row["slot"];
      if (!slotVal) return;

      const dateVal = row["Date"] || row["date"] || row["Time"];
      const saleDate = parseCustomDate(dateVal);

      if (saleDate && saleDate > lastRefill) {
        salesCounts[slotVal] = (salesCounts[slotVal] || 0) + 1;
        validSales++;
      } else {
        oldSales++;
      }
    });

    addLog(`📊 Sales Analysis: ${validSales} new sales. (${oldSales} ignored).`);

    // 3. Match with Master Data
    const output = [];
    
    masterData.forEach((row) => {
      const slotId = row["slot"] || row["Slot"]; 
      if (!slotId) return;

      const soldCount = salesCounts[slotId] || 0;
      
      if (soldCount > 0) {
        const capacity = Number(row["capacity"] || row["count"] || 20); 
        const name = row["name"] || "Unknown Product";

        output.push({
          productId: slotId, 
          name: name,
          capacity: capacity,
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
        orgId: machine.orgId, // 🟢 SECURITY FIX
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

      alert("✅ Kit Created Successfully!");
      navigate(`/refiller/machines/${machineId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save kit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)} style={btnBack}>← Back</button>
      
      <h1 style={{marginBottom: 20}}>⚡ Auto-Calculate Kit</h1>
      
      <div style={card}>
        <h3>1. Upload Data Files</h3>
        
        <div style={uploadRow}>
          <label style={label}>
            📄 <strong>Master Data</strong> (Planogram)
            <br/><small style={{color:'#666'}}>Must have "slot" and "name"</small>
          </label>
          <input type="file" accept=".csv" onChange={(e) => parseCSV(e.target.files[0], setMasterData)} />
        </div>

        <div style={uploadRow}>
          <label style={label}>
            📉 <strong>Sales Report</strong> (Tracking)
            <br/><small style={{color:'#666'}}>Must have "Selection" and "Date"</small>
          </label>
          <input type="file" accept=".csv" onChange={(e) => parseCSV(e.target.files[0], setSalesData)} />
        </div>

        <button onClick={calculateKit} style={btnPrimary}>
          🚀 Run Calculation
        </button>

        {/* LOGS CONSOLE */}
        {logs.length > 0 && (
          <div style={logBox}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>

      {calculated.length > 0 && (
        <div style={{...card, marginTop: 20}}>
          <h3>2. Review Kit Requirements</h3>
          
          <div style={tableWrapper}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{background: "#f5f5f5", textAlign: "left"}}>
                  <th style={th}>Slot</th>
                  <th style={th}>Product</th>
                  <th style={th}>Sold (Refill Qty)</th>
                </tr>
              </thead>
              <tbody>
                {calculated.map((p) => (
                  <tr key={p.productId} style={{borderBottom: "1px solid #eee"}}>
                    <td style={td}><b>{p.productId}</b></td>
                    <td style={td}>{p.name}</td>
                    <td style={{...td, color: "green", fontWeight: "bold", fontSize: 16}}>
                      {p.requiredQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={saveKit} disabled={loading} style={btnSuccess}>
            {loading ? "Saving..." : "💾 Create & Mark Prepared"}
          </button>
        </div>
      )}
    </div>
  );
}

// Styles
const card = { background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const label = { display: "block", marginBottom: 5, color: "#333", flex:1 };
const uploadRow = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20, borderBottom:'1px dashed #eee', paddingBottom:15 };
const btnBack = { border: "none", background: "none", color: "#1976d2", cursor: "pointer", marginBottom: 15, fontSize: 14 };
const btnPrimary = { background: "#1976d2", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 15, width:'100%' };
const btnSuccess = { background: "#2e7d32", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 15, width: "100%", marginTop: 20 };
const tableWrapper = { maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", borderRadius: 8, marginTop: 10 };
const th = { padding: "10px", position: "sticky", top: 0, background: "#f5f5f5" };
const td = { padding: "10px" };
const logBox = { marginTop: 15, padding: 10, background: "#333", color: "#0f0", fontFamily: "monospace", fontSize: 12, borderRadius: 6, maxHeight: 150, overflowY: 'auto' };
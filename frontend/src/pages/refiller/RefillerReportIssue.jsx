import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useNavigate, useParams } from "react-router-dom";
import { useAdmin } from "../../contexts/AdminContext";

const ISSUE_CATEGORIES = [
  { id: "motor_jammed", icon: "⚙️", label: "Motor Jammed" },
  { id: "payment_failed", icon: "💳", label: "Payment Failure" },
  { id: "item_stuck", icon: "🍫", label: "Item Stuck" },
  { id: "power_issue", icon: "🔌", label: "Power Issue" },
  { id: "other", icon: "❓", label: "Other" }
];

export default function RefillerReportIssue() {
  const navigate = useNavigate();
  const { machineId } = useParams(); 
  const { user } = useAdmin(); 

  const [machine, setMachine] = useState(null); 
  const [issueType, setIssueType] = useState("motor_jammed");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 🟢 Post-Submission Success State
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (machineId) {
      const fetchMachine = async () => {
        const docSnap = await getDoc(doc(db, "machines", machineId));
        if (docSnap.exists()) {
          setMachine({ id: docSnap.id, ...docSnap.data() });
        }
      };
      fetchMachine();
    }
  }, [machineId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description) return alert("Please describe the issue.");
    if (!machine) return alert("Machine data missing.");

    if (!window.confirm("Report this issue? The machine will be locked and marked as 'Down'.")) return;

    setLoading(true);
    const isOffline = !navigator.onLine;

    try {
      const batch = writeBatch(db);
      const newIssueRef = doc(collection(db, "machine_issues"));
      const machineRef = doc(db, "machines", machineId);

      // 1. Create Issue
      batch.set(newIssueRef, {
        machineId: machineId,
        orgId: machine.orgId, 
        refillerId: user.uid,
        refillerEmail: user.email,
        issueType: issueType,
        description: description,
        status: "reported", 
        priority: "medium",
        offline: isOffline, 
        reportedAt: serverTimestamp(),
        createdAt: serverTimestamp() 
      });

      // 2. Update Machine Status
      batch.update(machineRef, {
        status: "issue_reported",
        lastIssueId: newIssueRef.id,
        lastIssueReportedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      // 🟢 Show beautiful success screen instead of alert
      setSuccessData({
        syncStatus: isOffline ? "🟡 Saved locally. Will sync to Admin when online." : "🟢 Synced to Cloud. Admin notified."
      });

    } catch (error) {
      console.error("Error reporting issue:", error);
      alert("Failed to report issue.");
    } finally {
      setLoading(false);
    }
  };

  // 🟢 SUCCESS SCREEN UX
  if (successData) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <div style={{ background: "#fff5f5", padding: "40px 20px", borderRadius: "12px", border: "2px solid #fc8181" }}>
          <h1 style={{ fontSize: "50px", margin: "0 0 10px 0" }}>🚨</h1>
          <h2 style={{ color: "#c53030", margin: "0 0 10px 0" }}>Issue Sent to Admin!</h2>
          <p style={{ color: "#742a2a", fontSize: "16px", marginBottom: "20px" }}>
            The machine has been locked to prevent further errors.
          </p>
          
          <div style={{ background: "#fff", padding: "15px", borderRadius: "8px", marginBottom: "20px", display: "inline-block", textAlign: "left", border: "1px solid #fed7d7" }}>
            <p style={{ margin: "5px 0", fontSize: "15px" }}>📡 <strong>Network:</strong> {successData.syncStatus}</p>
          </div>

          <button onClick={() => navigate("/refiller")} style={{...btnPrimary, width: "100%", background: "#2b6cb0"}}>
            Return to Route Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 🟢 REPORTING FORM UX
  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto", paddingBottom: 60 }}>
      <button onClick={() => navigate(-1)} style={backBtn}>
        ← Back to Machine
      </button>

      <h2 style={{ color: "#2d3748", marginTop: 0 }}>⚠️ Report Machine Issue</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        <div style={infoBox}>
           <div style={{ fontSize: 13, color: "#718096", textTransform: "uppercase", fontWeight: "bold" }}>Reporting for</div>
           <div style={{ fontSize: 18, color: "#2d3748", fontWeight: "bold" }}>
             {machine?.name || "Loading..."} <span style={{ fontSize: 14, color: "#a0aec0", fontWeight: "normal" }}>({machineId})</span>
           </div>
        </div>

        {/* 🟢 TAP-FRIENDLY CATEGORY GRID */}
        <div>
          <label style={label}>What went wrong?</label>
          <div style={gridContainer}>
            {ISSUE_CATEGORIES.map(cat => (
              <div 
                key={cat.id} 
                onClick={() => setIssueType(cat.id)}
                style={{
                  ...categoryCard, 
                  borderColor: issueType === cat.id ? "#dc2626" : "#e2e8f0",
                  background: issueType === cat.id ? "#fef2f2" : "#fff"
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 5 }}>{cat.icon}</div>
                <div style={{ fontSize: 13, fontWeight: issueType === cat.id ? "bold" : "normal", color: issueType === cat.id ? "#991b1b" : "#4a5568" }}>
                  {cat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label style={label}>Provide more details</label>
          <textarea
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Coil A4 spun but the chocolate bar got wedged against the glass..."
            style={inputStyle}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ ...submitBtn, background: loading ? "#cbd5e1" : "#dc2626" }}
        >
          {loading ? "Sending..." : "🚨 Report Issue & Stop Machine"}
        </button>
      </form>
    </div>
  );
}

// Styles
const inputStyle = { width: "100%", padding: "15px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "16px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" };
const label = { display: "block", marginBottom: 10, fontWeight: "bold", color: "#4a5568", fontSize: "15px" };
const infoBox = { background: "#f8fafc", border: "1px solid #e2e8f0", padding: "15px", borderRadius: "8px" };
const backBtn = { background: "none", border: "none", color: "#3182ce", cursor: "pointer", marginBottom: 15, fontSize: 15, fontWeight: "bold", padding: 0 };
const submitBtn = { padding: "18px", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", cursor: "pointer", fontWeight: "bold", marginTop: "10px", boxShadow: "0 4px 6px rgba(220, 38, 38, 0.2)" };
const btnPrimary = { padding: "15px", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" };

// Grid UI Styles
const gridContainer = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "10px" };
const categoryCard = { padding: "15px 10px", borderRadius: "8px", border: "2px solid", textAlign: "center", cursor: "pointer", transition: "all 0.2s", userSelect: "none" };
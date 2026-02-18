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

export default function RefillerReportIssue() {
  const navigate = useNavigate();
  const { machineId } = useParams(); 
  const { user } = useAdmin(); 

  const [machine, setMachine] = useState(null); // Store full machine object
  const [issueType, setIssueType] = useState("motor_jammed");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (!description) return alert("Please describe the issue");
    if (!machine) return alert("Machine data missing");

    if (!window.confirm("Report this issue? The machine will be stopped.")) return;

    setLoading(true);

    try {
      const batch = writeBatch(db);
      const newIssueRef = doc(collection(db, "machine_issues"));
      const machineRef = doc(db, "machines", machineId);

      // Create Issue with Org ID
      batch.set(newIssueRef, {
        machineId: machineId,
        orgId: machine.orgId, // 🟢 SECURITY FIX
        refillerId: user.uid,
        refillerEmail: user.email,
        issueType: issueType,
        description: description,
        status: "open",
        priority: "medium",
        reportedAt: serverTimestamp(),
        createdAt: serverTimestamp() // Double check field name consistency
      });

      // Update Machine Status
      batch.update(machineRef, {
        status: "issue_reported",
        lastIssueId: newIssueRef.id,
        lastIssueReportedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      alert("Issue reported successfully!");
      navigate(`/refiller/machines/${machineId}`);

    } catch (error) {
      console.error("Error reporting issue:", error);
      alert("Failed to report issue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)} style={backBtn}>
        ← Cancel
      </button>

      <h2>⚠️ Report Machine Issue</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        
        <div style={infoBox}>
           <strong>Machine:</strong> {machine?.name || "Loading..."} ({machineId})
        </div>

        <div>
          <label style={label}>Issue Type</label>
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            style={inputStyle}
          >
            <option value="motor_jammed">⚙️ Motor Jammed</option>
            <option value="payment_failed">💳 Payment Failure</option>
            <option value="item_stuck">🍫 Item Stuck</option>
            <option value="power_issue">🔌 Power Issue</option>
            <option value="other">❓ Other</option>
          </select>
        </div>

        <div>
          <label style={label}>Description</label>
          <textarea
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened..."
            style={inputStyle}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ ...submitBtn, background: loading ? "#ccc" : "#d32f2f" }}
        >
          {loading ? "Reporting..." : "Report Issue & Stop Machine"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "16px", boxSizing: "border-box" };
const label = { display: "block", marginBottom: 6, fontWeight: "600" };
const infoBox = { background: "#f5f5f5", padding: 10, borderRadius: 6, marginBottom: 10 };
const backBtn = { background: "none", border: "none", color: "#666", cursor: "pointer", marginBottom: 10, fontSize: 14 };
const submitBtn = { padding: 14, color: "#fff", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer", fontWeight: "bold" };
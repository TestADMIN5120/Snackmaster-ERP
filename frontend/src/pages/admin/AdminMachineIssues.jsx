import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebaseClient";

export default function AdminMachineIssues() {
  console.log("🔥 AdminMachineIssues MOUNTED");

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🟢 Real-time listener for issues, sorted by newest first
    const q = query(
      collection(db, "machine_issues"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setIssues(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function updateIssueStatus(issueId, machineId, newStatus) {
    if (!window.confirm(`Mark issue as ${newStatus}?`)) return;

    try {
      // 1. Update the Issue Document
      await updateDoc(doc(db, "machine_issues", issueId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // 2. If Resolved, Reactivate the Machine
      if (newStatus === "resolved") {
        await updateDoc(doc(db, "machines", machineId), {
          status: "active", // Reset machine status
          updatedAt: serverTimestamp(),
        });
      }

    } catch (err) {
      console.error("❌ Failed to update issue", err);
      alert("Error updating status");
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading issues...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>🚨 Machine Issues (Live)</h1>

      {issues.length === 0 && (
        <div style={{ marginTop: 20, color: "#777", textAlign: "center", padding: 40, background: "#fff", borderRadius: 8 }}>
          <h3>No issues reported 🎉</h3>
          <p>All machines are running smoothly.</p>
        </div>
      )}

      {issues.map((issue) => (
        <div key={issue.id} style={card}>
          <div style={cardHeader}>
            <div>
                <h3 style={{ margin: "0 0 5px 0" }}>Machine: {issue.machineId}</h3>
                <span style={{ fontSize: 12, color: "#666" }}>
                    Reported: {issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleString() : "Just now"}
                </span>
            </div>
            <span style={statusBadge(issue.status)}>
              {issue.status.toUpperCase().replace("_", " ")}
            </span>
          </div>

          <div style={cardBody}>
            <p><strong>Refiller:</strong> {issue.refillerEmail || issue.refillerId}</p>
            <p><strong>Type:</strong> {issue.issueType}</p>
            <p style={{background: "#f9f9f9", padding: 10, borderRadius: 5, borderLeft: "4px solid #ddd"}}>
                "{issue.description}"
            </p>
          </div>

          <div style={cardFooter}>
            {issue.status === "open" || issue.status === "reported" ? (
              <button
                onClick={() => updateIssueStatus(issue.id, issue.machineId, "in_progress")}
                style={btnWarning}
              >
                🛠️ Acknowledge & Start Fix
              </button>
            ) : null}

            {issue.status === "in_progress" && (
              <button
                onClick={() => updateIssueStatus(issue.id, issue.machineId, "resolved")}
                style={btnSuccess}
              >
                ✅ Mark Resolved & Activate Machine
              </button>
            )}
            
            {issue.status === "resolved" && (
                <span style={{color: "green", fontSize: 14}}>Issue Resolved</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── UI Styles ───────── */

const card = {
  background: "#fff",
  marginBottom: 20,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,.08)",
  overflow: "hidden",
  border: "1px solid #eee"
};

const cardHeader = {
    padding: "15px 20px",
    background: "#f8f9fa",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
};

const cardBody = {
    padding: "20px",
    fontSize: "14px",
    lineHeight: "1.6"
};

const cardFooter = {
    padding: "15px 20px",
    background: "#fff",
    borderTop: "1px solid #eee",
    display: "flex",
    justifyContent: "flex-end"
};

const btnWarning = {
  padding: "10px 16px",
  background: "#fbc02d",
  color: "#000",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold"
};

const btnSuccess = {
  padding: "10px 16px",
  background: "#43a047",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold"
};

function statusBadge(status) {
  const base = { padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: "bold" };
  if (status === "open" || status === "reported") return { ...base, background: "#ffebee", color: "#c62828" };
  if (status === "in_progress") return { ...base, background: "#fff3e0", color: "#ef6c00" };
  if (status === "resolved") return { ...base, background: "#e8f5e9", color: "#2e7d32" };
  return base;
}
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebaseClient";

export default function SuperAdminIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadIssues();
  }, []);

  async function loadIssues() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "machine_issues"), 
        orderBy("reportedAt", "desc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIssues(data);
    } catch (error) {
      console.error("Error loading issues:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(issue, newStatus) {
    if (!window.confirm(`Mark this issue as ${newStatus}?`)) return;

    setBusyId(issue.id);
    const batch = writeBatch(db);

    // 1. Update the Issue
    const issueRef = doc(db, "machine_issues", issue.id);
    const issueUpdate = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    };
    if (newStatus === "resolved") {
      issueUpdate.resolvedAt = serverTimestamp();
    }
    batch.update(issueRef, issueUpdate);

    // 2. Update the Machine
    if (issue.machineId) {
      const machineRef = doc(db, "machines", issue.machineId);
      
      if (newStatus === "acknowledged") {
        batch.update(machineRef, {
          status: "issue_in_progress",
          updatedAt: serverTimestamp(),
        });
      } else if (newStatus === "resolved") {
        batch.update(machineRef, {
          status: "active",
          lastIssueResolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
      await loadIssues();
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Error updating status.");
    } finally {
      setBusyId(null);
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "open": return "#d32f2f";
      case "acknowledged": return "#f57c00";
      case "resolved": return "#388e3c";
      default: return "#757575";
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading issues...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>🔧 Machine Issues</h1>
      
      <table style={styles.table}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={styles.th}>Machine ID</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Description</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Reported At</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} style={styles.tr}>
              <td style={styles.td}><strong>{issue.machineId}</strong></td>
              <td style={styles.td}>{issue.issueType}</td>
              <td style={styles.td}>{issue.description}</td>
              <td style={styles.td}>
                <span style={{ 
                  ...styles.badge, 
                  backgroundColor: getStatusColor(issue.status) 
                }}>
                  {issue.status.toUpperCase()}
                </span>
              </td>
              <td style={styles.td}>
                {issue.reportedAt?.seconds 
                  ? new Date(issue.reportedAt.seconds * 1000).toLocaleString() 
                  : "Just now"}
              </td>
              <td style={styles.td}>
                {issue.status === "open" && (
                  <button
                    disabled={busyId === issue.id}
                    onClick={() => handleStatusUpdate(issue, "acknowledged")}
                    style={styles.btnAck}
                  >
                    Acknowledge
                  </button>
                )}

                {(issue.status === "acknowledged" || issue.status === "open") && (
                  <button
                    disabled={busyId === issue.id}
                    onClick={() => handleStatusUpdate(issue, "resolved")}
                    style={styles.btnResolve}
                  >
                    Resolve
                  </button>
                )}

                {issue.status === "resolved" && (
                  <span style={{ color: "#aaa", fontSize: "0.9em" }}>Completed</span>
                )}
              </td>
            </tr>
          ))}

          {issues.length === 0 && (
            <tr>
              <td colSpan="6" style={{ padding: 20, textAlign: "center" }}>
                No issues found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: { width: "100%", borderCollapse: "collapse", marginTop: 20 },
  th: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" },
  td: { padding: "12px", borderBottom: "1px solid #eee", verticalAlign: "middle" },
  tr: { hover: { backgroundColor: "#f9f9f9" } },
  badge: {
    padding: "4px 8px",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "bold",
  },
  btnAck: {
    padding: "6px 12px",
    marginRight: "8px",
    backgroundColor: "#f57c00",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  btnResolve: {
    padding: "6px 12px",
    backgroundColor: "#388e3c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
};
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  orderBy,
  query,
  addDoc
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function SuperAdminIssues() {
  const { user } = useAdmin();
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
    if (!window.confirm(`Mark this issue as ${newStatus.toUpperCase()}?`)) return;

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
      issueUpdate.resolvedBy = user?.email || "SuperAdmin";
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

      // 3. Log the action (Production Grade Audit)
      await addDoc(collection(db, "admin_actions"), {
        action: `ISSUE_${newStatus.toUpperCase()}`,
        issueId: issue.id,
        machineId: issue.machineId,
        orgId: issue.orgId || "unknown",
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

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
      case "open": 
      case "reported": return { bg: "#ffebee", text: "#c62828" };
      case "acknowledged": 
      case "in_progress": return { bg: "#fff3e0", text: "#ef6c00" };
      case "resolved": return { bg: "#e8f5e9", text: "#2e7d32" };
      default: return { bg: "#f5f5f5", text: "#757575" };
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading issues...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>🔧 Global Machine Issues</h1>
      
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Machine / Org</th>
              <th style={styles.th}>Type & Details</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Reported At</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => {
              const colors = getStatusColor(issue.status);
              return (
                <tr key={issue.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: "bold", fontSize: 15 }}>{issue.machineId}</div>
                    <div style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>Org: {issue.orgId || "N/A"}</div>
                    {issue.offline && (
                      <span style={{ fontSize: 11, background: "#ffeb3b", color: "#000", padding: "2px 6px", borderRadius: 4, fontWeight: "bold", display: "inline-block", marginTop: 4 }}>
                        📴 Offline Sync
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: "bold", color: "#333", textTransform: "capitalize" }}>{issue.issueType.replace("_", " ")}</div>
                    <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>"{issue.description}"</div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: colors.bg, color: colors.text }}>
                      {issue.status.toUpperCase().replace("_", " ")}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {issue.reportedAt?.seconds 
                      ? new Date(issue.reportedAt.seconds * 1000).toLocaleString() 
                      : "Just now"}
                  </td>
                  <td style={styles.td}>
                    {(issue.status === "open" || issue.status === "reported") && (
                      <button
                        disabled={busyId === issue.id}
                        onClick={() => handleStatusUpdate(issue, "acknowledged")}
                        style={styles.btnAck}
                      >
                        Acknowledge
                      </button>
                    )}

                    {(issue.status === "acknowledged" || issue.status === "in_progress") && (
                      <button
                        disabled={busyId === issue.id}
                        onClick={() => handleStatusUpdate(issue, "resolved")}
                        style={styles.btnResolve}
                      >
                        Resolve
                      </button>
                    )}

                    {issue.status === "resolved" && (
                      <span style={{ color: "#2e7d32", fontSize: 13, fontWeight: "bold" }}>✅ Resolved</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {issues.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: 40, textAlign: "center", color: "#666" }}>
                  No issues found across any organization. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  tableContainer: { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "16px", textAlign: "left", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 13, textTransform: "uppercase" },
  td: { padding: "16px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
  tr: { },
  badge: { padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" },
  btnAck: { padding: "8px 14px", backgroundColor: "#f57c00", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" },
  btnResolve: { padding: "8px 14px", backgroundColor: "#388e3c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" },
};
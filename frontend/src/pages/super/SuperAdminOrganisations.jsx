import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";

export default function SuperAdminOrganisations() {
  const { user } = useAdmin();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyOrg, setBusyOrg] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, [showDeleted]);

  async function loadOrgs() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "organisations"),
        where("deleted", "==", showDeleted)
      );
      const snap = await getDocs(q);
      setOrgs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("❌ Error loading organisations:", error);
    } finally {
      setLoading(false);
    }
  }

  /* ───────── ACTIONS ───────── */

  async function suspendOrg(org) {
    if (!window.confirm(`Suspend ${org.name}? All its machines will be marked as Service Down.`)) return;

    setBusyOrg(org.id);
    const batch = writeBatch(db);

    try {
      batch.update(doc(db, "organisations", org.id), {
        status: "suspended",
        suspended: true,
        suspendedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 🟢 FIX: Do NOT unassign orgId. Just disable the machines.
      const machinesSnap = await getDocs(query(collection(db, "machines"), where("orgId", "==", org.id)));
      machinesSnap.forEach((machine) => {
        batch.update(machine.ref, {
          status: "service-down",
          disabledReason: "ORG_SUSPENDED",
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      await addDoc(collection(db, "admin_actions"), {
        action: "ORG_SUSPENDED",
        orgId: org.id,
        orgName: org.name,
        affectedMachines: machinesSnap.size,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadOrgs();
    } catch (err) {
      console.error("❌ Suspend failed:", err);
      alert("Suspend failed");
    } finally {
      setBusyOrg(null);
    }
  }

  async function activateOrg(org) {
    setBusyOrg(org.id);
    const batch = writeBatch(db);

    try {
      batch.update(doc(db, "organisations", org.id), {
        status: "active",
        suspended: false,
        suspendedAt: null,
        updatedAt: serverTimestamp(),
      });

      // 🟢 Restore machines to active
      const machinesSnap = await getDocs(query(collection(db, "machines"), where("orgId", "==", org.id)));
      machinesSnap.forEach((machine) => {
        batch.update(machine.ref, {
          status: "active",
          disabledReason: null,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      await addDoc(collection(db, "admin_actions"), {
        action: "ORG_ACTIVATED",
        orgId: org.id,
        orgName: org.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadOrgs();
    } catch (err) {
      console.error("❌ Activate failed:", err);
      alert("Activate failed");
    } finally {
      setBusyOrg(null);
    }
  }

  async function softDeleteOrg(org) {
    if (!window.confirm(`Soft delete ${org.name}? This hides it from the active system.`)) return;

    setBusyOrg(org.id);

    try {
      await updateDoc(doc(db, "organisations", org.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user?.email || "unknown",
        status: "deleted",
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "ORG_SOFT_DELETED",
        orgId: org.id,
        orgName: org.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadOrgs();
    } catch (err) {
      console.error("❌ Soft delete failed:", err);
      alert("Soft delete failed");
    } finally {
      setBusyOrg(null);
    }
  }

  async function restoreOrg(org) {
    if (!window.confirm(`Restore organisation ${org.name}?`)) return;

    setBusyOrg(org.id);

    try {
      await updateDoc(doc(db, "organisations", org.id), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        status: "active",
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "ORG_RESTORED",
        orgId: org.id,
        orgName: org.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadOrgs();
    } catch (err) {
      console.error("❌ Restore failed:", err);
      alert("Restore failed");
    } finally {
      setBusyOrg(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading organisations…</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={header}>
        <h1>Organisations</h1>
        <button onClick={() => navigate("/super/orgs/create")} style={createBtn}>
          + Create Organisation
        </button>
      </div>

      <label style={toggleLabel}>
        <input
          type="checkbox"
          checked={showDeleted}
          onChange={() => setShowDeleted((v) => !v)}
          style={toggleInput}
        />
        <span style={{ fontWeight: 600 }}>
          {showDeleted ? "📂 View Active Organisations" : "🗑️ View Deleted Organisations"}
        </span>
      </label>

      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Org ID</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} style={tr}>
                <td style={{...td, fontWeight: "bold"}}>{org.name || "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", color: "#666" }}>{org.id}</td>
                <td style={td}>
                  <span style={statusBadge(org.status || "active")}>
                    {(org.status || "active").toUpperCase()}
                  </span>
                </td>
                
                <td style={td}>
                  {org.deleted === true ? (
                    <button
                      disabled={busyOrg === org.id}
                      onClick={() => restoreOrg(org)}
                      style={{ ...primaryBtn, background: "#2e7d32" }}
                    >
                      🔄 Restore
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      {org.status === "active" ? (
                        <button disabled={busyOrg === org.id} onClick={() => suspendOrg(org)} style={dangerBtn}>
                          ⏸️ Suspend
                        </button>
                      ) : (
                        <button disabled={busyOrg === org.id} onClick={() => activateOrg(org)} style={primaryBtn}>
                          ▶️ Activate
                        </button>
                      )}
                      <button
                        disabled={busyOrg === org.id}
                        onClick={() => softDeleteOrg(org)}
                        style={{ ...dangerBtn, background: "#6d4c41" }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={4} style={emptyRow}>
                  {showDeleted ? "No deleted organisations found." : "No active organisations found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* STYLES */
const tableContainer = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: "16px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };
const tr = { };
const createBtn = { padding: "10px 16px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: "pointer" };
const dangerBtn = { padding: "8px 12px", background: "#e53935", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const primaryBtn = { padding: "8px 12px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const toggleLabel = { marginBottom: 20, display: "inline-flex", alignItems: "center", cursor: "pointer", background: "#f1f5f9", padding: "10px 15px", borderRadius: 8 };
const toggleInput = { marginRight: 10, transform: "scale(1.2)" };
const emptyRow = { padding: 40, textAlign: "center", color: "#666" };

const statusBadge = (status) => ({
  padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold",
  background: status === "suspended" ? "#fff3e0" : status === "deleted" ? "#ffebee" : "#e8f5e9",
  color: status === "suspended" ? "#ef6c00" : status === "deleted" ? "#c62828" : "#2e7d32"
});
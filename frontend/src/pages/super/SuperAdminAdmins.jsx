import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function SuperAdminAdmins() {
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [admins, setAdmins] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [viewDeleted, setViewDeleted] = useState(false); // 🔄 New: Toggle between Active/Deleted
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [adminSnap, orgSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "admin"))),
        getDocs(collection(db, "organisations")),
      ]);

      setAdmins(adminSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setOrgs(orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("❌ Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  }

  async function log(action, payload = {}) {
    await addDoc(collection(db, "admin_actions"), {
      action,
      performedBy: user?.email || "unknown",
      createdAt: serverTimestamp(),
      ...payload,
    });
  }

  // 🛠️ RESTORE FUNCTION
  async function restoreAdmin(admin) {
    if (!window.confirm(`Restore access for ${admin.email}?`)) return;
    setBusyId(admin.id);
    try {
      await updateDoc(doc(db, "users", admin.id), {
        deleted: false,
        status: "active",
        updatedAt: serverTimestamp(),
      });
      await log("ADMIN_RESTORED", { adminEmail: admin.email, orgId: admin.orgId });
      await loadData();
    } catch (err) {
      alert("Failed to restore admin.");
    } finally {
      setBusyId(null);
    }
  }

  async function softDelete(admin) {
    if (!window.confirm(`Are you sure? This will block ${admin.email} and move them to the Deleted list.`)) return;
    setBusyId(admin.id);
    try {
      await updateDoc(doc(db, "users", admin.id), {
        deleted: true,
        status: "disabled",
        deletedAt: serverTimestamp(),
      });
      await log("ADMIN_SOFT_DELETED", { adminEmail: admin.email, orgId: admin.orgId });
      await loadData();
    } catch (err) {
      alert("Failed to delete admin.");
    } finally {
      setBusyId(null);
    }
  }

  /* ... Keep existing toggleAdmin, reassignAdmin, resendReset functions ... */
  async function toggleAdmin(admin, enable) {
    setBusyId(admin.id);
    try {
      await updateDoc(doc(db, "users", admin.id), {
        status: enable ? "active" : "disabled",
        updatedAt: serverTimestamp(),
      });
      await log(enable ? "ADMIN_ENABLED" : "ADMIN_DISABLED", { adminEmail: admin.email, orgId: admin.orgId });
      await loadData();
    } catch (err) { alert("Error updating status"); } finally { setBusyId(null); }
  }

  async function reassignAdmin(admin, newOrgId) {
    if (!newOrgId || newOrgId === admin.orgId) return;
    setBusyId(admin.id);
    try {
      await updateDoc(doc(db, "users", admin.id), { orgId: newOrgId, updatedAt: serverTimestamp() });
      await log("ADMIN_REASSIGNED", { adminEmail: admin.email, fromOrg: admin.orgId, toOrg: newOrgId });
      await loadData();
    } catch (err) { alert("Error reassigning"); } finally { setBusyId(null); }
  }

  async function resendReset(email) {
    try { await sendPasswordResetEmail(auth, email); alert("Reset email sent"); } catch(e) { alert("Failed"); }
  }

  // 🔍 Updated Filter Logic
  const visibleAdmins = useMemo(() => {
    return admins.filter((a) => {
      const isDeletedMatch = viewDeleted ? a.deleted === true : (a.deleted === false || !a.deleted);
      const orgName = orgs.find(o => o.id === a.orgId)?.name || "";
      const matchesSearch = a.email.toLowerCase().includes(search.toLowerCase()) || 
                           orgName.toLowerCase().includes(search.toLowerCase());
      const matchesOrgFilter = !filterOrg || a.orgId === filterOrg;
      
      return isDeletedMatch && matchesSearch && matchesOrgFilter;
    });
  }, [admins, search, filterOrg, orgs, viewDeleted]);

  if (loading) return <div style={{ padding: 24 }}>Loading admins…</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={header}>
        <h1>Admin Management {viewDeleted && <span style={{color: '#dc2626'}}>(Trash)</span>}</h1>
        <button onClick={() => navigate("/super/admins/create")} style={createBtn}>
          + Create New Admin
        </button>
      </div>

      {/* FILTERS BAR */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          placeholder="Search by email or org..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} style={selectStyle}>
          <option value="">All Organisations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        {/* 🔄 VIEW TOGGLE */}
        <button 
          onClick={() => setViewDeleted(!viewDeleted)} 
          style={viewDeleted ? btnActiveTab : btnGhost}
        >
          {viewDeleted ? "📂 Show Active" : "🗑️ Show Deleted"}
        </button>
      </div>

      {/* TABLE */}
      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={{ ...th, width: "30%" }}>Admin Email</th>
              <th style={{ ...th, width: "25%" }}>Organisation</th>
              <th style={{ ...th, width: "10%" }}>Status</th>
              <th style={{ ...th, width: "35%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleAdmins.map((a) => (
              <tr key={a.id} style={tr}>
                <td style={td}>{a.email}</td>
                <td style={td}>
                    <div style={{ fontWeight: 600 }}>{orgs.find(o => o.id === a.orgId)?.name || "N/A"}</div>
                    <div style={{ fontSize: 11, color: "#999" }}>{a.orgId}</div>
                </td>
                <td style={td}>
                  <span style={statusBadge(a.deleted ? "deleted" : a.status)}>
                    {a.deleted ? "deleted" : (a.status || "active")}
                  </span>
                </td>
                <td style={td}>
                  <div style={actionsWrapper}>
                    {viewDeleted ? (
                      // 🟢 ACTIONS FOR DELETED USERS
                      <button 
                        disabled={busyId === a.id} 
                        onClick={() => restoreAdmin(a)} 
                        style={btnPrimary}
                      >
                        🔄 Restore Admin
                      </button>
                    ) : (
                      // 🔴 ACTIONS FOR ACTIVE USERS
                      <>
                        <button onClick={() => resendReset(a.email)} style={btnWarn}>Reset</button>
                        <select
                          disabled={busyId === a.id}
                          onChange={(e) => reassignAdmin(a, e.target.value)}
                          defaultValue=""
                          style={selectInputSmall}
                        >
                          <option value="">Move Org</option>
                          {orgs.filter((o) => o.id !== a.orgId).map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                        {a.status === "disabled" ? (
                          <button onClick={() => toggleAdmin(a, true)} style={btnPrimary}>Enable</button>
                        ) : (
                          <button onClick={() => toggleAdmin(a, false)} style={btnDanger}>Disable</button>
                        )}
                        <button onClick={() => softDelete(a)} style={btnGhost}>Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleAdmins.length === 0 && (
          <div style={emptyBox}>
             <p>{viewDeleted ? "Trash is empty." : "No active admins found."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ... STYLES (Add these new buttons to your existing styles) ... */
const btnActiveTab = {
  height: "34px",
  padding: "0 12px",
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600
};

// Re-use your existing styles from the previous code block for th, td, tr, etc.
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 };
const tableContainer = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: "16px", verticalAlign: "middle" };
const tr = { borderBottom: "1px solid #f1f5f9" };
const actionsWrapper = { display: "flex", alignItems: "center", gap: "8px" };
const searchInput = { padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", width: "300px" };
const selectStyle = { padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" };
const createBtn = { padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" };
const btnPrimary = { height: "34px", padding: "0 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnDanger = { height: "34px", padding: "0 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnWarn = { height: "34px", padding: "0 12px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnGhost = { height: "34px", padding: "0 12px", background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer" };
const selectInputSmall = { height: "34px", padding: "0 8px", borderRadius: 6, border: "1px solid #e2e8f0" };
const emptyBox = { padding: "60px", textAlign: "center", color: "#94a3b8" };

const statusBadge = (status) => ({
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "bold",
    textTransform: "uppercase",
    background: status === "deleted" ? "#fef2f2" : (status === "disabled" ? "#fee2e2" : "#dcfce7"),
    color: status === "deleted" ? "#991b1b" : (status === "disabled" ? "#991b1b" : "#166534")
});
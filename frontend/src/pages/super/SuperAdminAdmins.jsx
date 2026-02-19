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
  const [viewDeleted, setViewDeleted] = useState(false); 
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

  const visibleAdmins = useMemo(() => {
    return admins.filter((a) => {
      const isDeletedMatch = viewDeleted ? a.deleted === true : (a.deleted === false || !a.deleted);
      const orgName = orgs.find(o => o.id === a.orgId)?.name || "";
      const matchesSearch = (a.email || "").toLowerCase().includes(search.toLowerCase()) || 
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

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          placeholder="Search by email or org..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} style={selectFilter}>
          <option value="">All Organisations</option>
          {orgs.filter(o => !o.deleted).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <button 
          onClick={() => setViewDeleted(!viewDeleted)} 
          style={viewDeleted ? btnActiveTab : btnGhostTab}
        >
          {viewDeleted ? "📂 Show Active" : "🗑️ Show Deleted"}
        </button>
      </div>

      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={{ ...th, width: "25%" }}>Admin Details</th>
              <th style={{ ...th, width: "25%" }}>Organisation</th>
              <th style={{ ...th, width: "10%" }}>Status</th>
              <th style={{ ...th, width: "40%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleAdmins.map((a) => (
              <tr key={a.id} style={tr}>
                <td style={td}>
                  <div style={{ fontWeight: "bold" }}>{a.displayName || "No Name"}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{a.email}</div>
                </td>
                <td style={td}>
                    <div style={{ fontWeight: 600 }}>{orgs.find(o => o.id === a.orgId)?.name || "Unassigned/Deleted"}</div>
                    <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>{a.orgId}</div>
                </td>
                <td style={td}>
                  <span style={statusBadge(a.deleted ? "deleted" : a.status)}>
                    {a.deleted ? "deleted" : (a.status || "active")}
                  </span>
                </td>
                <td style={td}>
                  <div style={actionsWrapper}>
                    {viewDeleted ? (
                      <button 
                        disabled={busyId === a.id} 
                        onClick={() => restoreAdmin(a)} 
                        style={btnRestore}
                      >
                        🔄 Restore Admin
                      </button>
                    ) : (
                      <>
                        {/* 🟢 STRICT FIXED-WIDTH ACTION BUTTONS */}
                        <button onClick={() => resendReset(a.email)} style={btnActionReset}>Reset</button>
                        
                        <select
                          disabled={busyId === a.id}
                          onChange={(e) => reassignAdmin(a, e.target.value)}
                          value={a.orgId || ""}
                          style={selectActionOrg}
                        >
                          <option value="">Move Org</option>
                          {orgs.filter((o) => !o.deleted).map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                        
                        {a.status === "disabled" ? (
                          <button onClick={() => toggleAdmin(a, true)} style={btnActionEnable}>Enable</button>
                        ) : (
                          <button onClick={() => toggleAdmin(a, false)} style={btnActionDisable}>Disable</button>
                        )}
                        
                        <button onClick={() => softDelete(a)} style={btnActionDelete}>Delete</button>
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

/* STYLES */
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 };
const tableContainer = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" };
const table = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }; // 🟢 Ensures columns don't shift randomly
const th = { textAlign: "left", padding: "16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: "16px", verticalAlign: "middle" };
const tr = { borderBottom: "1px solid #f1f5f9" };
const searchInput = { padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", width: "300px", fontSize: 14 };
const selectFilter = { padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14 };
const emptyBox = { padding: "60px", textAlign: "center", color: "#94a3b8", fontSize: 16 };

/* 🟢 STRICT FIXED ACTION STYLES */
const actionsWrapper = { display: "flex", alignItems: "center", gap: "8px" };

const btnActionReset = { height: "34px", width: "70px", padding: 0, background: "#fb8c00", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", textAlign: "center" };
const selectActionOrg = { height: "34px", width: "140px", padding: "0 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" };
const btnActionEnable = { height: "34px", width: "80px", padding: 0, background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", textAlign: "center" };
const btnActionDisable = { height: "34px", width: "80px", padding: 0, background: "#e53935", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", textAlign: "center" };
const btnActionDelete = { height: "34px", width: "75px", padding: 0, background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontWeight: "bold", textAlign: "center" };

const btnRestore = { height: "34px", padding: "0 16px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const createBtn = { padding: "10px 20px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 };
const btnActiveTab = { height: "38px", padding: "0 15px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
const btnGhostTab = { height: "38px", padding: "0 15px", background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontWeight: 600 };

const statusBadge = (status) => ({
    padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase",
    background: status === "deleted" ? "#ffebee" : (status === "disabled" ? "#fff3e0" : "#e8f5e9"),
    color: status === "deleted" ? "#c62828" : (status === "disabled" ? "#ef6c00" : "#2e7d32")
});
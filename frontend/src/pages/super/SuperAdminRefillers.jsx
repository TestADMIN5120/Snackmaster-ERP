import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebaseClient";

export default function SuperAdminRefillers() {
  const [refillers, setRefillers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewRefiller, setViewRefiller] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [refillerSnap, orgSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "refiller"))),
        getDocs(collection(db, "organisations")),
      ]);

      setRefillers(refillerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setOrgs(orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("❌ Failed to load refiller data", err);
    } finally {
      setLoading(false);
    }
  }

  const orgName = (orgId) => orgs.find((o) => o.id === orgId)?.name || "Unassigned/Deleted";

  const visibleRefillers = useMemo(() => {
    return refillers.filter((r) => {
      const org = orgName(r.orgId);
      const matchesSearch =
        (r.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.email || "").toLowerCase().includes(search.toLowerCase()) ||
        org.toLowerCase().includes(search.toLowerCase());
      const matchesOrgFilter = !filterOrg || r.orgId === filterOrg;
      return matchesSearch && matchesOrgFilter;
    });
  }, [refillers, search, filterOrg, orgs]);

  if (loading) return <div style={{ padding: 24 }}>Loading refillers…</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={header}>
        <h1>Refillers</h1>
        <div style={{ fontSize: 14, color: "#64748b" }}>Total: {visibleRefillers.length}</div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Search by name, email or org..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} style={selectFilter}>
          <option value="">All Organisations</option>
          {orgs.filter((o) => !o.deleted).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={{ ...th, width: "22%" }}>Refiller Details</th>
              <th style={{ ...th, width: "18%" }}>Organisation</th>
              <th style={{ ...th, width: "15%" }}>Phone</th>
              <th style={{ ...th, width: "15%" }}>Status</th>
              <th style={{ ...th, width: "15%" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRefillers.map((r) => (
              <tr key={r.id} style={tr}>
                <td style={td}>
                  <div style={{ fontWeight: "bold" }}>{r.displayName || "No Name"}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{r.email}</div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{orgName(r.orgId)}</div>
                  <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>{r.orgId}</div>
                </td>
                <td style={td}>{r.phone || "—"}</td>
                <td style={td}>
                  <span style={statusBadge(r.deleted ? "deleted" : r.status)}>
                    {r.deleted ? "deleted" : (r.status || "active")}
                  </span>
                </td>
                <td style={td}>
                  <button onClick={() => setViewRefiller(r)} style={btnView}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRefillers.length === 0 && (
          <div style={emptyBox}>
            <p>No refillers found.</p>
          </div>
        )}
      </div>

      {/* VIEW REFILLER MODAL */}
      {viewRefiller && (
        <div style={backdrop} onClick={() => setViewRefiller(null)}>
          <div style={viewModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Refiller Details</h2>
            <div style={viewRow}><b>Name:</b> {viewRefiller.displayName || "—"}</div>
            <div style={viewRow}><b>Email:</b> {viewRefiller.email || "—"}</div>
            <div style={viewRow}><b>Organisation:</b> {orgName(viewRefiller.orgId)}</div>
            <div style={viewRow}><b>Status:</b> {viewRefiller.deleted ? "deleted" : (viewRefiller.status || "active")}</div>
            <div style={viewRow}><b>Address:</b> {viewRefiller.address || "—"}</div>
            <div style={viewRow}><b>Phone Number:</b> {viewRefiller.phone || "—"}</div>
            <div style={viewRow}><b>Primary Contact:</b> {viewRefiller.primaryContact || "—"}</div>
            <div style={viewRow}><b>Secondary Contact:</b> {viewRefiller.secondaryContact || "—"}</div>
            <div style={viewRow}>
              <b>Address / Identity Proof:</b>{" "}
              {viewRefiller.proofDocUrl ? (
                <a href={viewRefiller.proofDocUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1e88e5" }}>
                  📎 View document
                </a>
              ) : "—"}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setViewRefiller(null)} style={btnSecondary}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* STYLES */
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 };
const tableContainer = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden" };
const table = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };
const th = { textAlign: "left", padding: "16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: "16px", verticalAlign: "middle" };
const tr = { borderBottom: "1px solid #f1f5f9" };
const searchInput = { padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", width: "300px", fontSize: 14 };
const selectFilter = { padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14 };
const emptyBox = { padding: "60px", textAlign: "center", color: "#94a3b8", fontSize: 16 };

const btnView = { height: "34px", padding: "0 16px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnSecondary = { padding: "10px 16px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };

const backdrop = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const viewModal = { background: "#fff", padding: 24, borderRadius: 12, width: "420px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const viewRow = { padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 };

const statusBadge = (status) => ({
  padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase",
  background: status === "deleted" ? "#ffebee" : (status === "disabled" ? "#fff3e0" : "#e8f5e9"),
  color: status === "deleted" ? "#c62828" : (status === "disabled" ? "#ef6c00" : "#2e7d32")
});

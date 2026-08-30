import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import EditMachineModal from "../../components/EditMachineModal";

export default function SuperAdminMachines() {
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [machines, setMachines] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [viewingMachine, setViewingMachine] = useState(null);
  const [editingMachine, setEditingMachine] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [machineSnap, orgSnap] = await Promise.all([
      getDocs(collection(db, "machines")),
      getDocs(collection(db, "organisations")),
    ]);

    setMachines(machineSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setOrgs(orgSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  function getOrgName(orgId) {
    if (!orgId) return "UNASSIGNED";
    return orgs.find(o => o.id === orgId)?.name || orgId;
  }

  /* ───────── ASSIGN / REASSIGN ───────── */
  async function assignMachine(machine, newOrgId) {
    if (!newOrgId) return;

    const isReassign = !!machine.orgId;
    setBusyId(machine.id);

    try {
      await updateDoc(doc(db, "machines", machine.id), {
        orgId: newOrgId,
        assigned: true,
        status: "active",
        disabledReason: null,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: isReassign ? "MACHINE_REASSIGNED" : "MACHINE_ASSIGNED",
        machineId: machine.id,
        fromOrg: machine.orgId || null,
        toOrg: newOrgId,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadData();
    } catch (err) {
      console.error("Machine assign/reassign failed", err);
      alert("Failed to assign machine.");
    } finally {
      setBusyId(null);
    }
  }

  /* ───────── UNASSIGN ───────── */
  async function unassignMachine(machine) {
    if (!window.confirm("Unassign this machine?")) return;

    setBusyId(machine.id);

    try {
      await updateDoc(doc(db, "machines", machine.id), {
        orgId: null,
        assigned: false,
        status: "unassigned",
        disabledReason: null,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "MACHINE_UNASSIGNED",
        machineId: machine.id,
        fromOrg: machine.orgId,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadData();
    } catch (err) {
      console.error("Unassign failed", err);
      alert("Failed to unassign machine.");
    } finally {
      setBusyId(null);
    }
  }

  /* ───────── SOFT DELETE ───────── */
  async function softDeleteMachine(machine) {
    if (!window.confirm(`Soft delete machine ${machine.id}?`)) return;

    setBusyId(machine.id);

    try {
      await updateDoc(doc(db, "machines", machine.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user?.email || "unknown",
        status: "deleted",
        assigned: false,
        orgId: null,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "MACHINE_SOFT_DELETED",
        machineId: machine.id,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadData();
    } catch (err) {
      console.error("Machine soft delete failed", err);
      alert("Soft delete failed");
    } finally {
      setBusyId(null);
    }
  }

  /* ───────── RESTORE ───────── */
  async function restoreMachine(machine) {
    if (!window.confirm(`Restore machine ${machine.id}?`)) return;

    setBusyId(machine.id);

    try {
      await updateDoc(doc(db, "machines", machine.id), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        status: "unassigned",
        assigned: false,
        orgId: null,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "MACHINE_RESTORED",
        machineId: machine.id,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadData();
    } catch (err) {
      console.error("Machine restore failed", err);
      alert("Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  function formatTimestamp(ts) {
    if (!ts || !ts.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleString("en-IN");
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading machines...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* HEADER */}
      <div style={header}>
        <h1>Machines</h1>
        <button
          onClick={() => navigate("/super/machines/create")}
          style={createBtn}
        >
          + Create Machine
        </button>
      </div>

      {/* TABLE */}
      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Type</th>
              <th style={th}>Status</th>
              <th style={th}>Organisation</th>
              <th style={th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {machines.map((m) => (
              <tr key={m.id} style={tr}>
                <td style={td}>{m.id}</td>
                <td style={td}>{m.name || "\u2014"}</td>
                <td style={td}>{m.machineType || "\u2014"}</td>

                <td style={td}>
                  <b>{m.status}</b>
                  {m.disabledReason && (
                    <div style={{ fontSize: 12, color: "#c62828" }}>
                      {m.disabledReason}
                    </div>
                  )}
                </td>

                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{getOrgName(m.orgId)}</div>
                </td>

                <td style={td}>
                  <div style={actionsRow}>
                    <button style={btnView} onClick={() => setViewingMachine(m)}>View</button>
                    {!m.deleted && (
                      <button style={btnEdit} onClick={() => setEditingMachine(m)}>Edit</button>
                    )}

                    {m.deleted ? (
                      <button
                        disabled={busyId === m.id}
                        onClick={() => restoreMachine(m)}
                        style={btnRestore}
                      >
                        Restore
                      </button>
                    ) : m.orgId ? (
                      <>
                        <select
                          disabled={busyId === m.id}
                          onChange={(e) => assignMachine(m, e.target.value)}
                          defaultValue=""
                          style={selectAction}
                        >
                          <option value="">Reassign</option>
                          {orgs
                            .filter((o) => o.id !== m.orgId && !o.deleted)
                            .map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>

                        <button
                          disabled={busyId === m.id}
                          onClick={() => unassignMachine(m)}
                          style={btnDanger}
                        >
                          Unassign
                        </button>
                      </>
                    ) : (
                      <>
                        <select
                          disabled={busyId === m.id}
                          onChange={(e) => assignMachine(m, e.target.value)}
                          defaultValue=""
                          style={selectAction}
                        >
                          <option value="">Assign to org</option>
                          {orgs.filter(o => !o.deleted).map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>

                        <button
                          disabled={busyId === m.id}
                          onClick={() => softDeleteMachine(m)}
                          style={btnDanger}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {machines.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 20, color: "#777" }}>
                  No machines found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW MACHINE DETAILS MODAL */}
      {viewingMachine && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Machine Details</h2>
              <button style={btnClose} onClick={() => setViewingMachine(null)}>Close</button>
            </div>

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>Machine ID</span><span style={detailValue}>{viewingMachine.id}</span></div>
              <div style={detailRow}><span style={detailLabel}>Name</span><span style={detailValue}>{viewingMachine.name || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Machine Type</span><span style={detailValue}>{viewingMachine.machineType || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Status</span><span style={detailValue}><b>{viewingMachine.status || "-"}</b></span></div>
            </div>

            <div style={sectionDivider} />

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>Location</span><span style={detailValue}>{viewingMachine.location || "-"}</span></div>
              <div style={detailRow}>
                <span style={detailLabel}>Google Maps</span>
                <span style={detailValue}>
                  {viewingMachine.googleMapsUrl ? (
                    <a href={viewingMachine.googleMapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1e88e5", textDecoration: "underline" }}>
                      Open Map
                    </a>
                  ) : "-"}
                </span>
              </div>
              <div style={detailRow}><span style={detailLabel}>Capacity</span><span style={detailValue}>{viewingMachine.capacity || "-"}</span></div>
            </div>

            <div style={sectionDivider} />

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>Organisation</span><span style={detailValue}>{getOrgName(viewingMachine.orgId)}</span></div>
              <div style={detailRow}><span style={detailLabel}>Assigned</span><span style={detailValue}>{viewingMachine.assigned ? "Yes" : "No"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Assigned Refiller</span><span style={detailValue}>{viewingMachine.assignedEmail || "-"}</span></div>
            </div>

            <div style={sectionDivider} />

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>Created At</span><span style={detailValue}>{formatTimestamp(viewingMachine.createdAt)}</span></div>
              <div style={detailRow}><span style={detailLabel}>Last Updated</span><span style={detailValue}>{formatTimestamp(viewingMachine.updatedAt)}</span></div>
              <div style={detailRow}><span style={detailLabel}>Last Refill</span><span style={detailValue}>{formatTimestamp(viewingMachine.lastRefillCompletedAt || viewingMachine.last_refill_at)}</span></div>
            </div>

            {!viewingMachine.deleted && (
              <div style={{ marginTop: 16 }}>
                <button style={btnEditLarge} onClick={() => { setViewingMachine(null); setEditingMachine(viewingMachine); }}>
                  Edit Machine
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT MACHINE MODAL (reuse existing component) */}
      {editingMachine && (
        <EditMachineModal
          machine={editingMachine}
          onClose={() => { setEditingMachine(null); loadData(); }}
        />
      )}
    </div>
  );
}

/* ───────── STYLES ───────── */

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
};

const tableContainer = {
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  overflow: "hidden",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const th = {
  textAlign: "left",
  padding: "14px 10px",
  background: "#f8fafc",
  borderBottom: "2px solid #e2e8f0",
  fontWeight: 600,
  color: "#64748b",
  fontSize: 13,
  textTransform: "uppercase",
};

const td = {
  padding: "12px 10px",
  verticalAlign: "middle",
  fontSize: 14,
};

const tr = {
  borderBottom: "1px solid #f1f5f9",
};

const actionsRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const createBtn = {
  padding: "8px 14px",
  fontSize: 13,
  background: "#1e88e5",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
};

const btnView = {
  padding: "5px 10px",
  background: "#e3f2fd",
  color: "#1565c0",
  border: "1px solid #90caf9",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 12,
};

const btnEdit = {
  padding: "5px 10px",
  background: "#fff3e0",
  color: "#e65100",
  border: "1px solid #ffcc80",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 12,
};

const btnDanger = {
  padding: "5px 10px",
  background: "#e53935",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 12,
};

const btnRestore = {
  padding: "5px 10px",
  background: "#2e7d32",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 12,
};

const selectAction = {
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 12,
  background: "#fff",
  cursor: "pointer",
};

const btnEditLarge = {
  padding: "10px 20px",
  background: "#1e88e5",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};

const btnClose = {
  padding: "8px 16px",
  background: "#e2e8f0",
  color: "#475569",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};

const modalOverlay = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(15, 23, 42, 0.6)",
  display: "flex", justifyContent: "center", alignItems: "center",
  zIndex: 1000,
};

const modalBox = {
  background: "#fff", padding: 24, borderRadius: 12,
  width: 520, maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
};

const sectionDivider = { borderTop: "1px solid #e2e8f0", margin: "12px 0" };
const detailSection = { display: "flex", flexDirection: "column", gap: 8 };
const detailRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0" };
const detailLabel = { fontSize: 13, fontWeight: "bold", color: "#64748b", minWidth: 140 };
const detailValue = { fontSize: 14, color: "#1e293b", textAlign: "right", flex: 1, wordBreak: "break-word" };

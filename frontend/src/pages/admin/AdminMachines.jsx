// frontend/src/pages/admin/AdminMachines.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

import FilterBar from "../../components/AdminMachines/FilterBar";
import Pagination from "../../components/AdminMachines/Pagination";
import EditMachineModal from "../../components/EditMachineModal";

export default function AdminMachines() {
  const nav = useNavigate();
  const { user, orgId } = useAdmin(); 

  const [machines, setMachines] = useState([]);
  const [refillers, setRefillers] = useState([]);
  const [editMachine, setEditMachine] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  /** LOAD MACHINES LIVE (Filtered by Org) */
  useEffect(() => {
    if (!orgId) return;

    setLoading(true);
    
    // 🟢 SECURE QUERY: Only my Org, Only active (not deleted)
    const q = query(
      collection(db, "machines"),
      where("orgId", "==", orgId),
      where("deleted", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMachines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("❌ Machine Access Denied:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  /** LOAD REFILLERS (Filtered by Org) */
  useEffect(() => {
    async function loadRefillers() {
      if (!orgId) return;
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "refiller"),
          where("orgId", "==", orgId),
          where("deleted", "==", false)
        );
        const s = await getDocs(q);
        setRefillers(s.docs.map((d) => ({ uid: d.id, ...d.data() })));
      } catch (e) {
        console.error("Failed to load refillers", e);
      }
    }
    loadRefillers();
  }, [orgId]);

  useEffect(() => setCurrentPage(1), [search, statusFilter, pageSize]);

  /** FILTER MACHINES */
  const filtered = useMemo(() => {
    const txt = search.toLowerCase();
    return machines.filter((m) => {
      const matchesSearch =
        m.id.toLowerCase().includes(txt) ||
        (m.name || "").toLowerCase().includes(txt) ||
        (m.location || "").toLowerCase().includes(txt);

      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [machines, search, statusFilter]);

  /** PAGINATE */
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /** UPDATE STATUS */
  async function updateStatus(machineId, newStatus) {
    try {
      await updateDoc(doc(db, "machines", machineId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        actorEmail: user.email, 
        actorUid: user.uid,
        orgId: orgId, 
        actionType: "change_status",
        machineId,
        newStatus,
        createdAt: serverTimestamp(),
      });
    } catch {
      alert("Failed to update status.");
    }
  }

  // ❌ Removed deleteMachine function. Admins cannot delete machines anymore.

  if (loading) return <div style={{ padding: 24 }}>Loading machines...</div>;

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Manage Machines</h1>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnPurple} onClick={() => nav("/admin/machines/assign")}>
            Assign Machines to Team
          </button>
          {/* ❌ Removed + Add Machine button */}
        </div>
      </div>

      <FilterBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* MACHINES TABLE */}
      <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse" }}>
        <thead style={{ background: "#f1f1f1" }}>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Name</th>
            <th style={th}>Location</th>
            <th style={th}>Capacity</th>
            <th style={th}>Status</th>
            <th style={th}>Assigned To</th>
            <th style={th}>Last Refill</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {paged.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={td}>{m.id}</td>
              <td style={td}>{m.name || "-"}</td>
              <td style={td}>{m.location || "-"}</td>
              <td style={td}>{m.capacity || "-"}</td>

              <td style={td}>
                <select
                  value={m.status || "active"}
                  onChange={(e) => updateStatus(m.id, e.target.value)}
                  style={{ padding: 6, borderRadius: 6 }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="service-down">Service Down</option>
                  <option value="issue_reported">Issue Reported</option>
                </select>
              </td>

              <td style={td}>
                 {m.assignedEmail ? (
                    <span style={{fontSize:12, fontWeight:500}}>{m.assignedEmail}</span>
                 ) : (
                    <span style={{color:'#999', fontSize:12}}>Unassigned</span>
                 )}
              </td>

              <td style={td}>
                {m.lastRefillCompletedAt?.seconds
                  ? new Date(m.lastRefillCompletedAt.seconds * 1000).toLocaleString("en-IN")
                  : "-"}
              </td>

              <td style={td}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button style={btnSecondary} onClick={() => setEditMachine(m)}>
                    Edit Details
                  </button>

                  <button
                    style={btnPurple}
                    onClick={() => nav(`/admin/machines/${m.id}/slots`)}
                  >
                    Configure Slots
                  </button>
                  {/* ❌ Removed Delete Button */}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {machines.length === 0 && (
        <div style={{padding:40, textAlign:'center', color:'#666'}}>
            No machines found for your organization. Contact SuperAdmin to register a machine.
        </div>
      )}

      <Pagination
        total={filtered.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
      />

      {editMachine && <EditMachineModal machine={editMachine} onClose={() => setEditMachine(null)} />}
    </div>
  );
}

/* styles */
const th = { textAlign: "left", padding: "10px", fontWeight: 700, fontSize: 14 };
const td = { padding: "10px", fontSize: 14 };

const btnSecondary = { padding: "6px 10px", background: "#3498db", borderRadius: 6, color: "#fff", border:'none', cursor:'pointer' };
const btnPurple = { padding: "6px 10px", background: "#6f42c1", borderRadius: 6, color: "#fff", border:'none', cursor:'pointer' };
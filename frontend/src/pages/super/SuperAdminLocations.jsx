import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";

export default function SuperAdminLocations() {
  const { user } = useAdmin();
  const navigate = useNavigate();

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    loadLocations();
  }, [showDeleted]);

  async function loadLocations() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "locations"),
        where("deleted", "==", showDeleted)
      );
      const snap = await getDocs(q);
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("❌ Error loading locations:", error);
    } finally {
      setLoading(false);
    }
  }

  /* ───────── ACTIONS ───────── */

  async function suspendLocation(location) {
    if (!window.confirm(`Suspend ${location.name}?`)) return;

    setBusyId(location.id);
    try {
      await updateDoc(doc(db, "locations", location.id), {
        status: "suspended",
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "LOCATION_SUSPENDED",
        entityType: "location",
        entityId: location.id,
        entityName: location.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadLocations();
    } catch (err) {
      console.error("❌ Suspend failed:", err);
      alert("Suspend failed");
    } finally {
      setBusyId(null);
    }
  }

  async function activateLocation(location) {
    setBusyId(location.id);
    try {
      await updateDoc(doc(db, "locations", location.id), {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "LOCATION_ACTIVATED",
        entityType: "location",
        entityId: location.id,
        entityName: location.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadLocations();
    } catch (err) {
      console.error("❌ Activate failed:", err);
      alert("Activate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function softDeleteLocation(location) {
    if (!window.confirm(`Soft delete ${location.name}? This hides it from the active system.`)) return;

    setBusyId(location.id);
    try {
      await updateDoc(doc(db, "locations", location.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user?.email || "unknown",
        status: "deleted",
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "LOCATION_SOFT_DELETED",
        entityType: "location",
        entityId: location.id,
        entityName: location.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadLocations();
    } catch (err) {
      console.error("❌ Soft delete failed:", err);
      alert("Soft delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function restoreLocation(location) {
    if (!window.confirm(`Restore location ${location.name}?`)) return;

    setBusyId(location.id);
    try {
      await updateDoc(doc(db, "locations", location.id), {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        status: "active",
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_actions"), {
        action: "LOCATION_RESTORED",
        entityType: "location",
        entityId: location.id,
        entityName: location.name,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      await loadLocations();
    } catch (err) {
      console.error("❌ Restore failed:", err);
      alert("Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading locations…</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={header}>
        <h1>Locations</h1>
        <button onClick={() => navigate("/super/locations/create")} style={createBtn}>
          + Add Location
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
          {showDeleted ? "📂 View Active Locations" : "🗑️ View Deleted Locations"}
        </span>
      </label>

      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Address</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id} style={tr}>
                <td style={{ ...td, fontWeight: "bold" }}>{location.name || "—"}</td>
                <td style={td}>{location.address || "—"}</td>
                <td style={td}>
                  <span style={statusBadge(location.status || "active")}>
                    {(location.status || "active").toUpperCase()}
                  </span>
                </td>
                <td style={td}>
                  {location.deleted === true ? (
                    <button
                      disabled={busyId === location.id}
                      onClick={() => restoreLocation(location)}
                      style={{ ...primaryBtn, background: "#2e7d32" }}
                    >
                      🔄 Restore
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      {location.status === "active" ? (
                        <button disabled={busyId === location.id} onClick={() => suspendLocation(location)} style={dangerBtn}>
                          ⏸️ Suspend
                        </button>
                      ) : (
                        <button disabled={busyId === location.id} onClick={() => activateLocation(location)} style={primaryBtn}>
                          ▶️ Activate
                        </button>
                      )}
                      <button
                        disabled={busyId === location.id}
                        onClick={() => softDeleteLocation(location)}
                        style={{ ...dangerBtn, background: "#6d4c41" }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={4} style={emptyRow}>
                  {showDeleted ? "No deleted locations found." : "No active locations found."}
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
const tr = {};
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

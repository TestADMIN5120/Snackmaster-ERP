import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function RefillerMachines() {
  const { orgId } = useAdmin();
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) loadMachines();
  }, [orgId]);

  async function loadMachines() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "machines"),
          where("orgId", "==", orgId),
          where("status", "==", "active")
        )
      );
      setMachines(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading machines:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Searching for machines...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Assigned Machines</h2>
      {machines.length === 0 ? (
        <div style={empty}>No active machines found for your organization.</div>
      ) : (
        machines.map(m => (
          <div key={m.id} onClick={() => navigate(`/refiller/machines/${m.id}`)} style={card}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{m.name}</div>
            <div style={{ color: "#666", fontSize: 14 }}>📍 {m.location || "No location set"}</div>
          </div>
        ))
      )}
    </div>
  );
}

const card = { background: "#fff", padding: 16, borderRadius: 10, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", cursor: "pointer", border: "1px solid #eee" };
const empty = { textAlign: "center", padding: 40, color: "#888" };
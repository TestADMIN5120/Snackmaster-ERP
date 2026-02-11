import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function RefillerHistory() {
  const { user } = useAdmin();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) load();
  }, [user]);

  async function load() {
    try {
      const snap = await getDocs(
        query(
          collection(db, "refill_logs"),
          where("userEmail", "==", user.email),
          orderBy("createdAt", "desc")
        )
      );
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading history...</div>;

  return (
    <div>
      <h2>My Refill History</h2>
      {logs.length === 0 ? <p>No logs found.</p> : logs.map((l) => (
        <div key={l.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <b>{l.machineName || "Unknown Machine"}</b>
            <span style={{ fontSize: 12, color: "#888" }}>
              {l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString() : "Recently"}
            </span>
          </div>
          <div style={{ marginTop: 5, color: "#166534", fontWeight: 600 }}>
            Refilled to {l.newPercent}%
          </div>
        </div>
      ))}
    </div>
  );
}

const card = { background: "#fff", padding: 14, borderRadius: 8, marginBottom: 10, borderLeft: "4px solid #1e88e5", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" };
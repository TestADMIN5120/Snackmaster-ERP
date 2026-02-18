import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";

export default function RefillerDashboard() {
  const { user } = useAdmin();
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "machines"),
      where("assignedTo", "==", user.uid),
      where("deleted", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMachines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div>
      {/* 🟢 UPDATED HEADER WITH BUTTON */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <h1 style={{ margin:0, color: "#333" }}>My Machines</h1>
        <button 
          onClick={() => navigate("/refiller/history")}
          style={{padding:'10px 16px', background:'#546e7a', color:'white', border:'none', borderRadius:6, cursor:'pointer'}}
        >
          📜 View History
        </button>
      </div>

      {loading && <p>Loading...</p>}

      <div style={grid}>
        {machines.map((m) => (
          <div key={m.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3>{m.name || m.id}</h3>
              <span style={{ fontWeight: "bold", color: m.status === 'active' ? 'green' : 'orange' }}>
                {m.status?.toUpperCase().replace("_", " ")}
              </span>
            </div>
            <p>📍 {m.location}</p>
            <button
              onClick={() => navigate(`/refiller/machines/${m.id}`)}
              style={actionBtn}
            >
              Manage Machine →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 };
const card = { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #eaeaea" };
const actionBtn = { marginTop: 15, width: "100%", padding: 12, background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "600" };
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function RefillerMachineView() {
  const { machineId } = useParams();
  const navigate = useNavigate();

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "#1e88e5", cursor: "pointer", marginBottom: 10 }}>
        ← Back to list
      </button>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <h2 style={{ margin: 0 }}>Machine Details</h2>
        <p style={{ color: "#666" }}>ID: {machineId}</p>
        
        <button onClick={() => navigate(`/refiller/machines/${machineId}/slots`)} style={btn}>
          Start Refill Process
        </button>
      </div>
    </div>
  );
}

const btn = { marginTop: 20, padding: "16px", width: "100%", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" };
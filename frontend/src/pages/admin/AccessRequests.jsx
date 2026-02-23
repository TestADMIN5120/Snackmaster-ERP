import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import axios from "axios";

export default function AccessRequests() {
  const { user } = useAdmin();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    // Admins see all pending requests. (Can be filtered by orgId if needed later)
    const q = query(collection(db, "password_requests"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleResetPassword(requestId, targetEmail) {
    if (!window.confirm(`Reset password for ${targetEmail} to 'Welcome@123'?`)) return;
    setProcessingId(requestId);

    try {
      const rawUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
      const backendUrl = rawUrl.replace(/\/api$/, "");

      // Call Backend to change password via Admin SDK
      const res = await axios.post(`${backendUrl}/api/admin-reset-password`, {
        targetEmail: targetEmail,
        newPassword: "Welcome@123",
        adminEmail: user.email
      });

      if (res.data.ok) {
        // Update Firestore request status
        await updateDoc(doc(db, "password_requests", requestId), {
          status: "resolved",
          resolvedAt: serverTimestamp(),
          resolvedBy: user.email
        });
        alert(`✅ Password reset to Welcome@123 for ${targetEmail}`);
      }
    } catch (err) {
      console.error("Reset failed", err);
      alert("Failed to reset password. Check backend logs.");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading requests...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 20 }}>🔑 Access & Password Requests</h1>
      
      {requests.length === 0 ? (
        <div style={{ padding: 40, background: "#fff", textAlign: "center", borderRadius: 12, border: "1px solid #e2e8f0", color: "#64748b" }}>
          No pending password reset requests.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {requests.map(req => (
            <div key={req.id} style={{ padding: 20, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{req.email}</h3>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Requested: {req.requestedAt?.toDate().toLocaleString() || "Just now"}
                </div>
              </div>
              <button 
                onClick={() => handleResetPassword(req.id, req.email)} 
                disabled={processingId === req.id}
                style={{ padding: "10px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontWeight: "bold", cursor: processingId === req.id ? "not-allowed" : "pointer" }}
              >
                {processingId === req.id ? "Resetting..." : "Reset to Default (Welcome@123)"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
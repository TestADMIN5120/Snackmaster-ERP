import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext"; 
import { createSecondaryUser } from "../../utils/authHelpers"; 

export default function AdminUsers() {
  const { user, orgId } = useAdmin(); 
  const [users, setUsers] = useState([]);

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");

  // LOAD REFILLERS FOR THIS ORG
  useEffect(() => {
    if (!orgId) return;

    // 🟢 SECURE QUERY: Only Refillers in my Org
    const q = query(
        collection(db, "users"), 
        where("orgId", "==", orgId),
        where("role", "==", "refiller")
    ); 

    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("❌ Read Error:", error);
    });
    return () => unsub();
  }, [orgId]);

  // 🟢 ADD NEW REFILLER (SECURE CREATION)
  async function createRefiller() {
    const emailClean = newEmail.trim();
    const passClean = newPassword;

    if (!emailClean.includes("@")) return alert("Invalid Email");
    if (passClean.length < 6) return alert("Password must be 6+ chars");
    if (!newName) return alert("Name is required");

    setLoading(true);
    try {
      const userData = {
        displayName: newName,
        role: "refiller", // 🔒 Forced Role
        orgId: orgId, // 🔒 Forced Org
        createdBy: user.email,
        status: "active", // 🟢 CRITICAL: Allows login
        deleted: false    // 🟢 CRITICAL: Prevents ghosting
      };

      await createSecondaryUser(emailClean, passClean, userData);

      alert(`✅ Refiller created!\n\nEmail: ${emailClean}\nPassword: ${passClean}\n\nThey can now log into the Refiller App.`);
      setShowAdd(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");

    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        alert("Error: This email is already registered.");
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // UPDATE USER
  async function updateUser() {
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        displayName: editName,
      });
      alert("Refiller updated!");
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("Update failed");
    }
  }

  // SOFT DELETE USER (Don't hard delete, respect audit trails)
  async function deleteUser(id, name) {
    if (!confirm(`Remove ${name} from your team? They will no longer be able to log in.`)) return;
    try {
      // 🟢 SOFT DELETE
      await updateDoc(doc(db, "users", id), {
        deleted: true,
        status: "disabled"
      });
      alert("Refiller removed.");
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
        <h1>Manage Route Team (Refillers)</h1>
        <button onClick={() => setShowAdd(true)} style={addBtn}>+ Add Refiller</button>
      </div>

      {/* USERS TABLE */}
      <div style={tableContainer}>
        <table style={table}>
            <thead style={{ background: "#f8fafc" }}>
            <tr>
                <th style={th}>Refiller Name</th>
                <th style={th}>Email / Login</th>
                <th style={th}>Role</th>
                <th style={th}>Actions</th>
            </tr>
            </thead>

            <tbody>
            {users.filter(u => !u.deleted).map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{...td, fontWeight: "bold"}}>{u.displayName || "-"}</td>
                <td style={{...td, color: "#666"}}>{u.email}</td>
                <td style={td}>
                    <span style={badgeRefiller}>REFILLER</span>
                </td>

                <td style={td}>
                    <button
                    style={btnSecondary}
                    onClick={() => {
                        setEditingUser(u);
                        setEditName(u.displayName || "");
                    }}
                    >
                    Edit Name
                    </button>

                    <button style={btnDanger} onClick={() => deleteUser(u.id, u.displayName)}>
                    Remove
                    </button>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        {users.filter(u => !u.deleted).length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>You have no refillers on your team yet.</div>
        )}
      </div>

      {/* ADD REFILLER MODAL */}
      {showAdd && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2 style={{marginTop: 0}}>Add Route Refiller</h2>
            
            <label style={label}>Full Name</label>
            <input placeholder="e.g. Mike Smith" value={newName} onChange={(e) => setNewName(e.target.value)} style={input} />

            <label style={label}>Login Email</label>
            <input type="email" placeholder="mike@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={input} />

            <label style={label}>Temporary Password</label>
            <input type="text" placeholder="Set Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={input} />

            <div style={{background: "#e0f2fe", padding: 10, borderRadius: 6, fontSize: 12, color: "#0284c7", marginBottom: 15, border: "1px solid #bae6fd"}}>
              ℹ️ This refiller will be permanently locked to your organization. They cannot see machines from other orgs.
            </div>

            <div style={{display:'flex', gap:10}}>
                <button style={btnPrimary} onClick={createRefiller} disabled={loading}>
                    {loading ? "Creating..." : "Create Account"}
                </button>
                <button style={btnCancel} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2 style={{marginTop: 0}}>Edit Refiller</h2>
            <label style={label}>Full Name</label>
            <input
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={input}
            />
            <div style={{marginTop:15, display:'flex', gap:10}}>
                <button style={btnPrimary} onClick={updateUser}>Save Changes</button>
                <button style={btnCancel} onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* UI STYLES */
const tableContainer = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)", overflow: "hidden", border: "1px solid #e2e8f0" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { padding: 16, textAlign: "left", fontWeight: "bold", color: "#64748b", fontSize: 13, textTransform: "uppercase" };
const td = { padding: 16, fontSize: 15 };
const badgeRefiller = { padding:"4px 10px", borderRadius:12, background: '#f3e5f5', color: '#7b1fa2', fontSize:11, fontWeight:'bold' };

const btnPrimary = { flex: 1, padding: "12px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnCancel = { padding: "12px 20px", background: "#e2e8f0", color: "#475569", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnSecondary = { padding: "8px 14px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", marginRight: 8, fontWeight: "bold" };
const btnDanger = { padding: "8px 14px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const addBtn = { padding: "10px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };

const label = { display: "block", fontSize: 13, fontWeight: "bold", color: "#475569", marginBottom: 5 };
const input = { padding: "12px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 15, width: "100%", boxSizing:'border-box', fontSize: 15 };
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 12, width: 400, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
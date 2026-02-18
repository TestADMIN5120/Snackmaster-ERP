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
  const { user, role, orgId } = useAdmin(); 
  const [users, setUsers] = useState([]);

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");

  // LOAD USERS (Filtered by Org for Admins)
  useEffect(() => {
    if (!orgId && role !== 'super_admin') return;

    let q;
    if (role === "super_admin") {
      q = collection(db, "users");
    } else {
      // 🟢 Admin only sees users in their Org
      q = query(collection(db, "users"), where("orgId", "==", orgId)); 
    }

    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("❌ Read Error:", error);
      // Don't alert continuously, just log
    });
    return () => unsub();
  }, [orgId, role]);

  // 🟢 ADD NEW REFILLER
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
        createdBy: user.email
      };

      await createSecondaryUser(emailClean, passClean, userData);

      alert("Refiller created successfully!");
      setShowAdd(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");

    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        alert("Error: This email is already registered.");
      } else if (err.code === 'permission-denied') {
        alert("Error: Permission Denied. Check if your Admin account has a valid Organization ID.");
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
      alert("User updated!");
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("Update failed");
    }
  }

  // DELETE USER
  async function deleteUser(id) {
    if (!confirm("Delete this user? They will lose access.")) return;
    try {
      await deleteDoc(doc(db, "users", id));
      alert("User deleted.");
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1>Manage Team</h1>
        <button onClick={() => setShowAdd(true)} style={addBtn}>+ Add Refiller</button>
      </div>

      {/* USERS TABLE */}
      <table style={table}>
        <thead style={{ background: "#eee" }}>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={td}>{u.displayName || "-"}</td>
              <td style={td}>{u.email}</td>
              <td style={td}>
                <span style={{
                  padding:"4px 8px", 
                  borderRadius:10, 
                  background: u.role==='admin'?'#e3f2fd':'#f3e5f5',
                  color: u.role==='admin'?'#1565c0':'#7b1fa2',
                  fontSize:12, fontWeight:'bold'
                }}>
                  {u.role.toUpperCase()}
                </span>
              </td>

              <td style={td}>
                <button
                  style={btnSecondary}
                  onClick={() => {
                    setEditingUser(u);
                    setEditName(u.displayName || "");
                  }}
                >
                  Edit
                </button>

                <button style={btnDanger} onClick={() => deleteUser(u.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ADD REFILLER MODAL */}
      {showAdd && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2>Add New Refiller</h2>
            
            <input
              placeholder="Refiller Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={input}
            />

            <input
              placeholder="Email Address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={input}
            />

            <input
              type="password"
              placeholder="Set Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={input}
            />

            <p style={{fontSize:12, color:'#666', marginBottom:15}}>
              * Will be assigned to your organization automatically.
            </p>

            <div style={{marginTop:15, display:'flex', gap:10}}>
                <button style={btnPrimary} onClick={createRefiller} disabled={loading}>
                    {loading ? "Creating..." : "Create Refiller"}
                </button>
                <button style={btnSecondary} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2>Edit User</h2>
            <input
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={input}
            />
            <div style={{marginTop:15, display:'flex', gap:10}}>
                <button style={btnPrimary} onClick={updateUser}>Save</button>
                <button style={btnSecondary} onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* UI STYLES */
const table = { width: "100%", marginTop: 20, borderCollapse: "collapse", background:'white', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' };
const th = { padding: 12, textAlign: "left", fontWeight: "bold", borderBottom:'2px solid #ddd' };
const td = { padding: 12 };
const btnPrimary = { padding: "10px 16px", background: "#3498db", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSecondary = { padding: "8px 14px", background: "#95a5a6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", marginRight: 5 };
const btnDanger = { padding: "8px 14px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const addBtn = { padding: "10px 16px", background: "#2ecc71", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const input = { padding: "10px", borderRadius: 6, border: "1px solid #ccc", marginBottom: 10, width: "100%", boxSizing:'border-box' };
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 30, borderRadius: 10, width: 400, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" };
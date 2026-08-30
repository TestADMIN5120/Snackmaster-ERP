import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import axios from "axios";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { createSecondaryUser } from "../../utils/authHelpers";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001/api";
const ID_TYPE_OPTIONS = ["Aadhaar", "PAN", "Driving License", "Voter ID", "Passport", "Other"];

export default function AdminUsers() {
  const { user, orgId } = useAdmin();
  const [users, setUsers] = useState([]);

  // Add Refiller form states
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPrimaryContact, setNewPrimaryContact] = useState("");
  const [newSecondaryContact, setNewSecondaryContact] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIdType, setNewIdType] = useState("");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newDocFile, setNewDocFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const newDocInputRef = useRef(null);

  // View Details modal
  const [viewingUser, setViewingUser] = useState(null);

  // Edit Refiller modal states
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPrimaryContact, setEditPrimaryContact] = useState("");
  const [editSecondaryContact, setEditSecondaryContact] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editIdType, setEditIdType] = useState("");
  const [editIdNumber, setEditIdNumber] = useState("");
  const [editDocFile, setEditDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const editDocInputRef = useRef(null);

  // LOAD REFILLERS FOR THIS ORG
  useEffect(() => {
    if (!orgId) return;

    const q = query(
        collection(db, "users"),
        where("orgId", "==", orgId),
        where("role", "==", "refiller")
    );

    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Read Error:", error);
    });
    return () => unsub();
  }, [orgId]);

  async function getAuthHeader() {
    const token = await getAuth().currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  async function uploadDocument(userId, file) {
    const formData = new FormData();
    formData.append("document", file);
    const headers = await getAuthHeader();
    return axios.post(`${API_URL}/refiller-documents/${userId}`, formData, { headers });
  }

  async function deleteDocument(userId) {
    const headers = await getAuthHeader();
    return axios.delete(`${API_URL}/refiller-documents/${userId}`, { headers });
  }

  // ADD NEW REFILLER
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
        role: "refiller",
        orgId: orgId,
        createdBy: user.email,
        status: "active",
        deleted: false,
        phone: newPhone.trim(),
        primaryContact: newPrimaryContact.trim(),
        secondaryContact: newSecondaryContact.trim(),
        address: newAddress.trim(),
        idType: newIdType,
        idNumber: newIdNumber.trim(),
      };

      const newUser = await createSecondaryUser(emailClean, passClean, userData);

      // Upload document if selected
      if (newDocFile) {
        try {
          await uploadDocument(newUser.uid, newDocFile);
        } catch (docErr) {
          console.error("Document upload failed:", docErr);
          alert("Refiller created but document upload failed. You can upload it later via Edit.");
        }
      }

      alert(`Refiller created!\n\nEmail: ${emailClean}\nPassword: ${passClean}\n\nThey can now log into the Refiller App.`);
      setShowAdd(false);
      resetAddForm();

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

  function resetAddForm() {
    setNewEmail(""); setNewPassword(""); setNewName("");
    setNewPhone(""); setNewPrimaryContact(""); setNewSecondaryContact("");
    setNewAddress(""); setNewIdType(""); setNewIdNumber("");
    setNewDocFile(null);
    if (newDocInputRef.current) newDocInputRef.current.value = "";
  }

  // OPEN EDIT MODAL
  function openEditModal(u) {
    setEditingUser(u);
    setEditName(u.displayName || "");
    setEditPhone(u.phone || "");
    setEditPrimaryContact(u.primaryContact || "");
    setEditSecondaryContact(u.secondaryContact || "");
    setEditAddress(u.address || "");
    setEditIdType(u.idType || "");
    setEditIdNumber(u.idNumber || "");
    setEditDocFile(null);
  }

  // UPDATE USER
  async function updateUser() {
    setUploadingDoc(true);
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        displayName: editName,
        phone: editPhone.trim(),
        primaryContact: editPrimaryContact.trim(),
        secondaryContact: editSecondaryContact.trim(),
        address: editAddress.trim(),
        idType: editIdType,
        idNumber: editIdNumber.trim(),
      });
    } catch (err) {
      console.error(err);
      alert("Update failed: " + err.message);
      setUploadingDoc(false);
      return;
    }

    // Upload new document if selected (separate from field update)
    if (editDocFile) {
      try {
        await uploadDocument(editingUser.id, editDocFile);
      } catch (docErr) {
        console.error("Document upload failed:", docErr);
        alert("Refiller details saved, but document upload failed. Make sure the backend server is running and try again.");
        setUploadingDoc(false);
        setEditDocFile(null);
        return;
      }
    }

    alert("Refiller updated!");
    setEditingUser(null);
    setEditDocFile(null);
    setUploadingDoc(false);
  }

  // DELETE DOCUMENT
  async function handleDeleteDocument() {
    if (!confirm("Remove the identity proof document?")) return;
    setUploadingDoc(true);
    try {
      await deleteDocument(editingUser.id);
      alert("Document removed.");
      // Update local state so UI reflects removal
      setEditingUser({ ...editingUser, identityProofUrl: null });
    } catch (err) {
      console.error(err);
      alert("Failed to remove document.");
    } finally {
      setUploadingDoc(false);
    }
  }

  // SOFT DELETE USER
  async function deleteUser(id, name) {
    if (!confirm(`Remove ${name} from your team? They will no longer be able to log in.`)) return;
    try {
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

  const activeUsers = users.filter(u => !u.deleted);

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
                <th style={th}>Phone</th>
                <th style={th}>Role</th>
                <th style={th}>Actions</th>
            </tr>
            </thead>

            <tbody>
            {activeUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{...td, fontWeight: "bold"}}>{u.displayName || "-"}</td>
                <td style={{...td, color: "#666"}}>{u.email}</td>
                <td style={{...td, color: "#666"}}>{u.phone || "-"}</td>
                <td style={td}>
                    <span style={badgeRefiller}>REFILLER</span>
                </td>

                <td style={td}>
                    <button
                    style={btnView}
                    onClick={() => setViewingUser(u)}
                    >
                    View
                    </button>

                    <button
                    style={btnSecondary}
                    onClick={() => openEditModal(u)}
                    >
                    Edit
                    </button>

                    <button style={btnDanger} onClick={() => deleteUser(u.id, u.displayName)}>
                    Remove
                    </button>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        {activeUsers.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>You have no refillers on your team yet.</div>
        )}
      </div>

      {/* ADD REFILLER MODAL */}
      {showAdd && (
        <div style={modalOverlay}>
          <div style={modalBoxWide}>
            <h2 style={{marginTop: 0}}>Add Route Refiller</h2>

            <div style={twoCol}>
              <div style={colFull}>
                <label style={label}>Full Name *</label>
                <input placeholder="e.g. Mike Smith" value={newName} onChange={(e) => setNewName(e.target.value)} style={input} />
              </div>
            </div>

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>Login Email *</label>
                <input type="email" placeholder="mike@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={input} />
              </div>
              <div style={col}>
                <label style={label}>Temporary Password *</label>
                <input type="text" placeholder="Set Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={input} />
              </div>
            </div>

            <div style={sectionDivider} />

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>Phone Number</label>
                <input placeholder="e.g. 9876543210" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={input} />
              </div>
              <div style={col}>
                <label style={label}>Primary Contact</label>
                <input placeholder="Primary contact name/number" value={newPrimaryContact} onChange={(e) => setNewPrimaryContact(e.target.value)} style={input} />
              </div>
            </div>

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>Secondary Contact</label>
                <input placeholder="Secondary contact name/number" value={newSecondaryContact} onChange={(e) => setNewSecondaryContact(e.target.value)} style={input} />
              </div>
              <div style={col}>
                <label style={label}>Address</label>
                <textarea placeholder="Full address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={textarea} rows={2} />
              </div>
            </div>

            <div style={sectionDivider} />

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>ID Type</label>
                <select value={newIdType} onChange={(e) => setNewIdType(e.target.value)} style={input}>
                  <option value="">-- Select --</option>
                  {ID_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={col}>
                <label style={label}>ID Number</label>
                <input placeholder="e.g. XXXX-XXXX-1234" value={newIdNumber} onChange={(e) => setNewIdNumber(e.target.value)} style={input} />
              </div>
            </div>

            <div>
              <label style={label}>Identity Proof Document (JPG, PNG, PDF - max 5MB)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                ref={newDocInputRef}
                onChange={(e) => setNewDocFile(e.target.files[0] || null)}
                style={{ marginBottom: 15 }}
              />
            </div>

            <div style={{background: "#e0f2fe", padding: 10, borderRadius: 6, fontSize: 12, color: "#0284c7", marginBottom: 15, border: "1px solid #bae6fd"}}>
              This refiller will be permanently locked to your organization. They cannot see machines from other orgs.
            </div>

            <div style={{display:'flex', gap:10}}>
                <button style={btnPrimary} onClick={createRefiller} disabled={loading}>
                    {loading ? "Creating..." : "Create Account"}
                </button>
                <button style={btnCancel} onClick={() => { setShowAdd(false); resetAddForm(); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div style={modalOverlay}>
          <div style={modalBoxWide}>
            <h2 style={{marginTop: 0}}>Edit Refiller</h2>

            <div style={twoCol}>
              <div style={colFull}>
                <label style={label}>Full Name</label>
                <input placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} style={input} />
              </div>
            </div>

            <div style={sectionDivider} />

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>Phone Number</label>
                <input placeholder="e.g. 9876543210" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={input} />
              </div>
              <div style={col}>
                <label style={label}>Primary Contact</label>
                <input placeholder="Primary contact name/number" value={editPrimaryContact} onChange={(e) => setEditPrimaryContact(e.target.value)} style={input} />
              </div>
            </div>

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>Secondary Contact</label>
                <input placeholder="Secondary contact name/number" value={editSecondaryContact} onChange={(e) => setEditSecondaryContact(e.target.value)} style={input} />
              </div>
              <div style={col}>
                <label style={label}>Address</label>
                <textarea placeholder="Full address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={textarea} rows={2} />
              </div>
            </div>

            <div style={sectionDivider} />

            <div style={twoCol}>
              <div style={col}>
                <label style={label}>ID Type</label>
                <select value={editIdType} onChange={(e) => setEditIdType(e.target.value)} style={input}>
                  <option value="">-- Select --</option>
                  {ID_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={col}>
                <label style={label}>ID Number</label>
                <input placeholder="e.g. XXXX-XXXX-1234" value={editIdNumber} onChange={(e) => setEditIdNumber(e.target.value)} style={input} />
              </div>
            </div>

            {/* Existing document display */}
            {editingUser.identityProofUrl && (
              <div style={docPreviewBox}>
                <span style={{ fontSize: 13, color: "#475569" }}>
                  Current Document:&nbsp;
                  <a
                    href={editingUser.identityProofUrl.startsWith("http") ? editingUser.identityProofUrl : `${API_URL.replace("/api", "")}${editingUser.identityProofUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1e88e5", textDecoration: "underline" }}
                  >
                    View Document
                  </a>
                </span>
                <button style={btnDangerSmall} onClick={handleDeleteDocument} disabled={uploadingDoc}>
                  Remove
                </button>
              </div>
            )}

            <div>
              <label style={label}>
                {editingUser.identityProofUrl ? "Replace Document" : "Upload Identity Proof"} (JPG, PNG, PDF - max 5MB)
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                ref={editDocInputRef}
                onChange={(e) => setEditDocFile(e.target.files[0] || null)}
                style={{ marginBottom: 15 }}
              />
            </div>

            <div style={{marginTop:15, display:'flex', gap:10}}>
                <button style={btnPrimary} onClick={updateUser} disabled={uploadingDoc}>
                  {uploadingDoc ? "Saving..." : "Save Changes"}
                </button>
                <button style={btnCancel} onClick={() => { setEditingUser(null); setEditDocFile(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingUser && (
        <div style={modalOverlay}>
          <div style={modalBoxWide}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Refiller Details</h2>
              <button style={btnCancel} onClick={() => setViewingUser(null)}>Close</button>
            </div>

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>Full Name</span><span style={detailValue}>{viewingUser.displayName || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Email / Login</span><span style={detailValue}>{viewingUser.email || "-"}</span></div>
            </div>

            <div style={sectionDivider} />

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>Phone Number</span><span style={detailValue}>{viewingUser.phone || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Primary Contact</span><span style={detailValue}>{viewingUser.primaryContact || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Secondary Contact</span><span style={detailValue}>{viewingUser.secondaryContact || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>Address</span><span style={detailValue}>{viewingUser.address || "-"}</span></div>
            </div>

            <div style={sectionDivider} />

            <div style={detailSection}>
              <div style={detailRow}><span style={detailLabel}>ID Type</span><span style={detailValue}>{viewingUser.idType || "-"}</span></div>
              <div style={detailRow}><span style={detailLabel}>ID Number</span><span style={detailValue}>{viewingUser.idNumber || "-"}</span></div>
              <div style={detailRow}>
                <span style={detailLabel}>Identity Proof</span>
                <span style={detailValue}>
                  {viewingUser.identityProofUrl ? (
                    <a
                      href={viewingUser.identityProofUrl.startsWith("http") ? viewingUser.identityProofUrl : `${API_URL.replace("/api", "")}${viewingUser.identityProofUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#1e88e5", textDecoration: "underline" }}
                    >
                      View Document
                    </a>
                  ) : "Not uploaded"}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button style={btnPrimary} onClick={() => { setViewingUser(null); openEditModal(viewingUser); }}>Edit Refiller</button>
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
const btnView = { padding: "8px 14px", background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9", borderRadius: 6, cursor: "pointer", marginRight: 8, fontWeight: "bold" };
const btnDanger = { padding: "8px 14px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnDangerSmall = { padding: "4px 10px", background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
const addBtn = { padding: "10px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };

const label = { display: "block", fontSize: 13, fontWeight: "bold", color: "#475569", marginBottom: 5 };
const input = { padding: "12px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 15, width: "100%", boxSizing:'border-box', fontSize: 15 };
const textarea = { padding: "12px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 15, width: "100%", boxSizing:'border-box', fontSize: 15, resize: "vertical", fontFamily: "inherit" };
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalBoxWide = { background: "#fff", padding: 24, borderRadius: 12, width: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };

const twoCol = { display: "flex", gap: 16, flexWrap: "wrap" };
const col = { flex: "1 1 240px", minWidth: 0 };
const colFull = { flex: "1 1 100%" };
const sectionDivider = { borderTop: "1px solid #e2e8f0", margin: "4px 0 16px" };
const docPreviewBox = { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px", marginBottom: 12 };

const detailSection = { display: "flex", flexDirection: "column", gap: 8 };
const detailRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0" };
const detailLabel = { fontSize: 13, fontWeight: "bold", color: "#64748b", minWidth: 140 };
const detailValue = { fontSize: 14, color: "#1e293b", textAlign: "right", flex: 1, wordBreak: "break-word" };

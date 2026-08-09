import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { createSecondaryUser } from "../../utils/authHelpers"; 

function Field({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <input {...props} style={inputStyle} />
    </div>
  );
}

export default function SuperAdminAdminCreate() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({ 
    email: "", 
    password: "", 
    name: "", 
    orgId: "" 
  });

  useEffect(() => {
    async function loadOrgs() {
      // 🟢 Only load active orgs
      const q = query(collection(db, "organisations"), where("deleted", "==", false));
      const snap = await getDocs(q);
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    loadOrgs();
  }, []);

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function createAdmin(e) {
    e.preventDefault();

    if (!form.email || !form.orgId || !form.password || !form.name) {
      alert("All fields are required.");
      return;
    }

    if (form.password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    setSaving(true);

    try {
      // 🟢 THE FIX: Added status and deleted flags for Security Rules
      await createSecondaryUser(form.email.trim(), form.password, {
        role: "admin",
        orgId: form.orgId,
        displayName: form.name,
        status: "active", // Required for Admin rule
        deleted: false,   // Required for Admin rule
        createdBy: "super_admin"
      });

      alert(`✅ Admin created successfully!\n\nEmail: ${form.email}\nPassword: ${form.password}\n\nPlease share these credentials securely.`);
      navigate("/super/admins");
    } catch (err) {
      console.error("❌ Admin creation failed", err);
      if (err.code === "auth/email-already-in-use") {
        alert("This email is already registered in the system.");
      } else {
        alert("Failed to create admin: " + err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: 24 }}>
      <h1 style={{marginBottom: 24}}>Create New Admin</h1>

      <form onSubmit={createAdmin} style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)"}}>
        <Field
          label="Full Name"
          name="name"
          placeholder="e.g. John Doe"
          value={form.name}
          onChange={updateField}
          required
        />

        <Field
          label="Admin Email"
          name="email"
          type="email"
          placeholder="admin@franchise.com"
          value={form.email}
          onChange={updateField}
          required
        />

        <Field
          label="Password (Set Initial)"
          name="password"
          type="text" // Visible so SuperAdmin can copy it
          placeholder="Set a strong password..."
          value={form.password}
          onChange={updateField}
          required
        />

        <label style={{ fontWeight: 600, display:'block', marginBottom: 6 }}>Assign Organisation</label>
        <select
          name="orgId"
          value={form.orgId}
          onChange={updateField}
          style={inputStyle}
          required
        >
          <option value="">-- Select Organisation --</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 30, display: "flex", gap: 12 }}>
          <button type="submit" disabled={saving} style={saving ? btnDisabled : btnPrimary}>
            {saving ? "Creating User..." : "Create Admin Account"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => navigate("/super/admins")}
            style={btnSecondary}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "12px", borderRadius: 6, border: "1px solid #ccc", boxSizing: 'border-box', fontSize: 15 };
const btnPrimary = { flex: 1, padding: "12px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 15 };
const btnDisabled = { flex: 1, padding: "12px", background: "#90caf9", color: "#fff", border: "none", borderRadius: 6, cursor: "not-allowed", fontWeight: "bold", fontSize: 15 };
const btnSecondary = { padding: "12px 24px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 15 };
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { createSecondaryUser } from "../../utils/authHelpers"; // 🟢 Import Helper

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
      const snap = await getDocs(collection(db, "organisations"));
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !o.deleted));
    }
    loadOrgs();
  }, []);

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function createAdmin(e) {
    e.preventDefault();

    if (!form.email || !form.orgId || !form.password || !form.name) {
      alert("All fields required");
      return;
    }

    setSaving(true);

    try {
      // 🟢 Use Helper to create Auth + Firestore without logging out
      await createSecondaryUser(form.email, form.password, {
        role: "admin",
        orgId: form.orgId,
        displayName: form.name,
        createdBy: "super_admin"
      });

      alert(`✅ Admin created successfully!\n\nEmail: ${form.email}\nPassword: ${form.password}\n\nPlease share these credentials securely.`);
      navigate("/super/admins");
    } catch (err) {
      console.error("❌ Admin creation failed", err);
      alert("Failed to create admin: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: 24 }}>
      <h1>Create New Admin</h1>

      <form onSubmit={createAdmin}>
        <Field
          label="Full Name"
          name="name"
          placeholder="John Doe"
          value={form.name}
          onChange={updateField}
        />

        <Field
          label="Admin Email"
          name="email"
          type="email"
          placeholder="admin@franchise.com"
          value={form.email}
          onChange={updateField}
        />

        <Field
          label="Password (Set Initial)"
          name="password"
          type="text" // Visible so you can copy it
          placeholder="Set a strong password..."
          value={form.password}
          onChange={updateField}
        />

        <label style={{ fontWeight: 600, display:'block', marginBottom: 6 }}>Assign Organisation</label>
        <select
          name="orgId"
          value={form.orgId}
          onChange={updateField}
          style={inputStyle}
        >
          <option value="">Select organisation</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.id})
            </option>
          ))}
        </select>

        <div style={{ marginTop: 24 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? "Creating User..." : "Create Admin Account"}
          </button>
          <button
            type="button"
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

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  boxSizing: 'border-box'
};

const btnPrimary = {
  padding: "10px 16px",
  background: "#1e88e5",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold"
};

const btnSecondary = {
  marginLeft: 12,
  padding: "10px 16px",
  background: "#e0e0e0",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
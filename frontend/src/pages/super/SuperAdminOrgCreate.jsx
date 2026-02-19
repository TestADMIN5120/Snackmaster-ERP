import React, { useState } from "react";
import {
  doc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

function Field({ label, error, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      <input
        {...props}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 6,
          boxSizing: "border-box",
          border: error ? "1px solid #e53935" : "1px solid #ccc",
          fontSize: 15
        }}
      />
      {error && <div style={{ color: "#e53935", fontSize: 13, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default function SuperAdminOrgCreate() {
  const navigate = useNavigate();
  const { user } = useAdmin();

  const [form, setForm] = useState({ id: "", name: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(e) {
    const { name, value } = e.target;
    if (name === "id") {
      setForm({ ...form, id: value.toUpperCase().trim() });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function validate() {
    const e = {};
    if (!form.id.match(/^ORG_[A-Z0-9_]+$/)) {
      e.id = "Org ID must start with ORG_ and contain only capitals/numbers";
    }
    if (!form.name.trim()) e.name = "Organisation name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function createOrganisation(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const orgRef = doc(db, "organisations", form.id);
      const existingOrg = await getDoc(orgRef);
      if (existingOrg.exists()) throw new Error("Organisation ID already exists");

      const orgPayload = {
        id: form.id,
        name: form.name.trim(),
        status: "active",
        suspended: false,
        deleted: false, // 🟢 FIX: CRITICAL FOR QUERIES
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(orgRef, orgPayload);

      await addDoc(collection(db, "admin_actions"), {
        action: "ORG_CREATED",
        entityType: "organisation",
        entityId: form.id,
        performedBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      alert(`✅ Organization '${form.name}' Created!\nNow go to 'Admins' to assign a manager.`);
      navigate("/super/orgs");
    } catch (err) {
      console.error(err);
      setErrors({ global: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>Create Organisation</h1>
      {errors.global && <div style={{ color: "#e53935", marginBottom: 16, background: "#fee2e2", padding: 10, borderRadius: 6 }}>{errors.global}</div>}

      <form onSubmit={createOrganisation} style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)"}}>
        <Field
          label="Organisation ID"
          name="id"
          value={form.id}
          onChange={updateField}
          placeholder="ORG_FRANCHISE_HYD"
          error={errors.id}
        />

        <Field
          label="Organisation Name"
          name="name"
          value={form.name}
          onChange={updateField}
          placeholder="e.g. Hyderabad Franchise"
          error={errors.name}
        />

        <div style={{ marginTop: 30, display: "flex", gap: 12 }}>
          <button type="submit" disabled={saving} style={saving ? btnDisabled : btnPrimary}>
            {saving ? "Creating…" : "Create Organisation"}
          </button>

          <button type="button" disabled={saving} onClick={() => navigate("/super/orgs")} style={btnSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const btnPrimary = { flex: 1, padding: "12px", background: "#1e88e5", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "pointer" };
const btnDisabled = { flex: 1, padding: "12px", background: "#90caf9", color: "#fff", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "not-allowed" };
const btnSecondary = { padding: "12px 24px", background: "#e0e0e0", color: "#333", border: "none", borderRadius: 6, fontWeight: "bold", fontSize: 15, cursor: "pointer" };
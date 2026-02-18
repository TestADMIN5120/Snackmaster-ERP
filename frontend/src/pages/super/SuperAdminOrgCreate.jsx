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
          padding: "10px",
          borderRadius: 6,
          border: error ? "1px solid #e53935" : "1px solid #ccc",
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
    // Force ORG ID uppercase
    if (name === "id") {
      setForm({ ...form, id: value.toUpperCase().trim() });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function validate() {
    const e = {};
    if (!form.id.match(/^ORG_[A-Z0-9_]+$/)) {
      e.id = "Org ID must start with ORG_ and contain only capitals";
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
      {errors.global && <div style={{ color: "#e53935", marginBottom: 16 }}>{errors.global}</div>}

      <form onSubmit={createOrganisation}>
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
          placeholder="Hyderabad Franchise"
          error={errors.name}
        />

        <div style={{ marginTop: 24 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 16px",
              background: "#1e88e5",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Creating…" : "Create Organisation"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/super/orgs")}
            style={{
              marginLeft: 12,
              padding: "10px 16px",
              background: "#e0e0e0",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
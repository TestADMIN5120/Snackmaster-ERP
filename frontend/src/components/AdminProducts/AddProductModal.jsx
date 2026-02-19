// frontend/src/components/AdminProducts/AddProductModal.jsx
import React, { useState } from "react";
import { db } from "../../firebaseClient";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AddProductModal({ onClose, orgId, user }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || !sku || !price) {
      alert("All fields required!");
      return;
    }

    if (!orgId) {
      alert("Error: No Organization ID found. Cannot save product.");
      return;
    }

    setSaving(true);

    try {
      // 1. Save the Product WITH THE ORG ID
      const newProduct = await addDoc(collection(db, "products"), {
        name: name.trim(),
        sku: sku.trim(),
        price: Number(price),
        orgId: orgId, // 🟢 CRITICAL MULTI-TENANT FIX
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Audit Log
      await addDoc(collection(db, "admin_actions"), {
        actionType: "add_product",
        productId: newProduct.id,
        productName: name.trim(),
        actorEmail: user?.email || "unknown",
        orgId: orgId,
        createdAt: serverTimestamp()
      });

      alert("Product added successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={backdrop}>
      <div style={modal}>
        <h2 style={{ marginTop: 0 }}>Add Product to Catalog</h2>

        <div style={field}>
          <label style={label}>Product Name</label>
          <input style={input} placeholder="e.g. Snickers Bar" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>SKU / Identifier</label>
          <input style={input} placeholder="e.g. SNK-01" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>Price (₹)</label>
          <input style={input} type="number" min="0" placeholder="e.g. 50" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button style={btnCancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
        </div>
      </div>
    </div>
  );
}

const backdrop = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modal = { width: 400, background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };
const field = { display: "flex", flexDirection: "column", marginBottom: 15 };
const label = { fontWeight: "bold", fontSize: 13, color: "#475569", marginBottom: 5 };
const input = { padding: "10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 15 };
const btnCancel = { padding: "10px 16px", background: "#f1f5f9", border: "none", borderRadius: 6, color: "#475569", cursor: "pointer", fontWeight: "bold" };
const btnPrimary = { padding: "10px 16px", background: "#10b981", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontWeight: "bold" };
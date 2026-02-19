// frontend/src/components/AdminProducts/EditProductModal.jsx
import React, { useState } from "react";
import { db } from "../../firebaseClient";
import { doc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";

export default function EditProductModal({ product, onClose, user }) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [price, setPrice] = useState(product.price);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || !sku || !price) {
      alert("All fields required!");
      return;
    }
    
    setSaving(true);
    try {
      await updateDoc(doc(db, "products", product.id), {
        name: name.trim(),
        sku: sku.trim(),
        price: Number(price),
        updatedAt: serverTimestamp(),
      });

      // 🟢 Audit Log for Editing
      await addDoc(collection(db, "admin_actions"), {
        actionType: "edit_product",
        productId: product.id,
        productName: name.trim(),
        actorEmail: user?.email || "unknown",
        orgId: product.orgId || "unknown", // Keeps audit localized to Org
        createdAt: serverTimestamp()
      });

      alert("Product updated!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={backdrop}>
      <div style={modal}>
        <h2 style={{ marginTop: 0 }}>Edit Product</h2>

        <div style={field}>
          <label style={label}>Name</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>SKU</label>
          <input style={input} value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>

        <div style={field}>
          <label style={label}>Price (₹)</label>
          <input style={input} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button style={btnCancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
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
const btnPrimary = { padding: "10px 16px", background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontWeight: "bold" };
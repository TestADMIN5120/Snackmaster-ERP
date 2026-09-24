import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, where, doc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminProductImages() {
  const { orgId } = useAdmin();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null); // productId with an in-flight request
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }
  const [preview, setPreview] = useState(null); // { url, name } for the lightbox

  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  useEffect(() => {
    if (orgId) loadProducts();
  }, [orgId]);

  async function loadProducts() {
    setLoading(true);
    try {
      const q = query(collection(db, "master_products"), where("orgId", "==", orgId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.sku || "").localeCompare(b.sku || "", undefined, { numeric: true, sensitivity: "base" }));
      setProducts(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function pickFileFor(product) {
    uploadTargetRef.current = product;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    const product = uploadTargetRef.current;
    e.target.value = null;
    if (!file || !product) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return setMessage({ type: "error", text: "Only JPG, PNG or WEBP images are allowed." });
    }
    if (file.size > 2 * 1024 * 1024) {
      return setMessage({ type: "error", text: "Image is larger than 2 MB. Please compress it first." });
    }

    setBusyId(product.id);
    setMessage(null);
    try {
      // If replacing, delete the old file from Storage (only if it's a Firebase URL)
      if (product.imageUrl && product.imageUrl.includes("firebasestorage.googleapis.com")) {
        try {
          const oldRef = ref(storage, product.imageUrl);
          await deleteObject(oldRef);
        } catch (delErr) {
          console.warn("Could not delete old image (may already be gone):", delErr.message);
        }
      }

      const ext = file.name.substring(file.name.lastIndexOf(".")) || ".jpg";
      const filePath = `product_images/${product.id}_${Date.now()}${ext}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, "master_products", product.id), {
        imageUrl: downloadUrl,
        imageUpdatedAt: serverTimestamp()
      });

      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, imageUrl: downloadUrl } : p));
      setMessage({ type: "ok", text: `Image saved for ${product.name || product.id}.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Upload failed." });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete the image for "${product.name || product.id}"?`)) return;
    setBusyId(product.id);
    setMessage(null);
    try {
      if (product.imageUrl && product.imageUrl.includes("firebasestorage.googleapis.com")) {
        const fileRef = ref(storage, product.imageUrl);
        await deleteObject(fileRef);
      }

      await updateDoc(doc(db, "master_products", product.id), {
        imageUrl: deleteField(),
        imageUpdatedAt: serverTimestamp()
      });

      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, imageUrl: null } : p));
      setMessage({ type: "ok", text: `Image deleted for ${product.name || product.id}.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Delete failed." });
    } finally {
      setBusyId(null);
    }
  }

  const term = search.trim().toLowerCase();
  const filtered = term
    ? products.filter(p =>
        (p.name || "").toLowerCase().includes(term) ||
        (p.sku || "").toLowerCase().includes(term) ||
        (p.brand || "").toLowerCase().includes(term))
    : products;

  const isValidUrl = (url) => url && url.startsWith("http");
  const withImage = products.filter(p => isValidUrl(p.imageUrl)).length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={headerBar}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 21, letterSpacing: "-0.5px" }}>🖼️ Product Images</h1>
        <p style={{ color: "rgba(255,255,255,0.88)", margin: "3px 0 0 0", fontSize: 13 }}>
          Upload one image per master product. Images are stored in Firebase Storage.
        </p>
      </div>

      {message && (
        <div style={{
          ...alertBox,
          background: message.type === "ok" ? "#f0fdf4" : "#fef2f2",
          color: message.type === "ok" ? "#166534" : "#991b1b",
          borderColor: message.type === "ok" ? "#bbf7d0" : "#fecaca"
        }}>
          {message.type === "ok" ? "✅" : "❌"} {message.text}
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", gap: 15, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="🔍 Search by name, SKU or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 220 }}
          />
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: "bold" }}>
            {withImage} / {products.length} products have an image
          </span>
        </div>

        {/* Hidden shared file input — opened per-row via pickFileFor() */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading products...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            {products.length === 0 ? "No master products found. Add products in Master Products first." : "No products match your search."}
          </div>
        ) : (
          <div style={tableWrapper}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={theadStyle}>
                <tr>
                  <th style={th}>Image</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Product</th>
                  <th style={th}>Brand</th>
                  <th style={th}>Image URL</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const hasValidImage = isValidUrl(p.imageUrl);
                  const hasOldBrokenUrl = p.imageUrl && !hasValidImage;
                  const busy = busyId === p.id;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={td}>
                        {hasValidImage ? (
                          <button
                            type="button"
                            onClick={() => setPreview({ url: p.imageUrl, name: p.name || p.id })}
                            title="View full image"
                            style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in" }}
                          >
                            <img src={p.imageUrl} alt={p.name} style={thumb} />
                          </button>
                        ) : (
                          <div style={{ ...thumb, display: "flex", alignItems: "center", justifyContent: "center", background: hasOldBrokenUrl ? "#fef2f2" : "#f1f5f9", color: hasOldBrokenUrl ? "#ef4444" : "#94a3b8", fontSize: 18 }}>{hasOldBrokenUrl ? "!" : "—"}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#64748b" }}>{p.sku || "-"}</td>
                      <td style={{ ...td, fontWeight: "bold" }}>
                        {p.name || "-"}
                        {p.isActive === false && <span style={inactiveChip}>INACTIVE</span>}
                      </td>
                      <td style={td}>{p.brand || "-"}</td>
                      <td style={{ ...td, fontSize: 12, fontFamily: "monospace", color: "#64748b", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hasValidImage ? (
                          <button
                            type="button"
                            onClick={() => setPreview({ url: p.imageUrl, name: p.name || p.id })}
                            style={{ padding: 0, border: "none", background: "none", cursor: "pointer", color: "#357683", fontFamily: "inherit", fontSize: "inherit", textAlign: "left" }}
                          >
                            {p.imageUrl}
                          </button>
                        ) : hasOldBrokenUrl ? <span style={{ color: "#ef4444" }}>old link — re-upload needed</span> : <span style={{ color: "#cbd5e1" }}>no image</span>}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => pickFileFor(p)} disabled={busy} style={btnUpload}>
                            {busy ? "⏳..." : hasValidImage ? "🔄 Replace" : "📤 Upload"}
                          </button>
                          {p.imageUrl && (
                            <button onClick={() => handleDelete(p)} disabled={busy} style={btnDelete} title="Delete image">🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 24, cursor: "zoom-out"
          }}
        >
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 8, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }} />
            <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>{preview.name}</span>
              <button onClick={() => setPreview(null)} style={{ ...btnUpload, background: "#fff" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES (FineX theme)
const headerBar = { background: "var(--fx-teal)", padding: "16px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 6px rgba(16,54,61,0.18)" };
const card = { background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", border: "1px solid var(--fx-border)" };
const alertBox = { padding: 13, borderRadius: 8, marginBottom: 16, fontSize: 14, border: "1px solid transparent" };
const input = { padding: "10px 12px", borderRadius: 6, border: "1px solid #ced4da", outline: "none", background: "#fff", fontSize: 14, color: "#334155" };
const tableWrapper = { border: "1px solid var(--fx-border)", borderRadius: 8, overflow: "hidden" };
const theadStyle = { background: "#f1f3f5", color: "#23292f", fontSize: 13, textAlign: "left" };
const th = { padding: "12px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid var(--fx-border)" };
const td = { padding: "10px 16px", color: "#334155", verticalAlign: "middle" };
const thumb = { width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid var(--fx-border)" };
const inactiveChip = { marginLeft: 8, fontSize: 10, fontWeight: "bold", color: "#b45309", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 4, padding: "2px 6px", verticalAlign: "middle" };
const btnUpload = { background: "#eaf3f5", color: "#357683", border: "1px solid #b7d4da", padding: "7px 12px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12 };
const btnDelete = { background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", padding: "7px 10px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", fontSize: 12 };

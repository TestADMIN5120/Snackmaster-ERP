import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, serverTimestamp, increment, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";

const emptyRow = () => ({ productSearch: "", productId: "", qty: "", machineId: "" });

export default function WarehouseOutward() {
  const { orgId, user } = useAdmin();
  const [products, setProducts] = useState([]);
  const [refillers, setRefillers] = useState([]);
  const [machines, setMachines] = useState([]);

  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState("Manual Adjustment");
  const [remarks, setRemarks] = useState("");

  const [issuedBy, setIssuedBy] = useState("");
  const [refillerSearch, setRefillerSearch] = useState("");
  const [selectedRefiller, setSelectedRefiller] = useState(null);

  // 🟢 Multiple Product / Qty / Machine rows
  const [rows, setRows] = useState([emptyRow()]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orgId) {
      loadProducts();
      loadRefillers();
      loadMachines();
    }
  }, [orgId]);

  // 🟢 Default "Issued By" with logged-in user's name (fallback to email)
  useEffect(() => {
    if (user) setIssuedBy(user.displayName || user.email || "");
  }, [user]);

  async function loadProducts() {
    const q = query(collection(db, "products"), where("orgId", "==", orgId));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 🟢 UPDATED: Alphanumeric sorting by SKU
    list.sort((a, b) => {
      const skuA = (a.sku || "").toString().toLowerCase();
      const skuB = (b.sku || "").toString().toLowerCase();
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    });

    setProducts(list);
  }

  // 🟢 Load refillers for the searchable "Issued To" dropdown
  async function loadRefillers() {
    const q = query(collection(db, "users"), where("orgId", "==", orgId), where("role", "==", "refiller"));
    const snap = await getDocs(q);
    const list = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(r => r.deleted !== true && r.status !== "disabled");
    list.sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
    setRefillers(list);
  }

  // 🟢 Load machines for the "Destination" dropdowns
  async function loadMachines() {
    const q = query(collection(db, "machines"), where("orgId", "==", orgId));
    const snap = await getDocs(q);
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.deleted !== true);
    list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    setMachines(list);
  }

  // 🟢 Helper for dropdown text
  const getProductLabel = (p) => `[${p.sku || 'N/A'}] ${p.name} (Available: ${p.warehouseStock || 0})`;
  const getRefillerLabel = (r) => `${r.displayName || "No Name"} (${r.email})`;

  function updateRow(index, changes) {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(index) {
    setRows(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleOutward(e) {
    e.preventDefault();
    if (!dateIssued || !issuedBy) return alert("Fill Date Issued and Issued By.");
    if (!selectedRefiller) return alert("Select a valid refiller from the Issued To dropdown.");
    if (!remarks.trim()) return alert("Remarks are mandatory.");

    // Validate every row
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId) return alert(`Row ${i + 1}: Select a valid product from the dropdown.`);
      if (!r.qty || Number(r.qty) <= 0) return alert(`Row ${i + 1}: Enter a valid quantity.`);
      if (!r.machineId) return alert(`Row ${i + 1}: Select a destination machine.`);
    }

    // Aggregate quantity per product to validate against available stock
    const qtyByProduct = {};
    rows.forEach(r => { qtyByProduct[r.productId] = (qtyByProduct[r.productId] || 0) + Number(r.qty); });

    for (const [productId, totalQty] of Object.entries(qtyByProduct)) {
      const p = products.find(x => x.id === productId);
      const available = p?.warehouseStock || 0;
      if (totalQty > available) {
        return alert(`Insufficient stock for [${p?.sku || 'N/A'}] ${p?.name}: requested ${totalQty}, only ${available} available.`);
      }
    }

    const summary = rows.map(r => {
      const p = products.find(x => x.id === r.productId);
      return `• ${r.qty} x [${p?.sku || 'N/A'}] ${p?.name} -> ${r.machineId}`;
    }).join("\n");
    if (!window.confirm(`Issue to ${getRefillerLabel(selectedRefiller)}:\n\n${summary}\n\nProceed?`)) return;

    setLoading(true);
    try {
      const movementDate = new Date(dateIssued);
      const batch = writeBatch(db);

      // One movement record per product + machine combination
      rows.forEach(r => {
        const p = products.find(x => x.id === r.productId);
        const movRef = doc(collection(db, "warehouse_movements"));
        batch.set(movRef, {
          type: "OUTWARD_MANUAL",
          productId: p.id,
          productName: p.name,
          quantity: Number(r.qty),
          movementDate: Timestamp.fromDate(movementDate),
          purpose: purpose,
          remarks: remarks.trim(),
          issuedBy: issuedBy,
          issuedTo: selectedRefiller.email,
          destination: r.machineId,
          orgId: orgId,
          performedBy: user.email,
          createdAt: serverTimestamp()
        });
      });

      // Deduct stock once per product (aggregated)
      Object.entries(qtyByProduct).forEach(([productId, totalQty]) => {
        batch.update(doc(db, "products", productId), {
          warehouseStock: increment(-totalQty),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();

      alert("✅ Stock deducted!");
      setRemarks("");
      setRefillerSearch(""); setSelectedRefiller(null);
      setRows([emptyRow()]);
      loadProducts();
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📤 Manual Outward Stock</h1>
      <p style={{ color: "#64748b", marginBottom: 30 }}>Issue multiple products to a refiller across multiple machines, or deduct stock for adjustments.</p>

      <div style={{ display: "flex", gap: 30, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={card}>
          <form onSubmit={handleOutward} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div style={{ display: "flex", gap: 15 }}>
              <label style={{...label, flex: 1}}>Date Issued * <input type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} style={input} required /></label>
              <label style={{...label, flex: 1}}>Purpose *
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={input}>
                  <option value="Manual Adjustment">Manual Adjustment</option>
                  <option value="Transfer to Machine">Transfer to Machine</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </label>
            </div>

            <div style={{ padding: 15, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
              <h4 style={{ margin: 0, color: "#334155" }}>Traceability Details</h4>
              <div style={{ display: "flex", gap: 15 }}>
                <label style={{...label, flex: 1}}>Issued By * <input type="text" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} style={input} required placeholder="Name of person handing over" /></label>
                {/* 🟢 Searchable Refiller Dropdown */}
                <label style={{...label, flex: 1}}>
                  Issued To (Refiller) *
                  <input
                    type="text"
                    list="outward-refillers"
                    value={refillerSearch}
                    onChange={(e) => {
                      setRefillerSearch(e.target.value);
                      const matched = refillers.find(r => getRefillerLabel(r) === e.target.value);
                      setSelectedRefiller(matched || null);
                    }}
                    onFocus={(e) => e.target.select()}
                    style={input}
                    required
                    placeholder="Search refiller by name or email..."
                  />
                  <datalist id="outward-refillers">
                    {refillers.map(r => (
                      <option key={r.uid} value={getRefillerLabel(r)} />
                    ))}
                  </datalist>
                </label>
              </div>
            </div>

            {/* 🟢 Multiple Product / Qty / Destination Machine rows */}
            <div style={{ padding: 15, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, color: "#334155" }}>Products & Destinations</h4>
                <button type="button" onClick={addRow} style={btnAdd}>+ Add Product</button>
              </div>

              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <label style={{...label, flex: 2}}>
                    Product *
                    <input
                      type="text"
                      list="outward-products"
                      value={r.productSearch}
                      onChange={(e) => {
                        const matched = products.find(p => getProductLabel(p) === e.target.value);
                        updateRow(i, { productSearch: e.target.value, productId: matched ? matched.id : "" });
                      }}
                      onFocus={(e) => e.target.select()}
                      style={input}
                      required
                      placeholder="Type e.g. SM 101..."
                    />
                  </label>
                  <label style={{...label, width: 90}}>
                    Qty *
                    <input type="number" min="1" value={r.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} style={input} required />
                  </label>
                  <label style={{...label, flex: 1.5}}>
                    Destination Machine *
                    <select value={r.machineId} onChange={(e) => updateRow(i, { machineId: e.target.value })} style={input} required>
                      <option value="">-- Select Machine --</option>
                      {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.id}{m.name ? ` - ${m.name}` : ""}{m.location ? ` (${m.location})` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} style={{...btnRemove, opacity: rows.length === 1 ? 0.4 : 1}} title="Remove row">✕</button>
                </div>
              ))}

              <datalist id="outward-products">
                {products.map(p => (
                  <option key={p.id} value={getProductLabel(p)} />
                ))}
              </datalist>
            </div>

            <label style={label}>General Remarks * <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} style={input} rows="2" required /></label>

            <button type="submit" disabled={loading} style={btnDanger}>{loading ? "Processing..." : "📤 Deduct Stock"}</button>
          </form>
        </div>

        <div style={{ ...card, flex: 1, minWidth: 300, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0, color: "#334155" }}>Available Stock</h3>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {products.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 14, fontWeight: "500" }}><span style={{color: "#0284c7", fontFamily: "monospace"}}>[{p.sku || "N/A"}]</span> {p.name}</span>
                <span style={{ fontWeight: "bold" }}>{p.warehouseStock || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const card = { background: "#fff", padding: 25, borderRadius: 12, border: "1px solid #e2e8f0", flex: 1.5 };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: "bold", color: "#475569" };
const input = { padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
const btnDanger = { padding: 16, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnAdd = { padding: "8px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 13 };
const btnRemove = { padding: "10px 14px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };

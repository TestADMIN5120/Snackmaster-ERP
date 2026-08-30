import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs, doc, writeBatch, increment, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { generateBulkReportPDF } from "../../utils/pdfGenerator";

export default function WarehouseDashboard() {
  const { orgId, user } = useAdmin();
  const [loading, setLoading] = useState(true);

  // Data States
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]); // Restored products state
  const [masterProducts, setMasterProducts] = useState([]); // Catalog for product search suggestions
  const [machines, setMachines] = useState([]); // Destination options for the Outward edit modal
  const [userNames, setUserNames] = useState({}); // email -> displayName (to show names instead of emails)

  // Outward Edit/Delete state
  const [editMov, setEditMov] = useState(null); // movement being edited (OUTWARD_MANUAL only)
  const [editForm, setEditForm] = useState({ dateIssued: "", qty: "", machineId: "", purpose: "Manual Adjustment", remarks: "", issuedBy: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Section 1: Movements UI State
  const [activeTab, setActiveTab] = useState("STOCK");
  const [stockSubTab, setStockSubTab] = useState("AVAILABLE"); // AVAILABLE | HISTORY
  const [movSearch, setMovSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [movPage, setMovPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (orgId) loadAllData();
  }, [orgId]);

  async function loadAllData() {
    setLoading(true);
    try {
      // Fetch Movements (sorted client-side to avoid composite index requirement)
      const movQ = query(collection(db, "warehouse_movements"), where("orgId", "==", orgId));
      const movSnap = await getDocs(movQ);
      const movs = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      movs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMovements(movs);

      // Fetch products (used for SKU lookup in Available Stock)
      const prodQ = query(collection(db, "products"), where("orgId", "==", orgId));
      const prodSnap = await getDocs(prodQ);
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Master Product catalog (for the searchable product dropdown, same as Inward Stock Receipt)
      const masterQ = query(collection(db, "master_products"), where("orgId", "==", orgId));
      const masterSnap = await getDocs(masterQ);
      const catalog = masterSnap.docs
        .filter(d => d.data().isActive !== false)
        .map(d => ({ id: d.id, name: d.data().name, sku: d.data().sku || "N/A" }));
      catalog.sort((a, b) => (a.sku || "").toString().toLowerCase().localeCompare((b.sku || "").toString().toLowerCase(), undefined, { numeric: true, sensitivity: 'base' }));
      setMasterProducts(catalog);

      // Fetch machines for the Outward edit modal's destination dropdown
      const machQ = query(collection(db, "machines"), where("orgId", "==", orgId));
      const machSnap = await getDocs(machQ);
      const machList = machSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(mm => mm.deleted !== true);
      machList.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
      setMachines(machList);

      // Fetch org users to map emails -> display names (old records store emails in issuedBy/performedBy)
      const usersQ = query(collection(db, "users"), where("orgId", "==", orgId));
      const usersSnap = await getDocs(usersQ);
      const names = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        if (u.email && u.displayName) names[u.email] = u.displayName;
      });
      setUserNames(names);

    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Helper: display product labels in the search dropdown (same format as Inward Stock Receipt)
  const getProductLabel = (p) => `[${p.sku}] ${p.name}`;

  // Helper: Get Date from either manual movementDate or fallback to createdAt
  const getRecordDate = (m) => {
    if (m.movementDate?.seconds) return new Date(m.movementDate.seconds * 1000);
    if (m.createdAt?.seconds) return new Date(m.createdAt.seconds * 1000);
    return new Date(); 
  };

  // --- FILTERING LOGIC ---

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // 1. Tab Filter
      if (activeTab === "OUTWARD" && m.type !== "OUTWARD_KIT" && m.type !== "OUTWARD_MANUAL") return false;
      if (activeTab !== "OUTWARD" && m.type !== activeTab) return false;

      // 2. Search Filter
      if (movSearch && !(m.productName || "").toLowerCase().includes(movSearch.toLowerCase())) return false;

      // 3. Date Filter
      const recDate = getRecordDate(m);
      if (startDate && recDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include the whole end day
        if (recDate > end) return false;
      }
      return true;
    });
  }, [movements, activeTab, movSearch, startDate, endDate]);

  // 🕘 STOCK HISTORY: all movement types (Inward, Outward, Returned, Expired/Damaged) with product + date range filters
  const historyMovements = useMemo(() => {
    return movements.filter(m => {
      if (movSearch && !(m.productName || "").toLowerCase().includes(movSearch.toLowerCase())) return false;
      const recDate = getRecordDate(m);
      if (startDate && recDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include the whole end day
        if (recDate > end) return false;
      }
      return true;
    });
  }, [movements, movSearch, startDate, endDate]);

  // Helper: split an EXPIRED_DAMAGED movement into Expired vs Damaged
  // (uncategorized/ambiguous records are counted as Expired)
  const classifyExpDmg = (m) => {
    const cat = (m.category || "").toUpperCase();
    if (cat === "EXPIRED") return "expiredOnly";
    if (cat === "DAMAGED") return "damagedOnly";
    // Fallback: infer from remarks text (old records have no category field)
    const text = (m.remarks || "").toLowerCase();
    const hasDmg = text.includes("damag");
    const hasExp = text.includes("expir");
    if (hasDmg && !hasExp) return "damagedOnly";
    return "expiredOnly";
  };

  // 🟢 AVAILABLE STOCK: per-product totals = Inward - Outward + Returned - Expired/Damaged
  const availableStock = useMemo(() => {
    const skuById = {};
    products.forEach(p => { skuById[p.id] = p.sku; });

    const map = {};
    movements.forEach(m => {
      // Respect the same product search filter as the movement tabs
      if (movSearch && !(m.productName || "").toLowerCase().includes(movSearch.toLowerCase())) return;
      const recDate = getRecordDate(m);

      const key = m.productId || m.productName;
      if (!map[key]) map[key] = { key, productName: m.productName, sku: skuById[m.productId] || "-", inward: 0, outward: 0, returned: 0, expired: 0, expiredOnly: 0, damagedOnly: 0, lastDate: null, lastInwardDate: null };
      if (!map[key].lastDate || recDate > map[key].lastDate) map[key].lastDate = recDate;
      const qty = Number(m.quantity) || 0;
      if (m.type === "INWARD") {
        map[key].inward += qty;
        if (!map[key].lastInwardDate || recDate > map[key].lastInwardDate) map[key].lastInwardDate = recDate;
      }
      else if (m.type === "OUTWARD_KIT" || m.type === "OUTWARD_MANUAL") map[key].outward += qty;
      else if (m.type === "RETURN") map[key].returned += qty;
      else if (m.type === "EXPIRED_DAMAGED") {
        map[key].expired += qty;
        map[key][classifyExpDmg(m)] += qty;
      }
    });

    return Object.values(map)
      .map(r => ({ ...r, available: r.inward - r.outward + r.returned - r.expired }))
      .sort((a, b) => a.sku.toString().toLowerCase().localeCompare(b.sku.toString().toLowerCase(), undefined, { numeric: true, sensitivity: 'base' }));
  }, [movements, products, movSearch]);

  // --- MOVEMENT TYPE DISPLAY META ---

  const TYPE_META = {
    INWARD: { label: "Inward", sign: "+", color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
    OUTWARD_KIT: { label: "Outward (Kit)", sign: "-", color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd" },
    OUTWARD_MANUAL: { label: "Outward (Manual)", sign: "-", color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd" },
    RETURN: { label: "Returned", sign: "+", color: "#ca8a04", bg: "#fef9c3", border: "#fde047" },
    EXPIRED_DAMAGED: { label: "Expired/Damaged", sign: "-", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  };
  const getTypeMeta = (type) => TYPE_META[type] || { label: type, sign: "", color: "#475569", bg: "#f1f5f9", border: "#e2e8f0" };

  // Person columns per movement tab: Inward shows the receiver, Outward the issuer + refiller,
  // Returned the receiver + returner. Values come from the traceability fields captured on each
  // form (issuedBy/issuedTo), falling back to performedBy for older records without them.
  // Resolve stored emails to display names (falls back to the raw value)
  const displayPerson = (v) => (v && userNames[v]) || v;

  const PERSON_COLUMNS = {
    INWARD: [{ label: "Received By", value: (m) => displayPerson(m.issuedTo || m.performedBy) || "Admin" }],
    OUTWARD: [
      { label: "Issue By", value: (m) => displayPerson(m.issuedBy || m.performedBy) || "Admin" },
      { label: "Refiller", value: (m) => displayPerson(m.issuedTo) || "-" },
    ],
    RETURN: [
      { label: "Received By", value: (m) => displayPerson(m.issuedTo || m.performedBy) || "Admin" },
      { label: "Returned By", value: (m) => displayPerson(m.issuedBy) || "-" },
    ],
    EXPIRED_DAMAGED: [{ label: "Performed By", value: (m) => displayPerson(m.performedBy) || "Admin" }],
  };
  const personColumns = PERSON_COLUMNS[activeTab] || PERSON_COLUMNS.EXPIRED_DAMAGED;

  // Per-row person info for mixed-type views (Stock History): maps a movement's type
  // to the same labels used in the tab views (Received By / Issue By / Refiller / Returned By).
  const getPersonInfo = (m) => {
    const tabKey = (m.type === "OUTWARD_KIT" || m.type === "OUTWARD_MANUAL") ? "OUTWARD" : m.type;
    const cols = PERSON_COLUMNS[tabKey] || PERSON_COLUMNS.EXPIRED_DAMAGED;
    return cols.map(c => ({ label: c.label, value: c.value(m) }));
  };

  // --- OUTWARD EDIT / DELETE ---
  // Manual outward records only: kit dispatches (OUTWARD_KIT) are auto-generated from kits
  // and editing/deleting only the movement would desync the kit records.
  // Stock impact: edits adjust products.warehouseStock by the qty difference; deletes restore it.

  function openEdit(m) {
    setEditForm({
      dateIssued: getRecordDate(m).toISOString().split('T')[0],
      qty: m.quantity ?? "",
      machineId: m.destination || "",
      purpose: m.purpose || "Manual Adjustment",
      remarks: m.remarks || "",
      issuedBy: m.issuedBy || "",
    });
    setEditMov(m);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const newQty = Number(editForm.qty);
    if (!editForm.dateIssued) return alert("Select a valid date.");
    if (!newQty || newQty <= 0) return alert("Enter a valid quantity.");
    if (!editForm.machineId) return alert("Select a destination machine.");
    if (!editForm.remarks.trim()) return alert("Remarks are mandatory.");

    const oldQty = Number(editMov.quantity) || 0;
    const extra = newQty - oldQty; // additional stock needed if qty increased
    const product = products.find(p => p.id === editMov.productId);
    if (extra > 0) {
      const available = product?.warehouseStock || 0;
      if (extra > available) {
        return alert(`Insufficient stock: increasing quantity by ${extra}, but only ${available} available in warehouse.`);
      }
    }

    setSavingEdit(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "warehouse_movements", editMov.id), {
        quantity: newQty,
        movementDate: Timestamp.fromDate(new Date(editForm.dateIssued)),
        destination: editForm.machineId,
        purpose: editForm.purpose,
        remarks: editForm.remarks.trim(),
        issuedBy: editForm.issuedBy,
        updatedAt: serverTimestamp(),
        editedBy: user?.email || "",
      });
      if (extra !== 0 && product) {
        batch.update(doc(db, "products", product.id), {
          warehouseStock: increment(-extra),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setEditMov(null);
      await loadAllData();
    } catch (err) {
      console.error("Outward Edit Error:", err);
      alert("Failed to update record.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteOutward(m) {
    const qty = Number(m.quantity) || 0;
    if (!window.confirm(`Delete this outward record?\n\n${qty} x ${m.productName} → ${m.destination || "-"}\n\n${qty} unit(s) will be restored to warehouse stock.`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "warehouse_movements", m.id));
      const product = products.find(p => p.id === m.productId);
      if (product) {
        batch.update(doc(db, "products", product.id), {
          warehouseStock: increment(qty),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await loadAllData();
    } catch (err) {
      console.error("Outward Delete Error:", err);
      alert("Failed to delete record.");
    }
  }

  // --- PAGINATION LOGIC ---

  const isStockTab = activeTab === "STOCK";
  const isHistoryView = isStockTab && stockSubTab === "HISTORY";
  const isAvailableView = isStockTab && stockSubTab === "AVAILABLE";
  const paginatedMovements = filteredMovements.slice((movPage - 1) * itemsPerPage, movPage * itemsPerPage);
  const paginatedAvailable = availableStock.slice((movPage - 1) * itemsPerPage, movPage * itemsPerPage);
  const paginatedHistory = historyMovements.slice((movPage - 1) * itemsPerPage, movPage * itemsPerPage);
  const section1Total = isStockTab ? (isHistoryView ? historyMovements.length : availableStock.length) : filteredMovements.length;
  const section1Showing = isStockTab ? (isHistoryView ? paginatedHistory.length : paginatedAvailable.length) : paginatedMovements.length;

  // --- EXPORT LOGIC (hidden on Available Stock view) ---

  const exportMovementsPDF = () => {
    if (isHistoryView) {
      const columns = ["Date", "Product", "Type", "Qty", "Reference / Remarks", "Person(s)"];
      const rows = historyMovements.map(m => {
        const meta = getTypeMeta(m.type);
        return [
          getRecordDate(m).toLocaleDateString('en-IN'),
          m.productName,
          meta.label,
          `${meta.sign}${m.quantity}`,
          m.referenceId || m.remarks || "-",
          getPersonInfo(m).map(p => `${p.label}: ${p.value}`).join(" | ")
        ];
      });
      generateBulkReportPDF("Stock History Data Sheet", columns, rows, orgId);
      return;
    }
    const columns = ["Date", "Product", "Qty", "Reference / Remarks", ...personColumns.map(c => c.label)];
    const rows = filteredMovements.map(m => [
      getRecordDate(m).toLocaleDateString('en-IN'),
      m.productName,
      m.quantity.toString(),
      m.referenceId || m.remarks || "-",
      ...personColumns.map(c => c.value(m))
    ]);
    generateBulkReportPDF(`${activeTab} Data Sheet`, columns, rows, orgId);
  };

  if (loading) return <div style={{ padding: 40, color: "#64748b" }}>Loading Warehouse Data...</div>;

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        .wh-table tbody tr:nth-child(even) { background: #f8fafb; }
        .wh-table tbody tr:hover { background: #e9f3f5; transition: background 0.15s; }
      `}</style>

      <div style={headerBar}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 21, letterSpacing: "-0.5px" }}>📊 Warehouse Data Sheets</h1>
        <p style={{ color: "rgba(255,255,255,0.88)", margin: "3px 0 0 0", fontSize: 13 }}>Interactive drill-down reports for all stock operations.</p>
      </div>

      {/* ==========================================
          SECTION 1: MOVEMENT DRILL-DOWN
      ========================================== */}
      <div style={card}>
        {/* TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, borderBottom: "2px solid #e2e8f0", paddingBottom: 12 }}>
          <TabButton active={activeTab === "STOCK"} onClick={() => {setActiveTab("STOCK"); setMovPage(1);}} icon="📦" label="Stock" color="#8b5cf6" />
          <TabButton active={activeTab === "INWARD"} onClick={() => {setActiveTab("INWARD"); setMovPage(1);}} icon="📥" label="Inward Products" color="#10b981" />
          <TabButton active={activeTab === "OUTWARD"} onClick={() => {setActiveTab("OUTWARD"); setMovPage(1);}} icon="📤" label="Outward Products" color="#3b82f6" />
          <TabButton active={activeTab === "RETURN"} onClick={() => {setActiveTab("RETURN"); setMovPage(1);}} icon="🔄" label="Returned Stock" color="#eab308" />
          <TabButton active={activeTab === "EXPIRED_DAMAGED"} onClick={() => {setActiveTab("EXPIRED_DAMAGED"); setMovPage(1);}} icon="⚠️" label="Expired/Damaged" color="#ef4444" />
        </div>

        {/* STOCK SUB-TABS */}
        {isStockTab && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <SubTabButton active={stockSubTab === "AVAILABLE"} onClick={() => {setStockSubTab("AVAILABLE"); setMovPage(1);}} icon="🧮" label="Available Stock" />
            <SubTabButton active={stockSubTab === "HISTORY"} onClick={() => {setStockSubTab("HISTORY"); setMovPage(1);}} icon="🕘" label="Stock History" />
          </div>
        )}

        {/* FILTERS */}
        <div style={filterBar}>
          <label style={label}>
            🔍 Filter by Product
            <select
              value={movSearch}
              onChange={e => { setMovSearch(e.target.value); setMovPage(1); }}
              style={{...input, minWidth: 240}}
            >
              <option value="">All Products</option>
              {masterProducts.map(p => (
                <option key={p.id} value={p.name}>{getProductLabel(p)}</option>
              ))}
            </select>
          </label>
          {!isAvailableView && (
            <>
              <label style={label}>📅 From Date <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setMovPage(1);}} style={{...input, minWidth: 150}} /></label>
              <label style={label}>📅 To Date <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setMovPage(1);}} style={{...input, minWidth: 150}} /></label>
              <button onClick={exportMovementsPDF} className="fx-btn-primary" style={{...btnPrimary, marginLeft: "auto"}}>📄 Export PDF Data Sheet</button>
            </>
          )}
        </div>

        {/* TABLE */}
        {isAvailableView ? (
          <div style={tableWrapper}>
            <table className="wh-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={theadStyle}>
                <tr>
                  <th style={th}>Product Name</th>
                  <th style={th}>Product Code</th>
                  <th style={th}>📥 Inward</th>
                  <th style={th}>📤 Outward</th>
                  <th style={th}>🔄 Returned</th>
                  <th style={th}>⚠️ Expired / Damaged</th>
                  <th style={th}>🧮 Available Stock</th>
                  <th style={th}>Last Updated / Inward</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAvailable.map(r => (
                  <tr key={r.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{...td, fontWeight: 600, color: "#0f172a"}}>{r.productName}</td>
                    <td style={td}><span style={skuChip}>{r.sku}</span></td>
                    <td style={{...td, color: "#16a34a", fontWeight: 600}}>+{r.inward}</td>
                    <td style={{...td, color: "#dc2626", fontWeight: 600}}>-{r.outward}</td>
                    <td style={{...td, color: "#ca8a04", fontWeight: 600}}>+{r.returned}</td>
                    <td style={{...td, color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap"}} title={`Expired: ${r.expiredOnly} | Damaged: ${r.damagedOnly} (Total: ${r.expired})`}>
                      -{r.expiredOnly} / -{r.damagedOnly}
                    </td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, fontSize: 14, padding: "5px 14px", borderRadius: 999, background: r.available > 20 ? "#dcfce7" : "#fee2e2", color: r.available > 20 ? "#166534" : "#991b1b", border: `1px solid ${r.available > 20 ? "#86efac" : "#fca5a5"}` }}>
                        {r.available}
                      </span>
                    </td>
                    <td style={{...td, color: "#64748b", fontSize: 13}}>
                      <div style={{ whiteSpace: "nowrap" }}>{r.lastDate ? r.lastDate.toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : "-"}</div>
                      <div style={{ whiteSpace: "nowrap", marginTop: 3 }}>{r.lastInwardDate ? r.lastInwardDate.toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : "-"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {availableStock.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No records found for this filter.</div>}
          </div>
        ) : isHistoryView ? (
          <div style={tableWrapper}>
            <table className="wh-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={theadStyle}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Product Name</th>
                  <th style={th}>Type</th>
                  <th style={th}>Qty</th>
                  <th style={th}>Ref / Remarks</th>
                  <th style={th}>Person(s)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map(m => {
                  const meta = getTypeMeta(m.type);
                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={td}>{getRecordDate(m).toLocaleDateString('en-IN')}</td>
                      <td style={{...td, fontWeight: 600, color: "#0f172a"}}>{m.productName}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: "nowrap" }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{ fontWeight: "bold", color: meta.sign === "+" ? "#16a34a" : "#dc2626" }}>
                          {meta.sign}{m.quantity}
                        </span>
                      </td>
                      <td style={{...td, color: "#64748b"}}>{m.referenceId || m.remarks || "-"}</td>
                      <td style={td}>
                        {getPersonInfo(m).map(p => (
                          <div key={p.label} style={{ whiteSpace: "nowrap" }}><b style={{ color: "#475569" }}>{p.label}:</b> {p.value}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {historyMovements.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No records found for this filter.</div>}
          </div>
        ) : (
          <div style={tableWrapper}>
            <table className="wh-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={theadStyle}>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Product Name</th>
                  <th style={th}>Qty</th>
                  <th style={th}>Ref / Remarks</th>
                  {personColumns.map(c => <th key={c.label} style={th}>{c.label}</th>)}
                  {activeTab === "OUTWARD" && <th style={th}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map(m => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={td}>{getRecordDate(m).toLocaleDateString('en-IN')}</td>
                    <td style={{...td, fontWeight: 600, color: "#0f172a"}}>{m.productName}</td>
                    <td style={td}>
                      <span style={{ fontWeight: "bold", color: activeTab==="INWARD" || activeTab==="RETURN" ? "#16a34a" : "#dc2626" }}>
                        {activeTab==="INWARD" || activeTab==="RETURN" ? "+" : "-"}{m.quantity}
                      </span>
                    </td>
                    <td style={{...td, color: "#64748b"}}>{m.referenceId || m.remarks || "-"}</td>
                    {personColumns.map(c => <td key={c.label} style={td}>{c.value(m)}</td>)}
                    {activeTab === "OUTWARD" && (
                      <td style={{...td, whiteSpace: "nowrap"}}>
                        {m.type === "OUTWARD_MANUAL" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => openEdit(m)} style={btnEdit} title="Edit record">✏️ Edit</button>
                            <button onClick={() => handleDeleteOutward(m)} style={btnDelete} title="Delete record and restore stock">🗑️ Delete</button>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }} title="Kit dispatches are managed from the Kits section">Kit — locked</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMovements.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No records found for this filter.</div>}
          </div>
        )}

        {/* PAGINATION */}
        <div style={paginationRow}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Showing <b style={{color: "#334155"}}>{section1Showing}</b> of <b style={{color: "#334155"}}>{section1Total}</b> {isAvailableView ? "products" : "records"}</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
              Rows per page
              <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setMovPage(1); }} style={perPageSelect}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <span style={{ fontSize: 13, color: "#64748b" }}>Page <b style={{color: "#334155"}}>{movPage}</b> of <b style={{color: "#334155"}}>{Math.max(1, Math.ceil(section1Total / itemsPerPage))}</b></span>
            <button disabled={movPage === 1} onClick={() => setMovPage(p => p - 1)} style={{...btnPage, opacity: movPage === 1 ? 0.5 : 1}}>← Previous</button>
            <button disabled={movPage * itemsPerPage >= section1Total} onClick={() => setMovPage(p => p + 1)} style={{...btnPage, opacity: movPage * itemsPerPage >= section1Total ? 0.5 : 1}}>Next →</button>
          </div>
        </div>
      </div>

      {/* OUTWARD EDIT MODAL */}
      {editMov && (
        <div style={modalOverlay} onClick={() => !savingEdit && setEditMov(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px 0", color: "#1e293b" }}>✏️ Edit Outward Record</h3>
            <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: 13 }}>
              <b style={{ color: "#334155" }}>{editMov.productName}</b> — Issued to {displayPerson(editMov.issuedTo) || "-"}
            </p>
            <form onSubmit={saveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{...label, flex: 1}}>Date Issued * <input type="date" value={editForm.dateIssued} onChange={e => setEditForm(f => ({ ...f, dateIssued: e.target.value }))} style={input} required /></label>
                <label style={{...label, width: 100}}>Qty * <input type="number" min="1" value={editForm.qty} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))} style={input} required /></label>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{...label, flex: 1}}>Destination Machine *
                  <select value={editForm.machineId} onChange={e => setEditForm(f => ({ ...f, machineId: e.target.value }))} style={input} required>
                    <option value="">-- Select Machine --</option>
                    {editForm.machineId && !machines.some(mm => mm.id === editForm.machineId) && (
                      <option value={editForm.machineId}>{editForm.machineId}</option>
                    )}
                    {machines.map(mm => (
                      <option key={mm.id} value={mm.id}>{mm.id}{mm.name ? ` - ${mm.name}` : ""}{mm.location ? ` (${mm.location})` : ""}</option>
                    ))}
                  </select>
                </label>
                <label style={{...label, flex: 1}}>Purpose *
                  <select value={editForm.purpose} onChange={e => setEditForm(f => ({ ...f, purpose: e.target.value }))} style={input}>
                    <option value="Manual Adjustment">Manual Adjustment</option>
                    <option value="Transfer to Machine">Transfer to Machine</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </label>
              </div>
              <label style={label}>Issued By * <input type="text" value={editForm.issuedBy} onChange={e => setEditForm(f => ({ ...f, issuedBy: e.target.value }))} style={input} required placeholder="Name of person handing over" /></label>
              <label style={label}>Remarks * <textarea value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} style={input} rows="2" required /></label>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={() => setEditMov(null)} disabled={savingEdit} style={btnCancel}>Cancel</button>
                <button type="submit" disabled={savingEdit} style={btnSave}>{savingEdit ? "Saving..." : "💾 Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-components & Styles
const TabButton = ({ active, onClick, icon, label, color }) => (
  <button onClick={onClick} style={{
    padding: "9px 18px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
    background: active ? "var(--fx-teal)" : "#fff",
    color: active ? "#fff" : "#64748b",
    border: `1px solid ${active ? "var(--fx-teal)" : "#dde3e7"}`,
    boxShadow: active ? "0 1px 4px rgba(60,130,144,0.35)" : "none",
    transition: "all 0.2s"
  }}>
    <span>{icon}</span> {label}
  </button>
);

const SubTabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{
    padding: "8px 16px", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
    background: active ? "#e3eff2" : "#fff",
    color: active ? "#2f6f7c" : "#64748b",
    border: `1px solid ${active ? "#a8ccd4" : "#dde3e7"}`,
    transition: "all 0.2s"
  }}>
    <span>{icon}</span> {label}
  </button>
);

const headerBar = { background: "var(--fx-teal)", padding: "13px 20px", borderRadius: 8, marginBottom: 16, boxShadow: "0 2px 6px rgba(16,54,61,0.18)" };
const card = { background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", border: "1px solid var(--fx-border)" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const input = { padding: "10px 12px", borderRadius: 6, border: "1px solid #ced4da", outline: "none", background: "#fff", fontSize: 14, color: "#334155" };
const btnPrimary = { padding: "10px 22px", background: "var(--fx-slate)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", boxShadow: "0 1px 3px rgba(35,58,79,0.3)", transition: "background 0.15s" };
const tableWrapper = { border: "1px solid var(--fx-border)", borderRadius: 8, overflow: "hidden" };
const theadStyle = { background: "#f1f3f5", color: "#23292f", fontSize: 13 };
const th = { padding: "12px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid var(--fx-border)" };
const filterBar = { display: "flex", gap: 15, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end", background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: 8, padding: "16px 18px" };
const perPageSelect = { padding: "7px 10px", borderRadius: 6, border: "1px solid #b7d4da", background: "#fff", color: "#357683", fontWeight: "bold", cursor: "pointer", outline: "none" };
const td = { padding: "11px 16px", color: "#334155" };
const skuChip = { fontFamily: "monospace", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 9px", borderRadius: 6, fontSize: 12.5, color: "#475569", fontWeight: 600 };
const paginationRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15 };
const btnPage = { padding: "7px 14px", background: "#eaf3f5", border: "1px solid #b7d4da", borderRadius: 6, cursor: "pointer", fontWeight: "bold", color: "#357683" };
const btnEdit = { padding: "6px 12px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12.5, whiteSpace: "nowrap" };
const btnDelete = { padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12.5, whiteSpace: "nowrap" };
const modalOverlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalBox = { background: "#fff", padding: 24, borderRadius: 12, width: "100%", maxWidth: 540, boxShadow: "0 10px 40px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" };
const btnCancel = { padding: "10px 20px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
const btnSave = { padding: "10px 20px", background: "var(--fx-teal)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };
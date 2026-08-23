# Warehouse Data Sheets - Styling Changes (Revert Reference)

**Date:** 2026-07-08
**File modified:** `frontend/src/pages/admin/WarehouseDashboard.jsx`
**Scope:** Visual styling only. No logic, data, or calculation changes.

To revert any change, replace the "NEW" snippet with the "ORIGINAL" snippet in the file above. To revert everything, apply all sections bottom-to-top.

---

## Change 1: Page Header → Gradient Header Bar + Full-Width Layout + Row Hover CSS

**ORIGINAL:**
```jsx
return (
  <div style={{ maxWidth: 1200 }}>
    <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📊 Warehouse Data Sheets</h1>
    <p style={{ color: "#64748b", marginBottom: 30 }}>Interactive drill-down reports for all stock operations.</p>
```

**NEW** (full-width page, gradient banner bar, injected CSS for zebra striping + row hover):
```jsx
return (
  <div style={{ width: "100%" }}>
    <style>{`
      .wh-table tbody tr:nth-child(even) { background: #fafbfd; }
      .wh-table tbody tr:hover { background: #eef2ff; transition: background 0.15s; }
    `}</style>

    <div style={headerBar}>
      <h1 style={{ margin: 0, color: "#fff", fontSize: 28, letterSpacing: "-0.5px" }}>📊 Warehouse Data Sheets</h1>
      <p style={{ color: "rgba(255,255,255,0.88)", margin: "6px 0 0 0", fontSize: 15 }}>Interactive drill-down reports for all stock operations.</p>
    </div>
```

Plus a new constant in the styles block (delete on revert):
```jsx
const headerBar = { background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%)", padding: "26px 30px", borderRadius: 16, marginBottom: 24, boxShadow: "0 10px 30px rgba(99,102,241,0.25)" };
```

Both `<table>` elements also gained `className="wh-table"` (was no className) so the injected CSS applies:
```jsx
<table className="wh-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
```

---

## Change 2: Table Header Row (`<thead>`) — applies to BOTH tables (Available Stock + movement tabs)

**ORIGINAL** (appeared twice in the file):
```jsx
<thead style={{ background: "#f8fafc", color: "#64748b" }}>
```

**NEW** (both occurrences now reference a shared constant):
```jsx
<thead style={theadStyle}>
```
The `theadStyle` constant is defined in the styles block (see Change 6). To revert: change both `<thead style={theadStyle}>` back to the original inline style and delete the `theadStyle` constant.

---

## Change 3: Available Stock Table Rows

**ORIGINAL:**
```jsx
{paginatedAvailable.map(r => (
  <tr key={r.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
    <td style={{...td, fontWeight: "bold"}}>{r.productName}</td>
    <td style={{...td, color: "#64748b"}}>{r.sku}</td>
    <td style={{...td, color: "#16a34a"}}>+{r.inward}</td>
    <td style={{...td, color: "#dc2626"}}>-{r.outward}</td>
    <td style={{...td, color: "#ca8a04"}}>+{r.returned}</td>
    <td style={{...td, color: "#dc2626"}}>-{r.expired}</td>
    <td style={td}>
      <span style={{ fontWeight: "bold", padding: "4px 10px", borderRadius: 12, background: r.available > 20 ? "#dcfce7" : "#fee2e2", color: r.available > 20 ? "#166534" : "#991b1b" }}>
        {r.available}
      </span>
    </td>
    <td style={{...td, color: "#64748b"}}>
      {r.lastDate ? r.lastDate.toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : "-"}
    </td>
  </tr>
))}
```

**NEW** (SKU chip, bolder numbers, pill badge with border; zebra striping comes from the `.wh-table` CSS in Change 1):
```jsx
{paginatedAvailable.map(r => (
  <tr key={r.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
    <td style={{...td, fontWeight: 600, color: "#0f172a"}}>{r.productName}</td>
    <td style={td}><span style={skuChip}>{r.sku}</span></td>
    <td style={{...td, color: "#16a34a", fontWeight: 600}}>+{r.inward}</td>
    <td style={{...td, color: "#dc2626", fontWeight: 600}}>-{r.outward}</td>
    <td style={{...td, color: "#ca8a04", fontWeight: 600}}>+{r.returned}</td>
    <td style={{...td, color: "#dc2626", fontWeight: 600}}>-{r.expired}</td>
    <td style={td}>
      <span style={{ fontWeight: 700, fontSize: 14, padding: "5px 14px", borderRadius: 999, background: r.available > 20 ? "#dcfce7" : "#fee2e2", color: r.available > 20 ? "#166534" : "#991b1b", border: `1px solid ${r.available > 20 ? "#86efac" : "#fca5a5"}` }}>
        {r.available}
      </span>
    </td>
    <td style={{...td, color: "#64748b", fontSize: 13}}>
      {r.lastDate ? r.lastDate.toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : "-"}
    </td>
  </tr>
))}
```

---

## Change 4: Movement Table Rows (Inward / Outward / Returned / Expired tabs)

**ORIGINAL:**
```jsx
{paginatedMovements.map(m => (
  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
    <td style={td}>{getRecordDate(m).toLocaleDateString('en-IN')}</td>
    <td style={{...td, fontWeight: "bold"}}>{m.productName}</td>
```

**NEW** (bolder product name; zebra striping comes from the `.wh-table` CSS in Change 1):
```jsx
{paginatedMovements.map(m => (
  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
    <td style={td}>{getRecordDate(m).toLocaleDateString('en-IN')}</td>
    <td style={{...td, fontWeight: 600, color: "#0f172a"}}>{m.productName}</td>
```

---

## Change 5: TabButton Component (tab pills)

**ORIGINAL:**
```jsx
const TabButton = ({ active, onClick, icon, label, color }) => (
  <button onClick={onClick} style={{
    padding: "10px 16px", borderRadius: 8, fontWeight: "bold", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
    background: active ? `${color}15` : "#f1f5f9",
    color: active ? color : "#64748b",
    border: `1px solid ${active ? color : "transparent"}`,
    transition: "all 0.2s"
  }}>
    <span>{icon}</span> {label}
  </button>
);
```

**NEW** (pill shape, solid fill + glow when active):
```jsx
const TabButton = ({ active, onClick, icon, label, color }) => (
  <button onClick={onClick} style={{
    padding: "10px 18px", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
    background: active ? color : "#f8fafc",
    color: active ? "#fff" : "#64748b",
    border: `1px solid ${active ? color : "#e2e8f0"}`,
    boxShadow: active ? `0 4px 14px ${color}55` : "none",
    transition: "all 0.2s"
  }}>
    <span>{icon}</span> {label}
  </button>
);
```

---

## Change 6: Shared Style Constants (bottom of file)

**ORIGINAL:**
```jsx
const card = { background: "#fff", padding: 25, borderRadius: 12, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const input = { padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", outline: "none" };
const btnPrimary = { padding: "10px 16px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const tableWrapper = { border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" };
const th = { padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "12px 16px" };
const paginationRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15 };
const btnPage = { padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontWeight: "bold", color: "#475569" };
```

**NEW:**
```jsx
const card = { background: "#fff", padding: 28, borderRadius: 16, boxShadow: "0 10px 30px rgba(2,6,23,0.06)", border: "1px solid #eef2f7" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: "bold", color: "#475569" };
const input = { padding: "11px 12px", borderRadius: 10, border: "1px solid #e2e8f0", outline: "none", background: "#f8fafc", fontSize: 14 };
const btnPrimary = { padding: "11px 18px", background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 14px rgba(14,165,233,0.35)" };
const tableWrapper = { border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" };
const theadStyle = { background: "#f1f5f9", color: "#475569", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.8px" };   // <-- NEW constant (delete on revert)
const th = { padding: "14px 16px", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 700 };
const td = { padding: "14px 16px", color: "#334155" };
const skuChip = { fontFamily: "monospace", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 9px", borderRadius: 6, fontSize: 12.5, color: "#475569", fontWeight: 600 };   // <-- NEW constant (delete on revert)
const paginationRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15 };
const btnPage = { padding: "7px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontWeight: "bold", color: "#475569" };
```

*(`label` and `paginationRow` are unchanged, listed only for completeness.)*

---

## Change 7: Filter Toolbar, Dark Table Header, Pagination with Per-Page Selector

> Note: the per-page selector is a small FUNCTIONAL addition (previously fixed at 10 rows), everything else here is styling only.

### 7a. Filters (Search Product / From Date / To Date)

**ORIGINAL:**
```jsx
<div style={{ display: "flex", gap: 15, marginBottom: 15, flexWrap: "wrap", alignItems: "flex-end" }}>
  <label style={label}>Search Product <input type="text" value={movSearch} onChange={e => {setMovSearch(e.target.value); setMovPage(1);}} style={input} placeholder="Search..." /></label>
  <label style={label}>From Date <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setMovPage(1);}} style={input} /></label>
  <label style={label}>To Date <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setMovPage(1);}} style={input} /></label>

  <button onClick={exportMovementsPDF} style={{...btnPrimary, marginLeft: "auto"}}>📄 Export PDF Data Sheet</button>
</div>
```

**NEW** (toolbar strip with icons and wider inputs):
```jsx
<div style={filterBar}>
  <label style={label}>🔍 Search Product <input type="text" value={movSearch} onChange={e => {setMovSearch(e.target.value); setMovPage(1);}} style={{...input, minWidth: 240}} placeholder="Type product name..." /></label>
  <label style={label}>📅 From Date <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setMovPage(1);}} style={{...input, minWidth: 150}} /></label>
  <label style={label}>📅 To Date <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setMovPage(1);}} style={{...input, minWidth: 150}} /></label>

  <button onClick={exportMovementsPDF} style={{...btnPrimary, marginLeft: "auto"}}>📄 Export PDF Data Sheet</button>
</div>
```

### 7b. Table header restyled (dark slate gradient)

**Previous value (from Change 6):**
```jsx
const theadStyle = { background: "#f1f5f9", color: "#475569", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.8px" };
const th = { padding: "14px 16px", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 700 };
```

**NEW:**
```jsx
const theadStyle = { background: "linear-gradient(135deg, #1e293b, #334155)", color: "#e2e8f0", textTransform: "uppercase", fontSize: 11.5, letterSpacing: "1px" };
const th = { padding: "15px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" };
```

### 7c. Input restyled (white with subtle shadow)

**Previous value (from Change 6):**
```jsx
const input = { padding: "11px 12px", borderRadius: 10, border: "1px solid #e2e8f0", outline: "none", background: "#f8fafc", fontSize: 14 };
```

**NEW:**
```jsx
const input = { padding: "11px 13px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", background: "#fff", fontSize: 14, color: "#334155", boxShadow: "0 1px 2px rgba(2,6,23,0.04)" };
```

### 7d. New style constants (delete on revert)

```jsx
const filterBar = { display: "flex", gap: 15, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" };
const perPageSelect = { padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#334155", fontWeight: "bold", cursor: "pointer", outline: "none" };
```

### 7e. Pagination with rows-per-page selector (functional addition)

**ORIGINAL** (fixed page size):
```jsx
const ITEMS_PER_PAGE = 10;
// ...
const paginatedMovements = filteredMovements.slice((movPage - 1) * ITEMS_PER_PAGE, movPage * ITEMS_PER_PAGE);
const paginatedAvailable = availableStock.slice((movPage - 1) * ITEMS_PER_PAGE, movPage * ITEMS_PER_PAGE);
// ...
<div style={paginationRow}>
  <span style={{ fontSize: 13, color: "#64748b" }}>Showing {section1Showing} of {section1Total} {activeTab === "AVAILABLE" ? "products" : "records"}</span>
  <div style={{ display: "flex", gap: 10 }}>
    <button disabled={movPage === 1} onClick={() => setMovPage(p => p - 1)} style={btnPage}>Previous</button>
    <button disabled={movPage * ITEMS_PER_PAGE >= section1Total} onClick={() => setMovPage(p => p + 1)} style={btnPage}>Next</button>
  </div>
</div>
```

**NEW** (state-based page size with 10/25/50/100 selector and page indicator):
```jsx
const [itemsPerPage, setItemsPerPage] = useState(10);
// ...
const paginatedMovements = filteredMovements.slice((movPage - 1) * itemsPerPage, movPage * itemsPerPage);
const paginatedAvailable = availableStock.slice((movPage - 1) * itemsPerPage, movPage * itemsPerPage);
// ...
<div style={paginationRow}>
  <span style={{ fontSize: 13, color: "#64748b" }}>Showing <b style={{color: "#334155"}}>{section1Showing}</b> of <b style={{color: "#334155"}}>{section1Total}</b> {activeTab === "AVAILABLE" ? "products" : "records"}</span>
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
```

---

## Change 8: App-Wide Font — Inter (affects ALL pages, not just Warehouse)

The app referenced the 'Inter' font in `styles.css` (login page) but never loaded it, and no global body font was set, so pages rendered in the browser's default font.

### 8a. `frontend/index.html` — font loading added

**ORIGINAL:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Snackmaster | Vending Solutions</title>
```

**NEW:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<title>Snackmaster | Vending Solutions</title>
```

### 8b. `frontend/src/styles.css` — global font rules added after the `*` reset

**ADDED (delete these two blocks on revert):**
```css
body {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button, input, select, textarea {
  font-family: inherit;
}
```

> Note: this change requires an internet connection to fetch the font from Google Fonts; offline it gracefully falls back to the system font.

---

## Change 9: Sidebar Styling (affects ALL admin pages)

**File modified:** `frontend/src/layouts/AdminLayout.jsx`
**Scope:** Visual styling only. Navigation, routing, collapse, and logout logic unchanged.

### 9a. Injected hover/scrollbar CSS (added right after the root `<div>`; delete the whole `<style>` block on revert)
```jsx
<style>{`
  .sm-nav::-webkit-scrollbar { width: 5px; }
  .sm-nav::-webkit-scrollbar-track { background: transparent; }
  .sm-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
  .sm-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
  .sm-navlink:hover { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
  .sm-collapse:hover { background: rgba(255,255,255,0.18) !important; color: #fff !important; }
  .sm-logout:hover { background: rgba(239,68,68,0.25) !important; color: #fecaca !important; }
  .sm-section:hover { color: #cbd5e1 !important; }
`}</style>
```
Also added on revert-delete: `className` props referencing these classes — `sm-navlink` (NavLink, non-active only), `sm-collapse` (collapse button), `sm-section` (section toggles), `sm-nav` (nav element), `sm-logout` (logout button).

### 9b. NavLink active state
- ORIGINAL: `background: "rgba(14, 165, 233, 0.15)"`, `color: "#38bdf8"`, `borderRadius: 8`, `fontWeight: 500`, plain `#38bdf8` left indicator bar, icon box `rgba(14,165,233,0.2)`.
- NEW: `background: "linear-gradient(90deg, rgba(14,165,233,0.28), rgba(99,102,241,0.14))"`, `color: "#7dd3fc"`, `borderRadius: 10`, `fontWeight: active ? 600 : 500`, indicator bar `linear-gradient(180deg, #38bdf8, #6366f1)` with glow `boxShadow: "0 0 8px rgba(56,189,248,0.8)"`, icon box `rgba(14,165,233,0.25)` with glow `0 0 10px rgba(56,189,248,0.25)`.

### 9c. Brand header
- ORIGINAL: plain `SNACKMASTER` text only.
- NEW: added a 34x34 gradient logo mark (🍿 on `linear-gradient(135deg, #38bdf8, #6366f1)`, radius 10, glow shadow) to the left of the title, wrapped in a flex row with `gap: 10`.

### 9d. User info card
- ORIGINAL: flat `rgba(255,255,255,0.05)` card, avatar above full-wrap email, plain orgId chip.
- NEW: subtle sky→indigo gradient card (`linear-gradient(135deg, rgba(56,189,248,0.08), rgba(99,102,241,0.06))`, radius 12, border `rgba(255,255,255,0.08)`); avatar (36px, gradient `#38bdf8→#6366f1`, white ring border, glow) sits left of an "ADMIN" role label + single-line ellipsized email; orgId chip now `🏢 {orgId}` with border and radius 6.

---

## Change 10: Unified Indigo/Violet Color Palette (Sidebar + Main Area + Pagination)

Harmonizes the sidebar with the page header bar's sky→indigo→violet gradient family.

### 10a. `frontend/src/layouts/AdminLayout.jsx` — color values changed (find each NEW value, restore ORIGINAL to revert):

| Element | ORIGINAL | NEW |
|---|---|---|
| Root layout background | `backgroundColor: "#f1f5f9"` | `background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)"` |
| Sidebar background | `linear-gradient(180deg, #0f172a 0%, #1e293b 100%)` | `linear-gradient(180deg, #0f172a 0%, #1e1b4b 70%, #312e81 160%)` |
| Active link background | `linear-gradient(90deg, rgba(14,165,233,0.28), rgba(99,102,241,0.14))` | `linear-gradient(90deg, rgba(99,102,241,0.35), rgba(139,92,246,0.15))` |
| Active link text | `#7dd3fc` | `#c7d2fe` |
| Active indicator bar | `linear-gradient(180deg, #38bdf8, #6366f1)` + glow `rgba(56,189,248,0.8)` | `linear-gradient(180deg, #818cf8, #a78bfa)` + glow `rgba(129,140,248,0.8)` |
| Active icon tile | `rgba(14, 165, 233, 0.25)` + glow `rgba(56,189,248,0.25)` | `rgba(99, 102, 241, 0.3)` + glow `rgba(129,140,248,0.3)` |
| Logo mark | `linear-gradient(135deg, #38bdf8, #6366f1)` + shadow `rgba(56,189,248,0.35)` | `linear-gradient(135deg, #6366f1, #8b5cf6)` + shadow `rgba(99,102,241,0.4)` |
| Brand "MASTER" text | `#38bdf8` | `#a5b4fc` |
| User card background | `linear-gradient(135deg, rgba(56,189,248,0.08), rgba(99,102,241,0.06))` | `linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))` |
| Avatar | `linear-gradient(135deg, #38bdf8, #0ea5e9)` → had become `#38bdf8, #6366f1` in Change 9 | `linear-gradient(135deg, #6366f1, #8b5cf6)` + shadow `rgba(99,102,241,0.35)` |
| "ADMIN" role label | `#7dd3fc` | `#a5b4fc` |
| Warehouse Ops section label | `color="#38bdf8"` | `color="#a5b4fc"` |

### 10b. `frontend/src/pages/admin/WarehouseDashboard.jsx` — pagination controls:

**Previous values (from Change 7):**
```jsx
const perPageSelect = { padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#334155", fontWeight: "bold", cursor: "pointer", outline: "none" };
const btnPage = { padding: "7px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontWeight: "bold", color: "#475569" };
```

**NEW (indigo accents):**
```jsx
const perPageSelect = { padding: "7px 10px", borderRadius: 8, border: "1px solid #c7d2fe", background: "#fff", color: "#4f46e5", fontWeight: "bold", cursor: "pointer", outline: "none" };
const btnPage = { padding: "7px 14px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, cursor: "pointer", fontWeight: "bold", color: "#4f46e5" };
```

---

## Summary of Visual Effects

| Element | Before | After |
|---|---|---|
| Font (app-wide) | Browser default | Inter (Google Fonts) with system fallback |
| Sidebar (all admin pages) | Static links, no hover, plain active state | Hover highlights, gradient active pill with glowing indicator, logo mark, upgraded user card, slim scrollbar |
| Page header | Plain dark text on background | Gradient banner bar (sky→indigo→violet) with white text |
| Page width | Capped at 1200px | Full width of the content area |
| Row hover | None | Light indigo highlight on hover |
| Tabs | Light tinted rectangles | Solid colored pills with glow on active |
| Card | Small shadow, 12px radius | Softer/larger shadow, 16px radius |
| Table header | Plain gray | Dark slate gradient, white uppercase letter-spaced labels |
| Filters | Bare inputs in a row | Toolbar strip with icons and wider white inputs |
| Pagination | Fixed 10 rows, plain Prev/Next | Rows-per-page selector (10/25/50/100), Page X of Y indicator, arrow buttons |
| Table rows | All white | Zebra striping (alternate #fafbfd) |
| SKU | Plain gray text | Monospace chip badge |
| Available qty badge | Small rounded rect | Pill with matching colored border |
| Export button | Flat sky blue | Sky→indigo gradient with shadow |
| Inputs | White, sharp | Soft gray fill, rounder corners |

**Not changed:** any calculation, filter, pagination, export, or data-loading logic.

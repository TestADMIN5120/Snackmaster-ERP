# FineX-Style Teal Theme - Styling Changes (Revert Reference)

**Date:** 2026-07-19
**Scope:** Visual styling only. No logic, data, routing, or calculation changes.

**Files modified/created:**

| File | What happened |
|---|---|
| `frontend/src/theme-finex.css` | **NEW** - central palette (CSS variables) + hover rules. Delete on revert. |
| `frontend/src/main.jsx` | One import line added. |
| `frontend/src/layouts/AdminLayout.jsx` | Restructured: teal top app bar + white sidebar (was dark indigo sidebar). |
| `frontend/src/pages/admin/WarehouseDashboard.jsx` | Style constants + tab buttons re-themed teal. |
| `frontend/src/pages/admin/AdminRefillLogs.jsx` | Style constants re-themed teal, banner text sized to match. |

**Look applied (modeled on the FineX app screenshot):** teal top app bar with Logout on the right, white sidebar with lavender/indigo active items, flat teal section-header bars, white cards with light borders, light-gray table header rows, slate-blue primary buttons.

**To revert everything:** delete `frontend/src/theme-finex.css` and `STYLE_CHANGES_FINEX_THEME.md`, then restore each "ORIGINAL" snippet below. The previous look is also fully documented in `STYLE_CHANGES_WAREHOUSE.md`.

---

## Change 1: New theme file `frontend/src/theme-finex.css` (delete on revert)

Contains only:
- `:root` CSS variables: `--fx-teal: #4696a4`, `--fx-teal-dark: #3c8290`, `--fx-slate: #5a7d9a`, `--fx-slate-dark: #4d6d88`, `--fx-lavender: #e8e7fa`, `--fx-indigo: #4f46e5`, `--fx-bg: #f4f6f8`, `--fx-border: #e2e7ea`, `--fx-text: #3d444d`
- Hover/scrollbar classes used by the new AdminLayout: `.fx-nav`, `.fx-navlink`, `.fx-section`, `.fx-collapse`, `.fx-logout`, `.fx-btn-primary`

> To change the theme's colors later, edit only this file.

## Change 2: `frontend/src/main.jsx` - one line added

**ORIGINAL:**
```jsx
import "./styles.css";
```

**NEW:**
```jsx
import "./styles.css";
import "./theme-finex.css";
```

---

## Change 3: `frontend/src/layouts/AdminLayout.jsx` - full visual restructure

All logic is unchanged: state (`orgStatus`, `collapsed`, `openSections`), the `onSnapshot` org listener, `handleLogout`, `isActive`, `toggleSection`, all routes/labels/icons, the collapse behavior, and the "Organisation Restricted" banner.

The ORIGINAL version of this file (dark indigo sidebar with gradient active pills, logo mark, glowing indicators, sidebar-bottom logout) is described in detail in `STYLE_CHANGES_WAREHOUSE.md` Changes 9-10. Structural summary of what changed now:

| Aspect | ORIGINAL (indigo dark theme) | NEW (FineX light theme) |
|---|---|---|
| Page structure | `flex` row: sidebar + main | `flex` column: **teal top app bar**, then row: sidebar + main |
| Top bar | none (brand inside sidebar) | 52px teal bar (`var(--fx-teal)`): 🍿 logo tile + `SNACK<span #ffe0b2>MASTER</span>` left; user email + white **Logout** button right |
| Logout | Red-tinted button at sidebar bottom | Moved to top bar (white text, `.fx-logout` hover). Sidebar-bottom button removed |
| Sidebar | Dark gradient `#0f172a → #1e1b4b → #312e81`, white text | White, `1px solid var(--fx-border)` right border |
| Sidebar header | 🍿 logo + SNACKMASTER + collapse button | "Admin Manager" title + bordered collapse button (like "FineX Manager <") |
| Section toggles | Tiny uppercase letter-spaced labels, transparent | Full-width rows, 13.5px, sentence case, bottom borders; **open section = lavender bg + indigo text** (chevron rotates 180°) |
| Nav links | Rounded gradient pills, glowing indicator bar, icon tiles | Flat list rows with bottom borders; active = `var(--fx-lavender)` bg, `var(--fx-indigo)` text, 3px indigo left bar; plain emoji icons |
| User card | Indigo gradient card, gradient avatar with glow | Light `#fafbfc` strip, flat teal avatar circle, teal "ADMIN" label, bordered org chip |
| Content background | `linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)` | `var(--fx-bg)` (#f4f6f8) |
| Content padding | 30 | 24 |
| Injected `<style>` block | `.sm-nav`/`.sm-navlink`/`.sm-collapse`/`.sm-logout`/`.sm-section` (dark hovers) | Removed - replaced by `.fx-*` classes in `theme-finex.css` |
| `SectionToggle` `color` prop | Accepted (`Warehouse Ops` passed `color="#a5b4fc"`) | Prop removed; all sections use theme colors |

**To revert this file:** restore the dark-theme version per `STYLE_CHANGES_WAREHOUSE.md` Changes 9-10, or ask to have it restored - no logic differs, so replacing the whole file with the previous version is safe.

---

## Change 4: `frontend/src/pages/admin/WarehouseDashboard.jsx`

### 4a. Zebra/hover CSS (indigo → teal tint)

**ORIGINAL:**
```jsx
.wh-table tbody tr:nth-child(even) { background: #fafbfd; }
.wh-table tbody tr:hover { background: #eef2ff; transition: background 0.15s; }
```

**NEW:**
```jsx
.wh-table tbody tr:nth-child(even) { background: #f8fafb; }
.wh-table tbody tr:hover { background: #e9f3f5; transition: background 0.15s; }
```

### 4b. Export button gained a hover class (remove attribute on revert)

```jsx
<button onClick={exportMovementsPDF} className="fx-btn-primary" style={{...btnPrimary, marginLeft: "auto"}}>
```

### 4c. TabButton (gradient/colored pills → flat FineX tabs, teal when active)

**ORIGINAL:**
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

**NEW** (the per-tab `color` prop is still accepted but no longer used - single teal accent):
```jsx
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
```

### 4d. SubTabButton (violet → teal tint)

**ORIGINAL:**
```jsx
    padding: "8px 16px", borderRadius: 8, ...
    background: active ? "#ede9fe" : "#fff",
    color: active ? "#6d28d9" : "#64748b",
    border: `1px solid ${active ? "#c4b5fd" : "#e2e8f0"}`,
```

**NEW:**
```jsx
    padding: "8px 16px", borderRadius: 6, ...
    background: active ? "#e3eff2" : "#fff",
    color: active ? "#2f6f7c" : "#64748b",
    border: `1px solid ${active ? "#a8ccd4" : "#dde3e7"}`,
```

### 4e. Style constants (bottom of file)

**ORIGINAL:**
```jsx
const headerBar = { background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%)", padding: "14px 24px", borderRadius: 14, marginBottom: 16, boxShadow: "0 10px 30px rgba(99,102,241,0.25)" };
const card = { background: "#fff", padding: 20, borderRadius: 16, boxShadow: "0 10px 30px rgba(2,6,23,0.06)", border: "1px solid #eef2f7" };
const input = { padding: "11px 13px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", background: "#fff", fontSize: 14, color: "#334155", boxShadow: "0 1px 2px rgba(2,6,23,0.04)" };
const btnPrimary = { padding: "11px 18px", background: "linear-gradient(135deg, #0ea5e9, #6366f1)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 14px rgba(14,165,233,0.35)" };
const tableWrapper = { border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" };
const theadStyle = { background: "linear-gradient(135deg, #1e293b, #334155)", color: "#e2e8f0", textTransform: "uppercase", fontSize: 11.5, letterSpacing: "1px" };
const th = { padding: "12px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" };
const filterBar = { display: "flex", gap: 15, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" };
const perPageSelect = { padding: "7px 10px", borderRadius: 8, border: "1px solid #c7d2fe", background: "#fff", color: "#4f46e5", fontWeight: "bold", cursor: "pointer", outline: "none" };
const btnPage = { padding: "7px 14px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, cursor: "pointer", fontWeight: "bold", color: "#4f46e5" };
```

**NEW:**
```jsx
const headerBar = { background: "var(--fx-teal)", padding: "13px 20px", borderRadius: 8, marginBottom: 16, boxShadow: "0 2px 6px rgba(16,54,61,0.18)" };
const card = { background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", border: "1px solid var(--fx-border)" };
const input = { padding: "10px 12px", borderRadius: 6, border: "1px solid #ced4da", outline: "none", background: "#fff", fontSize: 14, color: "#334155" };
const btnPrimary = { padding: "10px 22px", background: "var(--fx-slate)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", boxShadow: "0 1px 3px rgba(35,58,79,0.3)", transition: "background 0.15s" };
const tableWrapper = { border: "1px solid var(--fx-border)", borderRadius: 8, overflow: "hidden" };
const theadStyle = { background: "#f1f3f5", color: "#23292f", fontSize: 13 };
const th = { padding: "12px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid var(--fx-border)" };
const filterBar = { display: "flex", gap: 15, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end", background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: 8, padding: "16px 18px" };
const perPageSelect = { padding: "7px 10px", borderRadius: 6, border: "1px solid #b7d4da", background: "#fff", color: "#357683", fontWeight: "bold", cursor: "pointer", outline: "none" };
const btnPage = { padding: "7px 14px", background: "#eaf3f5", border: "1px solid #b7d4da", borderRadius: 6, cursor: "pointer", fontWeight: "bold", color: "#357683" };
```

*(`label`, `td`, `skuChip`, `paginationRow` unchanged.)*

---

## Change 5: `frontend/src/pages/admin/AdminRefillLogs.jsx`

### 5a. Zebra/hover CSS - same swap as 4a, on the `.rl-table` class.

### 5b. Export CSV button gained `className="fx-btn-primary"` (remove attribute on revert).

### 5c. Banner text sized to match the Warehouse page

**ORIGINAL:**
```jsx
<h1 style={{ margin: 0, color: "#fff", fontSize: 28, letterSpacing: "-0.5px" }}>📍 Refiller Tracking Ledger</h1>
<p style={{ color: "rgba(255,255,255,0.88)", margin: "6px 0 0 0", fontSize: 15 }}>Track exactly who refilled which machines on specific dates.</p>
```

**NEW:**
```jsx
<h1 style={{ margin: 0, color: "#fff", fontSize: 21, letterSpacing: "-0.5px" }}>📍 Refiller Tracking Ledger</h1>
<p style={{ color: "rgba(255,255,255,0.88)", margin: "3px 0 0 0", fontSize: 13 }}>Track exactly who refilled which machines on specific dates.</p>
```

### 5d. Style constants - same swaps as 4e, with these page-specific ORIGINAL values that differ:

```jsx
// ORIGINAL (this page only):
const headerBar = { background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%)", padding: "26px 30px", borderRadius: 16, marginBottom: 24, boxShadow: "0 10px 30px rgba(99,102,241,0.25)" };
const card = { background: "#fff", padding: 28, borderRadius: 16, boxShadow: "0 10px 30px rgba(2,6,23,0.06)", border: "1px solid #eef2f7" };
const th = { padding: "15px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" };
```
```jsx
// NEW (this page only):
const headerBar = { background: "var(--fx-teal)", padding: "16px 20px", borderRadius: 8, marginBottom: 20, boxShadow: "0 2px 6px rgba(16,54,61,0.18)" };
const card = { background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", border: "1px solid var(--fx-border)" };
const th = { padding: "13px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid var(--fx-border)" };
```

*(`label`, `td`, `skuChip`, `paginationRow`, `btnDel` unchanged.)*

---

## Summary of Visual Effects

| Element | Before (indigo/violet theme) | After (FineX teal theme) |
|---|---|---|
| App frame | Dark indigo sidebar, no top bar | Teal top app bar + white sidebar |
| Logout | Bottom of sidebar | Top-right of teal bar (like FineX) |
| Active nav item | Gradient indigo pill with glow | Lavender row + indigo text + 3px left bar |
| Open nav section | Uppercase tiny gray label | Lavender row with indigo text (like "Master Setup") |
| Page banners | Sky→indigo→violet gradient, big shadow | Flat teal bar, subtle shadow (like "Search User") |
| Table headers | Dark slate gradient, uppercase white | Light gray `#f1f3f5`, bold dark text |
| Primary buttons | Sky→indigo gradient with glow | Flat slate blue (like the FineX "Search" button) |
| Tabs | Per-color solid pills with glow | Flat rectangles, teal when active |
| Row hover | Indigo tint | Teal tint |
| Corner radii | 10-16px | 6-10px (crisper, FineX-like) |
| Palette source | Hard-coded per file | CSS variables in `theme-finex.css` |

**Not changed:** any calculation, filter, pagination, export, navigation, auth, or data-loading logic. Refiller and Super Admin layouts are untouched.

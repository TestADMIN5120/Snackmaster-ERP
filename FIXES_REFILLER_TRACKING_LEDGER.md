# Refiller Tracking Ledger - Bug Fixes

**File changed:** `frontend/src/pages/admin/AdminRefillLogs.jsx`
**Date:** 2026-07-12

This document explains the issues found on the **📍 Refiller Tracking Ledger** page (Admin > Refill Logs) and the fixes applied.

---

## Issue 1: Logs Not Loading (Missing Firestore Composite Index)

### Problem
The Firestore query combined a `where` clause with an `orderBy` clause on different fields:

```js
query(
  collection(db, "refill_logs"),
  where("orgId", "==", orgId),
  orderBy("createdAt", "desc")   // requires composite index (orgId + createdAt)
)
```

Firestore requires a **composite index** for this combination. If the index does not exist in the Firebase project, the query fails. The error was only logged to the browser console, so the page silently showed *"No refill tracking data found"* even when logs existed.

### Fix
Removed `orderBy` from the query and sorted the results **client-side** instead (newest first). This matches the pattern already used in `WarehouseDashboard.jsx`:

```js
const q = query(collection(db, "refill_logs"), where("orgId", "==", orgId));
// ...
data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
```

No Firestore index setup is needed anymore. The unused `orderBy` import was also removed.

---

## Issue 2: "Specific Date" Filter Off By One Day (Timezone Bug)

### Problem
The date filter converted the log timestamp to a date string using `toISOString()`:

```js
const logDateStr = new Date(l.createdAt.seconds * 1000).toISOString().split('T')[0];
```

`toISOString()` returns the date in **UTC**. For users in IST (UTC+5:30), any refill logged **before 5:30 AM** was treated as belonging to the *previous* day, so it did not appear when filtering by its actual date.

### Fix
The date string is now built from **local time** components:

```js
const d = new Date(l.createdAt.seconds * 1000);
const logDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
```

The comparison now matches the same local dates the user sees in the table.

---

## Issue 3: No Loading or Error State

### Problem
- While data was still being fetched, the page immediately displayed *"No refill tracking data found"*, which was misleading.
- If the Firestore listener failed (e.g. permissions or index error), the user got no feedback at all.

### Fix
- Added a `loading` state: the page now shows **"Loading Refiller Tracking Data..."** until the first snapshot arrives.
- Added a `loadError` state: if the Firestore listener fails, a red error banner is displayed at the top of the page with the error message instead of failing silently.

---

## Issue 4: CSV Export Produced Broken Columns

### Problem
CSV rows were built with plain string interpolation:

```js
`${formatDate(...)},${l.userEmail},...`
```

If a machine name, email, or remark contained a **comma** (e.g. `Lobby, Tower A`), the columns shifted and the exported report was corrupted. Quotes inside values would also break the file.

### Fix
Every field is now properly escaped/quoted per the CSV standard:

```js
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
```

Additional small improvements to the export:
- Clicking **Export CSV Report** with zero filtered records now shows an alert instead of downloading an empty file.
- The temporary object URL created for the download is now released with `URL.revokeObjectURL()` after the download starts (prevents a small memory leak).

---

## Summary of Behavior After Fixes

| Area | Before | After |
|------|--------|-------|
| Data loading | Blank/"No data" if composite index missing | Always loads (client-side sort, no index needed) |
| Specific Date filter | Wrong day for early-morning logs (UTC bug) | Matches local dates exactly |
| Loading feedback | None (showed "No data" while fetching) | "Loading..." indicator |
| Error feedback | Console only | Visible red error banner |
| CSV export | Columns break on commas; empty exports allowed | Properly quoted fields; empty export blocked |

No visual/styling changes were made - the page layout, filters, table, and pagination look the same as before.

---

# Round 2: Search Machine / Filter by Refiller / Data Not Loading

**Reported symptoms:** "Search Machine" and "Filter by Refiller" not working; data not loading.

## Root Cause Investigation (verified against the live Firestore database)

1. **The `refill_logs` collection is EMPTY.** No refill has ever been completed through the refiller flow, so the page has nothing to display. This is why "data is not loading" - the query and page work correctly, but there are zero records. (Verified with the Firebase Admin SDK: `refill_logs` collection does not exist; other collections like `machines`, `products`, `warehouse_movements` have data.)

2. **Refill logs are written WITHOUT a machine name.** The backend endpoint that creates logs (`backend/index.js`, `/api/confirm-refill`) writes only: `machineId, orgId, refillerId, userEmail, kitId, audited_inventory, returns, completedAt, createdAt`. It does **not** write `machineName`, `durationMinutes`, or `offline` - but the ledger page searched and displayed `machineName`. Result: even with data, searching by machine *name* would never match, and the Machine column would show "Unknown".

3. **The "Filter by Refiller" dropdown was built only from loaded logs.** With zero logs, the dropdown contained only "All Refillers", making the filter appear broken.

## Fixes Applied (`frontend/src/pages/admin/AdminRefillLogs.jsx`)

### 1. Machine names resolved from the `machines` collection
The page now loads the org's machines once and resolves each log's machine name via `machineId`:
```js
const getMachineName = (l) => l.machineName || machinesMap[l.machineId]?.name || "";
```
Used in: the search filter, the table's "Machine Synced" column, and the CSV export. Searching by machine name now works even though logs only store the machine ID.

### 2. Refiller dropdown populated from the `users` collection
The dropdown now lists all refiller accounts in the organisation (`users` where `role == "refiller"`), merged with any emails found in logs. The filter is usable even before any logs exist, and always shows every refiller.

### 3. Clearer empty state
When the collection has no records at all, the table now says:
> "No refill logs recorded yet. Entries will appear here once a refiller completes a machine refill."

instead of the misleading "No refill tracking data found for this selection."

### 4. Search robustness
Empty search text now explicitly matches all rows (`!txt || ...`) rather than relying on `"".includes("")` behaviour.

### 5. "Search Machine" now suggests existing machines
The search input is now a searchable dropdown (HTML `<datalist>`, same pattern as the Inward Stock Receipt product selector). As you type, all existing machines of the organisation appear as suggestions in `[MACHINE-ID] Name` format (e.g. `[SNACK-001] Alpha Unit`). Picking a suggestion filters the ledger by that exact machine; free typing still works as a normal text search on machine name or ID.

## Important Note - Why the page was empty

The ledger only shows data after a **refiller completes a refill** (Refiller app > machine page > confirm refill), which calls the backend `/api/confirm-refill` and creates the `refill_logs` record. To see data on this page:

1. Make sure the **backend server is running** (`cd backend && node index.js` on port 5001) - the refiller confirm step posts to it (`VITE_BACKEND_URL` or `http://localhost:5001/api`).
2. Log in as the refiller and complete a refill on a machine.
3. The entry will then appear in the Refiller Tracking Ledger in real time.

---

# Round 3: Warehouse Data Sheets Styling + Machine Dropdown

## 1. "Search Machine" replaced with a guaranteed "Filter by Machine" dropdown
The datalist-based search was not showing suggestions reliably in the browser, so it was replaced with a native `<select>` dropdown (same behavior as "Filter by Refiller"). It is always populated with:
- All machines of the organisation (from the `machines` collection), shown as `[SNACK-001] Alpha Unit`
- Plus any machine IDs found in logs that no longer exist in the machines collection

Selecting a machine filters the ledger to that exact machine; "All Machines" shows everything.

## 2. Page restyled to match the Warehouse Data Sheets page
- **Top header banner**: same blue-violet gradient banner with title and subtitle
- **Card container**: filters + table + pagination wrapped in the same white rounded card with soft shadow
- **Filter bar**: same light-grey rounded filter bar with icon labels (🔍 / 👤 / 📅) and identical input styling
- **Export button**: same gradient primary button style
- **Data table**: same dark gradient uppercase header, zebra-striped rows, hover highlight, monospace ID chip for machine IDs, pill-style badges for duration and sync type
- **Pagination**: same layout — "Showing X of Y records", styled "Rows per page" select (10/25/50/100), "Page X of Y", and "← Previous / Next →" buttons

All filtering, real-time updates, CSV export, and delete functionality are unchanged.

## Test Data Seeded

To verify the page immediately, 4 sample refill logs were seeded via a new script `backend/seedRefillLogsTest.js` (marked with `isTestData: true`), linked to the real machines (Alpha Unit / Beta Unit) and the refiller account.

- Re-seed: `cd backend && node seedRefillLogsTest.js`
- Remove test data: `cd backend && node seedRefillLogsTest.js --clean`

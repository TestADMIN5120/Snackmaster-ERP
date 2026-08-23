// Throwaway verification: runs the AdminNewSalesLedger vendor validation +
// normalization logic against the real vendor CSVs.
import fs from "fs";
import Papa from "../frontend/node_modules/papaparse/papaparse.min.js";

const VENDOR_FORMATS = {
  daalchini: {
    label: "Daalchini — Detailed Sales Report",
    columns: [
      ["id"], ["order_id"], ["slot_identifier"], ["manufacturer_variant_id"],
      ["name"], ["mrp"], ["offer_price"], ["created_at_tz"], ["updated_at_tz"],
      ["status"], ["success"], ["failed"], ["pendng"], ["hold_reset_done"],
      ["vend_remaining"], ["sub_status"], ["refund_count"],
      ["vending_machine_id"], ["machine_name"], ["street"]
    ],
    signature: ["order_id", "vending_machine_id", "offer_price"]
  },
  vendvittor: {
    label: "VendVittor — Daily Device Summary",
    columns: [
      ["Date"], ["Day of Week"], ["Device ID"], ["Location"], ["Revenue"],
      ["Transactions"], ["Cash Transactions"], ["PG Transactions"], ["Refund Count"]
    ],
    signature: ["Device ID", "Revenue", "PG Transactions"]
  },

};

const cleanNum = (v) => Number(String(v ?? "").replace(/,/g, "").trim()) || 0;

function validateVendorFormat(vendorKey, fields) {
  const spec = VENDOR_FORMATS[vendorKey];
  const found = (fields || []).map((f) => (f || "").trim()).filter(Boolean);
  const problems = [];
  const missing = spec.columns
    .filter((group) => !group.some((h) => found.includes(h)))
    .map((group) => group.join('" or "'));
  if (missing.length) {
    problems.push(`Missing required column${missing.length > 1 ? "s" : ""}: "${missing.join('", "')}"`);
  }
  const known = new Set(spec.columns.flat());
  const extra = found.filter((f) => !known.has(f));
  if (extra.length) {
    problems.push(`Unexpected column${extra.length > 1 ? "s" : ""} for this format: "${extra.join('", "')}"`);
  }
  if (problems.length) {
    const lcFound = new Set(found.map((f) => f.toLowerCase()));
    for (const [key, other] of Object.entries(VENDOR_FORMATS)) {
      if (key !== vendorKey && other.signature.every((h) => lcFound.has(h.toLowerCase()))) {
        problems.push(`Hint: these columns match the "${other.label}" format — check the vendor selection.`);
        break;
      }
    }
  }
  return problems;
}

function normalizeRows(vendorKey, rawData) {
  const lines = [];
  let totalRefunded = 0;
  if (vendorKey === "daalchini") {
    rawData.forEach(row => {
      const status = (row["status"] || "").trim().toLowerCase();
      if (status !== "completed") return;
      const txnId = (row["order_id"] || "").replace(/[^a-zA-Z0-9]/g, '');
      const unitPrice = cleanNum(row["offer_price"]);
      if (!txnId || unitPrice <= 0) return;
      const qtySold = cleanNum(row["success"]);
      const qtyRefunded = cleanNum(row["refund_count"]);
      const name = (row["name"] || "Unknown").trim();
      const slotId = (row["slot_identifier"] || "").toString().trim();
      const d = new Date((row["created_at_tz"] || "").trim());
      const parsedDate = isNaN(d) ? null : d;
      if (qtySold > 0) {
        lines.push({ txnId, slotId, parsedDate, name: qtySold > 1 ? `${name} x${qtySold}` : name, price: unitPrice * qtySold, qty: qtySold });
      }
      if (qtyRefunded > 0) {
        totalRefunded += unitPrice * qtyRefunded;
        lines.push({ txnId, slotId, parsedDate, name: `${name} (Refunded x${qtyRefunded})`, price: unitPrice * qtyRefunded, qty: qtyRefunded });
      }
    });
  } else if (vendorKey === "vendvittor") {
    rawData.forEach(row => {
      const deviceId = (row["Device ID"] || "").trim();
      const dateStr = (row["Date"] || "").trim();
      const revenue = cleanNum(row["Revenue"]);
      if (!deviceId || !dateStr || revenue <= 0) return;
      const txnCount = cleanNum(row["Transactions"]);
      const refundCount = cleanNum(row["Refund Count"]);
      const d = new Date(`${dateStr}T12:00:00`);
      lines.push({
        txnId: `VV${deviceId}${dateStr}`.replace(/[^a-zA-Z0-9]/g, ''),
        name: `Daily Summary — ${txnCount} sales${refundCount > 0 ? `, ${refundCount} refunds` : ""}`,
        slotId: deviceId, price: revenue, qty: 1, parsedDate: isNaN(d) ? null : d
      });
    });
  }
  return { lines, totalRefunded };
}

function group(lines) {
  const g = {};
  lines.forEach(l => {
    if (!g[l.txnId]) g[l.txnId] = { amount: 0, items: 0, date: l.parsedDate };
    g[l.txnId].amount += l.price;
    g[l.txnId].items++;
  });
  return g;
}

function parseFile(path) {
  const text = fs.readFileSync(path, "utf8");
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => (h || "").trim() });
}

const files = {
  daalchini: "C:/Users/Public/SnackMasterDocs/19072026-shared documents/detailed_sales_report_prod_read___ist_2026-07-19T11_16_27.321271Z.csv",
  vendvittor: "C:/Users/Public/SnackMasterDocs/19072026-shared documents/summary_by_device_date_Snack_2026-07-19.csv"
};

for (const [actualVendor, path] of Object.entries(files)) {
  const res = parseFile(path);
  console.log(`\n══════ ${actualVendor.toUpperCase()} file ══════`);
  for (const selected of Object.keys(VENDOR_FORMATS)) {
    const problems = validateVendorFormat(selected, res.meta.fields);
    const tag = problems.length === 0 ? "✅ VALID" : "❌ REJECTED";
    console.log(`selected=${selected}: ${tag}`);
    problems.forEach(p => console.log(`     · ${p}`));
  }
  const { lines, totalRefunded } = normalizeRows(actualVendor, res.data);
  const txns = group(lines);
  const gross = Object.values(txns).reduce((s, t) => s + t.amount, 0);
  const nullDates = lines.filter(l => !l.parsedDate).length;
  console.log(`→ normalize: ${res.data.length} raw rows → ${lines.length} item lines → ${Object.keys(txns).length} txns`);
  console.log(`→ gross ₹${gross.toFixed(2)} | refunded ₹${totalRefunded.toFixed(2)} | net ₹${(gross - totalRefunded).toFixed(2)} | lines with unparsed date: ${nullDates}`);
  const sample = Object.entries(txns).find(([, t]) => t.items > 1);
  if (sample) console.log(`→ sample multi-item txn: ${sample[0]} (${sample[1].items} items, ₹${sample[1].amount})`);
}

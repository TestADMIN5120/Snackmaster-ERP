// Seeds test sales data for the Sales & Transaction Ledger screen.
// Run: node seedSalesTest.js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });
const db = admin.firestore();

const ORG_ID = "ORG_PRIMARY_VDS";
const MACHINE_ID = "SNACK-001";
const MACHINE_NAME = "Alpha Unit";
const BATCH_ID = `BATCH_SEED_${Date.now()}`;

const rows = [
  ["SEED001", 50, "Lays Classic", "A1", "2026-07-01T09:15:22"],
  ["SEED002", 40, "Kurkure Masala", "A2", "2026-07-01T10:02:45"],
  ["SEED003", 60, "Coca Cola", "B1", "2026-07-01T11:30:10"],
  ["SEED004", 35, "Parle-G", "C3", "2026-07-01T12:45:33"],
  ["SEED005", 80, "Dairy Milk", "D2", "2026-07-01T14:20:05"],
  ["SEED006", 25, "Bingo Mad Angles", "A3", "2026-07-02T09:05:18"],
  ["SEED007", 55, "Sprite", "B2", "2026-07-02T10:40:52"],
  ["SEED008", 45, "Haldiram Bhujia", "C1", "2026-07-02T11:55:07"],
  ["SEED009", 70, "Red Bull", "D1", "2026-07-02T13:10:41"],
  ["SEED010", 30, "Good Day Biscuit", "C2", "2026-07-02T15:25:59"],
  ["SEED012", 65, "Snickers", "D3", "2026-07-03T10:15:28"],
  ["SEED013", 20, "Center Fresh", "E1", "2026-07-03T11:05:36"],
  ["SEED014", 90, "Maggi Cup Noodles", "E2", "2026-07-03T12:50:44"],
  ["SEED015", 55, "Thums Up", "B1", "2026-07-03T14:35:12"],
  ["SEED016", 45, "Uncle Chipps", "A2", "2026-07-04T09:12:09"],
  ["SEED018", 75, "KitKat", "D2", "2026-07-04T10:45:21"],
  ["SEED019", 35, "Hide and Seek", "C3", "2026-07-04T11:33:47"],
  ["SEED020", 60, "Mountain Dew", "B2", "2026-07-04T13:22:55"],
  ["SEED021", 50, "Doritos", "A3", "2026-07-05T09:41:16"],
  ["SEED022", 85, "Perk Home Pack", "D1", "2026-07-05T10:28:38"],
  ["SEED023", 30, "Britannia Cake", "C1", "2026-07-05T11:57:02"],
  ["SEED024", 55, "Fanta", "B3", "2026-07-05T13:44:29"],
  ["SEED025", 40, "Too Yumm", "A1", "2026-07-05T15:19:53"],
];

async function run() {
  const batch = db.batch();
  let totalRevenue = 0;
  const totalRefunded = 40; // simulated refund detected in the report

  for (const [txnId, amount, productName, slotId, date] of rows) {
    totalRevenue += amount;
    batch.set(db.collection("sales_transactions").doc(txnId), {
      txnId,
      uploadBatchId: BATCH_ID,
      machineId: MACHINE_ID,
      orgId: ORG_ID,
      amount,
      productName,
      slotId,
      items: [{ productName, slotId, price: amount, qty: 1 }],
      dateISO: new Date(date).toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deleted: false,
    });
  }

  // One multi-item transaction (2 products in a single purchase)
  const multiAmount = 50 + 40;
  totalRevenue += multiAmount;
  batch.set(db.collection("sales_transactions").doc("SEED011"), {
    txnId: "SEED011",
    uploadBatchId: BATCH_ID,
    machineId: MACHINE_ID,
    orgId: ORG_ID,
    amount: multiAmount,
    productName: "Multiple Items",
    slotId: "Mixed",
    items: [
      { productName: "Lays Magic Masala", slotId: "A1", price: 50, qty: 1 },
      { productName: "Pepsi", slotId: "B3", price: 40, qty: 1 },
    ],
    dateISO: new Date("2026-07-03T09:30:14").toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    deleted: false,
  });

  batch.set(db.collection("sales_upload_logs").doc(BATCH_ID), {
    id: BATCH_ID,
    orgId: ORG_ID,
    machineId: MACHINE_ID,
    machineName: MACHINE_NAME,
    fromDate: "2026-07-01",
    toDate: "2026-07-05",
    totalRevenue,
    totalRefunded,
    netRevenue: totalRevenue - totalRefunded,
    transactionCount: rows.length + 1,
    uploadedBy: "vdsplofficial@gmail.com (seed script)",
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    deleted: false,
  });

  await batch.commit();
  console.log(`Done. Batch ${BATCH_ID}: ${rows.length + 1} transactions, gross Rs.${totalRevenue}, refunds Rs.${totalRefunded}, net Rs.${totalRevenue - totalRefunded}`);
}

run().catch((e) => { console.error("Seed failed:", e); process.exit(1); });

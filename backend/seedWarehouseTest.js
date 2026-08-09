// Seeds test warehouse data: master products, current stock, and stock movements.
// Idempotent: uses fixed document IDs, safe to re-run.
// Run: node seedWarehouseTest.js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });
const db = admin.firestore();

const ORG_ID = "ORG_PRIMARY_VDS";
const ADMIN_EMAIL = "vdsplofficial@gmail.com";
const TS = (s) => admin.firestore.Timestamp.fromDate(new Date(s));

// [docId, sku, name, mrp, inward, outward, returned, expired]
const PRODUCTS = [
  ["PROD_SM001", "SM-001", "Lays Classic 50g",    20, 200, 120, 15,  5],
  ["PROD_SM002", "SM-002", "Kurkure Masala 60g",  20, 150,  90, 10,  0],
  ["PROD_SM003", "SM-003", "Coca Cola 250ml",     40, 120, 100,  8,  4],
  ["PROD_SM004", "SM-004", "Parle-G 100g",        10, 300, 180, 20, 10],
  ["PROD_SM005", "SM-005", "Dairy Milk 25g",      45, 100,  85,  5,  2],
  ["PROD_SM006", "SM-006", "Sprite 250ml",        40,  80,  60,  6,  0],
  ["PROD_SM007", "SM-007", "Red Bull 250ml",     125,  60,  45,  3,  3],
  ["PROD_SM008", "SM-008", "Snickers 45g",        50,  90,  70,  7,  2],
];

async function run() {
  const batch = db.batch();

  PRODUCTS.forEach(([id, sku, name, mrp, inward, outward, returned, expired], idx) => {
    const available = inward - outward + returned - expired;
    const n = String(idx + 1).padStart(2, "0");

    // 1. Master catalog entry
    batch.set(db.collection("master_products").doc(id), {
      sku, name, category: "Snacks & Beverages", brand: name.split(" ")[0],
      unitSize: name.split(" ").pop(), mrp, marginPercent: 20, gstRatePercent: 18,
      costWithGst: Math.round(mrp * 0.8), costWithoutGst: Math.round(mrp * 0.8 / 1.18),
      barcode: `890${n}000${n}`, shelfLifeDays: 180, isActive: true,
      orgId: ORG_ID, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Current stock entry (matches movement math)
    batch.set(db.collection("products").doc(id), {
      id, sku, name, orgId: ORG_ID, warehouseStock: available,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const common = { productId: id, productName: name, orgId: ORG_ID, performedBy: ADMIN_EMAIL };

    // 3. Movements (fixed IDs => idempotent)
    batch.set(db.collection("warehouse_movements").doc(`WHM_SEED_${n}_IN`), {
      ...common, type: "INWARD", quantity: inward,
      movementDate: TS("2026-07-01T10:00:00"), createdAt: TS("2026-07-01T10:00:00"),
      expiryDate: TS("2026-12-28T00:00:00"), batchId: `BATCH-JUL-${n}`,
      invoiceNumber: `INV-2026-${n}`, supplier: "VDS Distributors",
      issuedBy: "Supplier Delivery", issuedTo: "Warehouse Manager", destination: "Main Warehouse",
      remarks: "Seed: initial stock receipt",
    });

    // Outward split: 60% kit dispatch, 40% manual
    const kitQty = Math.round(outward * 0.6);
    const manualQty = outward - kitQty;
    batch.set(db.collection("warehouse_movements").doc(`WHM_SEED_${n}_OUTK`), {
      ...common, type: "OUTWARD_KIT", quantity: kitQty,
      movementDate: TS("2026-07-03T11:30:00"), createdAt: TS("2026-07-03T11:30:00"),
      referenceId: "SNACK-001", issuedBy: "Warehouse Manager", issuedTo: "Refiller",
      destination: "Alpha Unit (SNACK-001)", remarks: "Seed: kit dispatch to machine",
    });
    batch.set(db.collection("warehouse_movements").doc(`WHM_SEED_${n}_OUTM`), {
      ...common, type: "OUTWARD_MANUAL", quantity: manualQty,
      movementDate: TS("2026-07-04T15:00:00"), createdAt: TS("2026-07-04T15:00:00"),
      purpose: "Stock Transfer", issuedBy: "Warehouse Manager", issuedTo: "Field Team",
      destination: "Beta Unit (SNACK-002)", remarks: "Seed: manual transfer",
    });

    if (returned > 0) {
      batch.set(db.collection("warehouse_movements").doc(`WHM_SEED_${n}_RET`), {
        ...common, type: "RETURN", quantity: returned,
        movementDate: TS("2026-07-05T17:20:00"), createdAt: TS("2026-07-05T17:20:00"),
        referenceId: "SNACK-001", issuedBy: "Refiller", issuedTo: "Warehouse Manager",
        destination: "Main Warehouse", remarks: "Seed: unsold stock returned from machine",
      });
    }
    if (expired > 0) {
      batch.set(db.collection("warehouse_movements").doc(`WHM_SEED_${n}_EXP`), {
        ...common, type: "EXPIRED_DAMAGED", quantity: expired,
        movementDate: TS("2026-07-06T09:45:00"), createdAt: TS("2026-07-06T09:45:00"),
        issuedBy: "Warehouse Manager", issuedTo: "Disposal", destination: "Scrap",
        remarks: "Seed: expired/damaged write-off",
      });
    }
  });

  await batch.commit();

  console.log("Seeded warehouse data:");
  console.log("Product              | In  | Out | Ret | Exp | Available");
  PRODUCTS.forEach(([, sku, name, , i, o, r, e]) =>
    console.log(`${sku} ${name.padEnd(20)} | ${i} | ${o} | ${r} | ${e} | ${i - o + r - e}`));
}

run().catch((e) => { console.error("Seed failed:", e); process.exit(1); });

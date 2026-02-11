/**
 * PHASE 0.3.2 — MIGRATE ALL DATA TO ORG ADMIN
 */

const path = require("path");
const admin = require("firebase-admin");

// Load service account
const serviceAccount = require(path.join(
  __dirname,
  "serviceAccountKey.json"
));

// ✅ Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

// 🔴 CRITICAL FIX (Windows + Firestore)
db.settings({
  projectId: serviceAccount.project_id,
});

// ---------------- CONFIG ----------------
const TARGET_ORG = "ORG_FRANCHISE_HYD";
const TARGET_ADMIN_EMAIL = "vdsofficial@snackmaster.in";
// ----------------------------------------

async function migrateMachines() {
  console.log("🔹 Migrating machines + slots");

  const machinesSnap = await db.collection("machines").get();

  for (const machine of machinesSnap.docs) {
    await machine.ref.update({
      orgId: TARGET_ORG,
      adminEmail: TARGET_ADMIN_EMAIL,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const slotsSnap = await machine.ref.collection("slots").get();
    if (!slotsSnap.empty) {
      const batch = db.batch();
      slotsSnap.docs.forEach((slot) => {
        batch.update(slot.ref, {
          orgId: TARGET_ORG,
          adminEmail: TARGET_ADMIN_EMAIL,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  console.log("✅ Machines + slots migrated");
}

async function migrateCollection(name) {
  console.log(`🔹 Migrating collection: ${name}`);
  const snap = await db.collection(name).get();

  if (snap.empty) {
    console.log(`⚠️ ${name}: no docs`);
    return;
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      orgId: TARGET_ORG,
      adminEmail: TARGET_ADMIN_EMAIL,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  console.log(`✅ ${name}: ${snap.size} docs migrated`);
}

async function main() {
  try {
    await migrateMachines();

    await migrateCollection("refill_logs");
    await migrateCollection("refiller_actions");
    await migrateCollection("admin_actions");
    await migrateCollection("refill_snapshots");
    await migrateCollection("csv_uploads");
    await migrateCollection("warehouse_picklists");

    console.log("\n🎉 PHASE 0.3.2 COMPLETE — DATA OWNERSHIP FIXED\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

main();

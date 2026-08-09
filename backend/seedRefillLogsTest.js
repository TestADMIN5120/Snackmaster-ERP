// backend/seedRefillLogsTest.js
// Seeds a few TEST refill_logs records (marked isTestData: true) so the
// Admin > Refiller Tracking Ledger page can be verified.
// Run: node seedRefillLogsTest.js
// Cleanup: node seedRefillLogsTest.js --clean   (deletes only the seeded test records)

const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });
const db = admin.firestore();

async function clean() {
  const snap = await db.collection("refill_logs").where("isTestData", "==", true).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`Deleted ${snap.size} test refill logs.`);
}

async function seed() {
  const orgId = "ORG_PRIMARY_VDS";

  const machinesSnap = await db.collection("machines").where("orgId", "==", orgId).get();
  const machines = machinesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const refSnap = await db.collection("users").where("role", "==", "refiller").limit(1).get();
  const refiller = refSnap.docs[0];

  if (machines.length === 0 || refiller === undefined) {
    console.error("Missing machines or refiller user. Run seed.js first.");
    process.exit(1);
  }

  console.log("Machines:", machines.map(m => `${m.id} / ${m.name || "no-name"}`).join(" | "));
  console.log("Refiller:", refiller.data().email);

  const now = Date.now();
  const mk = (machine, daysAgo, extra) => ({
    machineId: machine.id,
    machineName: machine.name || null,
    orgId,
    refillerId: refiller.id,
    userEmail: refiller.data().email,
    kitId: null,
    audited_inventory: [],
    returns: [],
    isTestData: true,
    completedAt: admin.firestore.Timestamp.fromMillis(now - daysAgo * 86400000),
    createdAt: admin.firestore.Timestamp.fromMillis(now - daysAgo * 86400000),
    ...extra
  });

  const m2 = machines[1] || machines[0];
  const logs = [
    mk(machines[0], 0, { durationMinutes: 12, offline: false }),
    mk(m2, 0, { durationMinutes: 25, offline: true }),
    mk(machines[0], 1, { durationMinutes: 8, offline: false }),
    mk(m2, 2, { durationMinutes: 17, offline: false })
  ];

  const batch = db.batch();
  logs.forEach(l => batch.set(db.collection("refill_logs").doc(), l));
  await batch.commit();
  console.log(`Seeded ${logs.length} test refill logs.`);
}

(process.argv.includes("--clean") ? clean() : seed())
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });

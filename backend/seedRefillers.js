// Seeds test refiller accounts (Firebase Auth user + users/{uid} doc).
// Idempotent: skips creation if the email already exists, always re-syncs the Firestore doc.
// Run: node seedRefillers.js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });
const db = admin.firestore();

const EXISTING_REFILLER_EMAIL = "riteshkumarrajak3@gmail.com"; // used to detect the correct orgId
const FALLBACK_ORG_ID = "ORG_PRIMARY_VDS";
const DEFAULT_PASSWORD = "Refill@123";

const REFILLERS = [
  { email: "refiller.one@snackmaster.test", displayName: "refiller_one" },
  { email: "refiller.two@snackmaster.test", displayName: "refiller_two" },
  { email: "refiller.three@snackmaster.test", displayName: "refiller_three" },
];

async function resolveOrgId() {
  try {
    const rec = await admin.auth().getUserByEmail(EXISTING_REFILLER_EMAIL);
    const snap = await db.collection("users").doc(rec.uid).get();
    if (snap.exists && snap.data().orgId) return snap.data().orgId;
  } catch (e) {
    console.warn(`Could not resolve orgId from ${EXISTING_REFILLER_EMAIL}: ${e.message}`);
  }
  return FALLBACK_ORG_ID;
}

async function run() {
  const orgId = await resolveOrgId();
  console.log(`Using orgId: ${orgId}\n`);

  for (const r of REFILLERS) {
    let authUser;
    try {
      authUser = await admin.auth().getUserByEmail(r.email);
      console.log(`Auth user already exists: ${r.email} (${authUser.uid})`);
    } catch {
      authUser = await admin.auth().createUser({
        email: r.email,
        password: DEFAULT_PASSWORD,
        displayName: r.displayName,
      });
      console.log(`Created auth user: ${r.email} (${authUser.uid})`);
    }

    await db.collection("users").doc(authUser.uid).set({
      uid: authUser.uid,
      email: r.email,
      displayName: r.displayName,
      role: "refiller",
      orgId,
      status: "active",
      deleted: false,
      createdBy: "seedRefillers.js",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Synced users/${authUser.uid} -> ${r.displayName}\n`);
  }

  console.log("Done. Refillers seeded:");
  REFILLERS.forEach(r => console.log(`  ${r.displayName}  |  ${r.email}  |  password: ${DEFAULT_PASSWORD}`));
}

run().catch((e) => { console.error("Seed failed:", e); process.exit(1); });

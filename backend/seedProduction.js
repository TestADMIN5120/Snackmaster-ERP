// backend/seedProduction.js
// Minimal production seed: creates Super Admin, one Admin, one Refiller,
// and a default Organisation. Everything else (machines, products, locations,
// vendors, warehouse data) is left for the user to set up via the UI.
//
// Usage:
//   1. Place the NEW project's service account key as ./serviceAccountKey.prod.json
//   2. Run:  node seedProduction.js
//
// Idempotent: safe to run multiple times.

const admin = require("firebase-admin");
const path = require("path");

// ── Load the production service-account key ────────────────────────────
const keyPath = path.resolve(__dirname, "serviceAccountKey.prod.json");
try {
  require.resolve(keyPath);
} catch {
  console.error(
    "ERROR: serviceAccountKey.prod.json not found in backend/.\n" +
    "Download it from Firebase Console -> Project Settings -> Service Accounts.\n" +
    "Save it as backend/serviceAccountKey.prod.json"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const auth = admin.auth();
const db = admin.firestore();

// ── Configuration ──────────────────────────────────────────────────────
const ORG_ID = "ORG_PRIMARY";
const ORG_NAME = "Primary Organisation";

const SUPER_ADMIN = {
  email: "vdsplsuper@gmail.com",
  password: "SuperMaster123",
  displayName: "Super Admin",
  role: "super_admin",
  orgId: null,
};

const ADMIN = {
  email: "vdsplofficial@gmail.com",
  password: "Snackmaster123",
  displayName: "Admin",
  role: "admin",
  orgId: ORG_ID,
};

const REFILLER = {
  email: "riteshkumarrajak3@gmail.com",
  password: "Refill@123",
  displayName: "Refiller",
  role: "refiller",
  orgId: ORG_ID,
};

// ── Helpers ────────────────────────────────────────────────────────────
async function upsertUser({ email, password, displayName, role, orgId }) {
  let userRecord = await auth.getUserByEmail(email).catch(() => null);

  if (!userRecord) {
    userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    console.log(`  Created auth user: ${email} (${userRecord.uid})`);
  } else {
    console.log(`  Auth user exists:  ${email} (${userRecord.uid})`);
  }

  await db.collection("users").doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email,
      displayName,
      role,
      orgId,
      status: "active",
      deleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`  Synced Firestore users/${userRecord.uid}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────
async function seed() {
  console.log("=== Snackmaster Production Seed ===\n");

  // 1. Organisation
  console.log("1. Organisation");
  await db.collection("organisations").doc(ORG_ID).set(
    {
      id: ORG_ID,
      name: ORG_NAME,
      status: "active",
      suspended: false,
      deleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`  Upserted org: ${ORG_ID} (${ORG_NAME})\n`);

  // 2. Super Admin
  console.log("2. Super Admin");
  await upsertUser(SUPER_ADMIN);

  // 3. Admin
  console.log("3. Admin");
  await upsertUser(ADMIN);

  // 4. Refiller
  console.log("4. Refiller");
  await upsertUser(REFILLER);

  // Done
  console.log("=== Seed Complete ===\n");
  console.log("Credentials:");
  console.log(`  Super Admin : ${SUPER_ADMIN.email} / ${SUPER_ADMIN.password}`);
  console.log(`  Admin       : ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`  Refiller    : ${REFILLER.email} / ${REFILLER.password}`);
  console.log("\nEverything else (machines, products, locations, vendors)");
  console.log("should be created by the user through the application UI.");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

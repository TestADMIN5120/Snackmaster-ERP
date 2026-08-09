// backend/seedSuperAdmin.js
// Creates a Super Admin login (role: "super_admin").
// Run: node seedSuperAdmin.js

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const SUPER_EMAIL = "vdsplsuper@gmail.com";
const SUPER_PASSWORD = "SuperMaster123";

async function seedSuperAdmin() {
  try {
    let userRecord = await auth.getUserByEmail(SUPER_EMAIL).catch(() => null);
    if (!userRecord) {
      userRecord = await auth.createUser({ email: SUPER_EMAIL, password: SUPER_PASSWORD, emailVerified: true });
    }

    await db.collection("users").doc(userRecord.uid).set({
      email: SUPER_EMAIL,
      role: "super_admin",
      displayName: "Snackmaster Super Admin",
      orgId: null,
      status: "active",
      deleted: false,
      createdAt: new Date()
    }, { merge: true });

    console.log("✅ Super Admin seeded successfully.");
    console.log(`   Email:    ${SUPER_EMAIL}`);
    console.log(`   Password: ${SUPER_PASSWORD}`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
seedSuperAdmin();

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = "vdsplofficial@gmail.com";

async function seedAdmin() {
  try {
    let userRecord = await auth.getUserByEmail(ADMIN_EMAIL).catch(() => null);
    if (!userRecord) {
      userRecord = await auth.createUser({ email: ADMIN_EMAIL, password: "Snackmaster123", emailVerified: true });
    }

    await db.collection("users").doc(userRecord.uid).set({
      email: ADMIN_EMAIL,
      role: "admin",
      displayName: "Snackmaster Admin",
      status: "active",
      deleted: false,
      createdAt: new Date()
    });

    console.log("✅ Admin seeded successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
seedAdmin();
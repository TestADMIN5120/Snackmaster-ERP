const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

console.log("1. Script is executing..."); // This MUST print

const keyPath = path.resolve(__dirname, "../serviceAccountKey.json");
console.log("2. Looking for key at:", keyPath);

if (!fs.existsSync(keyPath)) {
  console.error("❌ ERROR: Key file missing!");
  process.exit(1);
}

const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function runPatch() {
  console.log("3. Connected to project:", admin.app().options.projectId);
  try {
    const snap = await db.collection("users").get();
    console.log("👤 Users found:", snap.size);

    let updated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const patch = {};

      if (data.deleted === undefined) {
        patch.deleted = false;
        patch.deletedAt = null;
        patch.deletedBy = null;
      }
      if (data.status === undefined) {
        patch.status = "active";
      }

      if (Object.keys(patch).length > 0) {
        console.log("📝 Updating user:", doc.id);
        await doc.ref.update(patch);
        updated++;
      }
    }
    console.log(`🎉 FINISHED. Updated ${updated} users.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ DATABASE ERROR:", err.message);
    process.exit(1);
  }
}

runPatch();
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// 1. Absolute path to key
const keyPath = path.resolve(__dirname, "../serviceAccountKey.json");

// 2. Pre-flight check: Does the file exist?
if (!fs.existsSync(keyPath)) {
  console.error("❌ ERROR: serviceAccountKey.json NOT FOUND at:", keyPath);
  process.exit(1);
}

const serviceAccount = require(keyPath);

// 3. Force Initialize
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

// 4. Execute with immediate logging
(async () => {
  console.log("🚀 Script started..."); // If you don't see this, the file isn't running at all
  try {
    const projectId = admin.app().options.projectId;
    console.log("🔍 Connected project:", projectId);

    const snap = await db.collection("machines").get();
    console.log("📦 Machines found in DB:", snap.size);

    let updated = 0;

    for (const doc of snap.docs) {
      const data = doc.data();

      if (data.deleted === undefined) {
        console.log("📝 Updating machine:", doc.id);
        await doc.ref.update({
          deleted: false,
          deletedAt: null,
          deletedBy: null,
        });
        updated++;
      }
    }

    console.log(`🎉 MACHINES PATCH COMPLETE — updated ${updated}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
    process.exit(1);
  }
})();
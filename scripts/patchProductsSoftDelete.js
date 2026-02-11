const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

console.log("1. Script is executing..."); 

const keyPath = path.resolve(__dirname, "../serviceAccountKey.json");

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
    const snap = await db.collection("products").get();
    console.log("📦 Products found:", snap.size);

    let updated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.deleted === undefined) {
        console.log("📝 Updating product:", doc.id);
        await doc.ref.update({
          deleted: false,
          deletedAt: null,
          deletedBy: null,
        });
        updated++;
      }
    }
    console.log(`🎉 FINISHED. Updated ${updated} products.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ DATABASE ERROR:", err.message);
    process.exit(1);
  }
}

runPatch();
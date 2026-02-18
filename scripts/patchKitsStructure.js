const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function patchKits() {
  try {
    console.log("🔍 Connected project:", admin.app().options.projectId);

    const snap = await db.collection("kits").get();
    console.log("📦 Kits found:", snap.size);

    let updated = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const updates = {};

      if (!("status" in data)) updates.status = "draft";
      if (!("products" in data)) updates.products = [];

      if (!("createdAt" in data)) updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      if (!("preparedAt" in data)) updates.preparedAt = null;
      if (!("completedAt" in data)) updates.completedAt = null;

      if (!("createdOffline" in data)) updates.createdOffline = false;
      if (!("syncedAt" in data)) updates.syncedAt = null;

      if (!("deleted" in data)) updates.deleted = false;
      if (!("deletedAt" in data)) updates.deletedAt = null;

      if (Object.keys(updates).length > 0) {
        console.log("📝 Updating kit:", doc.id);
        await doc.ref.update(updates);
        updated++;
      }
    }

    console.log("🎉 KIT STRUCTURE PATCH COMPLETE — updated", updated, "kits");
    process.exit(0);

  } catch (err) {
    console.error("❌ PATCH FAILED:", err.message);
    process.exit(1);
  }
}

patchKits();

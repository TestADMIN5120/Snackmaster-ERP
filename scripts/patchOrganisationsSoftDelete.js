const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.resolve(__dirname, "../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id, // 🔴 FORCE IT
});

console.log("🔍 Connected project:", admin.app().options.projectId);

// --- Rest of the script ---

const db = admin.firestore();

async function run() {
  const snap = await db.collection("organisations").get();
  console.log("📦 Organisations found:", snap.size);

  if (snap.empty) {
    throw new Error("NO ORGANISATIONS FOUND — wrong project?");
  }

  const batch = db.batch();
  let touched = 0;

  snap.docs.forEach((doc) => {
    const d = doc.data();
    const update = {};

    if (!("deleted" in d)) update.deleted = false;
    if (!("deletedAt" in d)) update.deletedAt = null;
    if (!("deletedBy" in d)) update.deletedBy = null;

    if (Object.keys(update).length > 0) {
      console.log("📝 Updating:", doc.id, update);
      batch.update(doc.ref, update);
      touched++;
    }
  });

  if (touched === 0) {
    console.log("✅ Nothing to patch — already clean");
    return;
  }

  await batch.commit();
  console.log(`🎉 PATCH COMPLETE — updated ${touched} organisations`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ PATCH FAILED:", err.message);
    process.exit(1);
  });
  
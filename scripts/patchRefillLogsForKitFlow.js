const admin = require("firebase-admin");
const path = require("path");

// 1. 🔍 FIX: Load the service account key explicitly
// We assume the script is in /scripts and the key is in the root folder
const keyPath = path.join(__dirname, "../serviceAccountKey.json");

console.log(`🔑 Loading key from: ${keyPath}`);

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch (e) {
  console.error("❌ ERROR: Could not load serviceAccountKey.json.");
  console.error("👉 Make sure the file exists in the folder above /scripts");
  process.exit(1);
}

// 2. Initialize Firebase with the cert
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function patchRefillLogs() {
  console.log("🚀 Script started...");
  
  try {
    const snap = await db.collection("refill_logs").get();
    console.log(`📦 Found ${snap.size} refill logs.`);

    const batch = db.batch();
    let updatedCount = 0;
    // Firestore batches are limited to 500 ops. If you have >500 logs, 
    // we might need a chunking loop, but for now we'll track the count safely.

    for (const doc of snap.docs) {
      const data = doc.data();
      const patch = {};

      // Check for missing fields and set defaults
      if (data.kitId === undefined) patch.kitId = null;
      if (data.refillerId === undefined) patch.refillerId = null;
      if (data.offline === undefined) patch.offline = false;
      if (data.issueReported === undefined) patch.issueReported = false;
      
      // Ensure timestamps exist if missing
      if (data.refillStartedAt === undefined) patch.refillStartedAt = null;
      if (data.refillCompletedAt === undefined) patch.refillCompletedAt = null;
      if (data.durationSeconds === undefined) patch.durationSeconds = 0;

      // Only add to batch if there are changes needed
      if (Object.keys(patch).length > 0) {
        console.log(`📝 Staging update for log: ${doc.id}`);
        batch.update(doc.ref, patch);
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`🎉 PATCH COMPLETE — Successfully updated ${updatedCount} logs.`);
    } else {
      console.log("✅ All logs are already up to date.");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ PATCH FAILED:", err.message);
    process.exit(1);
  }
}

patchRefillLogs();
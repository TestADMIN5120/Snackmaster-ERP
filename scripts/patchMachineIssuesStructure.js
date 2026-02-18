const admin = require("firebase-admin");
const path = require("path");

// 1. 🔍 FIX: Load the service account key explicitly
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

// 2. Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function patchMachineIssues() {
  console.log("🚀 Script started...");

  try {
    const snap = await db.collection("machine_issues").get();

    console.log(`📦 Machine issues found: ${snap.size}`);

    // 🔹 If collection doesn't exist yet, we stop here gracefully.
    if (snap.empty) {
      console.log("ℹ️ Collection is empty (or doesn't exist yet).");
      console.log("✅ This is perfectly fine! No existing data needs patching.");
      process.exit(0);
    }

    let updated = 0;
    const batch = db.batch();

    for (const doc of snap.docs) {
      const data = doc.data();
      const patch = {};

      // Check for missing fields and apply defaults
      if (data.machineId === undefined) patch.machineId = null;
      if (data.refillerId === undefined) patch.refillerId = null;
      if (data.orgId === undefined) patch.orgId = null;
      if (data.issueType === undefined) patch.issueType = "other";
      if (data.description === undefined) patch.description = "";
      if (data.photoUrl === undefined) patch.photoUrl = null;
      if (data.status === undefined) patch.status = "open";
      if (data.reportedAt === undefined) patch.reportedAt = null;
      if (data.resolvedAt === undefined) patch.resolvedAt = null;
      if (data.priority === undefined) patch.priority = "medium";

      if (Object.keys(patch).length > 0) {
        console.log(`📝 Staging update for issue: ${doc.id}`);
        batch.update(doc.ref, patch);
        updated++;
      }
    }

    if (updated > 0) {
      await batch.commit();
      console.log(`🎉 PATCH COMPLETE — Updated ${updated} issues.`);
    } else {
      console.log("✅ All existing issues already have the correct structure.");
    }

    process.exit(0);

  } catch (err) {
    console.error("❌ PATCH FAILED:", err.message);
    process.exit(1);
  }
}

patchMachineIssues();
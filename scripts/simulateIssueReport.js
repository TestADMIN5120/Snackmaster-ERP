const admin = require("firebase-admin");
const path = require("path");

// 1. Load Key
const keyPath = path.join(__dirname, "../serviceAccountKey.json");
const serviceAccount = require(keyPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// 🛑 EDIT THIS ID to match a real machine in your database!
const TARGET_MACHINE_ID = "101"; 

async function reportIssue() {
  console.log(`🚀 Simulating Issue Report for: ${TARGET_MACHINE_ID}`);

  try {
    // Check if machine exists first
    const machineRef = db.collection("machines").doc(TARGET_MACHINE_ID);
    const machineSnap = await machineRef.get();

    if (!machineSnap.exists) {
      console.log("❌ Machine not found! Please edit TARGET_MACHINE_ID in the script.");
      process.exit(1);
    }

    const batch = db.batch();
    const newIssueRef = db.collection("machine_issues").doc();

    // 1. Create the Issue
    batch.set(newIssueRef, {
      machineId: TARGET_MACHINE_ID,
      refillerId: "manual_tester",
      issueType: "motor_jammed",
      description: "Motor 3 is stuck (Manual Test Report)",
      status: "open",
      priority: "medium",
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Update Machine Status (Simulating Frontend Logic)
    batch.update(machineRef, {
      status: "issue_reported",
      lastIssueId: newIssueRef.id,
      lastIssueReportedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    console.log("✅ Issue Reported Successfully!");
    console.log("👉 Go to your Super Admin Dashboard > Issues to see it.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  }
}

reportIssue();
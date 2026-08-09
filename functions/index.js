const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/*
────────────────────────────────────────────────────────────────────────
TRIGGER: When a new issue is created in 'machine_issues'
ACTION:  Update the corresponding machine's status to 'issue_reported'
────────────────────────────────────────────────────────────────────────
*/
exports.onMachineIssueCreated = functions.firestore
  .document("machine_issues/{issueId}")
  .onCreate(async (snapshot, context) => {
    try {
      // 1. Get the data from the newly created issue
      const issue = snapshot.data();
      const machineId = issue.machineId;
      const issueId = context.params.issueId; // The ID of the issue doc

      if (!machineId) {
        console.log(`❌ Skipped: Issue ${issueId} has no machineId.`);
        return null;
      }

      // 2. Reference the machine document
      const machineRef = db.collection("machines").doc(machineId);
      const machineSnap = await machineRef.get();

      if (!machineSnap.exists) {
        console.log(`❌ Failed: Machine ${machineId} does not exist.`);
        return null;
      }

      // 3. Update the machine
      console.log(`🚨 Updating Machine ${machineId} status to 'issue_reported'...`);

      await machineRef.update({
        status: "issue_reported",
        lastIssueId: issueId,
        lastIssueReportedAt: admin.firestore.FieldValue.serverTimestamp(),
        // We also update 'updatedAt' so it floats to the top of lists
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Success: Machine ${machineId} is now flagged.`);
      return null;

    } catch (error) {
      console.error("❌ CRITICAL ERROR in onMachineIssueCreated:", error);
      return null;
    }
  });
// scripts/patchMachinesForRefillerFlow.js

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function patchMachines() {
  try {
    console.log("🔍 Connected project:", admin.app().options.projectId);

    const machinesSnap = await db.collection("machines").get();
    console.log("📦 Machines found:", machinesSnap.size);

    let updatedCount = 0;

    for (const doc of machinesSnap.docs) {
      const data = doc.data();
      const updates = {};

      // Add assignedRefillerId if missing
      if (!("assignedRefillerId" in data)) {
        updates.assignedRefillerId = data.assignedTo || null;
      }

      // Add currentStatus if missing
      if (!("currentStatus" in data)) {
        updates.currentStatus = data.assigned
          ? "ready"        // machine assigned & active
          : "unassigned";  // not assigned
      }

      // Add lastRefillTime if missing
      if (!("lastRefillTime" in data)) {
        updates.lastRefillTime = data.last_refill_at || null;
      }

      if (Object.keys(updates).length > 0) {
        console.log("📝 Updating machine:", doc.id, updates);
        await doc.ref.update(updates);
        updatedCount++;
      }
    }

    console.log("🎉 PATCH COMPLETE — updated", updatedCount, "machines");
    process.exit(0);

  } catch (err) {
    console.error("❌ PATCH FAILED:", err.message);
    process.exit(1);
  }
}

patchMachines();

// scripts/patchMachinesForKitFlow.js

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

      if (!("activeKitId" in data)) {
        updates.activeKitId = null;
      }

      if (!("kitStatus" in data)) {
        updates.kitStatus = null; 
        // null means no kit created yet
      }

      if (Object.keys(updates).length > 0) {
        console.log("📝 Updating machine:", doc.id, updates);
        await doc.ref.update(updates);
        updatedCount++;
      }
    }

    console.log("🎉 KIT PATCH COMPLETE — updated", updatedCount, "machines");
    process.exit(0);

  } catch (err) {
    console.error("❌ PATCH FAILED:", err.message);
    process.exit(1);
  }
}

patchMachines();

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

async function patchMachines() {
  console.log("🚀 Starting Machine Patch: Ensuring 'deleted' flag exists...");

  try {
    const snap = await db.collection("machines").get();
    console.log(`📦 Found ${snap.size} machines.`);

    const batch = db.batch();
    let count = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      
      // If the 'deleted' field is missing, set it to false
      if (data.deleted === undefined) {
        console.log(`🔧 Patching Machine ${doc.id} (Adding deleted: false)`);
        batch.update(doc.ref, { 
          deleted: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Success: Patched ${count} machines.`);
    } else {
      console.log("✨ All machines already have the flag. No changes needed.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

patchMachines();
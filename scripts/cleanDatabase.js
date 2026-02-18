const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 1. Collections to Clean (Keep 1 document)
const singleSampleCollections = [
  "admin_actions",
  "kits",
  "machine_issues",
  "machines",
  "organisations", 
  "refill_logs",
  "refiller_actions",
  "users" // ⚠️ We will handle SuperAdmin protection separately below
];

// 2. Collections to Clean (Keep 5 documents)
const multiSampleCollections = ["products"];

async function cleanCollection(collectionName, keepCount) {
  console.log(`\n🧹 Cleaning: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`   - Empty collection.`);
    return;
  }

  const docs = snapshot.docs;
  console.log(`   - Found ${docs.length} documents.`);

  if (docs.length <= keepCount) {
    console.log(`   - Skipping (Count <= ${keepCount})`);
    return;
  }

  // Keep the *most recent* ones if timestamps exist, otherwise just the first ones found
  // (Assuming you want to keep data to look at, usually newest is better)
  // If no timestamp, we just take the first 'keepCount' from the array.
  
  const docsToDelete = docs.slice(keepCount); 
  
  console.log(`   - Deleting ${docsToDelete.length} documents...`);

  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of docsToDelete) {
    // 🛡️ USER PROTECTION: Don't delete the SUPER ADMIN if we are cleaning users
    if (collectionName === "users") {
      const data = doc.data();
      if (data.role === 'super_admin' || data.email === 'vickysinghofficial13@gmail.com') { // CHANGE THIS TO YOUR EMAIL
        console.log(`   - 🛡️ Skipping Super Admin deletion: ${doc.id}`);
        continue;
      }
    }

    batch.delete(doc.ref);
    count++;

    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
  console.log(`   - ✅ Deleted ${docsToDelete.length} documents.`);
}

async function run() {
  // 1. Clean Single Sample Collections
  for (const col of singleSampleCollections) {
    await cleanCollection(col, 1);
  }

  // 2. Clean Products (Keep 5)
  for (const col of multiSampleCollections) {
    await cleanCollection(col, 5);
  }

  console.log("\n✨ Database Cleanup Complete.");
}

run();
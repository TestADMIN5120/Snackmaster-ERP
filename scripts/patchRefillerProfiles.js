const admin = require("firebase-admin");
const path = require("path");

// 1. DEBUG: Prove the script is actually running
console.log("🚀 Script Initializing...");

// 2. Load Service Account Safely (Uses absolute path)
const keyPath = path.join(__dirname, "../serviceAccountKey.json");
console.log(`🔑 Loading key from: ${keyPath}`);

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch (e) {
  console.error("❌ ERROR: Could not load serviceAccountKey.json.");
  console.error("👉 Make sure the file exists one folder up from /scripts");
  process.exit(1);
}

// 3. Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function patchRefillers() {
  console.log("🔄 Connecting to Firestore...");

  try {
    // 4. Fetch Users
    const usersSnap = await db
      .collection("users")
      .where("role", "==", "refiller")
      .get();

    console.log(`👤 Refillers found in 'users' DB: ${usersSnap.size}`);

    if (usersSnap.empty) {
      console.log("⚠️ No users with role 'refiller' found. Nothing to patch.");
      return;
    }

    const batch = db.batch();
    let count = 0;

    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      const uid = doc.id;
      const refillerRef = db.collection("refillers").doc(uid);

      console.log(`📝 Staging profile for: ${userData.email || uid}`);

      // 5. FORCEFUL PATCH (Using merge: true)
      // This will create it if missing, or update it if it exists.
      batch.set(
        refillerRef,
        {
          name: userData.name || "Unknown Refiller",
          phone: userData.phone || "",
          email: userData.email || "", // Helpful to sync email too
          active: true,
          role: "refiller", // Explicitly ensure role is set
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // Note: We don't overwrite createdAt if it exists, logic handled by merge
        },
        { merge: true }
      );

      count++;
    }

    // 6. Commit Batch
    if (count > 0) {
      await batch.commit();
      console.log(`\n🎉 PATCH COMPLETE — Updated/Created ${count} profiles.`);
    } else {
      console.log("ℹ️ No actions pending.");
    }
  } catch (err) {
    console.error("❌ FATAL ERROR inside script:", err);
    throw err; // Pass to global catcher
  }
}

// 7. Execute with Proper Process Management
patchRefillers()
  .then(() => {
    console.log("🏁 Script finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Script crashed:", err);
    process.exit(1);
  });
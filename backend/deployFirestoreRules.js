// backend/deployFirestoreRules.js
// Publishes ../firestore.rules to the live project via the Firebase Rules API.
// Run: node deployFirestoreRules.js

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const source = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

  const ruleset = await admin.securityRules().releaseFirestoreRulesetFromSource(source);
  console.log(`✅ Released ruleset ${ruleset.name} (created ${ruleset.createTime})`);

  // Read back what is now live so success is verified, not assumed.
  const live = await admin.securityRules().getFirestoreRuleset();
  const liveSource = live.source[0].content;
  console.log(`🔎 Live ruleset: ${live.name}`);
  console.log(`🔎 Live source ${liveSource === source ? "matches" : "DOES NOT match"} firestore.rules (${liveSource.length} chars)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Deploy failed:", err.message || err);
    process.exit(1);
  });

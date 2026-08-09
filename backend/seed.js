const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function seed() {
  console.log("🌱 Starting Production Seed...");

  // 1. Create a Default Organisation
  const orgId = "ORG_PRIMARY_VDS";
  await db.collection('organisations').doc(orgId).set({
    id: orgId,
    name: "VDS Official Operations",
    status: "active",
    suspended: false,
    deleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Seed Machines
  const machines = [
    { id: 'SNACK-001', name: 'Alpha Unit', location: 'Hyderabad North', capacity: 200, orgId: orgId },
    { id: 'SNACK-002', name: 'Beta Unit', location: 'Hyderabad South', capacity: 180, orgId: orgId }
  ];

  for (const m of machines) {
    await db.collection('machines').doc(m.id).set({
      ...m,
      current_stock_percent: 100,
      status: "active",
      deleted: false,
      assigned: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Seeded Machine:', m.id);
  }

  // 3. Seed Users
  const users = [
    { email: 'vdsplofficial@gmail.com', password: 'Snackmaster123', role: 'admin', displayName: "VDS Admin", orgId: orgId },
    { email: 'riteshkumarrajak3@gmail.com', password: 'deliveryhead', role: 'refiller', displayName: "Ritesh Refiller", orgId: orgId }
  ];

  for (const u of users) {
    try {
      let userRecord = await auth.getUserByEmail(u.email).catch(() => null);
      if (!userRecord) {
        userRecord = await auth.createUser({ email: u.email, password: u.password, emailVerified: true });
      }

      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: u.email,
        role: u.role,
        displayName: u.displayName,
        orgId: u.orgId,
        status: "active",
        deleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('👤 Seeded User Profile:', u.email);
    } catch (err) {
      console.error('❌ Error seeding user:', u.email, err.message);
    }
  }
  console.log('🏁 Seeding complete.');
  process.exit(0);
}

seed();
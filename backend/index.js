const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Confirm Refill API ---
app.post("/api/confirm-refill", async (req, res) => {
  const { machineId, orgId, refillerId, userEmail, kitId, products } = req.body;

  if (!machineId || !orgId) return res.status(400).json({ error: "Missing required fields" });

  try {
    const batch = db.batch();
    const machineRef = db.collection("machines").doc(machineId);

    // 1. Reset Machine Status
    batch.update(machineRef, {
      status: "active",
      current_stock_percent: 100,
      activeKitId: null,
      kitStatus: null,
      lastRefillCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Create Log
    const logRef = db.collection("refill_logs").doc();
    batch.set(logRef, {
      machineId,
      orgId,
      refillerId,
      userEmail,
      products: products || [],
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Close Kit if exists
    if (kitId) {
      const kitRef = db.collection("kits").doc(kitId);
      batch.update(kitRef, { status: "completed", completedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    await batch.commit();
    res.json({ ok: true, message: "Refill processed and logged." });
  } catch (error) {
    console.error("Refill Error:", error);
    res.status(500).json({ error: "Backend processing failed" });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Backend ready on port ${PORT}`));
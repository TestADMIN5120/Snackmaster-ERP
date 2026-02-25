const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");

// 🟢 DYNAMIC FIREBASE SECRETS (Cloud + Local Support)
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // If deployed to Render, use the secure Environment Variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // If running locally, use the JSON file
  try {
    serviceAccount = require("./serviceAccountKey.json");
  } catch (err) {
    console.error("❌ CRITICAL: No FIREBASE_SERVICE_ACCOUNT env var, and serviceAccountKey.json is missing.");
    process.exit(1); // Stop the server from crashing wildly
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

/* ──────────────────────────────────────────────
   CONFIRM REFILL API 
────────────────────────────────────────────── */
app.post("/api/confirm-refill", async (req, res) => {
  const { machineId, orgId, refillerId, userEmail, kitId, products, returnedItems } = req.body;

  if (!machineId || !orgId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const batch = db.batch();
    const machineRef = db.collection("machines").doc(machineId);

    batch.update(machineRef, {
      status: "active",
      current_stock_percent: 100,
      kitStatus: null,
      activeKitId: null,
      lastRefillCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const logRef = db.collection("refill_logs").doc();
    batch.set(logRef, {
      machineId, orgId, refillerId, userEmail, kitId: kitId || null,
      audited_inventory: products || [],
      returns: returnedItems || [],
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (kitId) {
      const kitRef = db.collection("kits").doc(kitId);
      batch.update(kitRef, {
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (Array.isArray(returnedItems) && returnedItems.length > 0) {
      returnedItems.forEach((item) => {
        if (!item.productId || !item.quantity) return;
        const qty = Number(item.quantity);
        const isExpired = item.condition === "expired";
        const movementRef = db.collection("warehouse_movements").doc();

        batch.set(movementRef, {
          type: isExpired ? "EXPIRED" : "RETURN",
          productId: item.productId,
          productName: item.name || "Unknown Product",
          quantity: qty,
          referenceId: kitId || `REF_${machineId}`,
          remarks: item.reason || (isExpired ? "Expired at machine" : "Returned unsold"),
          orgId, performedBy: userEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (!isExpired) {
          const productRef = db.collection("products").doc(item.productId);
          batch.update(productRef, {
            warehouseStock: admin.firestore.FieldValue.increment(qty),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    }

    await batch.commit();
    res.json({ ok: true });
  } catch (error) {
    console.error("Refill Error:", error);
    res.status(500).send("Error");
  }
});

/* ──────────────────────────────────────────────
   🟢 ADMIN RESET PASSWORD (EMAIL-BASED)
────────────────────────────────────────────── */
app.post("/api/admin-reset-password", async (req, res) => {
  const { targetEmail, newPassword, adminEmail } = req.body;

  if (!targetEmail || !newPassword) {
    return res.status(400).json({ error: "Missing targetEmail or newPassword" });
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(targetEmail);
    await admin.auth().updateUser(userRecord.uid, { password: newPassword });

    await db.collection("audit_logs").add({
      action: "MANUAL_PASSWORD_RESET",
      targetEmail: targetEmail,
      performedBy: adminEmail || "Unknown Admin",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, message: "Password successfully reset." });
  } catch (error) {
    console.error("Password Reset Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Backend live on port ${PORT}`));
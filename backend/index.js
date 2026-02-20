const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// --- Confirm Refill API ---
app.post("/api/confirm-refill", async (req, res) => {
  const {
    machineId,
    orgId,
    refillerId,
    userEmail,
    kitId,
    products,
    returnedItems
  } = req.body;

  if (!machineId || !orgId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const batch = db.batch();
    const machineRef = db.collection("machines").doc(machineId);

    // 🟢 FIXED: Explicitly clearing kit references to unlock the Refiller UI
    batch.update(machineRef, {
      status: "active",
      current_stock_percent: 100,
      kitStatus: null,
      activeKitId: null, // unlocks "Create Kit" for next cycle
      lastRefillCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 🟢 Create Refill Log
    const logRef = db.collection("refill_logs").doc();
    batch.set(logRef, {
      machineId,
      orgId,
      refillerId,
      userEmail,
      kitId: kitId || null,
      audited_inventory: products || [], // exact grid snapshot
      returns: returnedItems || [],
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 🟢 Close Kit if exists
    if (kitId) {
      const kitRef = db.collection("kits").doc(kitId);
      batch.update(kitRef, {
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 🟢 Process Returns / Expired Items
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
          remarks:
            item.reason ||
            (isExpired ? "Expired at machine" : "Returned unsold"),
          orgId,
          performedBy: userEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 🟢 Only restock if NOT expired
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(`🚀 Backend live on port ${PORT}`)
);
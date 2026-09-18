const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
   📄 REFILLER DOCUMENTS — stored in <repo>/refiller_documents,
   each file exposed at /refiller_documents/<filename>
────────────────────────────────────────────── */
const REFILLER_DOCS_DIR = path.join(__dirname, "..", "refiller_documents");
fs.mkdirSync(REFILLER_DOCS_DIR, { recursive: true });

app.use("/refiller_documents", express.static(REFILLER_DOCS_DIR, { maxAge: "365d", immutable: true }));

const DOC_TYPES = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
  "application/pdf": ".pdf"
};

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (DOC_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP or PDF files are allowed."));
  }
});

// Verifies the Firebase ID token and requires an active admin/super_admin.
async function requireAdmin(req, res, next) {
  try {
    const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!idToken) return res.status(401).json({ error: "Missing auth token" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const userData = userSnap.exists ? userSnap.data() : null;

    const active = userData && userData.deleted !== true && userData.status !== "disabled";
    if (!active || !["admin", "super_admin"].includes(userData.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.caller = { uid: decoded.uid, role: userData.role, orgId: userData.orgId || null };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ error: "Invalid or expired auth token" });
  }
}

/* ──────────────────────────────────────────────
   📄 REFILLER DOCUMENT UPLOAD / DELETE
────────────────────────────────────────────── */
const removeRefillerDocFiles = (userId) =>
  fs.readdirSync(REFILLER_DOCS_DIR)
    .filter((f) => f.startsWith(`${userId}_`))
    .forEach((f) => fs.unlinkSync(path.join(REFILLER_DOCS_DIR, f)));

// ADD / REPLACE identity proof document (multipart field: "document")
app.post("/api/refiller-documents/:userId", requireAdmin, (req, res) => {
  docUpload.single("document")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No document file received" });

    try {
      const userId = req.params.userId;
      if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      removeRefillerDocFiles(userId); // replace = drop old file
      const filename = `${userId}_${Date.now()}${DOC_TYPES[req.file.mimetype]}`;
      fs.writeFileSync(path.join(REFILLER_DOCS_DIR, filename), req.file.buffer);

      const identityProofUrl = `/refiller_documents/${filename}`;
      await db.collection("users").doc(userId).update({ identityProofUrl });

      res.json({ ok: true, identityProofUrl });
    } catch (error) {
      console.error("Refiller document upload error:", error);
      res.status(500).json({ error: "Failed to save document" });
    }
  });
});

// DELETE identity proof document
app.delete("/api/refiller-documents/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    removeRefillerDocFiles(userId);
    await db.collection("users").doc(userId).update({
      identityProofUrl: admin.firestore.FieldValue.delete()
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Refiller document delete error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

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

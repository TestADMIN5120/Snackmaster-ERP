const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// 🟢 DYNAMIC FIREBASE SECRETS (Cloud + Local Support)
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  try {
    serviceAccount = require("./serviceAccountKey.json");
  } catch (err) {
    console.error("❌ CRITICAL: No FIREBASE_SERVICE_ACCOUNT env var, and serviceAccountKey.json is missing.");
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🟢 CLOUDINARY CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Health check for Render
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

/* ──────────────────────────────────────────────
   CLOUDINARY UPLOAD HELPER
────────────────────────────────────────────── */
function uploadToCloudinary(buffer, folder, publicId, resourceType = "image") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function deleteFromCloudinary(folder, publicId, resourceType = "image") {
  const fullId = `${folder}/${publicId}`;
  return cloudinary.uploader.destroy(fullId, { resource_type: resourceType }).catch(() => {});
}

/* ──────────────────────────────────────────────
   🖼️ PRODUCT IMAGES — stored in Cloudinary
────────────────────────────────────────────── */
const IMAGE_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error("Only JPG, PNG or WEBP images are allowed."));
  }
});

/* ──────────────────────────────────────────────
   📄 REFILLER DOCUMENTS — stored in Cloudinary
────────────────────────────────────────────── */
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

// Loads the master product, enforcing org ownership (super_admin bypasses).
async function loadOwnedProduct(req, res) {
  const productId = req.params.productId || "";
  if (!/^[A-Za-z0-9_-]+$/.test(productId)) {
    res.status(400).json({ error: "Invalid product id" });
    return null;
  }
  const snap = await db.collection("master_products").doc(productId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }
  const product = snap.data();
  if (req.caller.role !== "super_admin" && product.orgId !== req.caller.orgId) {
    res.status(403).json({ error: "Product belongs to another organisation" });
    return null;
  }
  return { id: productId, ref: snap.ref, ...product };
}

// ADD / REPLACE product image
app.post("/api/product-images/:productId", requireAdmin, (req, res) => {
  imageUpload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No image file received" });

    try {
      const product = await loadOwnedProduct(req, res);
      if (!product) return;

      const publicId = `${product.id}_${Date.now()}`;
      const result = await uploadToCloudinary(req.file.buffer, "product_images", publicId);
      const imageUrl = result.secure_url;

      // Delete old Cloudinary image if exists
      if (product.cloudinaryPublicId) {
        await deleteFromCloudinary("product_images", product.cloudinaryPublicId);
      }

      await product.ref.update({
        imageUrl,
        cloudinaryPublicId: publicId,
        imageUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ ok: true, imageUrl });
    } catch (error) {
      console.error("Product image upload error:", error);
      res.status(500).json({ error: "Failed to save image" });
    }
  });
});

// DELETE product image
app.delete("/api/product-images/:productId", requireAdmin, async (req, res) => {
  try {
    const product = await loadOwnedProduct(req, res);
    if (!product) return;

    if (product.cloudinaryPublicId) {
      await deleteFromCloudinary("product_images", product.cloudinaryPublicId);
    }

    await product.ref.update({
      imageUrl: admin.firestore.FieldValue.delete(),
      cloudinaryPublicId: admin.firestore.FieldValue.delete(),
      imageUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Product image delete error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

/* ──────────────────────────────────────────────
   📄 REFILLER DOCUMENT UPLOAD / DELETE
────────────────────────────────────────────── */

// ADD / REPLACE identity proof document
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

      const publicId = `${userId}_${Date.now()}`;
      const resourceType = req.file.mimetype === "application/pdf" ? "raw" : "image";
      const result = await uploadToCloudinary(req.file.buffer, "refiller_documents", publicId, resourceType);
      const identityProofUrl = result.secure_url;

      // Delete old if exists
      const oldData = userSnap.data();
      if (oldData.cloudinaryDocPublicId) {
        await deleteFromCloudinary("refiller_documents", oldData.cloudinaryDocPublicId, oldData.cloudinaryDocResourceType || "image");
      }

      await db.collection("users").doc(userId).update({
        identityProofUrl,
        cloudinaryDocPublicId: publicId,
        cloudinaryDocResourceType: resourceType,
      });

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

    const userData = userSnap.data();
    if (userData.cloudinaryDocPublicId) {
      await deleteFromCloudinary("refiller_documents", userData.cloudinaryDocPublicId, userData.cloudinaryDocResourceType || "image");
    }

    await db.collection("users").doc(userId).update({
      identityProofUrl: admin.firestore.FieldValue.delete(),
      cloudinaryDocPublicId: admin.firestore.FieldValue.delete(),
      cloudinaryDocResourceType: admin.firestore.FieldValue.delete(),
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
app.listen(PORT, () => console.log(`Backend live on port ${PORT}`));

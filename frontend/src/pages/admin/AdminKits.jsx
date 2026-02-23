import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAdmin } from "../../contexts/AdminContext";
import { generateKitPDF } from "../../utils/pdfGenerator";

export default function AdminKits() {
  const { orgId, user } = useAdmin();
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);

  useEffect(() => {
    if (!orgId) return;

    const q = query(
      collection(db, "kits"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setKits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Kits Read Error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orgId]);

  async function issueKit(kit) {
    if (!window.confirm(`Issue Kit ${kit.id.slice(-6)}? This will deduct stock from the warehouse.`)) return;

    setIssuing(true);
    try {
      const batch = writeBatch(db);

      const kitRef = doc(db, "kits", kit.id);
      batch.update(kitRef, {
        status: "issued",
        issuedAt: serverTimestamp(),
        issuedBy: user.email
      });

      const machineRef = doc(db, "machines", kit.machineId);
      batch.update(machineRef, {
        kitStatus: "issued",
        updatedAt: serverTimestamp()
      });

      kit.products.forEach((p) => {
        if (!p.productId) return;

        const productRef = doc(db, "products", p.productId);
        batch.update(productRef, {
          warehouseStock: increment(-p.requiredQty)
        });

        const movementRef = doc(collection(db, "warehouse_movements"));
        batch.set(movementRef, {
          type: "OUTWARD_KIT",
          productId: p.productId,
          productName: p.name,
          quantity: p.requiredQty,
          referenceId: kit.id,
          orgId: orgId,
          performedBy: user.email,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      alert("✅ Kit Issued! Stock deducted and Refiller notified.");
      setSelectedKit(null);
    } catch (err) {
      console.error("Error issuing kit:", err);
      alert("Failed to issue kit. Check console.");
    } finally {
      setIssuing(false);
    }
  }

  function formatDate(ts) {
    if (!ts?.seconds) return "-";
    return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginBottom: 5, color: "#1e293b" }}>📦 Issue Kits & Traceability</h1>
      <p style={{ color: "#64748b", marginBottom: 20 }}>
        Review kits prepared by your field team, issue stock from the warehouse, and download official manifests.
      </p>

      {loading ? (
        <p>Loading kits...</p>
      ) : (
        <div style={tableContainer}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f8fafc", textTransform: "uppercase", fontSize: 12, color: "#64748b" }}>
              <tr>
                <th style={th}>Date Prepared</th>
                <th style={th}>Kit ID</th>
                <th style={th}>Machine</th>
                <th style={th}>Refiller</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {kits.map((k) => (
                <tr key={k.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={td}>{formatDate(k.createdAt)}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#64748b" }}>
                    {k.id.slice(-8)}
                  </td>
                  <td style={{ ...td, fontWeight: "bold", color: "#1e293b" }}>
                    {k.machineId}
                  </td>
                  <td style={td}>{k.refillerEmail}</td>
                  <td style={td}>
                    {k.status === "prepared" && <span style={badgeWarning}>⏳ Pending Issue</span>}
                    {k.status === "issued" && <span style={badgeBlue}>🚚 Issued to Route</span>}
                    {k.status === "completed" && <span style={badgeSuccess}>✅ Refill Complete</span>}
                  </td>
                  <td style={td}>
                    <button style={btnView} onClick={() => setSelectedKit(k)}>
                      View Kit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedKit && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h2 style={{ marginTop: 0, color: "#1e293b" }}>Kit Details</h2>
              <button onClick={() => generateKitPDF(selectedKit)} style={btnDownload}>
                📥 Download PDF
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b", marginBottom: 15 }}>
              <div><b>Machine:</b> {selectedKit.machineId}</div>
              <div><b>Refiller:</b> {selectedKit.refillerEmail}</div>
            </div>

            {/* ✅ FIXED PRODUCT TABLE */}
            <div style={{ maxHeight: 350, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={thModal}>Slot</th>
                    <th style={thModal}>Product Name</th>
                    <th style={thModal}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedKit.products || []).map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdModal}><b>{p.slotId}</b></td>
                      <td style={tdModal}>
                        {p.name || "Unknown Product"}
                        {p.swapped && (
                          <span style={{ color: "#3b82f6", fontSize: 11, marginLeft: 5 }}>
                            *(Swapped)
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdModal, fontWeight: "bold", color: "#16a34a" }}>
                        {p.requiredQty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setSelectedKit(null)} style={btnCancel} disabled={issuing}>
                Close
              </button>

              {selectedKit.status === "prepared" && (
                <button onClick={() => issueKit(selectedKit)} disabled={issuing} style={btnPrimary}>
                  {issuing ? "Processing..." : "📤 Issue Stock"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── STYLES ─── */
const tableContainer = { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" };
const th = { padding: "14px 16px", textAlign: "left", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "14px 16px" };
const badgeWarning = { background: "#fef08a", color: "#854d0e", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold" };
const badgeBlue = { background: "#e0f2fe", color: "#0369a1", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold" };
const badgeSuccess = { background: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: "bold" };
const btnView = { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: "bold" };

const modalBackdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 };
const modalBox = { background: "#fff", padding: 25, borderRadius: 12, width: 500, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const thModal = { padding: "10px", textAlign: "left", borderBottom: "1px solid #e2e8f0", color: "#64748b" };
const tdModal = { padding: "10px" };
const btnCancel = { padding: "10px 16px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnPrimary = { padding: "10px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" };
const btnDownload = { padding: "6px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12 };
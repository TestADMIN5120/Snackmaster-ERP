 // frontend/src/components/MachineCard.jsx
import React from "react";

// Converts Firestore timestamp to readable date
function formatDate(ts) {
  if (!ts || !ts.seconds) return "-";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MachineCard({ machine = {}, onView }) {
  const percent = machine.current_stock_percent ?? 0;

  // Premium color thresholds (Green / Orange / Red)
  const color =
    percent >= 70 ? "#10b981" : percent >= 30 ? "#f59e0b" : "#ef4444";

  // Override status color if the machine is broken or offline
  const isDown = machine.status === "issue_reported" || machine.status === "service-down";
  const badgeBg = isDown ? "#fee2e2" : `${color}15`; // 15 is hex opacity
  const badgeText = isDown ? "#ef4444" : color;

  return (
    <div
      onClick={() => onView && onView(machine.id)}
      style={outerCard}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = cardHoverShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = cardShadow;
      }}
    >
      {/* HEADER */}
      <div style={headerRow}>
        <div style={titleText}>
          {machine.name || machine.id || "Unnamed Machine"}
        </div>

        <div
          style={{
            ...statusBadge,
            backgroundColor: badgeBg,
            color: badgeText,
            border: `1px solid ${badgeText}40`,
          }}
        >
          {(machine.status || "UNKNOWN").toUpperCase().replace("_", " ")}
        </div>
      </div>

      {/* LOCATION */}
      <div style={subText}>📍 {machine.location || "Location not set"}</div>

      {/* STOCK BAR */}
      <div style={stockRow}>
        <div style={stockBar}>
          <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, ...stockFill(color) }} />
        </div>
        <div style={{...percentText, color: color}}>{percent}%</div>
      </div>

      {/* EXTRA MACHINE INFO */}
      <div style={infoLine}>
        Last Refill: <b>{formatDate(machine.last_refill_at)}</b>
      </div>

      <div style={infoLine}>
        Products Inside: <b>{machine.productCount ?? "—"}</b>
      </div>
    </div>
  );
}

/* STYLES */
const outerCard = {
  background: "#fff",
  borderRadius: 14,
  padding: 20,
  cursor: "pointer",
  boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
  border: "1px solid #e2e8f0",
  transition: "all .2s ease",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 10,
};

const titleText = { fontWeight: 800, fontSize: 16, color: "#1e293b", lineHeight: 1.2 };

const statusBadge = {
  padding: "4px 8px",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 800,
  textAlign: "center"
};

const subText = { fontSize: 13, color: "#64748b", marginBottom: 15 };

const stockRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 15,
};

const stockBar = {
  flex: 1,
  height: 8,
  background: "#f1f5f9",
  borderRadius: 99,
  overflow: "hidden",
};

const stockFill = (color) => ({
  height: "100%",
  background: color,
  borderRadius: 99,
});

const percentText = { fontSize: 14, fontWeight: 800, minWidth: 40, textAlign: "right" };

const infoLine = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 6,
};

const cardShadow = "0 4px 15px rgba(0,0,0,0.04)";
const cardHoverShadow = "0 12px 25px rgba(0,0,0,0.1)";
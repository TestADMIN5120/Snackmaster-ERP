 // frontend/src/components/AdminProducts/ProductPagination.jsx
import React from "react";

export default function ProductPagination({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  total
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>

      {/* Page size dropdown */}
      <div style={{ color: "#64748b", fontSize: 14 }}>
        <span style={{ marginRight: 10 }}>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: "#fff"
          }}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Prev/Next */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
          style={{
            padding: "8px 16px",
            background: currentPage === 1 ? "#e2e8f0" : "#1e88e5",
            color: currentPage === 1 ? "#94a3b8" : "#fff",
            borderRadius: 6,
            border: "none",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          ← Prev
        </button>

        <button
          disabled={currentPage * pageSize >= total}
          onClick={() => setCurrentPage((p) => p + 1)}
          style={{
            padding: "8px 16px",
            background: currentPage * pageSize >= total ? "#e2e8f0" : "#1e88e5",
            color: currentPage * pageSize >= total ? "#94a3b8" : "#fff",
            borderRadius: 6,
            border: "none",
            cursor: currentPage * pageSize >= total ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
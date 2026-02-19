 import React from "react";

export default function ProductTable({ products, onEdit, onDelete }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead style={{ background: "#f8fafc" }}>
        <tr>
          <th style={th}>Product Name</th>
          <th style={th}>SKU</th>
          <th style={th}>Price</th>
          <th style={th}>Actions</th>
        </tr>
      </thead>

      <tbody>
        {products.map((p) => (
          <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{...td, fontWeight: "bold"}}>{p.name}</td>
            <td style={{...td, fontFamily: "monospace", color: "#64748b"}}>{p.sku}</td>
            <td style={{...td, color: "#16a34a", fontWeight: "bold"}}>₹{p.price}</td>

            <td style={td}>
              <button style={btnSecondary} onClick={() => onEdit(p)}>
                Edit
              </button>

              <button style={btnDanger} onClick={() => onDelete(p.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th = { textAlign: "left", padding: "16px", fontWeight: "bold", color: "#64748b", fontSize: 13, textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "16px", fontSize: 14 };

const btnSecondary = { padding: "8px 14px", marginRight: 10, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, color: "#475569", cursor: "pointer", fontWeight: "bold" };
const btnDanger = { padding: "8px 14px", background: "#fee2e2", border: "none", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontWeight: "bold" };
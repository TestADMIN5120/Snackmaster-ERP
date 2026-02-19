 import React from "react";

export default function ProductFilterBar({ search, setSearch }) {
  return (
    <div style={{ display: "flex", marginBottom: 20 }}>
      <input
        type="text"
        placeholder="Search catalog by name or SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          flex: 1,
          maxWidth: 400,
          padding: "10px 15px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          fontSize: 15,
        }}
      />
    </div>
  );
}
import React from "react";

export default function FilterBar({ search, setSearch, statusFilter, setStatusFilter }) {
  return (
    <div style={{ display: "flex", gap: 15, marginTop: 20, marginBottom: 10, background: "#fff", padding: 15, borderRadius: 10, border: "1px solid #e2e8f0" }}>
      <input
        type="text"
        placeholder="Search machines by name, ID, or location..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          flex: 1,
          padding: "10px 15px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          fontSize: 14,
        }}
      />

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        style={{
          padding: "10px 15px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          fontSize: 14,
          background: "#fff",
          minWidth: "150px"
        }}
      >
        <option value="all">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="service-down">Service Down</option>
        <option value="issue_reported">Issue Reported</option>
      </select>
    </div>
  );
}
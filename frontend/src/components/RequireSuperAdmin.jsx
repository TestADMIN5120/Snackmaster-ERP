import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";

export default function RequireSuperAdmin({ children }) {
  const { user, role, loading } = useAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        Checking permissions...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== "super_admin") {
    console.warn(`⛔ Access Denied: User is '${role}', but 'super_admin' required.`);
    
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "refiller") return <Navigate to="/refiller" replace />;
    
    return <Navigate to="/" replace />;
  }

  return children;
}
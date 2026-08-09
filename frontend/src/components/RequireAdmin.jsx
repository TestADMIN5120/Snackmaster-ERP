import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";

export default function RequireAdmin({ children }) {
  const { user, role, loading } = useAdmin();
  const location = useLocation();

  // 1. Wait for loading to finish (Safety net)
  if (loading) {
    return <div>Checking permissions...</div>;
  }

  // 2. Not Logged In? -> Go to Login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Logged In, but NOT an Admin? -> Redirect to their correct home
  if (role !== "admin") {
    console.warn(`⛔ Access Denied: User is '${role}', but 'admin' required.`);
    
    if (role === "super_admin") return <Navigate to="/super" replace />;
    if (role === "refiller") return <Navigate to="/refiller" replace />;
    
    // Fallback
    return <Navigate to="/" replace />;
  }

  // 4. Access Granted
  return children;
}
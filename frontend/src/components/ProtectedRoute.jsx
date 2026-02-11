import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";

export default function ProtectedRoute() {
  const { loading, user, isOrgAdmin, isSuperAdmin } = useAdmin();

  if (loading) return <div>Checking permissions...</div>;

  if (!user) return <Navigate to="/login" replace />;

  // allow BOTH admin & super admin
  if (!isOrgAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

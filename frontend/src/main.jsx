console.log("🔥 MAIN JSX RELOADED");

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

/* ───────── ERROR BOUNDARY ───────── */
import ErrorBoundary from "./components/ErrorBoundary";

/* ───────── AUTH / CONTEXT ───────── */
import { AdminProvider, useAdmin } from "./contexts/AdminContext";

/* ───────── AUTH PAGES ───────── */
import Login from "./pages/Login";

/* ───────── COMMON PAGES ───────── */
import Dashboard from "./pages/Dashboard";

/* ───────── ADMIN ───────── */
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMachines from "./pages/admin/AdminMachines";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminRefillLogs from "./pages/admin/AdminRefillLogs";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAssignMachines from "./pages/admin/AdminAssignMachines";
import AdminMachineSlots from "./pages/admin/AdminMachineSlots";
import AdminMachineIssues from "./pages/admin/AdminMachineIssues"; 

/* ───────── REFILLER ───────── */
import RefillerLayout from "./layouts/RefillerLayout";
import RefillerDashboard from "./pages/refiller/RefillerDashboard"; 
import RefillerMachinePage from "./pages/refiller/RefillerMachinePage"; 
import RefillerMachineSlots from "./pages/refiller/RefillerMachineSlots";
import RefillerReportIssue from "./pages/refiller/RefillerReportIssue"; 
import RefillerHistory from "./pages/refiller/RefillerHistory";
import RefillerMakeKit from "./pages/refiller/RefillerMakeKit"; 

/* ───────── SUPER ADMIN ───────── */
import SuperAdminLayout from "./layouts/SuperAdminLayout";
import SuperAdminDashboard from "./pages/super/SuperAdminDashboard";
import SuperAdminInsights from "./pages/super/SuperAdminInsights";
import SuperAdminOrganisations from "./pages/super/SuperAdminOrganisations";
import SuperAdminOrgCreate from "./pages/super/SuperAdminOrgCreate";
import SuperAdminAdmins from "./pages/super/SuperAdminAdmins";
import SuperAdminAdminCreate from "./pages/super/SuperAdminAdminCreate";
import SuperAdminMachines from "./pages/super/SuperAdminMachines";
import SuperAdminMachineCreate from "./pages/super/SuperAdminMachineCreate";
import SuperAdminAuditLogs from "./pages/super/SuperAdminAuditLogs";
import SuperAdminIssues from "./pages/super/SuperAdminIssues";

/* ───────── ROUTE GUARDS ───────── */
import RequireAdmin from "./components/RequireAdmin";
import RequireSuperAdmin from "./components/RequireSuperAdmin";

/* ───────── STYLES ───────── */
import "./styles.css";

/* ─────────────────────────────
   ROUTES CONFIGURATION
───────────────────────────── */
function AppRoutes() {
  const { user, role, loading } = useAdmin();
  const location = useLocation();

  // 🛑 1. STOP INFINITE LOOPS: Wait for Firebase
  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f4f7f6" }}>
        <h3 style={{color: "#555"}}>Loading SnackMaster...</h3>
      </div>
    );
  }

  // 🛑 2. LOGIN GUARD: If logged in, redirect away from Login
  if (user && location.pathname === "/login") {
    if (role === "super_admin") return <Navigate to="/super" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "refiller") return <Navigate to="/refiller" replace />;
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      {/* ───────── LOGIN ───────── */}
      <Route path="/login" element={<Login />} />

      {/* ───────── ROOT REDIRECT ───────── */}
      <Route
        path="/"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : role === "super_admin" ? (
            <Navigate to="/super" replace />
          ) : role === "admin" ? (
            <Navigate to="/admin" replace />
          ) : role === "refiller" ? (
            <Navigate to="/refiller" replace />
          ) : (
            <Dashboard />
          )
        }
      />

      {/* ───────── REFILLER ───────── */}
      <Route 
        path="/refiller" 
        element={
          user ? <RefillerLayout /> : <Navigate to="/login" />
        }
      >
        <Route index element={<RefillerDashboard />} />
        <Route path="machines" element={<RefillerDashboard />} />
        <Route path="machines/:machineId" element={<RefillerMachinePage />} />
        <Route path="machines/:machineId/slots" element={<RefillerMachineSlots />} />
        <Route path="machines/:machineId/report-issue" element={<RefillerReportIssue />} />
        <Route path="machines/:machineId/make-kit" element={<RefillerMakeKit />} /> 
        <Route path="history" element={<RefillerHistory />} />
      </Route>

      {/* ───────── SUPER ADMIN ───────── */}
      <Route
        path="/super"
        element={
          <RequireSuperAdmin>
            <SuperAdminLayout />
          </RequireSuperAdmin>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="insights" element={<SuperAdminInsights />} />
        <Route path="orgs" element={<SuperAdminOrganisations />} />
        <Route path="orgs/create" element={<SuperAdminOrgCreate />} />
        <Route path="admins" element={<SuperAdminAdmins />} />
        <Route path="admins/create" element={<SuperAdminAdminCreate />} />
        <Route path="machines" element={<SuperAdminMachines />} />
        <Route path="machines/create" element={<SuperAdminMachineCreate />} />
        <Route path="audit" element={<SuperAdminAuditLogs />} />
        <Route path="issues" element={<SuperAdminIssues />} />
      </Route>

      {/* ───────── ADMIN ───────── */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="issues" element={<AdminMachineIssues />} /> 
        <Route path="machines" element={<AdminMachines />} />
        <Route path="machines/assign" element={<AdminAssignMachines />} />
        <Route path="machines/:machineId/slots" element={<AdminMachineSlots />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="refill-logs" element={<AdminRefillLogs />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="users" element={<AdminUsers />} />
      </Route>
      
      {/* ───────── FALLBACK ───────── */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

/* ─────────────────────────────
   APP BOOTSTRAP
───────────────────────────── */
function App() {
  return (
    <AdminProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AdminProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
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
import ChangePassword from "./pages/admin/auth/ChangePassword";

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
import AdminMakeKit from "./pages/admin/AdminMakeKit"; 
import AccessRequests from "./pages/admin/AccessRequests";
import AdminProductImages from "./pages/admin/AdminProductImages";

/* ───────── WAREHOUSE ───────── */
import WarehouseDashboard from "./pages/admin/WarehouseDashboard";
import WarehouseInward from "./pages/admin/WarehouseInward";
import WarehouseOutward from "./pages/admin/WarehouseOutward";
import WarehouseLedger from "./pages/admin/WarehouseLedger";
import AdminKits from "./pages/admin/AdminKits";
import AdminMasterProducts from "./pages/admin/AdminMasterProducts";
import WarehouseReturns from "./pages/admin/WarehouseReturns";
import WarehouseExpired from "./pages/admin/WarehouseExpired";

/* ───────── 🟢 SALES & FINANCIALS (NEW) ───────── */
import AdminSalesLedger from "./pages/admin/sales/AdminSalesLedger";
import AdminNewSalesLedger from "./pages/admin/sales/AdminNewSalesLedger";
import AdminSalesAnalytics from "./pages/admin/sales/AdminSalesAnalytics";

/* ───────── REFILLER ───────── */
import RefillerLayout from "./layouts/RefillerLayout";
import RefillerDashboard from "./pages/refiller/RefillerDashboard";
import RefillerMachinePage from "./pages/refiller/RefillerMachinePage";
import RefillerMachineSlots from "./pages/refiller/RefillerMachineSlots";
import RefillerReportIssue from "./pages/refiller/RefillerReportIssue";
import RefillerHistory from "./pages/refiller/RefillerHistory";

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

import "./styles.css";
import "./theme-finex.css";

/* ─────────────────────────────
   ROUTES CONFIGURATION
───────────────────────────── */
function AppRoutes() {
  const { user, role, loading } = useAdmin();
  const location = useLocation();

  if (loading) return null;

  // LOGIN GUARD
  if (user && location.pathname === "/login") {
    if (role === "super_admin") return <Navigate to="/super" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "refiller") return <Navigate to="/refiller" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* ROOT REDIRECT */}
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
            <Navigate to="/login" replace />
          )
        }
      />

      {/* ───────── REFILLER ───────── */}
      <Route
        path="/refiller"
        element={user && role === "refiller" ? <RefillerLayout /> : <Navigate to="/login" />}
      >
        <Route index element={<RefillerDashboard />} />
        <Route path="machines" element={<RefillerDashboard />} />
        <Route path="machines/:machineId" element={<RefillerMachinePage />} />
        <Route path="machines/:machineId/slots" element={<RefillerMachineSlots />} />
        <Route path="machines/:machineId/report-issue" element={<RefillerReportIssue />} />
        <Route path="history" element={<RefillerHistory />} />
        <Route path="change-password" element={<ChangePassword />} />
      </Route>

      {/* ───────── SUPER ADMIN ───────── */}
      <Route
        path="/super"
        element={<RequireSuperAdmin><SuperAdminLayout /></RequireSuperAdmin>}
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
        <Route path="access-requests" element={<AccessRequests />} />
        <Route path="change-password" element={<ChangePassword />} />
      </Route>

      {/* ───────── ADMIN ───────── */}
      <Route
        path="/admin"
        element={<RequireAdmin><AdminLayout /></RequireAdmin>}
      >
        <Route index element={<AdminDashboard />} />
        <Route path="issues" element={<AdminMachineIssues />} />
        <Route path="machines" element={<AdminMachines />} />
        <Route path="machines/assign" element={<AdminAssignMachines />} />
        <Route path="machines/:machineId/slots" element={<AdminMachineSlots />} />
        <Route path="machines/:machineId/make-kit" element={<AdminMakeKit />} />

        {/* WAREHOUSE */}
        <Route path="warehouse/dashboard" element={<WarehouseDashboard />} />
        <Route path="warehouse/master-products" element={<AdminMasterProducts />} />
        <Route path="warehouse/inward" element={<WarehouseInward />} />
        <Route path="warehouse/outward" element={<WarehouseOutward />} />
        <Route path="warehouse/returns" element={<WarehouseReturns />} />
        <Route path="warehouse/expired" element={<WarehouseExpired />} />
        <Route path="warehouse/kits" element={<AdminKits />} />
        <Route path="warehouse/movements" element={<WarehouseLedger />} />

        {/* 🟢 NEW: SALES & FINANCIALS */}
        <Route path="sales/ledger" element={<AdminSalesLedger />} />
        <Route path="sales/new-ledger" element={<AdminNewSalesLedger />} />
        <Route path="sales/analytics" element={<AdminSalesAnalytics />} />

        <Route path="products" element={<AdminProducts />} />
        <Route path="product-images" element={<AdminProductImages />} />
        <Route path="refill-logs" element={<AdminRefillLogs />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="access-requests" element={<AccessRequests />} />
        <Route path="change-password" element={<ChangePassword />} />
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
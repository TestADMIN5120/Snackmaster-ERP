# 🍫 SnackMaster - Enterprise Route Management

SnackMaster is a multi-tenant SaaS platform designed to manage smart vending machines, inventory routes, and field operations. It features a strict three-tier architecture ensuring complete data isolation and operational efficiency.

## 🏗️ System Architecture

* **👑 Super Admin (Command Center)**
    * Manages the entire platform.
    * Creates Organizations (Tenants) and registers physical hardware (Machine IDs).
    * Assigns initial Admins to Organizations.
    * Views global KPIs and system-wide Audit Logs.
* **🏢 Admin (Tenant Operations)**
    * Manages a specific Organization. Cannot see data outside their Org.
    * Manages the Product Catalog, configures Machine Slots, and auto-calculates Refill Kits.
    * Creates and assigns "Refillers" to specific machines/routes.
    * Resolves machine hardware issues reported by the field.
* **🚚 Refiller (Field Ops)**
    * Mobile-first interface for warehouse and field workers.
    * Follows strict, offline-capable workflows for machine restocking.
    * Reports hardware issues directly to the Admin.

## 🚀 Tech Stack
* **Frontend:** React 18, Vite, React Router v6
* **Backend / DB:** Firebase Auth, Firestore (NoSQL)
* **Cloud Functions:** Node.js (for background automation)
* **Offline Support:** Firestore IndexedDB Persistence

## 📖 Getting Started
Please see [DEPLOY.md](./DEPLOY.md) for full setup, environment variables, and deployment instructions.
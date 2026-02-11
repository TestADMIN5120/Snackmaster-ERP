import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("🔐 AUTH STATE:", u?.uid, u?.email);

      if (!u) {
        setUser(null);
        setRole(null);
        setOrgId(null);
        setLoading(false);
        return;
      }

      setUser(u);

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.error("❌ USER DOC MISSING FOR UID:", u.uid);
          throw new Error("User profile not found");
        }

        const data = snap.data();
        console.log("✅ USER DOC LOADED:", data);

        // 🔒 BLOCK SUSPENDED ORGS (TASK 3)
        // If they are an admin, we verify if their organisation is active
        if (data.role === "admin" && data.orgId) {
          const orgSnap = await getDoc(doc(db, "organisations", data.orgId));

          if (orgSnap.exists()) {
            const org = orgSnap.data();

            if (org.suspended === true || org.deleted === true) {
              console.warn("🚫 ORG BLOCKED/SUSPENDED:", data.orgId);
              // Clear states and sign out for security
              setRole(null);
              setOrgId(null);
              await signOut(auth); 
              setLoading(false);
              return;
            }
          }
        }

        // 🔒 BLOCK DISABLED ADMINS (TASK 2/4 Logic)
        if (data.status === "disabled" || data.deleted === true) {
            console.warn("🚫 ADMIN USER DISABLED");
            setRole(null);
            setOrgId(null);
            await signOut(auth);
            setLoading(false);
            return;
        }

        setRole(data.role);
        setOrgId(data.orgId);

      } catch (err) {
        console.error("❌ AdminContext load failed:", err);
        setRole(null);
        setOrgId(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <AdminContext.Provider
      value={{
        user,
        role,
        orgId,
        isSuperAdmin: role === "super_admin",
        isAdmin: role === "admin",
        isRefiller: role === "refiller",
        loading,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}

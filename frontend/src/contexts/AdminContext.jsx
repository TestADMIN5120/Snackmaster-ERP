import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebaseClient";

const AdminContext = createContext();

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }) {
  const [user, setUser] = useState(null); 
  const [role, setRole] = useState(null); 
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔄 AdminContext: Initializing Auth Listener...");
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log("🔐 Auth Detected:", currentUser.email);
        
        // Listen to User Profile Changes in Real-time
        const userRef = doc(db, "users", currentUser.uid);
        
        const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // 🟢 SECURITY: Instantly kick out disabled or deleted users
            if (userData.deleted || userData.status === 'disabled') {
              console.warn("⛔ Account disabled. Logging out.");
              alert("Your account has been disabled or removed. Contact support.");
              signOut(auth);
              return;
            }

            setUser({ ...currentUser, ...userData });
            setRole(userData.role || "guest");
            setOrgId(userData.orgId || null);
          } else {
            console.error("❌ User document missing in Firestore!");
            setUser(currentUser);
            setRole("guest"); 
            setOrgId(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("❌ Firestore Read Error (User Doc):", error);
          setUser(null);
          setRole(null);
          setOrgId(null);
          setLoading(false);
        });

        return () => unsubscribeSnapshot(); 

      } else {
        console.log("👋 User Logged Out");
        setUser(null);
        setRole(null);
        setOrgId(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const value = { user, role, orgId, loading };

  return (
    <AdminContext.Provider value={value}>
      {loading ? (
        <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc", color: "#64748b", fontFamily: "sans-serif" }}>
          <h2>Authenticating...</h2>
        </div>
      ) : children}
    </AdminContext.Provider>
  );
}
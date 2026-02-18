import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebaseClient";

const AdminContext = createContext();

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }) {
  const [user, setUser] = useState(null); // Full user object (Auth + DB Data)
  const [role, setRole] = useState(null); // "admin" | "refiller" | "super_admin"
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔄 AdminContext: Initializing Auth Listener...");
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log("🔐 Auth Detected:", currentUser.email);
        
        // 1. Listen to User Profile Changes Real-time
        const userRef = doc(db, "users", currentUser.uid);
        
        const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log("✅ User Profile Loaded:", userData.role);

            // Prevent login if account is disabled/deleted
            if (userData.deleted || userData.status === 'disabled') {
              alert("Your account has been disabled. Contact support.");
              auth.signOut();
              return;
            }

            // Set Context State
            setUser({ ...currentUser, ...userData });
            setRole(userData.role);
            setOrgId(userData.orgId);
          } else {
            console.error("❌ User document missing in Firestore!");
            setUser(currentUser);
            setRole("guest"); // Fallback role
          }
          setLoading(false);
        }, (error) => {
          console.error("❌ Firestore Read Error (User Doc):", error);
          // If we can't read the user doc (permission denied), we can't let them in.
          setUser(null);
          setRole(null);
          setLoading(false);
        });

        return () => unsubscribeSnapshot(); // Cleanup snapshot on unmount/change

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

  const value = {
    user,
    role,
    orgId,
    loading
  };

  return (
    <AdminContext.Provider value={value}>
      {!loading ? children : <div style={{padding:50, textAlign:'center'}}>Loading App Session...</div>}
    </AdminContext.Provider>
  );
}
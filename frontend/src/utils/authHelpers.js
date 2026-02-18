import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// Re-use your config from firebaseClient.js (you might need to export it or copy it here)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 🛠️ Helper to create a user WITHOUT logging out the current admin
export async function createSecondaryUser(email, password, roleData) {
  let secondaryApp;
  try {
    // 1. Initialize a secondary app instance
    const appName = "secondaryApp";
    // Check if exists to avoid errors
    const existingApps = getApps();
    const found = existingApps.find(app => app.name === appName);
    
    secondaryApp = found ? found : initializeApp(firebaseConfig, appName);
    
    const secondaryAuth = getAuth(secondaryApp);
    const db = getFirestore(getApp()); // Use MAIN app firestore (authenticated as admin)

    // 2. Create the user in Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCredential.user;

    // 3. Create the user doc in Firestore (Using MAIN db connection so it has Admin permissions)
    // We strictly define the fields based on the roleData passed
    await setDoc(doc(db, "users", newUser.uid), {
      uid: newUser.uid,
      email: email,
      ...roleData, // { role: 'admin', orgId: '...', etc }
      status: "active",
      deleted: false,
      createdAt: serverTimestamp(),
    });

    // 4. Sign out the secondary auth immediately so it doesn't linger
    await signOut(secondaryAuth);

    return newUser;

  } catch (error) {
    console.error("Error creating secondary user:", error);
    throw error;
  }
}
import { initializeApp, getApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

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
  const appName = "SecondaryAppInstance";
  let secondaryApp;
  
  try {
    // 1. Initialize or retrieve secondary app
    const existingApps = getApps();
    secondaryApp = existingApps.find(app => app.name === appName) 
      || initializeApp(firebaseConfig, appName);
    
    const secondaryAuth = getAuth(secondaryApp);
    const db = getFirestore(getApp()); // Use MAIN app firestore (authenticated as admin)

    // 2. Create the user in Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCredential.user;

    // 3. Create the user doc in Firestore using Admin connection
    await setDoc(doc(db, "users", newUser.uid), {
      uid: newUser.uid,
      email: email,
      ...roleData, 
      status: "active",
      deleted: false,
      createdAt: serverTimestamp(),
    });

    // 4. Sign out and delete the secondary app so it doesn't leak memory or session states
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);

    return newUser;

  } catch (error) {
    console.error("Error creating secondary user:", error);
    // Cleanup on failure
    if (secondaryApp) {
        await deleteApp(secondaryApp).catch(e => console.log("Cleanup error ignored", e));
    }
    throw error;
  }
}
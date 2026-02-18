import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore"; // 🟢 Added import
import { getStorage } from "firebase/storage";

// Configuration pulled from your .env.development file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Logging for verification
// We use import.meta.env.MODE as a backup to ensure ENV isn't undefined
console.log("🔥 ENV:", import.meta.env.VITE_ENV || import.meta.env.MODE);
console.log("🔥 FIREBASE PROJECT:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 🟢 ENABLE OFFLINE PERSISTENCE
enableIndexedDbPersistence(db)
  .then(() => {
    console.log("🔥 Firestore offline persistence enabled");
  })
  .catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("⚠️ Offline persistence failed: Multiple tabs open.");
    } else if (err.code === "unimplemented") {
      // The current browser does not support all of the features required to enable persistence
      console.warn("⚠️ Offline persistence not supported by this browser.");
    }
  });
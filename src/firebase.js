import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase Config - ใช้ environment variables เพื่อความปลอดภัย
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDjk9y_c7kiWii9RBJfNw5QKSd3lhW5iBQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "exam-webapp-25aa1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "exam-webapp-25aa1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "exam-webapp-25aa1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "686919080198",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:686919080198:web:48f7349d6b8a4ba6b2a687",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-2S0RGWYLPK"
};

let db, auth, googleProvider;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error("❌ Firebase Initialization Error:", error);
  console.error("🔍 Firebase Config:", firebaseConfig);
}

export { db, auth, googleProvider };
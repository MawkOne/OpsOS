import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAkIj6qJg8hYC-qzR0oOVNyLjA8d1fx_eI",
  authDomain: "opsos-864a1.firebaseapp.com",
  projectId: "opsos-864a1",
  storageBucket: "opsos-864a1.firebasestorage.app",
  messagingSenderId: "1037187340032",
  appId: "1:1037187340032:web:e1af53878897ad60d505e5",
  measurementId: "G-762L8DNVDZ",
};

// Initialize Firebase (prevent multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics (only in browser)
export const initAnalytics = async () => {
  if (typeof window !== "undefined" && await isSupported()) {
    return getAnalytics(app);
  }
  return null;
};

export default app;


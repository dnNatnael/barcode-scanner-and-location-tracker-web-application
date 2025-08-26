// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBcHiaq3aEwoo3ujLlYnTyrZ0aclhOz_co",
  authDomain: "barcode-app-f3e64.firebaseapp.com",
  projectId: "barcode-app-f3e64",
  storageBucket: "barcode-app-f3e64.firebasestorage.app",
  messagingSenderId: "430924750441",
  appId: "1:430924750441:web:44bdcf31750a22ff9c4cf8",
  measurementId: "G-G2NRHN85PK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };

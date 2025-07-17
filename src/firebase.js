// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCCX36I3J1twM_LPaB8jL3AuauUaOenuPg",
  authDomain: "barcode-scanner-4b473.firebaseapp.com",
  projectId: "barcode-scanner-4b473",
  storageBucket: "barcode-scanner-4b473.appspot.com",
  messagingSenderId: "322354540290",
  appId: "1:322354540290:web:634bee7386024b801fdc1b",
  measurementId: "G-JKQN57TZBS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };

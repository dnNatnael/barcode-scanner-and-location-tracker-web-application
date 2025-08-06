// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA8l4UZel-WTnftJJxH6S1sZ5GUJ4JlrcA",
  authDomain: "barcode-app-61c52.firebaseapp.com",
  projectId: "barcode-app-61c52",
  storageBucket: "barcode-app-61c52.firebasestorage.app",
  messagingSenderId: "995865908540",
  appId: "1:995865908540:web:63b18b22bad649aa9cfa39",
  measurementId: "G-1W3C0P1R4M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };

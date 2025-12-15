
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";

// REPLACE WITH YOUR FIREBASE CONFIG
// You can find this in your Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyDQkb_C0nfBV40amjICzQuBqtUr4qNWbpc",
  authDomain: "multisensorylearning-b553b.firebaseapp.com",
  projectId: "multisensorylearning-b553b",
  storageBucket: "multisensorylearning-b553b.firebasestorage.app",
  messagingSenderId: "1034000458938",
  appId: "1:1034000458938:web:eb202a95faddaac0e6ce83",
  measurementId: "G-R7B9Z3KH8J"
};

// Initialize Firebase
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app);

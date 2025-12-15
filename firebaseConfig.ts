
import * as firebaseApp from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Workaround for TypeScript errors: cast modules to any to access functions
const appModule = firebaseApp as any;
const authModule = firebaseAuth as any;

// App functions
const initializeApp = appModule.initializeApp;
const getApp = appModule.getApp;
const getApps = appModule.getApps;

// Auth functions - Exporting them to use in other files to avoid import errors
export const getAuth = authModule.getAuth;
export const signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
export const createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
export const signOut = authModule.signOut;
export const onAuthStateChanged = authModule.onAuthStateChanged;

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQkb_C0nfBV40amjICzQuBqtUr4qNWbpc",
  authDomain: "multisensorylearning-b553b.firebaseapp.com",
  projectId: "multisensorylearning-b553b",
  storageBucket: "multisensorylearning-b553b.firebasestorage.app",
  messagingSenderId: "1034000458938",
  appId: "1:1034000458938:web:eb202a95faddaac0e6ce83",
  measurementId: "G-R7B9Z3KH8J"
};

let app;
let auth: any;
let db: Firestore;

try {
  // Prevent hot-reload errors in Expo by checking if app is already initialized
  if (getApps && getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  auth = getAuth(app);
  db = getFirestore(app);

} catch (error) {
  console.error("Firebase initialization error:", error);
  throw error;
}

export { auth, db };

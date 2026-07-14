// shared/firebaseConfig.js
//
// Initializes Firebase (App, Auth, Firestore) for SAFpedia.
// Used by both admin/ and user/ code — this file lives in shared/ per
// the Coding Standards Admin vs User Separation rule.
//
// Firebase Web SDK config values (apiKey, authDomain, etc.) are not secret —
// Firebase's real security boundary is Firestore Security Rules, not hiding
// these fields — so they are hardcoded here per your instruction, instead
// of being fetched from api/config.js. This lets you test without
// redeploying for every change.
//
// IMPORTANT: this does NOT apply to Paystack secret keys or the Cloudinary
// API secret — those must stay server-side only, in Vercel env vars, never
// in frontend code.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: replace with your actual Firebase project values (Firebase Console
// → Project Settings → General → Your apps → SDK setup and configuration).
const firebaseConfig = {
apiKey: "AIzaSyDeV06ALDWmi5c01Wv_tTLPuFKRywz9tHc",
  authDomain: "sappedia-concept.firebaseapp.com",
  projectId: "sappedia-concept",
  storageBucket: "sappedia-concept.firebasestorage.app",
  messagingSenderId: "881986535800",
  appId: "1:881986535800:web:9bd4ad3c98ce651290488d",
  measurementId: "G-ELRZPLH8VQ"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Kept async for compatibility with existing callers (userAuth.js uses
// `await getFirebase()`) even though init is now synchronous.
export async function getFirebase() {
  return { firebaseApp, auth, db };
}
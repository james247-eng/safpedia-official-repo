// shared/firebaseConfig.js
//
// Initializes Firebase (App, Auth, Firestore) for SAFpedia.
// Used by both admin/ and user/ code — this file lives in shared/ per
// the Coding Standards Admin vs User Separation rule.
//
// All values come from environment variables. Never hardcode keys here.
// See .env.example for the required variable names.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// NOTE: Vanilla JS/HTML (no bundler) cannot read process.env directly in the
// browser. Env-injection strategy: this file fetches the Firebase Web
// config from the api/config.js Vercel serverless function on first use,
// then initializes Firebase once the config arrives. Callers must await
// getFirebase() before using auth/db.

let firebaseApp;
let auth;
let db;
let initPromise;

async function initFirebase() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Failed to load Firebase config from /api/config");
  }
  const firebaseConfig = await response.json();

  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);

  return { firebaseApp, auth, db };
}

// Returns a promise resolving to { firebaseApp, auth, db }. Safe to call
// from multiple files — initialization only runs once.
export function getFirebase() {
  if (!initPromise) {
    initPromise = initFirebase();
  }
  return initPromise;
}

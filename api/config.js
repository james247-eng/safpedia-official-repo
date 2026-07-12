// api/config.js
//
// Vercel serverless function. Returns the Firebase Web SDK config as JSON.
// These values (apiKey, authDomain, projectId, etc.) are the standard public
// Firebase Web config — safe to expose to the browser. They are read here
// from Vercel Environment Variables so nothing is hardcoded in the repo.
//
// This is the single source of truth for env-injection in the vanilla
// JS/no-bundler setup: shared/firebaseConfig.js fetches this endpoint on
// page load instead of reading process.env or window.__ENV__ directly.

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.status(200).json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  });
}

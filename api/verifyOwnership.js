// api/verifyOwnership.js
//
// Server-side ownership check for content access (Milestone 3).
//
// WHY THIS EXISTS: Firestore rules allow public read of an approved
// product's full document — including `fileUrl` — because Firestore
// security rules are all-or-nothing at the document level (there is no
// field-level read restriction). That means a client-side "ownership
// check" before rendering a viewer is not actually secure on its own;
// someone could read `fileUrl` directly via the Firestore SDK without
// ever calling this endpoint.
//
// The real gate is here: this function uses the Firebase Admin SDK
// (trusted, server-side, bypasses all client rules) to verify the
// requester actually has a successful order containing this product,
// and ONLY THEN reads fileUrl from products/{id}/private/content — a
// subcollection that is never client-readable at all (see firestore.rules
// assumption #3). Content viewers (pdfViewer.js, audioPlayer.js,
// videoPlayer.js) must fetch fileUrl from here — never from a direct
// client-side products/{id} read, which no longer even contains it.
//
// Requires Vercel env vars: FIREBASE_ADMIN_PROJECT_ID,
// FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
// (see .env.example).

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Vercel env vars store newlines as literal "\n" — must be restored.
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { idToken, productId } = req.body || {};

  if (!idToken || !productId) {
    res.status(400).json({ error: "idToken and productId are required" });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    return;
  }

  const uid = decodedToken.uid;

  try {
    const ordersSnap = await db
      .collection("orders")
      .where("customerId", "==", uid)
      .where("paymentStatus", "==", "successful")
      .get();

    const hasPurchased = ordersSnap.docs.some((orderDoc) => {
      const items = orderDoc.data().items || [];
      return items.some((item) => item.productId === productId);
    });

    if (!hasPurchased) {
      res.status(403).json({ error: "You have not purchased this product." });
      return;
    }

    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    const product = productSnap.data();

    // fileUrl now lives in a locked subcollection, not on the public
    // product doc (see firestore.rules assumption #3) — read it here,
    // server-side, after the purchase check above has already passed.
    const contentSnap = await db
      .collection("products")
      .doc(productId)
      .collection("private")
      .doc("content")
      .get();

    if (!contentSnap.exists) {
      res.status(404).json({ error: "Content file not found for this product." });
      return;
    }

    res.status(200).json({
      fileUrl: contentSnap.data().fileUrl,
      contentType: product.contentType,
      title: product.title,
    });
  } catch (error) {
    res.status(500).json({ error: "Could not verify ownership. Please try again." });
  }
}
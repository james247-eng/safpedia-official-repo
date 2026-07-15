// api/submitReview.js
//
// FIX for a flagged gap: firestore.rules could not verify that a reviewer
// actually purchased the product (Firestore rules can't cheaply query an
// array-of-maps field). Real fix: reviews are no longer written directly
// by the client at all — this endpoint verifies the purchase server-side
// (Firebase Admin SDK, same pattern as api/verifyOwnership.js) and writes
// the review itself. firestore.rules now denies all client writes to
// `reviews`, matching how `orders` is already locked down.
//
// No frontend review-submission UI exists yet (only reading reviews was
// built, in productDetail.js) — so this is a clean fix with no client
// code to rework.

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
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

  const { idToken, productId, rating, comment } = req.body || {};

  if (!idToken || !productId || !rating) {
    res.status(400).json({ error: "idToken, productId, and rating are required" });
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be an integer from 1 to 5" });
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
    // The actual ownership check — same logic as verifyOwnership.js.
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
      res.status(403).json({ error: "You can only review products you've purchased." });
      return;
    }

    // One review per customer per product — check for an existing one.
    const existingSnap = await db
      .collection("reviews")
      .where("productId", "==", productId)
      .where("customerId", "==", uid)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      res.status(409).json({ error: "You've already reviewed this product." });
      return;
    }

    const reviewRef = db.collection("reviews").doc();
    await reviewRef.set({
      reviewId: reviewRef.id,
      productId,
      customerId: uid,
      rating,
      comment: comment || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Keep the product's aggregate rating/review_count in sync, since this
    // is the one place reviews get written from.
    const reviewsForProductSnap = await db
      .collection("reviews")
      .where("productId", "==", productId)
      .get();

    const allRatings = reviewsForProductSnap.docs.map((d) => d.data().rating || 0);
    const avgRating = allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;

    await db.collection("products").doc(productId).update({
      rating: Math.round(avgRating * 10) / 10,
      review_count: allRatings.length,
    });

    res.status(200).json({ success: true, reviewId: reviewRef.id });
  } catch (error) {
    res.status(500).json({ error: "Could not submit review. Please try again." });
  }
}
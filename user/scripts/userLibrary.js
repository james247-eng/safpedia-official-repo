// user/scripts/userLibrary.js
//
// Milestone 2 checklist item: "Build userLibrary.js — shows purchased
// content (empty state first, populate after Milestone 5)."
//
// This IS the ownership-check pattern from the Firestore Schema
// Reference: "before rendering any product content to a customer, query
// orders where customerId == uid AND the product appears in a successful
// order's items array." Since orders can only be written server-side
// (Paystack webhook, Milestone 5), this view will correctly show empty
// until that milestone is built and a real purchase happens.
//
// KNOWN GAP: previously the "Access" button was a placeholder — now wired
// to the real viewers built in Milestone 3.

import { getFirebase } from "../../shared/firebaseConfig.js";
import { registerView } from "./userBrowse.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { openPdfViewer } from "../../shared/contentViewer/pdfViewer.js";
import { openAudioPlayer } from "../../shared/contentViewer/audioPlayer.js";
import { openVideoPlayer } from "../../shared/contentViewer/videoPlayer.js";

const VIEWER_BY_CONTENT_TYPE = {
  ebook: openPdfViewer,
  audio: openAudioPlayer,
  video: openVideoPlayer,
};

const CONTENT_TYPE_ICONS = {
  ebook: "menu_book",
  audio: "headphones",
  video: "video_library",
  physical: "inventory_2",
};

async function getCurrentUser() {
  const { auth } = await getFirebase();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Returns the deduplicated list of products the customer has successfully
// purchased, by scanning their successful orders' `items` arrays.
async function getPurchasedProducts(uid) {
  const { db } = await getFirebase();

  const ordersQuery = query(
    collection(db, "orders"),
    where("customerId", "==", uid),
    where("paymentStatus", "==", "successful")
  );
  const ordersSnap = await getDocs(ordersQuery);

  const productIds = new Set();
  ordersSnap.forEach((orderDoc) => {
    const items = orderDoc.data().items || [];
    items.forEach((item) => {
      if (item.productId) productIds.add(item.productId);
    });
  });

  const products = [];
  for (const productId of productIds) {
    try {
      const productSnap = await getDoc(doc(db, "products", productId));
      if (productSnap.exists()) {
        products.push({ productId, ...productSnap.data() });
      }
    } catch (error) {
      // Product may have been removed or rules denied read (e.g. no longer
      // approved) — skip it rather than break the whole library render.
      console.warn(`Could not load purchased product ${productId}:`, error);
    }
  }

  return products;
}

function renderLibraryCard(product) {
  const icon = CONTENT_TYPE_ICONS[product.contentType] || "inventory_2";
  const isViewable = Boolean(VIEWER_BY_CONTENT_TYPE[product.contentType]);

  return `
    <div class="product-card">
      <img
        src="${product.coverImageUrl || ""}"
        alt="${product.title || "Product cover"}"
        style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; background:var(--color-input-bg);"
      />
      <span style="font:600 15px var(--font-body); color:var(--color-text);">${product.title || "Untitled Product"}</span>
      ${
        isViewable
          ? `<button class="btn btn-primary access-content-btn" data-product-id="${product.productId}" data-content-type="${product.contentType}" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px;">
              <span class="material-icons" style="font-size:18px;">${icon}</span>
              Access Content
            </button>`
          : `<span style="font:400 13px var(--font-body); color:var(--color-text-muted); text-align:center;">
              <span class="material-icons" style="font-size:16px; vertical-align:middle;">${icon}</span>
              Physical product — no digital viewer
            </span>`
      }
    </div>
  `;
}

function wireAccessButtons() {
  document.querySelectorAll(".access-content-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const openViewer = VIEWER_BY_CONTENT_TYPE[btn.dataset.contentType];
      if (openViewer) openViewer(btn.dataset.productId);
    });
  });
}

async function renderLibraryView() {
  const content = document.getElementById("dashboardContent");
  if (!content) return;

  content.innerHTML = `<p style="color:var(--color-text-muted);">Loading your library...</p>`;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    content.innerHTML = `
      <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
        You need to be logged in to view your library.
        <br /><br />
        <a class="btn btn-primary" href="../public/login.html">Log In</a>
      </div>
    `;
    return;
  }

  try {
    const products = await getPurchasedProducts(currentUser.uid);

    if (products.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
          <span class="material-icons" style="font-size:32px; color:var(--color-secondary); display:block; margin-bottom:8px;">local_library</span>
          Your library is empty. Anything you purchase will show up here.
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:var(--grid-gap, 20px);">
        ${products.map(renderLibraryCard).join("")}
      </div>
    `;
    wireAccessButtons();
  } catch (error) {
    content.innerHTML = `<p class="form-error">Could not load your library: ${error.message}</p>`;
  }
}

registerView("library", renderLibraryView);
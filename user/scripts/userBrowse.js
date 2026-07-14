// user/scripts/userBrowse.js
//
// Milestone 2: renders the Browse view inside user/index.html's
// #dashboardContent, pulling `products` where status == "approved" per the
// Firestore Schema Reference. Also wires the sidebar/bottom-nav data-view
// clicks for the dashboard shell.
//
// KNOWN GAP (flagged, not silently patched): product cards are supposed to
// show the vendor's store name (Design Guide 5.2), but:
//   - Firestore rules only allow a user to read their OWN `users` doc.
//   - `products` has no vendor-name field to fall back on (only vendorId).
// Fix: denormalize `vendorName` onto each product doc when it's created
// (vendorAddProduct.js, Milestone 4). Until then, this file shows a
// generic vendor label instead of querying users/{vendorId} directly.

import { getFirebase } from "../../shared/firebaseConfig.js";
import { getCartCount } from "../../shared/utils/cart.js";

import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Simple registry so other view scripts (userSettings.js, and later
// userLibrary.js / userOrders.js / userNotifications.js) can register a
// real render function for their nav item instead of falling through to
// the "coming soon" placeholder. Each view script imports registerView
// from this file and calls it once at load time.
const viewRegistry = {};

export function registerView(name, renderFn) {
  viewRegistry[name] = renderFn;
}

const CONTENT_TYPE_BADGES = {
  ebook: { label: "Ebook", color: "#1652B8", icon: "menu_book" },
  audio: { label: "Audiobook", color: "#0D4F3C", icon: "headphones" },
  video: { label: "Video Course", color: "#9333EA", icon: "video_library" },
  physical: { label: "Physical Product", color: "#6B7280", icon: "inventory_2" },
};

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function renderProductCard(product) {
  const badge = CONTENT_TYPE_BADGES[product.contentType] || {
    label: product.contentType || "Product",
    color: "#6B7280",
    icon: "category",
  };

  return `
    <div class="product-card">
      <img
        src="${product.coverImageUrl || ""}"
        alt="${product.title || "Product cover"}"
        style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; background:var(--color-input-bg);"
      />
      <span class="badge" style="background:${badge.color}; color:#FFFFFF; width:fit-content;">
        <span class="material-icons" style="font-size:14px; vertical-align:middle;">${badge.icon}</span>
        ${badge.label}
      </span>
      <span style="font:600 15px var(--font-body); color:var(--color-text);">${product.title || "Untitled Product"}</span>
      <span style="font:400 13px var(--font-body); color:var(--color-text-muted);">SAFpedia Vendor</span>
      <span style="font:700 16px var(--font-display); color:var(--color-primary);">${formatNaira(product.price)}</span>
      <a class="btn btn-primary" style="width:100%;" href="../public/productDetail.html?id=${product.productId}">Buy Now</a>
    </div>
  `;
}

async function loadApprovedProducts() {
  const { db } = await getFirebase();
  const productsQuery = query(
    collection(db, "products"),
    where("status", "==", "approved")
  );
  const snapshot = await getDocs(productsQuery);

  const products = [];
  snapshot.forEach((docSnap) => {
    products.push({ productId: docSnap.id, ...docSnap.data() });
  });
  return products;
}

async function renderBrowseView() {
  const content = document.getElementById("dashboardContent");
  if (!content) return;

  content.innerHTML = `<p style="color:var(--color-text-muted);">Loading products...</p>`;

  try {
    const products = await loadApprovedProducts();

    if (products.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
          <span class="material-icons" style="font-size:32px; color:var(--color-secondary); display:block; margin-bottom:8px;">inventory_2</span>
          No products available yet. Check back soon.
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:var(--grid-gap, 20px);">
        ${products.map(renderProductCard).join("")}
      </div>
    `;
  } catch (error) {
    content.innerHTML = `<p class="form-error">Could not load products: ${error.message}</p>`;
  }
}

function renderComingSoonView(viewName) {
  const content = document.getElementById("dashboardContent");
  if (!content) return;
  content.innerHTML = `
    <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
      This section (${viewName}) is coming soon.
    </div>
  `;
}

// Wires sidebar + bottom-nav data-view clicks, plus logout. "browse" is
// built in this file; other views render via the registry above once
// their own scripts have registered (falls back to "coming soon" until
// then).
function initDashboardNav() {
  const navItems = document.querySelectorAll("[data-view]");

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const view = item.getAttribute("data-view");

      document.querySelectorAll("[data-view]").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-view") === view);
      });

      if (view === "browse") {
        renderBrowseView();
      } else if (viewRegistry[view]) {
        viewRegistry[view]();
      } else {
        renderComingSoonView(view);
      }
    });
  });
}

function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    const { auth } = await getFirebase();
    await signOut(auth);
    window.location.href = "../public/login.html";
  });
}


function updateCartBadge() {
  const badge = document.getElementById("cartCountBadge");
  if (!badge) return;
  const count = getCartCount();
  badge.style.display = count > 0 ? "block" : "none";
  badge.textContent = count;
}

window.addEventListener("cart:updated", updateCartBadge);
updateCartBadge();


initDashboardNav();
initLogout();
renderBrowseView();
// user/scripts/productDetail.js
//
// Milestone 2: public product detail page (public/productDetail.html).
// Follows the pattern of public HTML pages sourcing logic from
// user/scripts/ (same as register.html/login.html -> userAuth.js).
//
// KNOWN GAP (flagged, same as userBrowse.js): vendor store name can't be
// read from users/{vendorId} under the current Firestore rules (owner-only
// reads), and products has no vendor-name field. Shows a generic vendor
// label until vendorName is denormalized onto products (Milestone 4).

import { getFirebase } from "../../shared/firebaseConfig.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getCart,
  addToCart,
  removeFromCart,
  getCartTotal,
  getCartCount,
} from "../../shared/utils/cart.js";

const CONTENT_TYPE_BADGES = {
  ebook: { label: "Ebook", color: "#1652B8", icon: "menu_book" },
  audio: { label: "Audiobook", color: "#0D4F3C", icon: "headphones" },
  video: { label: "Video Course", color: "#9333EA", icon: "video_library" },
  physical: { label: "Physical Product", color: "#6B7280", icon: "inventory_2" },
};

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function getProductIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

async function fetchProduct(productId) {
  const { db } = await getFirebase();
  const snap = await getDoc(doc(db, "products", productId));
  if (!snap.exists()) return null;
  return { productId: snap.id, ...snap.data() };
}

async function fetchReviews(productId) {
  const { db } = await getFirebase();
  const reviewsQuery = query(
    collection(db, "reviews"),
    where("productId", "==", productId)
  );
  const snap = await getDocs(reviewsQuery);
  const reviews = [];
  snap.forEach((d) => reviews.push(d.data()));
  return reviews;
}

async function fetchRelatedProducts(category, excludeProductId) {
  const { db } = await getFirebase();
  const relatedQuery = query(
    collection(db, "products"),
    where("status", "==", "approved"),
    where("category", "==", category),
    limit(5)
  );
  const snap = await getDocs(relatedQuery);
  const related = [];
  snap.forEach((d) => {
    if (d.id !== excludeProductId) related.push({ productId: d.id, ...d.data() });
  });
  return related.slice(0, 4);
}

function renderNotFound() {
  document.getElementById("productDetailRoot").innerHTML = `
    <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
      <span class="material-icons" style="font-size:32px; color:var(--color-secondary); display:block; margin-bottom:8px;">search_off</span>
      This product isn't available.
      <br /><br />
      <a class="btn btn-primary" href="../public/index.html">Back to SAFpedia</a>
    </div>
  `;
}

function renderRelatedCard(product) {
  return `
    <a class="product-card" style="text-decoration:none;" href="./productDetail.html?id=${product.productId}">
      <img src="${product.coverImageUrl || ""}" alt="${product.title || ""}" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; background:var(--color-input-bg);" />
      <span style="font:600 14px var(--font-body); color:var(--color-text);">${product.title || "Untitled"}</span>
      <span style="font:700 14px var(--font-display); color:var(--color-primary);">${formatNaira(product.price)}</span>
    </a>
  `;
}

function renderReviewRow(review) {
  const stars = "★".repeat(review.rating || 0) + "☆".repeat(5 - (review.rating || 0));
  return `
    <div style="padding:12px 0; border-bottom:1px solid var(--color-divider);">
      <span style="color:var(--color-accent); letter-spacing:1px;">${stars}</span>
      <p style="margin:6px 0 0 0; font:400 14px var(--font-body); color:var(--color-text);">${review.comment || ""}</p>
    </div>
  `;
}

async function renderProductDetail() {
  const root = document.getElementById("productDetailRoot");
  const productId = getProductIdFromUrl();

  if (!productId) {
    renderNotFound();
    return;
  }

  let product;
  try {
    product = await fetchProduct(productId);
  } catch (error) {
    renderNotFound();
    return;
  }

  if (!product || product.status !== "approved") {
    renderNotFound();
    return;
  }

  const badge = CONTENT_TYPE_BADGES[product.contentType] || {
    label: product.contentType || "Product",
    color: "#6B7280",
    icon: "category",
  };

  document.title = `${product.title || "Product"} — SAFpedia`;

  root.innerHTML = `
    <div class="pd-main">
      <div class="pd-image-col">
        <img src="${product.coverImageUrl || ""}" alt="${product.title || ""}" />
      </div>
      <div class="pd-info-col">
        <span class="badge" style="background:${badge.color}; color:#FFFFFF; width:fit-content;">
          <span class="material-icons" style="font-size:14px; vertical-align:middle;">${badge.icon}</span>
          ${badge.label}
        </span>
        <h1 class="pd-title">${product.title || "Untitled Product"}</h1>
        <span class="pd-vendor">Sold by SAFpedia Vendor</span>
        <span class="pd-price">${formatNaira(product.price)}</span>

        <div class="pd-actions">
          <button class="btn btn-primary" id="addToCartBtn">Add to Cart</button>
        </div>
      </div>
    </div>

    <div class="pd-tabs">
      <button class="pd-tab active" data-tab="description">Description</button>
      <button class="pd-tab" data-tab="reviews">Reviews</button>
    </div>

    <div class="pd-tab-panel active" id="tab-description">
      <p style="font:400 15px var(--font-body); color:var(--color-text); line-height:1.6;">
        ${product.description || "No description provided."}
      </p>
    </div>

    <div class="pd-tab-panel" id="tab-reviews">
      <div id="reviewsList">
        <p style="color:var(--color-text-muted);">Loading reviews...</p>
      </div>
    </div>

    <div id="relatedSection"></div>
  `;

  wireTabs();
  wireAddToCart(product);
  loadReviews(productId);
  loadRelatedProducts(product.category, productId);
}

function wireTabs() {
  const tabs = document.querySelectorAll(".pd-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".pd-tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

function wireAddToCart(product) {
  const btn = document.getElementById("addToCartBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    addToCart(product);
    renderCartDrawer();
    btn.textContent = "Added ✓";
    setTimeout(() => (btn.textContent = "Add to Cart"), 1500);
  });
}

async function loadReviews(productId) {
  const list = document.getElementById("reviewsList");
  try {
    const reviews = await fetchReviews(productId);
    if (reviews.length === 0) {
      list.innerHTML = `<p style="color:var(--color-text-muted);">No reviews yet.</p>`;
      return;
    }
    list.innerHTML = reviews.map(renderReviewRow).join("");
  } catch (error) {
    list.innerHTML = `<p class="form-error">Could not load reviews.</p>`;
  }
}

async function loadRelatedProducts(category, excludeProductId) {
  const section = document.getElementById("relatedSection");
  if (!category) return;
  try {
    const related = await fetchRelatedProducts(category, excludeProductId);
    if (related.length === 0) return;
    section.innerHTML = `
      <h2 class="pd-related-heading">More like this</h2>
      <div class="pd-related-grid">
        ${related.map(renderRelatedCard).join("")}
      </div>
    `;
  } catch (error) {
    // Related products are a nice-to-have; fail silently rather than
    // break the whole page.
  }
}

// ── Cart drawer ──────────────────────────────────────────────

function renderCartDrawer() {
  const cart = getCart();
  const list = document.getElementById("cartItemsList");
  const total = document.getElementById("cartTotal");
  const cartCount = document.getElementById("cartCount");

  if (cart.length === 0) {
    list.innerHTML = `<p style="color:var(--color-text-muted); padding:20px 0;">Your cart is empty.</p>`;
  } else {
    list.innerHTML = cart
      .map(
        (item) => `
      <div class="pd-cart-item">
        <img src="${item.coverImageUrl || ""}" alt="${item.title || ""}" />
        <div style="flex:1;">
          <div style="font:600 13px var(--font-body); color:var(--color-text);">${item.title}</div>
          <div style="font:400 12px var(--font-body); color:var(--color-text-muted);">${formatNaira(item.price)} × ${item.quantity}</div>
        </div>
        <span class="material-icons remove-cart-item" data-id="${item.productId}" style="cursor:pointer; color:var(--color-error); font-size:18px;">delete</span>
      </div>
    `
      )
      .join("");

    document.querySelectorAll(".remove-cart-item").forEach((el) => {
      el.addEventListener("click", () => {
        removeFromCart(el.dataset.id);
        renderCartDrawer();
      });
    });
  }

  total.textContent = formatNaira(getCartTotal(cart));

  const count = getCartCount(cart);
  if (count > 0) {
    cartCount.style.display = "block";
    cartCount.textContent = count;
  } else {
    cartCount.style.display = "none";
  }
}

function initCartDrawerToggle() {
  const icon = document.getElementById("cartIcon");
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  const closeBtn = document.getElementById("closeCartBtn");

  const open = () => {
    drawer.classList.add("open");
    overlay.classList.add("open");
  };
  const close = () => {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  };

  icon.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
}

initCartDrawerToggle();
renderCartDrawer();
renderProductDetail();
// shared/utils/cart.js
//
// Shopping cart storage (Milestone 2 checklist: "shopping cart — can be
// in-memory/localStorage for Phase 1, not Firestore"). Used by
// productDetail.js now, and will be read again by the checkout page in
// Milestone 5 — kept here in shared/ for that reason.
//
// Digital products (ebook/audio/video) are licenses, not stock — quantity
// is locked to 1 for those. Only "physical" products support quantity > 1.

const CART_KEY = "safpedia_cart";

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Could not read cart from localStorage:", error);
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
  return cart;
}

export function getCart() {
  return readCart();
}

// Adds a product to the cart. `product` should include at least:
// productId, title, price, coverImageUrl, vendorId, contentType.
export function addToCart(product, quantity = 1) {
  const cart = readCart();
  const existing = cart.find((item) => item.productId === product.productId);
  const isPhysical = product.contentType === "physical";

  if (existing) {
    existing.quantity = isPhysical ? existing.quantity + quantity : 1;
  } else {
    cart.push({
      productId: product.productId,
      title: product.title,
      price: product.price,
      coverImageUrl: product.coverImageUrl,
      vendorId: product.vendorId,
      contentType: product.contentType,
      quantity: isPhysical ? quantity : 1,
    });
  }

  return writeCart(cart);
}

export function removeFromCart(productId) {
  const cart = readCart().filter((item) => item.productId !== productId);
  return writeCart(cart);
}

export function updateQuantity(productId, quantity) {
  if (quantity <= 0) return removeFromCart(productId);

  const cart = readCart();
  const item = cart.find((i) => i.productId === productId);
  if (item && item.contentType === "physical") {
    item.quantity = quantity;
  }
  return writeCart(cart);
}

export function clearCart() {
  return writeCart([]);
}

export function getCartTotal(cart = readCart()) {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
}

export function getCartCount(cart = readCart()) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}
// user/scripts/userCart.js
//
// Logic for public/cart.html — the dedicated cart page. Reads/writes
// through shared/utils/cart.js (the localStorage cart module). Checkout
// is intentionally left as a disabled placeholder — real checkout wiring
// (Paystack Inline) is Milestone 5.

import {
  getCart,
  removeFromCart,
  updateQuantity,
  getCartTotal,
} from "../../shared/utils/cart.js";

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function renderCartRow(item) {
  const isPhysical = item.contentType === "physical";

  return `
    <div class="cart-row">
      <img src="${item.coverImageUrl || ""}" alt="${item.title || ""}" />
      <div class="cart-row-info">
        <div class="cart-row-title">${item.title || "Untitled"}</div>
        <div class="cart-row-price">${formatNaira(item.price)}</div>
      </div>

      ${
        isPhysical
          ? `
        <div class="qty-control">
          <button class="qty-btn" data-action="decrease" data-id="${item.productId}">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" data-action="increase" data-id="${item.productId}">+</button>
        </div>
      `
          : `<span style="font:400 12px var(--font-body); color:var(--color-text-muted);">Qty 1</span>`
      }

      <span class="material-icons" data-action="remove" data-id="${item.productId}" style="cursor:pointer; color:var(--color-error);">delete</span>
    </div>
  `;
}

function render() {
  const cart = getCart();
  const list = document.getElementById("cartList");
  const totalEl = document.getElementById("cartPageTotal");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
        <span class="material-icons" style="font-size:32px; color:var(--color-secondary); display:block; margin-bottom:8px;">shopping_cart</span>
        Your cart is empty.
        <br /><br />
        <a class="btn btn-primary" href="./index.html">Browse Products</a>
      </div>
    `;
    totalEl.textContent = formatNaira(0);
    checkoutBtn.disabled = true;
    return;
  }

  list.innerHTML = cart.map(renderCartRow).join("");
  totalEl.textContent = formatNaira(getCartTotal(cart));
  checkoutBtn.disabled = false;

  list.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const action = el.dataset.action;
      const item = cart.find((i) => i.productId === id);

      if (action === "remove") {
        removeFromCart(id);
      } else if (action === "increase" && item) {
        updateQuantity(id, item.quantity + 1);
      } else if (action === "decrease" && item) {
        updateQuantity(id, item.quantity - 1);
      }

      render();
    });
  });
}

document.getElementById("checkoutBtn")?.addEventListener("click", () => {
  alert("Checkout is coming in a later milestone.");
});

// Keep the page in sync if the cart changes in another tab, or via the
// cart:updated event dispatched by shared/utils/cart.js.
window.addEventListener("cart:updated", render);

render();
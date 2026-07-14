// user/scripts/userRoleToggle.js
//
// Milestone 4 checklist item: "userRoleToggle.js — shows 'Switch to Vendor
// Mode' once approved." Built ahead of its milestone at the user's request,
// but scoped defensively: since no vendor/influencer application flow
// exists yet (Milestone 4/7), no account will actually have
// vendorApprovalStatus/influencerApprovalStatus == "approved" — so the
// toggle correctly stays hidden for every user until those milestones are
// built. Nothing here needs rework once they are; it just starts finding
// eligible accounts.
//
// KNOWN GAP (flagged): switching to Vendor/Influencer mode shows a "coming
// soon" placeholder rather than a real vendor/influencer dashboard, since
// those sidebar nav items and view scripts don't exist yet.

import { getFirebase } from "../../shared/firebaseConfig.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const MODE_LABELS = {
  customer: "Customer Mode",
  vendor: "Vendor Mode",
  influencer: "Affiliate Mode",
};

let availableModes = ["customer"];
let currentModeIndex = 0;

async function getCurrentUser() {
  const { auth } = await getFirebase();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

function renderModePlaceholder(mode) {
  const content = document.getElementById("dashboardContent");
  if (!content) return;
  content.innerHTML = `
    <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
      ${MODE_LABELS[mode]} dashboard is coming soon.
    </div>
  `;
}

function updateToggleUI() {
  const label = document.getElementById("roleToggleLabel");
  if (label) label.textContent = MODE_LABELS[availableModes[currentModeIndex]];
}

function initToggleClick() {
  const toggle = document.getElementById("roleToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    currentModeIndex = (currentModeIndex + 1) % availableModes.length;
    const mode = availableModes[currentModeIndex];
    updateToggleUI();

    if (mode === "customer") {
      // Re-trigger the currently-active nav item's view (defaults to
      // Browse, since that's the shell's default view).
      const activeNavItem = document.querySelector("[data-view].active");
      if (activeNavItem) activeNavItem.dispatchEvent(new Event("click"));
    } else {
      renderModePlaceholder(mode);
    }
  });
}

async function initRoleToggle() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  const { db } = await getFirebase();
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const modes = ["customer"];

  if (
    (userData.roles || []).includes("vendor") &&
    userData.vendorApprovalStatus === "approved"
  ) {
    modes.push("vendor");
  }

  if (
    (userData.roles || []).includes("influencer") &&
    userData.influencerApprovalStatus === "approved"
  ) {
    modes.push("influencer");
  }

  if (modes.length <= 1) {
    // Only a customer — toggle stays hidden, matching the default
    // display:none already set on #roleToggle in user/index.html.
    return;
  }

  availableModes = modes;
  currentModeIndex = 0;

  const toggle = document.getElementById("roleToggle");
  if (toggle) toggle.style.display = "flex";

  updateToggleUI();
  initToggleClick();
}

initRoleToggle();
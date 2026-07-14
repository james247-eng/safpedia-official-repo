// user/scripts/userSettings.js
//
// Account Settings view for the customer dashboard (user/index.html).
// Registers itself into userBrowse.js's view registry so clicking
// "Account Settings" in the sidebar/bottom-nav renders this instead of
// the "coming soon" placeholder.
//
// Editable fields: fullName, phone, bankName, accountNumber, accountName.
// These are exactly the fields the Firestore rules' isValidSelfUpdate
// check permits a user to change on their own `users` doc — roles,
// balances, approval statuses, and referral stats are intentionally
// left out of this form since self-editing them is blocked server-side.

import { getFirebase } from "../../shared/firebaseConfig.js";
import { registerView } from "./userBrowse.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

async function getCurrentUser() {
  const { auth } = await getFirebase();
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function renderSettingsView() {
  const content = document.getElementById("dashboardContent");
  if (!content) return;

  content.innerHTML = `<p style="color:var(--color-text-muted);">Loading account settings...</p>`;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    content.innerHTML = `
      <div class="empty-state" style="background:var(--color-surface); border:1px dashed var(--color-divider); border-radius:var(--radius-card); padding:40px 20px; text-align:center; color:var(--color-text-muted);">
        You need to be logged in to view account settings.
        <br /><br />
        <a class="btn btn-primary" href="../public/login.html">Log In</a>
      </div>
    `;
    return;
  }

  const { db } = await getFirebase();
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userSnap.exists() ? userSnap.data() : {};

  content.innerHTML = `
    <div style="max-width:520px;">
      <h2 style="font:700 24px var(--font-display); color:var(--color-primary); margin:0 0 var(--space-lg) 0;">
        Account Settings
      </h2>

      <form id="profileForm" class="auth-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="settingsFullName">Full Name</label>
          <input class="form-input" type="text" id="settingsFullName" value="${escapeHtml(userData.fullName)}" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="settingsPhone">Phone</label>
          <input class="form-input" type="tel" id="settingsPhone" value="${escapeHtml(userData.phone)}" required />
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" value="${escapeHtml(currentUser.email)}" disabled />
        </div>

        <h3 style="font:600 15px var(--font-body); color:var(--color-text); margin:var(--space-lg) 0 var(--space-sm) 0;">
          Payout Details
        </h3>
        <p style="font:400 12px var(--font-body); color:var(--color-text-muted); margin:0 0 var(--space-md) 0;">
          Used for vendor/influencer payouts if applicable.
        </p>

        <div class="form-group">
          <label class="form-label" for="settingsBankName">Bank Name</label>
          <input class="form-input" type="text" id="settingsBankName" value="${escapeHtml(userData.bankName)}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="settingsAccountNumber">Account Number</label>
          <input class="form-input" type="text" id="settingsAccountNumber" value="${escapeHtml(userData.accountNumber)}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="settingsAccountName">Account Name</label>
          <input class="form-input" type="text" id="settingsAccountName" value="${escapeHtml(userData.accountName)}" />
        </div>

        <div class="form-group">
          <span class="form-error" id="profileError"></span>
          <span id="profileSuccess" style="color:var(--color-success); font-size:12px; display:none;"></span>
        </div>

        <button type="submit" class="btn btn-primary" id="profileSubmit">Save Changes</button>
      </form>

      <h3 style="font:600 15px var(--font-body); color:var(--color-text); margin:var(--space-2xl) 0 var(--space-sm) 0;">
        Change Password
      </h3>

      <form id="passwordForm" class="auth-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="currentPassword">Current Password</label>
          <input class="form-input" type="password" id="currentPassword" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="newPassword">New Password</label>
          <input class="form-input" type="password" id="newPassword" required />
        </div>

        <div class="form-group">
          <span class="form-error" id="passwordFormError"></span>
          <span id="passwordFormSuccess" style="color:var(--color-success); font-size:12px; display:none;"></span>
        </div>

        <button type="submit" class="btn btn-secondary" id="passwordSubmit">Update Password</button>
      </form>
    </div>
  `;

  wireProfileForm(currentUser);
  wirePasswordForm(currentUser);
}

function wireProfileForm(currentUser) {
  const form = document.getElementById("profileForm");
  const errorEl = document.getElementById("profileError");
  const successEl = document.getElementById("profileSuccess");
  const submitBtn = document.getElementById("profileSubmit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    successEl.style.display = "none";

    const fullName = document.getElementById("settingsFullName").value.trim();
    const phone = document.getElementById("settingsPhone").value.trim();
    const bankName = document.getElementById("settingsBankName").value.trim();
    const accountNumber = document.getElementById("settingsAccountNumber").value.trim();
    const accountName = document.getElementById("settingsAccountName").value.trim();

    if (!fullName || !phone) {
      errorEl.textContent = "Full name and phone are required.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    try {
      const { db } = await getFirebase();
      await updateDoc(doc(db, "users", currentUser.uid), {
        fullName,
        phone,
        bankName,
        accountNumber,
        accountName,
      });
      successEl.textContent = "Profile updated.";
      successEl.style.display = "block";
    } catch (error) {
      errorEl.textContent = error.message || "Could not save changes.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Changes";
    }
  });
}

function wirePasswordForm(currentUser) {
  const form = document.getElementById("passwordForm");
  const errorEl = document.getElementById("passwordFormError");
  const successEl = document.getElementById("passwordFormSuccess");
  const submitBtn = document.getElementById("passwordSubmit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    successEl.style.display = "none";

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;

    if (newPassword.length < 6) {
      errorEl.textContent = "New password must be at least 6 characters.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      successEl.textContent = "Password updated.";
      successEl.style.display = "block";
      form.reset();
    } catch (error) {
      errorEl.textContent = error.message || "Could not update password. Check your current password.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Password";
    }
  });
}

registerView("settings", renderSettingsView);
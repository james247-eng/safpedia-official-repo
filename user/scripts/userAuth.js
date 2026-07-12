// user/scripts/userAuth.js
//
// Handles registration (Milestone 1). Wires up public/register.html's form.
// Login logic, email verification, and password reset are separate
// checklist items and are NOT included in this file.

import { getFirebase } from "../../shared/firebaseConfig.js";
import {
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Reads the ?ref= query param from the current URL, if present.
// Returns the referral code string, or null if absent.
function getReferralCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") || null;
}

// Registers a new user: creates the Firebase Auth account, then writes
// the initial `users` Firestore document per the Firestore Schema
// Reference (roles: ["customer"] at signup).
export async function registerUser({ fullName, email, phone, password }) {
  const { auth, db } = await getFirebase();

  const referredBy = getReferralCodeFromUrl();

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  const userDoc = {
    uid,
    fullName,
    email,
    phone,
    roles: ["customer"],
    status: "active",
    createdAt: serverTimestamp(),
  };

  if (referredBy) {
    userDoc.referredBy = referredBy;
  }

  await setDoc(doc(db, "users", uid), userDoc);

  return credential.user;
}

// Wires up the register form on public/register.html.
function initRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("registerSubmit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      formError.textContent = "Passwords do not match.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    try {
      await registerUser({ fullName, email, phone, password });
      window.location.href = "../user/index.html";
    } catch (error) {
      formError.textContent = error.message || "Registration failed. Please try again.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  });
}

initRegisterForm();

// user/scripts/userAuth.js
//
// Handles authentication for SAFpedia (Milestone 1):
//   - Registration (public/register.html)
//   - Login (public/login.html)
//   - Password reset request (public/resetPassword.html)
// Email verification is a separate checklist item and is NOT in this file.

import { getFirebase } from "../../shared/firebaseConfig.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
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

  await sendEmailVerification(credential.user);

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
  const successPanel = document.getElementById("registerSuccess");

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
      form.style.display = "none";
      if (successPanel) successPanel.style.display = "block";
    } catch (error) {
      formError.textContent = error.message || "Registration failed. Please try again.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  });
}

initRegisterForm();

// Logs an existing user in via Firebase Auth email/password. Blocks login
// if the email address has not yet been verified.
export async function loginUser({ email, password }) {
  const { auth } = await getFirebase();
  const credential = await signInWithEmailAndPassword(auth, email, password);

  if (!credential.user.emailVerified) {
    await signOut(auth);
    const err = new Error("Please verify your email before logging in. Check your inbox for the verification link.");
    err.code = "unverified-email";
    throw err;
  }

  return credential.user;
}

// Resends the verification email. Requires re-authenticating briefly since
// Firebase only allows sendEmailVerification on the currently signed-in
// user; signs back out immediately after sending.
export async function resendVerificationEmail({ email, password }) {
  const { auth } = await getFirebase();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user);
  await signOut(auth);
}

// Wires up the login form on public/login.html.
function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("loginSubmit");
  const resendLink = document.getElementById("resendVerificationLink");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";
    if (resendLink) resendLink.style.display = "none";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      await loginUser({ email, password });
      window.location.href = "../user/index.html";
    } catch (error) {
      formError.textContent = error.message || "Login failed. Please check your credentials.";
      if (error.code === "unverified-email" && resendLink) {
        resendLink.style.display = "inline-block";
        resendLink.onclick = async (e) => {
          e.preventDefault();
          resendLink.textContent = "Sending...";
          try {
            await resendVerificationEmail({ email, password });
            resendLink.textContent = "Verification email sent!";
          } catch (resendError) {
            resendLink.textContent = "Resend verification email";
            formError.textContent = resendError.message || "Could not resend email.";
          }
        };
      }
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In";
    }
  });
}

initLoginForm();

// Sends a Firebase password reset email to the given address.
export async function sendResetPasswordEmail({ email }) {
  const { auth } = await getFirebase();
  await sendPasswordResetEmail(auth, email);
}

// Wires up the reset-password form on public/resetPassword.html.
function initResetPasswordForm() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) return;

  const formError = document.getElementById("formError");
  const formSuccess = document.getElementById("formSuccess");
  const submitBtn = document.getElementById("resetSubmit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";
    formSuccess.style.display = "none";
    formSuccess.textContent = "";

    const email = document.getElementById("email").value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      await sendResetPasswordEmail({ email });
      formSuccess.textContent = "Reset link sent. Check your inbox.";
      formSuccess.style.display = "block";
      submitBtn.textContent = "Send Reset Link";
      submitBtn.disabled = false;
    } catch (error) {
      formError.textContent = error.message || "Could not send reset link. Please try again.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Reset Link";
    }
  });
}

initResetPasswordForm();
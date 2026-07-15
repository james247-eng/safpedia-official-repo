// shared/contentViewer/videoPlayer.js
//
// Video viewer for video courses, per UI Design Guide Sections 7.1
// (Player Shell) and 7.4 (Video Player): Google Drive embed inside a
// locked iframe container, src never exposed in the DOM until after a
// server-side ownership check.
//
// SCHEMA GAP (flagged): the Design Guide calls for an episode/module list
// with per-episode resume progress, but `products` has a single `fileUrl`
// field — no episodes array, no per-episode progress field. This plays
// the one video only. Multi-episode + resume support needs a schema
// addition before this can be built out further.
//
// SECURITY NOTE: same pattern as pdfViewer.js / audioPlayer.js — fileUrl
// (the Drive link) comes only from api/verifyOwnership.js.

import { getFirebase } from "../firebaseConfig.js";

function buildShell() {
  const overlay = document.createElement("div");
  overlay.id = "safpediaViewerOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: #0A2463; z-index: 1000;
    display: flex; flex-direction: column; color: #FFFFFF;
  `;

  overlay.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; padding:16px 20px;">
      <span class="material-icons" id="viewerCloseBtn" style="cursor:pointer;">arrow_back</span>
      <span id="viewerTitle" style="font:600 16px 'Space Grotesk', sans-serif;">Loading...</span>
    </div>

    <div id="videoContainer" style="flex:1; display:flex; align-items:center; justify-content:center;">
      <p style="color:rgba(255,255,255,0.7);">Loading video...</p>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

// Converts a standard Google Drive share link into its embeddable
// /preview form, if it isn't already.
function toEmbedUrl(driveUrl) {
  if (!driveUrl) return "";
  if (driveUrl.includes("/preview")) return driveUrl;
  const match = driveUrl.match(/\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return driveUrl;
}

export async function openVideoPlayer(productId) {
  const overlay = buildShell();
  const titleEl = overlay.querySelector("#viewerTitle");
  const container = overlay.querySelector("#videoContainer");

  overlay.querySelector("#viewerCloseBtn").addEventListener("click", () => overlay.remove());

  const { auth } = await getFirebase();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    container.innerHTML = `<p style="color:rgba(255,255,255,0.85);">Please log in to view this content.</p>`;
    return;
  }

  let fileUrl;
  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/verifyOwnership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, productId }),
    });
    const result = await response.json();

    if (!response.ok) {
      container.innerHTML = `<p style="color:rgba(255,255,255,0.85);">${result.error || "Access denied."}</p>`;
      return;
    }

    fileUrl = result.fileUrl;
    titleEl.textContent = result.title || "Video";
  } catch (error) {
    container.innerHTML = `<p style="color:rgba(255,255,255,0.85);">Could not verify access. Please try again.</p>`;
    return;
  }

  const embedUrl = toEmbedUrl(fileUrl);
  if (!embedUrl) {
    container.innerHTML = `<p style="color:rgba(255,255,255,0.85);">Video link is unavailable.</p>`;
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.style.cssText = "width:90%; max-width:960px; aspect-ratio:16/9; border:none; border-radius:8px;";
  iframe.setAttribute("allow", "autoplay");
  iframe.setAttribute("allowfullscreen", "true");

  container.innerHTML = "";
  container.appendChild(iframe);
}
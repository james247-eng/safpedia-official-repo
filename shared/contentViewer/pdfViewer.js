// shared/contentViewer/pdfViewer.js
//
// PDF viewer for ebooks, per UI Design Guide Sections 7.1 (Player Shell)
// and 7.2 (PDF Viewer). Uses PDF.js loaded from CDN (no bundler).
//
// SECURITY NOTE: this file never reads `fileUrl` from a direct client-side
// products/{id} Firestore read. It calls api/verifyOwnership.js, which
// checks the purchase server-side with the Firebase Admin SDK and only
// then returns the file URL. See that file's header comment for why.

import { getFirebase } from "../firebaseConfig.js";

let pdfjsLibPromise;

// Loads the PDF.js ESM build from CDN once, lazily.
function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs"
    ).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsLibPromise;
}

function buildShell() {
  const overlay = document.createElement("div");
  overlay.id = "safpediaViewerOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: #0A2463; z-index: 1000;
    display: flex; flex-direction: column; color: #FFFFFF;
  `;

  overlay.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <span class="material-icons" id="viewerCloseBtn" style="cursor:pointer;">arrow_back</span>
        <span id="viewerTitle" style="font:600 16px 'Space Grotesk', sans-serif;">Loading...</span>
      </div>
      <div style="display:flex; align-items:center; gap:16px;">
        <span class="material-icons" id="pdfZoomOut" style="cursor:pointer;">zoom_out</span>
        <span class="material-icons" id="pdfZoomIn" style="cursor:pointer;">zoom_in</span>
      </div>
    </div>

    <div id="pdfPageContainer" style="flex:1; overflow:auto; display:flex; justify-content:center; padding:20px;" oncontextmenu="return false;">
      <p style="color:rgba(255,255,255,0.7);">Loading document...</p>
    </div>

    <div style="display:flex; align-items:center; justify-content:center; gap:20px; padding:14px;">
      <span class="material-icons" id="pdfPrevPage" style="cursor:pointer;">chevron_left</span>
      <span id="pdfPageCount" style="font:400 13px Inter, sans-serif;">Page 0 of 0</span>
      <span class="material-icons" id="pdfNextPage" style="cursor:pointer;">chevron_right</span>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

export async function openPdfViewer(productId) {
  const overlay = buildShell();
  const titleEl = overlay.querySelector("#viewerTitle");
  const pageContainer = overlay.querySelector("#pdfPageContainer");
  const pageCountEl = overlay.querySelector("#pdfPageCount");

  overlay.querySelector("#viewerCloseBtn").addEventListener("click", () => overlay.remove());

  const { auth } = await getFirebase();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    pageContainer.innerHTML = `<p style="color:rgba(255,255,255,0.85);">Please log in to view this content.</p>`;
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
      pageContainer.innerHTML = `<p style="color:rgba(255,255,255,0.85);">${result.error || "Access denied."}</p>`;
      return;
    }

    fileUrl = result.fileUrl;
    titleEl.textContent = result.title || "Document";
  } catch (error) {
    pageContainer.innerHTML = `<p style="color:rgba(255,255,255,0.85);">Could not verify access. Please try again.</p>`;
    return;
  }

  try {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument(fileUrl).promise;

    let currentPage = 1;
    let currentScale = 1.2;
    const totalPages = pdf.numPages;

    async function renderPage(pageNum) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.background = "#FFFFFF";
      canvas.style.borderRadius = "4px";

      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;

      pageContainer.innerHTML = "";
      pageContainer.appendChild(canvas);
      pageCountEl.textContent = `Page ${pageNum} of ${totalPages}`;
    }

    overlay.querySelector("#pdfPrevPage").addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderPage(currentPage);
      }
    });

    overlay.querySelector("#pdfNextPage").addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage += 1;
        renderPage(currentPage);
      }
    });

    overlay.querySelector("#pdfZoomIn").addEventListener("click", () => {
      currentScale = Math.min(currentScale + 0.2, 3);
      renderPage(currentPage);
    });

    overlay.querySelector("#pdfZoomOut").addEventListener("click", () => {
      currentScale = Math.max(currentScale - 0.2, 0.6);
      renderPage(currentPage);
    });

    await renderPage(currentPage);
  } catch (error) {
    pageContainer.innerHTML = `<p style="color:rgba(255,255,255,0.85);">Could not load document: ${error.message}</p>`;
  }
}
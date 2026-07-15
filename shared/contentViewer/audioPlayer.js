// shared/contentViewer/audioPlayer.js
//
// Custom audio player for audiobooks/podcasts/audio courses, per UI
// Design Guide Sections 7.1 (Player Shell) and 7.3 (Audio Player).
//
// SCHEMA GAP (flagged): the Design Guide calls for an episode list sidebar
// for courses/podcasts, but `products` has a single `fileUrl` field — no
// episodes array. This plays that one file only. Multi-episode support
// needs a schema addition (e.g. `episodes: [{title, fileUrl}]`) before
// this can show a real episode list.
//
// SECURITY NOTE: same as pdfViewer.js — fileUrl comes only from
// api/verifyOwnership.js, never a direct client-side products/{id} read.

import { getFirebase } from "../firebaseConfig.js";

function buildShell() {
  const overlay = document.createElement("div");
  overlay.id = "safpediaViewerOverlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: #0A2463; z-index: 1000;
    display: flex; flex-direction: column; color: #FFFFFF;
    align-items: center; justify-content: center;
  `;

  overlay.innerHTML = `
    <div style="position:absolute; top:16px; left:20px; display:flex; align-items:center; gap:12px;">
      <span class="material-icons" id="viewerCloseBtn" style="cursor:pointer;">arrow_back</span>
      <span id="viewerTitle" style="font:600 16px 'Space Grotesk', sans-serif;">Loading...</span>
    </div>

    <div style="width:90%; max-width:420px; text-align:center;">
      <div id="audioStatus" style="color:rgba(255,255,255,0.7); margin-bottom:24px;">Loading audio...</div>

      <div id="audioControls" style="display:none;">
        <div style="display:flex; align-items:center; justify-content:center; gap:24px; margin-bottom:20px;">
          <span class="material-icons" id="audioSkipBack" style="cursor:pointer; font-size:28px;">skip_previous</span>
          <span class="material-icons" id="audioPlayPause" style="cursor:pointer; font-size:44px;">play_arrow</span>
          <span class="material-icons" id="audioSkipForward" style="cursor:pointer; font-size:28px;">skip_next</span>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
          <span id="audioCurrentTime" style="font-size:12px; color:rgba(255,255,255,0.7);">0:00</span>
          <div style="flex:1; height:4px; background:#DCE8FF; border-radius:2px; position:relative;">
            <div id="audioProgressFill" style="height:4px; background:#FF6B35; border-radius:2px; width:0%;"></div>
          </div>
          <span id="audioDuration" style="font-size:12px; color:rgba(255,255,255,0.7);">0:00</span>
        </div>

        <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
          <span class="material-icons" style="font-size:18px;">volume_up</span>
          <input type="range" id="audioVolume" min="0" max="1" step="0.05" value="1" style="width:100px;" />
          <select id="audioSpeed" style="background:transparent; color:#FFFFFF; border:1px solid rgba(255,255,255,0.4); border-radius:6px; padding:4px 8px;">
            <option value="0.75">0.75x</option>
            <option value="1" selected>1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function openAudioPlayer(productId) {
  const overlay = buildShell();
  const titleEl = overlay.querySelector("#viewerTitle");
  const statusEl = overlay.querySelector("#audioStatus");
  const controls = overlay.querySelector("#audioControls");

  overlay.querySelector("#viewerCloseBtn").addEventListener("click", () => {
    audio?.pause();
    overlay.remove();
  });

  const { auth } = await getFirebase();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    statusEl.textContent = "Please log in to view this content.";
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
      statusEl.textContent = result.error || "Access denied.";
      return;
    }

    fileUrl = result.fileUrl;
    titleEl.textContent = result.title || "Audio";
  } catch (error) {
    statusEl.textContent = "Could not verify access. Please try again.";
    return;
  }

  const audio = new Audio(fileUrl);
  statusEl.style.display = "none";
  controls.style.display = "block";

  const playPauseBtn = overlay.querySelector("#audioPlayPause");
  const progressFill = overlay.querySelector("#audioProgressFill");
  const currentTimeEl = overlay.querySelector("#audioCurrentTime");
  const durationEl = overlay.querySelector("#audioDuration");

  playPauseBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
      playPauseBtn.textContent = "pause";
    } else {
      audio.pause();
      playPauseBtn.textContent = "play_arrow";
    }
  });

  overlay.querySelector("#audioSkipBack").addEventListener("click", () => {
    audio.currentTime = Math.max(0, audio.currentTime - 15);
  });

  overlay.querySelector("#audioSkipForward").addEventListener("click", () => {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
  });

  overlay.querySelector("#audioVolume").addEventListener("input", (e) => {
    audio.volume = Number(e.target.value);
  });

  overlay.querySelector("#audioSpeed").addEventListener("change", (e) => {
    audio.playbackRate = Number(e.target.value);
  });

  audio.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    currentTimeEl.textContent = formatTime(audio.currentTime);
    const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progressFill.style.width = `${percent}%`;
  });

  audio.addEventListener("ended", () => {
    playPauseBtn.textContent = "play_arrow";
  });
}
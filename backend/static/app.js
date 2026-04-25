const BACKEND_URL = "http://127.0.0.1:5000";
const FACE_URL = "http://127.0.0.1:5001";

let currentMode = null;
let userId = "user_" + Math.random().toString(36).slice(2, 8);
let sessionStartTime = null;
let messageCount = 0;
let detectedEmotions = [];
let moodTimeline = [];
let facePollTimer = null;
let faceAnalyzeTimer = null;
let cameraStream = null;
let combinedCameraStream = null;
let moodChart = null;
let lastFaceEmotion = "-";
let lastTextEmotion = "-";
let lastFinalEmotion = "-";

let cameraAutoFrame = { tx: 0, ty: 0, scale: 1 };
let combinedAutoFrame = { tx: 0, ty: 0, scale: 1 };

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let activeRecordingTarget = "chat";
let isAnalyzingFace = false;

let lastTrackedFaceEmotion = null;
let lastTrackedFaceEmotionTime = 0;

let smoothYaw = 0;
let smoothPitch = 0;
let combinedSmoothYaw = 0;
let combinedSmoothPitch = 0;
let targetYaw = 0;
let targetPitch = 0;
let combinedTargetYaw = 0;
let combinedTargetPitch = 0;
let gazeAnimationStarted = false;

const moodScoreMap = {
  joy: 5,
  surprise: 4,
  neutral: 3,
  fear: 2,
  sadness: 1,
  disgust: 1,
  anger: 1,
  happy: 5,
  sad: 1
};

document.addEventListener("DOMContentLoaded", () => {
  const startSessionBtn = document.getElementById("start-session-btn");
  if (startSessionBtn) {
    startSessionBtn.addEventListener("click", () => showScreen("screen-mode"));
  }

  document.querySelectorAll("[data-back='welcome']").forEach(btn => {
    btn.addEventListener("click", () => showScreen("screen-welcome"));
  });

  document.querySelectorAll(".mode-card").forEach(card => {
    card.addEventListener("click", () => startMode(card.dataset.mode));
  });

  const sessionBackBtn = document.getElementById("session-back-btn");
  if (sessionBackBtn) sessionBackBtn.addEventListener("click", endSession);

  const finishBtn = document.getElementById("finish-btn");
  if (finishBtn) finishBtn.addEventListener("click", finishSummary);

  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) sendBtn.addEventListener("click", () => sendChat("chat"));

  const combinedSendBtn = document.getElementById("combined-send-btn");
  if (combinedSendBtn) combinedSendBtn.addEventListener("click", () => sendChat("combined"));

  const recordBtn = document.getElementById("record-btn");
  if (recordBtn) recordBtn.addEventListener("click", () => toggleVoiceRecording("chat"));

  const cameraRecordBtn = document.getElementById("camera-record-btn");
  if (cameraRecordBtn) cameraRecordBtn.addEventListener("click", () => toggleVoiceRecording("camera"));

  const combinedRecordBtn = document.getElementById("combined-record-btn");
  if (combinedRecordBtn) combinedRecordBtn.addEventListener("click", () => toggleVoiceRecording("combined"));

  const startCameraBtn = document.getElementById("start-camera-btn");
  if (startCameraBtn) {
    startCameraBtn.addEventListener("click", async () => {
      await startCameraFrontend();
      await manualStartCamera();
      startFaceStreaming("camera-video");
    });
  }

  const stopCameraBtn = document.getElementById("stop-camera-btn");
  if (stopCameraBtn) {
    stopCameraBtn.addEventListener("click", async () => {
      stopFaceStreaming();
      stopAllFrontendVideo();
      await manualStopCamera();
      resetFacePanel();
    });
  }

  const combinedStartCameraBtn = document.getElementById("combined-start-camera-btn");
  if (combinedStartCameraBtn) {
    combinedStartCameraBtn.addEventListener("click", async () => {
      await startCombinedCameraFrontend();
      await manualStartCamera();
      startFaceStreaming("combined-camera-video");
    });
  }

  const combinedStopCameraBtn = document.getElementById("combined-stop-camera-btn");
  if (combinedStopCameraBtn) {
    combinedStopCameraBtn.addEventListener("click", async () => {
      stopFaceStreaming();
      stopAllFrontendVideo();
      await manualStopCamera();
      resetFacePanel();
    });
  }

  const endSessionBtn = document.getElementById("end-session-btn");
  if (endSessionBtn) endSessionBtn.addEventListener("click", endSession);

  document.querySelectorAll(".suggestion-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (currentMode === "combined") {
        const combinedInput = document.getElementById("combined-message-input");
        if (combinedInput) combinedInput.value = chip.textContent;
      } else if (currentMode === "chat") {
        const chatInput = document.getElementById("message-input");
        if (chatInput) chatInput.value = chip.textContent;
      }
    });
  });

  const messageInput = document.getElementById("message-input");
  if (messageInput) {
    messageInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat("chat");
      }
    });
  }

  const combinedMessageInput = document.getElementById("combined-message-input");
  if (combinedMessageInput) {
    combinedMessageInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat("combined");
      }
    });
  }

  startGazeAnimationLoop();

    const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
        userDropdown.classList.add("hidden");
      }
    });
  }
});

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}
function updateSessionHeader(mode) {
  const titleEl = document.getElementById("session-title");
  const subtitleEl = document.getElementById("session-subtitle");
  const statusEl = document.querySelector(".session-status");

  if (titleEl) {
    if (mode === "camera") titleEl.textContent = "Camera Mode";
    else if (mode === "chat") titleEl.textContent = "Chat Mode";
    else titleEl.textContent = "Combined Mode";
  }

  if (subtitleEl) subtitleEl.style.display = "none";
  if (statusEl) statusEl.style.display = "none";
}
function startMode(mode) {
  lastFaceEmotion = "-";
  lastTextEmotion = "-";
  lastFinalEmotion = "-";
  currentMode = mode;
  sessionStartTime = Date.now();
  updateSessionHeader(mode);
  messageCount = 0;
  detectedEmotions = [];
  moodTimeline = [];
  lastTrackedFaceEmotion = null;
  lastTrackedFaceEmotionTime = 0;

  const chatBox = document.getElementById("chat-box");
  if (chatBox) {
    chatBox.innerHTML = `
      <div class="msg bot">
        <div class="msg-label">AI Therapist</div>
        <div class="msg-bubble">Hello, Im here for you. How are you feeling today?</div>
      </div>
    `;
  }

  const combinedChatBox = document.getElementById("combined-chat-box");
  if (combinedChatBox) {
    combinedChatBox.innerHTML = `
      <div class="msg bot">
        <div class="msg-label">AI Therapist</div>
        <div class="msg-bubble">Hello, Im here for you. How are you feeling today?</div>
      </div>
    `;
  }

  hideAllModeLayouts();
  stopFaceStreaming();
  stopAllFrontendVideo();

  if (mode === "camera") {
    document.getElementById("session-title").textContent = "Camera Mode";
    //document.getElementById("session-subtitle").textContent = "Face emotion + voice session";
    document.getElementById("camera-mode-layout").classList.remove("hidden");

    resetFacePanel();
    resetCameraResponsePanel();

    startCameraFrontend().then(() => {
      manualStartCamera().then(() => {
        setTimeout(() => startFaceStreaming("camera-video"), 300);
      });
    });
  } else if (mode === "chat") {
    document.getElementById("session-title").textContent = "Chat Mode";
    //document.getElementById("session-subtitle").textContent = "Text therapy session";
    document.getElementById("chat-mode-layout").classList.remove("hidden");

    resetChatMeta();
    manualStopCamera();
  } else {
    document.getElementById("session-title").textContent = "Combined Mode";
    //document.getElementById("session-subtitle").textContent = "Face + text multimodal session";
    document.getElementById("combined-mode-layout").classList.remove("hidden");

    resetCombinedMeta();
    resetFacePanel();

    startCombinedCameraFrontend().then(() => {
      manualStartCamera().then(() => {
        setTimeout(() => startFaceStreaming("combined-camera-video"), 300);
      });
    });
  }

  showScreen("screen-session");
}

function hideAllModeLayouts() {
  document.getElementById("camera-mode-layout").classList.add("hidden");
  document.getElementById("chat-mode-layout").classList.add("hidden");
  document.getElementById("combined-mode-layout").classList.add("hidden");
}

async function endSession() {
  stopFacePolling();
  stopFaceStreaming();
  stopAllFrontendVideo();
  manualStopCamera();

  buildSummary();
  await saveSessionSummary();

  showScreen("screen-summary");
}

function finishSummary() {
  if (moodChart) {
    moodChart.destroy();
    moodChart = null;
  }

  currentMode = null;
  window.location.href = `${BACKEND_URL}/session-history`;
}

/* ---------------- Frontend video ---------------- */

async function startCameraFrontend() {
  try {
    if (cameraStream) return;

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    const video = document.getElementById("camera-video");
    if (video) {
      video.srcObject = cameraStream;
      await video.play();
    }
  } catch (err) {
    console.error("Camera preview error:", err);
  }
}

async function startCombinedCameraFrontend() {
  try {
    if (combinedCameraStream) return;

    combinedCameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    const video = document.getElementById("combined-camera-video");
    if (video) {
      video.srcObject = combinedCameraStream;
      await video.play();
    }
  } catch (err) {
    console.error("Combined camera preview error:", err);
  }
}

function stopAllFrontendVideo() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (combinedCameraStream) {
    combinedCameraStream.getTracks().forEach(track => track.stop());
    combinedCameraStream = null;
  }

  const v1 = document.getElementById("camera-video");
  const v2 = document.getElementById("combined-camera-video");

  if (v1) {
    v1.pause();
    v1.srcObject = null;
  }

  if (v2) {
    v2.pause();
    v2.srcObject = null;
  }

  resetVideoTransform("camera-video");
  resetVideoTransform("combined-camera-video");

  cameraAutoFrame = { tx: 0, ty: 0, scale: 1 };
  combinedAutoFrame = { tx: 0, ty: 0, scale: 1 };

  targetYaw = 0;
  targetPitch = 0;
  combinedTargetYaw = 0;
  combinedTargetPitch = 0;
}

/* ---------------- Helpers ---------------- */

function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetVideoTransform(videoId) {
  const video = document.getElementById(videoId);
  if (!video) return;

  video.style.transformOrigin = "center center";
  video.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
}

function applyAutoCentering(data, videoId, stateObj) {
  const video = document.getElementById(videoId);
  if (!video) return;

  const sourceW = video.videoWidth || 640;
  const sourceH = video.videoHeight || 480;
  const viewW = video.clientWidth || sourceW;
  const viewH = video.clientHeight || sourceH;

  if (!data || !data.face_detected || !data.face_box) {
    stateObj.tx = lerp(stateObj.tx, 0, 0.22);
    stateObj.ty = lerp(stateObj.ty, 0, 0.22);
    stateObj.scale = lerp(stateObj.scale, 1, 0.18);

    video.style.transformOrigin = "top left";
    video.style.transform = `translate3d(${stateObj.tx}px, ${stateObj.ty}px, 0) scale(${stateObj.scale})`;
    return;
  }

  const [faceX, faceY, faceW, faceH] = data.face_box;

  const zoom = 1.75;
  const cx = faceX + faceW / 2;
  const cy = faceY + faceH / 2;

  let cropW = faceW * zoom;
  let cropH = faceH * zoom;

  const targetAspect = viewW / viewH;
  const cropAspect = cropW / cropH;

  if (cropAspect > targetAspect) {
    cropH = cropW / targetAspect;
  } else {
    cropW = cropH * targetAspect;
  }

  let xStart = cx - cropW / 2;
  let yStart = cy - cropH / 2;
  let xEnd = cx + cropW / 2;
  let yEnd = cy + cropH / 2;

  if (xStart < 0) {
    xEnd -= xStart;
    xStart = 0;
  }
  if (yStart < 0) {
    yEnd -= yStart;
    yStart = 0;
  }
  if (xEnd > sourceW) {
    const overflow = xEnd - sourceW;
    xStart -= overflow;
    xEnd = sourceW;
  }
  if (yEnd > sourceH) {
    const overflow = yEnd - sourceH;
    yStart -= overflow;
    yEnd = sourceH;
  }

  xStart = Math.max(0, xStart);
  yStart = Math.max(0, yStart);
  xEnd = Math.min(sourceW, xEnd);
  yEnd = Math.min(sourceH, yEnd);

  const finalCropW = Math.max(1, xEnd - xStart);
  const targetScale = sourceW / finalCropW;

  const targetTx = -(xStart / sourceW) * viewW * targetScale;
  const targetTy = -(yStart / sourceH) * viewH * targetScale;

  stateObj.tx = lerp(stateObj.tx, targetTx, 0.32);
  stateObj.ty = lerp(stateObj.ty, targetTy, 0.32);
  stateObj.scale = lerp(stateObj.scale, targetScale, 0.24);

  video.style.transformOrigin = "top left";
  video.style.transform = `translate3d(${stateObj.tx}px, ${stateObj.ty}px, 0) scale(${stateObj.scale})`;
}

/* ---------------- Gaze canvas overlay ---------------- */

function startGazeAnimationLoop() {
  if (gazeAnimationStarted) return;
  gazeAnimationStarted = true;

  function animate() {
    smoothYaw = lerp(smoothYaw, targetYaw, 0.18);
    smoothPitch = lerp(smoothPitch, targetPitch, 0.18);

    combinedSmoothYaw = lerp(combinedSmoothYaw, combinedTargetYaw, 0.18);
    combinedSmoothPitch = lerp(combinedSmoothPitch, combinedTargetPitch, 0.18);

    drawGazeWidget("gaze-canvas-overlay", smoothYaw, smoothPitch);
    drawGazeWidget("combined-gaze-canvas-overlay", combinedSmoothYaw, combinedSmoothPitch);

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

function drawGazeWidget(canvasId, yaw, pitch) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 34);
  ctx.lineTo(cx, cy + 34);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 34, cy);
  ctx.lineTo(cx + 34, cy);
  ctx.stroke();

  const gx = clamp(yaw, -0.6, 0.6);
  const gy = clamp(pitch, -0.6, 0.6);

  const scale = 46;
  const endX = cx + gx * scale;
  const endY = cy + gy * scale;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fill();

  drawCanvasArrow(ctx, cx, cy, endX, endY);
}

function drawCanvasArrow(ctx, fromX, fromY, toX, toY) {
  const headLength = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = "#ffd84d";
  ctx.fillStyle = "#ffd84d";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

/* ---------------- Face frame streaming ---------------- */

function startFaceStreaming(videoId = "camera-video") {
  stopFaceStreaming();

  const video = document.getElementById(videoId);
  if (!video) return;

  faceAnalyzeTimer = setInterval(async () => {
    if (isAnalyzingFace) return;

    try {
      if (!video.videoWidth || !video.videoHeight) return;

      isAnalyzingFace = true;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      const image = canvas.toDataURL("image/jpeg", 0.7);

      const res = await fetch(`${FACE_URL}/analyze_face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image })
      });

      const data = await res.json();
      renderFaceState(data);
    } catch (err) {
      console.error("Face error:", err);
    } finally {
      isAnalyzingFace = false;
    }
  }, 120);
}

function stopFaceStreaming() {
  if (faceAnalyzeTimer) {
    clearInterval(faceAnalyzeTimer);
    faceAnalyzeTimer = null;
  }
  isAnalyzingFace = false;
}

/* ---------------- Camera service ---------------- */

async function manualStartCamera() {
  try {
    await fetch(`${FACE_URL}/start_camera`);
  } catch (err) {
    console.error("Start camera service error:", err);
  }
}

async function manualStopCamera() {
  try {
    await fetch(`${FACE_URL}/stop_camera`);
  } catch (err) {
    console.error("Stop camera service error:", err);
  }
}

/* kept only for compatibility */
function startFacePolling() {
  stopFacePolling();
}

function stopFacePolling() {
  if (facePollTimer) {
    clearInterval(facePollTimer);
    facePollTimer = null;
  }
}

function renderFaceState(data) {
  renderCameraFaceState(data);
  renderCombinedFaceState(data);
}

function trackFaceEmotionForSummary(emotion) {
  const e = (emotion || "neutral").toLowerCase();
  const now = Date.now();

  if (!e || e === "-" || e === "unknown") return;

  if (lastTrackedFaceEmotion === e && (now - lastTrackedFaceEmotionTime) < 3000) {
    return;
  }

  lastTrackedFaceEmotion = e;
  lastTrackedFaceEmotionTime = now;

  detectedEmotions.push(e);
  moodTimeline.push(moodScoreMap[e] || 3);
}

function renderCameraFaceState(data) {
  const fd = document.getElementById("face-detected");
  const fc = document.getElementById("face-centered");
  const fdis = document.getElementById("face-distraction");
  const fy = document.getElementById("face-yaw");
  const fp = document.getElementById("face-pitch");

  if (fd) fd.textContent = data.face_detected ? "Yes" : "No";
  if (fc) fc.textContent = data.centered ? "Yes" : "No";
  if (fdis) fdis.textContent = data.distraction ?? "-";
  if (fy) fy.textContent = formatNumber(data.gaze_yaw);
  if (fp) fp.textContent = formatNumber(data.gaze_pitch);

  const emotion = data.face_emotion || "Neutral";
  const conf = data.emotion_confidence ?? 0;

  if (currentMode === "camera" && data.face_detected) {
    trackFaceEmotionForSummary(emotion);
  }

  const et = document.getElementById("face-emotion-text");
  const es = document.getElementById("face-emotion-score");
  const cfe = document.getElementById("camera-footer-emotion");
  const cfei = document.getElementById("camera-face-emotion-inline");

  if (et) et.textContent = capitalize(emotion);
  if (es) es.textContent = `${Math.round(conf * 100)}%`;
  if (cfe) cfe.textContent = capitalize(emotion);
  if (cfei) cfei.textContent = capitalize(emotion);

  const caption = buildFaceCaption(data);
  const cc = document.getElementById("camera-caption");
  const cfm = document.getElementById("camera-footer-message");

  if (cc) cc.textContent = caption;
  if (cfm) cfm.textContent = caption;

  setEmotionBadgeStyle("face-emotion-badge", emotion);
  targetYaw = -(data.gaze_yaw || 0);
  targetPitch = data.gaze_pitch || 0;
  applyAutoCentering(data, "camera-video", cameraAutoFrame);
}

function renderCombinedFaceState(data) {
  const emotion = data.face_emotion || "Neutral";
  const conf = data.emotion_confidence ?? 0;

  if (currentMode === "combined" && data.face_detected) {
    trackFaceEmotionForSummary(emotion);
  }

  const fd = document.getElementById("combined-face-detected");
  const fc = document.getElementById("combined-face-centered");
  const fdis = document.getElementById("combined-face-distraction");
  const fy = document.getElementById("combined-face-yaw");
  const fp = document.getElementById("combined-face-pitch");

  if (fd) fd.textContent = data.face_detected ? "Yes" : "No";
  if (fc) fc.textContent = data.centered ? "Yes" : "No";
  if (fdis) fdis.textContent = data.distraction ?? "-";
  if (fy) fy.textContent = formatNumber(data.gaze_yaw);
  if (fp) fp.textContent = formatNumber(data.gaze_pitch);

  const et = document.getElementById("combined-face-emotion-text");
  const es = document.getElementById("combined-face-emotion-score");
  const cfe = document.getElementById("combined-camera-footer-emotion");
  const cfei = document.getElementById("combined-face-emotion-inline");

  if (et) et.textContent = capitalize(emotion);
  if (es) es.textContent = `${Math.round(conf * 100)}%`;
  if (cfe) cfe.textContent = capitalize(emotion);
  if (cfei) cfei.textContent = capitalize(emotion);

  const caption = buildFaceCaption(data);
  const cc = document.getElementById("combined-camera-caption");
  const cfm = document.getElementById("combined-camera-footer-message");

  if (cc) cc.textContent = caption;
  if (cfm) cfm.textContent = caption;

  setEmotionBadgeStyle("combined-face-emotion-badge", emotion);
  combinedTargetYaw = -(data.gaze_yaw || 0);
  combinedTargetPitch = data.gaze_pitch || 0;
  applyAutoCentering(data, "combined-camera-video", combinedAutoFrame);
}

function buildFaceCaption(data) {
  if (!data.face_detected) return "No face detected. Please stay in frame.";
  if (data.distraction === "off_center") return "Please move back toward the center.";
  if (data.distraction === "distracted") return "You seem distracted. Try focusing on the screen.";
  if ((data.face_emotion || "").toLowerCase() === "sad") return "Take a deep breath. I'm here with you.";
  if ((data.face_emotion || "").toLowerCase() === "fear") return "You look uneasy. You're safe here.";
  if ((data.face_emotion || "").toLowerCase() === "happy") return "You seem more positive right now.";
  return "Monitoring face status.";
}

function setEmotionBadgeStyle(elementId, emotion) {
  const badge = document.getElementById(elementId);
  if (!badge) return;

  const e = (emotion || "neutral").toLowerCase();
  badge.style.background = "rgba(76, 174, 194, 0.94)";

  if (e === "sad" || e === "sadness") badge.style.background = "rgba(69, 132, 198, 0.95)";
  else if (e === "fear") badge.style.background = "rgba(126, 98, 199, 0.95)";
  else if (e === "anger") badge.style.background = "rgba(202, 92, 92, 0.95)";
  else if (e === "happy" || e === "joy") badge.style.background = "rgba(103, 176, 110, 0.95)";
}

function resetFacePanel() {
  const ids = [
    "face-detected", "face-centered", "face-distraction", "face-yaw", "face-pitch",
    "combined-face-detected", "combined-face-centered", "combined-face-distraction",
    "combined-face-yaw", "combined-face-pitch"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "-";
  });

  const textIds = [
    "face-emotion-text", "camera-footer-emotion", "camera-face-emotion-inline",
    "combined-face-emotion-text", "combined-camera-footer-emotion", "combined-face-emotion-inline"
  ];

  textIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "Neutral";
  });

  const scoreIds = ["face-emotion-score", "combined-face-emotion-score"];
  scoreIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0%";
  });

  const captionIds = [
    "camera-caption", "camera-footer-message",
    "combined-camera-caption", "combined-camera-footer-message"
  ];

  captionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "System is monitoring face status.";
  });
}

/* ---------------- Chat / combined text ---------------- */

async function sendChat(target) {
  const input = target === "combined"
    ? document.getElementById("combined-message-input")
    : document.getElementById("message-input");

  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  addMessage(target, "user", text);
  input.value = "";
  messageCount += 1;
  showTyping(target, true);

  try {
    const res = await fetch(`${BACKEND_URL}/chat_fused`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, message: text })
    });

    const data = await res.json();
    showTyping(target, false);

    renderResponseMetadata(target, data);
    trackEmotion(data.final_emotion || data.text_emotion || "neutral");
    addMessage(target, "bot", data.response || "No response returned.");
  } catch (err) {
    showTyping(target, false);
    addMessage(target, "bot", "Im having trouble reaching the backend right now.");
  }
}

function addMessage(target, role, text) {
  const chatBox = target === "combined"
    ? document.getElementById("combined-chat-box")
    : document.getElementById("chat-box");

  if (!chatBox) return;

  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  wrap.innerHTML = `
    <div class="msg-label">${role === "user" ? "User" : "AI Therapist"}</div>
    <div class="msg-bubble">${text}</div>
  `;

  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping(target, show) {
  const el = target === "combined"
    ? document.getElementById("combined-typing-indicator")
    : document.getElementById("typing-indicator");

  if (el) el.classList.toggle("hidden", !show);
}

function renderResponseMetadata(target, data) {
  if (data.face_emotion) lastFaceEmotion = capitalize(data.face_emotion);
  if (data.text_emotion) lastTextEmotion = capitalize(data.text_emotion);
  if (data.final_emotion) lastFinalEmotion = capitalize(data.final_emotion);
  if (target === "camera") {
    const te = document.getElementById("camera-text-emotion");
    const fe = document.getElementById("camera-face-emotion-inline");
    const fin = document.getElementById("camera-final-emotion");
    const tr = document.getElementById("camera-transcript");
    const rep = document.getElementById("camera-reply");
    const cap = document.getElementById("camera-caption");

    if (te) te.textContent = capitalize(data.text_emotion || "-");
    if (fe) fe.textContent = capitalize(data.face_emotion || "-");
    if (fin) fin.textContent = capitalize(data.final_emotion || "-");
    if (tr) tr.textContent = data.text || "No transcript";
    if (rep) rep.textContent = data.response || "No response";
    if (cap) cap.textContent = data.text || "Waiting for voice input...";
  } else if (target === "combined") {
    const te = document.getElementById("combined-text-emotion");
    const fe = document.getElementById("combined-face-emotion-inline");
    const fin = document.getElementById("combined-final-emotion");

    if (te) te.textContent = capitalize(data.text_emotion || "-");
    if (fe) fe.textContent = capitalize(data.face_emotion || "-");
    if (fin) fin.textContent = capitalize(data.final_emotion || "-");
  } else {
    const te = document.getElementById("text-emotion");
    if (te) te.textContent = capitalize(data.text_emotion || "-");
  }
}

function resetChatMeta() {
  const el = document.getElementById("text-emotion");
  if (el) el.textContent = "-";
}

function resetCameraResponsePanel() {
  const ids = [
    ["camera-text-emotion", "-"],
    ["camera-face-emotion-inline", "-"],
    ["camera-final-emotion", "-"],
    ["camera-transcript", "No speech recorded yet."],
    ["camera-reply", "Your response will appear here after recording."]
  ];

  ids.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function resetCombinedMeta() {
  const ids = ["combined-text-emotion", "combined-face-emotion-inline", "combined-final-emotion"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "-";
  });
}

/* ---------------- Voice recording ---------------- */

async function toggleVoiceRecording(target) {
  if (isRecording) {
    mediaRecorder.stop();
    return;
  }

  activeRecordingTarget = target;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      updateRecordingUI(target, false, "Transcribing voice...");

      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const file = new File([audioBlob], "recorded_voice.webm", { type: "audio/webm" });

      await sendVoiceFile(target, file);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    updateRecordingUI(target, true, "Recording voice...");
  } catch (err) {
    console.error("Mic error:", err);
  }
}

function updateRecordingUI(target, recording, customText = null) {
  const map = {
    chat: {
      btn: document.getElementById("record-btn"),
      status: document.getElementById("recording-status")
    },
    camera: {
      btn: document.getElementById("camera-record-btn"),
      status: document.getElementById("camera-recording-status")
    },
    combined: {
      btn: document.getElementById("combined-record-btn"),
      status: document.getElementById("combined-recording-status")
    }
  };

  const ui = map[target];
  if (!ui) return;

  if (recording) {
    ui.btn.textContent = "⏹";
    ui.status.textContent = customText || "Recording voice...";
    ui.status.classList.remove("hidden");
  } else {
    ui.btn.textContent = "🎤";
    if (customText) {
      ui.status.textContent = customText;
      ui.status.classList.remove("hidden");
    } else {
      ui.status.classList.add("hidden");
    }
  }
}

async function sendVoiceFile(target, file) {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("audio", file);

  if (target === "camera") {
    const tr = document.getElementById("camera-transcript");
    const rep = document.getElementById("camera-reply");
    if (tr) tr.textContent = "Transcribing voice...";
    if (rep) rep.textContent = "Thinking...";
  } else {
    addMessage(target, "user", "[Voice message]");
  }

  messageCount += 1;
  showTyping(target === "camera" ? "chat" : target, true);

  try {
    const res = await fetch(`${BACKEND_URL}/voice_fused`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    showTyping(target === "camera" ? "chat" : target, false);
    updateRecordingUI(target, false, null);

    if (target === "camera") {
      renderResponseMetadata("camera", data);
    } else {
      const targetBox = target === "combined"
        ? document.getElementById("combined-chat-box")
        : document.getElementById("chat-box");

      if (data.text && targetBox) {
        const lastUserMsg = targetBox.querySelector(".msg.user:last-child .msg-bubble");
        if (lastUserMsg) lastUserMsg.textContent = data.text;
      }

      renderResponseMetadata(target, data);
      addMessage(target, "bot", data.response || "No response returned.");
    }

    trackEmotion(data.final_emotion || data.text_emotion || "neutral");
  } catch (err) {
    showTyping(target === "camera" ? "chat" : target, false);
    updateRecordingUI(target, false, null);

    if (target === "camera") {
      const rep = document.getElementById("camera-reply");
      const tr = document.getElementById("camera-transcript");
      if (rep) rep.textContent = "Voice processing failed.";
      if (tr) tr.textContent = "Could not transcribe voice.";
    } else {
      addMessage(target, "bot", "Voice processing failed.");
    }

    console.error("Voice error:", err);
  }
}

async function saveSessionSummary() {
  const durationMin = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000));

  const payload = {
    mode: currentMode || "unknown",
    duration_min: durationMin,
    message_count: messageCount || 0,
    detected_emotions: detectedEmotions || [],
    mood_timeline: moodTimeline || [],
    face_emotion: lastFaceEmotion || "-",
    text_emotion: lastTextEmotion || "-",
    final_emotion: lastFinalEmotion || "-"
  };

  try {
    const res = await fetch(`${BACKEND_URL}/save_session_summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Session saved:", data);
  } catch (err) {
    console.error("Session save error:", err);
  }
}
/* ---------------- Summary ---------------- */

function trackEmotion(emotion) {
  const e = (emotion || "neutral").toLowerCase();
  detectedEmotions.push(e);
  moodTimeline.push(moodScoreMap[e] || 3);
}

function buildSummary() {
  const durationMin = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000));
  document.getElementById("summary-duration").textContent = `${durationMin} min`;
  document.getElementById("summary-messages").textContent = String(messageCount || 0);

  const now = new Date();
  document.getElementById("summary-date").textContent = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const combinedSummaryBlock = document.getElementById("combined-summary-block");
  const sf = document.getElementById("summary-face");
  const st = document.getElementById("summary-text");
  const sfi = document.getElementById("summary-final");

  if (currentMode === "combined") {
    if (combinedSummaryBlock) combinedSummaryBlock.classList.remove("hidden");
    if (sf) sf.textContent = lastFaceEmotion;
    if (st) st.textContent = lastTextEmotion;
    if (sfi) sfi.textContent = lastFinalEmotion;
  } else {
    if (combinedSummaryBlock) combinedSummaryBlock.classList.add("hidden");
    if (sf) sf.textContent = "-";
    if (st) st.textContent = "-";
    if (sfi) sfi.textContent = "-";
  }

  buildEmotionPills();
  buildMoodChart();

  const quotes = [
    "Great job today. See you next time!",
    "You took an important step by showing up today.",
    "Every honest conversation is progress.",
    "Your feelings matter, and you gave them space today."
  ];

  document.getElementById("summary-quote").textContent =
    quotes[Math.floor(Math.random() * quotes.length)];
}

function buildEmotionPills() {
  const container = document.getElementById("summary-emotions");
  container.innerHTML = "";
  const unique = [...new Set(detectedEmotions)];
  const list = unique.length ? unique : ["neutral"];

  list.forEach(emotion => {
    const pill = document.createElement("div");
    pill.className = `emotion-pill ${pillClass(emotion)}`;
    pill.textContent = capitalize(emotion);
    container.appendChild(pill);
  });
}

function buildMoodChart() {
  const ctx = document.getElementById("mood-chart");
  if (moodChart) moodChart.destroy();

  const data = moodTimeline.length > 1 ? moodTimeline : [3, 3];

  moodChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [{
        data,
        borderColor: "#4eb6bf",
        backgroundColor: "rgba(78,182,191,0.14)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "#4eb6bf"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          min: 0,
          max: 6,
          ticks: { display: false },
          grid: { color: "rgba(0,0,0,0.05)" }
        }
      }
    }
  });
}

/* ---------------- Utils ---------------- */

function capitalize(str) {
  if (!str || str === "-") return "-";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatNumber(v) {
  if (v === null || v === undefined) return "-";
  return Number(v).toFixed(2);
}

function pillClass(emotion) {
  switch ((emotion || "").toLowerCase()) {
    case "joy":
    case "happy":
      return "pill-joy";
    case "sad":
    case "sadness":
      return "pill-sadness";
    case "fear":
      return "pill-fear";
    case "anger":
      return "pill-anger";
    case "neutral":
      return "pill-neutral";
    case "surprise":
      return "pill-surprise";
    case "disgust":
      return "pill-disgust";
    default:
      return "pill-neutral";
  }
}

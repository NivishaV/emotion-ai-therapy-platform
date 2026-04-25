from flask import Flask, jsonify, request
from flask_cors import CORS

import cv2
import torch
import numpy as np
import time
import base64
from collections import deque, Counter

from openface.face_detection import FaceDetector
from openface.landmark_detection import LandmarkDetector
from openface.multitask_model import MultitaskPredictor

app = Flask(__name__)
CORS(app)

# ---------------------------
# DEVICE
# ---------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", device)

# ---------------------------
# MODELS
# ---------------------------
face_detector = FaceDetector(
    model_path="../weights/Alignment_RetinaFace.pth",
    device=device
)

landmark_detector = LandmarkDetector(
    model_path="../weights/Landmark_98.pkl",
    device=device,
    device_ids=[0] if device == "cuda" else [-1]
)

predictor = MultitaskPredictor(
    model_path="../weights/MTL_backbone.pth",
    device=device
)

if hasattr(predictor, "model"):
    predictor.model = predictor.model.to(device)

emotion_labels = [
    "Neutral", "Happy", "Sad", "Surprise",
    "Fear", "Disgust", "Anger", "Contempt"
]

# ---------------------------
# STATE
# ---------------------------
latest_face_state = {
    "face_detected": False,
    "face_emotion": "Neutral",
    "raw_emotion": "Neutral",
    "emotion_confidence": 0.0,
    "gaze_yaw": 0.0,
    "gaze_pitch": 0.0,
    "centered": True,
    "distraction": "unknown",
    "face_box": None,
    "timestamp": None
}

# ---------------------------
# STABILIZATION
# ---------------------------
emotion_buffer = deque(maxlen=4)
stable_emotion = "Neutral"
last_update_time = time.time()
cooldown = 0.7

smooth_x, smooth_y, smooth_w, smooth_h = 0, 0, 0, 0
alpha = 0.55

# ---------------------------
# SAFE IMAGE DECODE
# ---------------------------
def decode_base64_image(image_data):
    try:
        if not image_data:
            return None

        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        img_bytes = base64.b64decode(image_data)
        np_arr = np.frombuffer(img_bytes, np.uint8)

        if np_arr.size == 0:
            return None

        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None or len(frame.shape) != 3:
            return None

        return frame

    except Exception as e:
        print("Decode error:", e)
        return None


# ---------------------------
# HELPERS
# ---------------------------
def update_stable_emotion(raw_emotion, confidence):
    global stable_emotion, last_update_time

    if confidence >= 0.35:
        emotion_buffer.append(raw_emotion)

    if not emotion_buffer:
        return stable_emotion

    most_common = Counter(emotion_buffer).most_common(1)[0][0]
    now = time.time()

    if most_common != stable_emotion and (now - last_update_time) > cooldown:
        stable_emotion = most_common
        last_update_time = now

    return stable_emotion


def classify_attention(yaw, pitch, dx, dy):
    if abs(dx) > 120 or abs(dy) > 100:
        return "off_center"

    if abs(yaw) > 0.4 or abs(pitch) > 0.4:
        return "distracted"

    return "focused"


def choose_best_detection(dets, w, h):
    best = None
    best_area = 0

    if dets is None:
        return None

    for d in dets:
        if len(d) < 5:
            continue

        score = float(d[4])
        if score < 0.75:
            continue

        x1, y1, x2, y2 = map(int, d[:4])

        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)

        fw, fh = x2 - x1, y2 - y1
        if fw < 60 or fh < 60:
            continue

        area = fw * fh

        if area > best_area:
            best_area = area
            best = (x1, y1, x2, y2, score)

    return best


# ---------------------------
# MAIN ANALYSIS
# ---------------------------
def analyze_frame(frame):
    global smooth_x, smooth_y, smooth_w, smooth_h

    h, w = frame.shape[:2]

    # -------- FACE DETECTION --------
    try:
        temp_path = "temp.png"
        cv2.imwrite(temp_path, frame)  # PNG (stable, no JPEG errors)
        _, dets = face_detector.get_face(temp_path)
    except Exception as e:
        print("FaceDetector error:", e)
        return latest_face_state

    best = choose_best_detection(dets, w, h)

    if best is None:
        latest_face_state.update({
            "face_detected": False,
            "timestamp": time.time()
        })
        return latest_face_state

    x1, y1, x2, y2, conf = best
    fw, fh = x2 - x1, y2 - y1

    # -------- SMOOTHING --------
    if smooth_w == 0:
        smooth_x, smooth_y, smooth_w, smooth_h = x1, y1, fw, fh
    else:
        smooth_x = int(alpha * x1 + (1 - alpha) * smooth_x)
        smooth_y = int(alpha * y1 + (1 - alpha) * smooth_y)
        smooth_w = int(alpha * fw + (1 - alpha) * smooth_w)
        smooth_h = int(alpha * fh + (1 - alpha) * smooth_h)

    sx1 = max(0, smooth_x)
    sy1 = max(0, smooth_y)
    sx2 = min(w, smooth_x + smooth_w)
    sy2 = min(h, smooth_y + smooth_h)

    face_crop = frame[sy1:sy2, sx1:sx2]

    if face_crop.size == 0:
        latest_face_state["face_detected"] = False
        return latest_face_state

    # -------- MODEL --------
    try:
        with torch.no_grad():
            emotion_logits, gaze, au = predictor.predict(face_crop)

        probs = torch.softmax(emotion_logits, dim=1)
        idx = torch.argmax(probs).item()

        raw_emotion = emotion_labels[idx]
        conf = float(probs[0][idx].item())

        yaw = float(gaze[0][0].item())
        pitch = float(gaze[0][1].item())

    except Exception as e:
        print("Predict error:", e)
        return latest_face_state

    final_emotion = update_stable_emotion(raw_emotion, conf)

    # -------- CENTER --------
    cx, cy = (sx1 + sx2) // 2, (sy1 + sy2) // 2
    dx, dy = cx - w // 2, cy - h // 2

    centered = abs(dx) < 100 and abs(dy) < 80
    distraction = classify_attention(yaw, pitch, dx, dy)

    latest_face_state.update({
    "face_detected": True,
    "face_emotion": final_emotion,
    "raw_emotion": raw_emotion,
    "emotion_confidence": round(conf, 3),
    "gaze_yaw": round(yaw, 3),
    "gaze_pitch": round(pitch, 3),
    "centered": centered,
    "distraction": distraction,
    "face_box": [sx1, sy1, sx2 - sx1, sy2 - sy1],
    "timestamp": time.time()
})

    return latest_face_state


# ---------------------------
# API
# ---------------------------
@app.route("/")
def home():
    return "Face Service Running"

@app.route("/start_camera", methods=["GET"])
def start_camera():
    return jsonify({"status": "camera service ready"})

@app.route("/stop_camera", methods=["GET"])
def stop_camera():
    return jsonify({"status": "camera service stopped"})

@app.route("/face_status", methods=["GET"])
def face_status():
    return jsonify(latest_face_state)

@app.route("/analyze_face", methods=["POST"])
def analyze_face():
    data = request.get_json()

    frame = decode_base64_image(data.get("image"))

    if frame is None:
        return jsonify({
            **latest_face_state,
            "face_detected": False
        })

    result = analyze_frame(frame)
    return jsonify(result)

# ---------------------------
# RUN
# ---------------------------
if __name__ == "__main__":
    app.run(port=5001, debug=False)
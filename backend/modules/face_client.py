import requests

FACE_SERVICE_URL = "http://127.0.0.1:5001/face_status"

def get_latest_face_state():
    try:
        response = requests.get(FACE_SERVICE_URL, timeout=3)
        response.raise_for_status()
        data = response.json()
        return data
    except Exception as e:
        print("Face service error:", e)
        return {
            "face_detected": False,
            "face_emotion": "Neutral",
            "emotion_confidence": 0.0,
            "gaze_yaw": 0.0,
            "gaze_pitch": 0.0,
            "centered": True,
            "distraction": "unknown",
            "face_box": None,
            "timestamp": None
        }
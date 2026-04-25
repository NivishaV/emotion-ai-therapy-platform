def normalize_face_emotion(face_emotion: str) -> str:
    if not face_emotion:
        return "neutral"

    e = face_emotion.strip().lower()

    mapping = {
        "neutral": "neutral",
        "happy": "joy",
        "joy": "joy",
        "sad": "sadness",
        "sadness": "sadness",
        "fear": "fear",
        "angry": "anger",
        "anger": "anger",
        "disgust": "disgust",
        "surprise": "surprise",
        "contempt": "neutral"
    }

    return mapping.get(e, "neutral")


def fuse_modalities(text_emotion: str, face_state: dict, source: str):
    text_emotion = (text_emotion or "neutral").strip().lower()

    raw_face_emotion = face_state.get("face_emotion", "Neutral")
    face_emotion = normalize_face_emotion(raw_face_emotion)
    face_detected = face_state.get("face_detected", False)
    distraction = face_state.get("distraction", "unknown")
    centered = face_state.get("centered", True)

    # ---------------------------
    # CASE 1: CHAT / VOICE
    # ---------------------------
    # In chat and voice mode, text should still be primary,
    # but face should influence the final result when there is a clear mismatch.
    if source in ["chat", "voice"]:
        if not face_detected:
            final_emotion = text_emotion

        elif text_emotion == face_emotion:
            final_emotion = text_emotion

        elif text_emotion == "neutral" and face_emotion != "neutral":
            final_emotion = face_emotion

        elif face_emotion == "neutral":
            final_emotion = text_emotion

        # If face shows a strong negative state while text looks positive,
        # mark as mixed so the LLM can respond more carefully.
        elif text_emotion == "joy" and face_emotion in ["sadness", "fear", "anger", "disgust"]:
            final_emotion = "mixed"

        # If text is already a strong negative emotion, trust text more.
        elif text_emotion in ["sadness", "fear", "anger", "disgust"]:
            final_emotion = text_emotion

        else:
            final_emotion = text_emotion

    # ---------------------------
    # CASE 2: COMBINED / CAMERA / OTHER MULTIMODAL
    # ---------------------------
    else:
        if not face_detected:
            final_emotion = text_emotion

        elif text_emotion == face_emotion:
            final_emotion = text_emotion

        elif text_emotion == "neutral" and face_emotion != "neutral":
            final_emotion = face_emotion

        elif face_emotion == "neutral" and text_emotion != "neutral":
            final_emotion = text_emotion

        # Text says joy, face says negative -> mixed
        elif text_emotion == "joy" and face_emotion in ["sadness", "fear", "anger", "disgust"]:
            final_emotion = "mixed"

        # Text says negative, face says joy -> mixed
        elif text_emotion in ["sadness", "fear", "anger", "disgust"] and face_emotion == "joy":
            final_emotion = "mixed"

        # If both are emotional but different, prefer the more cautious emotion
        elif face_emotion in ["sadness", "fear", "anger", "disgust"]:
            final_emotion = face_emotion

        else:
            final_emotion = text_emotion

    return {
        "final_emotion": final_emotion,
        "text_emotion": text_emotion,
        "face_emotion": face_emotion,
        "face_detected": face_detected,
        "distraction": distraction,
        "centered": centered
    }
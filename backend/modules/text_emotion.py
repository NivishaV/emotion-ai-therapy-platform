from transformers import pipeline

emotion_model = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base"
)

def detect_text_emotion(text: str):
    result = emotion_model(text)[0]
    return {
        "label": result["label"],
        "score": float(result["score"])
    }
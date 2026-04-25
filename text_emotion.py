from transformers import pipeline

emotion_model = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    device=0   # ✅ USE GPU
)

def get_text_emotion(text):
    result = emotion_model(text)
    return result[0]['label']
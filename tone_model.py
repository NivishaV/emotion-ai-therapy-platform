from transformers import pipeline

# Load pretrained emotion model
tone_classifier = pipeline(
    "audio-classification",
    model="superb/wav2vec2-base-superb-er"
)

def predict_tone_emotion(audio_file):
    result = tone_classifier(audio_file)

    # Top prediction
    label = result[0]["label"].lower()

    # Map to your 4 emotions
    mapping = {
        "ang": "Anger",
        "hap": "Happy",
        "sad": "Sad",
        "neu": "Happy"   # treat neutral as calm/happy
    }

    return mapping.get(label, "Happy")
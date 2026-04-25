from voice_input import record_audio
from speech_to_text import speech_to_text
from text_emotion import get_text_emotion

def process_voice():

    # Step 1: Record voice
    audio_file = record_audio()

    # Step 2: Convert to text
    text = speech_to_text(audio_file)

    # Step 3: Detect emotion
    emotion = get_text_emotion(text)

    return text, emotion
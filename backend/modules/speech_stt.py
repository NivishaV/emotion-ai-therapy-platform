import sounddevice as sd
from scipy.io.wavfile import write
from faster_whisper import WhisperModel
import tempfile
import os

_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Whisper model on CPU...")
        _whisper_model = WhisperModel(
            "tiny.en",
            device="cpu",
            compute_type="int8"
        )
        print("Whisper model loaded on CPU.")
    return _whisper_model

def record_audio(duration=5, fs=16000):
    print("Recording...")

    recording = sd.rec(
        int(duration * fs),
        samplerate=fs,
        channels=1,
        dtype="float32"
    )
    sd.wait()

    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    write(temp_file.name, fs, recording)

    return temp_file.name

def transcribe_audio(file_path):
    model = get_whisper_model()

    print("Transcribing:", file_path)

    segments, info = model.transcribe(
        file_path,
        beam_size=1,
        language="en"
    )

    text = " ".join(seg.text.strip() for seg in segments).strip()
    return text
import whisper
import torch
import os

# 🔥 SET FFMPEG PATH MANUALLY (IMPORTANT)
os.environ["PATH"] += os.pathsep + r"C:\Users\Nivisha\Downloads\ffmpeg-8.1-essentials_build\ffmpeg-8.1-essentials_build\bin"

# Use GPU
device = "cuda" if torch.cuda.is_available() else "cpu"

model = whisper.load_model("base").to(device)

def speech_to_text(audio_file):
    print("🔄 Converting speech to text...")
    
    result = model.transcribe(audio_file)
    
    print("🗣 Detected Text:", result["text"])
    return result["text"]
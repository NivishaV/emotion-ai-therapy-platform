# Emotion AI Therapy Platform

A multimodal AI therapy web application that combines text emotion recognition, facial emotion analysis, voice input, gaze-aware attention cues, and session history tracking.

## Features

- User signup and login with email OTP verification
- MongoDB-based user storage
- Text emotion recognition
- Face emotion detection
- Voice input and speech-to-text processing
- Multimodal emotion fusion
- AI therapist response generation
- Session summary and session history
- Modern Flask web interface

## Tech Stack

- Python
- Flask
- MongoDB
- HTML, CSS, JavaScript
- Transformers
- OpenCV
- DeepFace
- Groq LLM API
- Speech Recognition

## Project Structure

```text
OpenFace-3.0-main/
├── backend/
│   ├── app.py
│   ├── auth_utils.py
│   ├── config.py
│   ├── db.py
│   ├── modules/
│   ├── static/
│   ├── templates/
│   └── requirements.txt
├── face_service.py
├── README.md
├── LICENSE
└── .gitignore

Setup Instructions
Clone the repository.
git clone <repository-url>
cd OpenFace-3.0-main
Create virtual environment.
cd backend
python -m venv backend_env
backend_env\Scripts\activate
Install dependencies.
pip install -r requirements.txt
Create .env file inside backend/.
SECRET_KEY=your_secret_key
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=ai_therapy

MAIL_EMAIL=your_email@gmail.com
MAIL_APP_PASSWORD=your_gmail_app_password

GROQ_API_KEY=your_groq_api_key
Start MongoDB service.
Run Flask backend.
python app.py
Open browser.
http://127.0.0.1:5000
Important Note

The .env file, virtual environments, model weights, cache folders, and generated media files are ignored for security and storage reasons.

Author

V. Nivisha
M.Tech Artificial Intelligence and Data Science
SAP Research Project


---
# Emotion AI Therapy Platform

> **Multimodal Emotion Recognition and LLM-Based Adaptive Psychotherapy Response System**

An advanced AI-powered psychotherapy assistant that understands human emotions using **text, facial expressions, voice cues, and multimodal fusion**, then generates intelligent therapeutic responses using a **Large Language Model (LLM)**.

Built as a **full-stack web application** with secure authentication, real-time interaction, session tracking, and scalable modular architecture.

---

# Live Repository

🔗 https://github.com/NivishaV/emotion-ai-therapy-platform

---

# Project Vision

This platform was developed to create a human-centered AI therapy assistant capable of emotionally aware conversations.

The system recognizes emotions from multiple user inputs:

- Written text
- Facial expressions
- Voice / tone
- Combined multimodal signals

It then uses an **LLM-based psychotherapy response engine** to generate calm, adaptive, supportive responses. Inspired by the user's project proposal for multimodal emotion recognition, LLM integration, Flask frontend/backend, and MongoDB database architecture. 

---

# Core Features

# Secure Authentication System

- User Signup & Login
- OTP Email Verification
- Password Strength Validation
- Protected Sessions
- Logout System

---

# Multimodal Emotion Intelligence

## 1. Text Emotion Recognition

Detects emotional intent from user messages.

Supported emotions:

- Joy
- Sadness
- Fear
- Anger
- Surprise
- Neutral

Uses NLP transformer-based emotion classification.

---

## 2. Facial Emotion Recognition

Real-time webcam emotion detection using computer vision.

Capabilities:

- Face detection
- Landmark analysis
- Emotion inference
- Live monitoring
- Gaze detection

Integrated with OpenFace pipeline and face service modules.

---

## 3. Voice / Speech Emotion Layer

Speech input processing includes:

- Speech-to-text conversion
- Voice tone capture
- Emotional speech cues

---

## 4. Multimodal Fusion Engine

Combines outputs from:

- Text + Face
- Face + Voice
- Text + Voice
- Text + Face + Voice

Provides more accurate emotional understanding than single-input systems.

---

# LLM-Based Adaptive Therapy Response System

Uses a **Large Language Model (LLM)** to generate emotionally aware psychotherapy-style responses.

## Current Integration

- Ollama (Local LLM Support)

## Response Capabilities

- Context-aware replies
- Emotion-sensitive conversation tone
- Therapeutic supportive guidance
- Memory-aware session continuity

---

# MongoDB Database Integration

MongoDB is used for persistent storage.

## Collections Include:

### Users Collection

Stores:

- Name
- Email
- Password hash
- Verification status
- Signup date

### Sessions Collection

Stores:

- User ID
- Session mode
- Emotions detected
- Messages
- Therapy summaries
- Timestamps

### Benefits of MongoDB

- Flexible schema
- Fast JSON-like storage
- Ideal for AI apps
- Easy session analytics

---

# Full Web Application Modules

## Frontend

- HTML5
- CSS3
- JavaScript
- Premium UI / UX
- Responsive Layout
- Glassmorphism Authentication Pages

## Backend

- Python Flask
- REST APIs
- Authentication Routes
- Session Management

## AI Modules

- NLP Emotion Detection
- Face Recognition Pipeline
- Fusion Engine
- LLM Response Generator

---

# User Workflow

1. User creates account  
2. Email OTP verification  
3. Login securely  
4. Choose session mode:

- Chat Mode
- Camera Mode
- Combined Mode

5. Interact with AI Therapist  
6. Receive adaptive emotional responses  
7. View session summary  
8. Access session history dashboard

---

# Screens Included

- Login Page
- Signup Page
- Home Dashboard
- Session Mode Selection
- Live Therapy Chat
- Camera Emotion Session
- Session Summary
- Session History

---

# Tech Stack

## Programming

- Python
- JavaScript

## Frameworks

- Flask

## Database

- MongoDB

## AI / ML

- Transformers
- OpenFace
- Computer Vision
- Speech Recognition
- LLM APIs

## UI

- HTML
- CSS
- JS Animations

---

# Project Structure

```bash
emotion-ai-therapy-platform/
│── backend/
│   ├── app.py
│   ├── db.py
│   ├── auth_utils.py
│   ├── modules/
│   ├── templates/
│   └── static/
│
│── face_service.py
│── fusion.py
│── requirements.txt
│── README.md
```
---

# Installation
## Clone Repository
```bash
git clone https://github.com/NivishaV/emotion-ai-therapy-platform.git
cd emotion-ai-therapy-platform
```
## Install Packages
```bash
pip install -r requirements.txt
```
## Run
```bash
python face_service.py
cd backend
python app.py
```

---


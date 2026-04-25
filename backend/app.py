from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime, timedelta
import tempfile
import os
import re

load_dotenv()

from db import users_collection, otp_collection, sessions_collection
from auth_utils import generate_otp, send_otp_email
from modules.chat_engine import process_fused_message
from modules.speech_stt import transcribe_audio

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "ai_therapy_secret_key_123")
CORS(app)


# ---------------------------
# AUTH HELPERS
# ---------------------------
def is_logged_in():
    return "user_email" in session


def is_strong_password(password: str) -> bool:
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[^A-Za-z0-9]", password):
        return False
    return True


# ---------------------------
# AUTH ROUTES
# ---------------------------
@app.route("/")
def home():
    if not is_logged_in():
        return redirect(url_for("login"))
    return render_template("index.html", user_name=session.get("user_name", "User"))


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("signup.html")

    full_name = request.form.get("full_name", "").strip()
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "").strip()
    confirm_password = request.form.get("confirm_password", "").strip()

    if not full_name or not email or not password or not confirm_password:
        flash("Please fill all the fields.", "error")
        return redirect(url_for("signup"))

    if password != confirm_password:
        flash("Passwords do not match.", "error")
        return redirect(url_for("signup"))

    if len(password) < 8:
        flash("Password must be at least 8 characters long.", "error")
        return redirect(url_for("signup"))

    if not any(char.isupper() for char in password):
        flash("Password must contain at least one uppercase letter.", "error")
        return redirect(url_for("signup"))

    if not any(char.isdigit() for char in password):
        flash("Password must contain at least one number.", "error")
        return redirect(url_for("signup"))

    if not any(not char.isalnum() for char in password):
        flash("Password must contain at least one special character.", "error")
        return redirect(url_for("signup"))

    existing_user = users_collection.find_one({"email": email})

    if existing_user and existing_user.get("is_verified", False):
        flash("This email is already registered. Please log in.", "error")
        return redirect(url_for("login"))

    password_hash = generate_password_hash(password)

    if existing_user and not existing_user.get("is_verified", False):
        users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "full_name": full_name,
                    "password_hash": password_hash,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    else:
        users_collection.insert_one({
            "full_name": full_name,
            "email": email,
            "password_hash": password_hash,
            "is_verified": False,
            "created_at": datetime.utcnow()
        })

    otp_collection.delete_many({"email": email})

    otp_code = generate_otp()

    otp_collection.insert_one({
        "email": email,
        "otp_code": otp_code,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=5)
    })

    try:
        send_otp_email(email, otp_code)
    except Exception as e:
        print("OTP mail error:", e)
        flash("Failed to send OTP email. Check your email settings.", "error")
        return redirect(url_for("signup"))

    session["pending_email"] = email
    flash("OTP sent to your email. Please verify your account.", "success")
    return redirect(url_for("verify_otp"))


@app.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():
    pending_email = session.get("pending_email")

    if not pending_email:
        flash("No signup session found. Please sign up again.", "error")
        return redirect(url_for("signup"))

    if request.method == "GET":
        return render_template("verify_otp.html", email=pending_email)

    otp_input = request.form.get("otp", "").strip()

    if not otp_input:
        flash("Please enter the OTP.", "error")
        return redirect(url_for("verify_otp"))

    otp_record = otp_collection.find_one(
        {"email": pending_email},
        sort=[("created_at", -1)]
    )

    if not otp_record:
        flash("OTP not found. Please sign up again.", "error")
        return redirect(url_for("signup"))

    if datetime.utcnow() > otp_record["expires_at"]:
        otp_collection.delete_many({"email": pending_email})
        flash("OTP expired. Please sign up again.", "error")
        return redirect(url_for("signup"))

    if otp_input != otp_record["otp_code"]:
        flash("Incorrect OTP. Please try again.", "error")
        return redirect(url_for("verify_otp"))

    users_collection.update_one(
        {"email": pending_email},
        {"$set": {"is_verified": True, "verified_at": datetime.utcnow()}}
    )

    otp_collection.delete_many({"email": pending_email})
    session.pop("pending_email", None)

    flash("Account verified successfully. Please log in.", "success")
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "").strip()

    if not email or not password:
        flash("Please enter email and password.", "error")
        return redirect(url_for("login"))

    user = users_collection.find_one({"email": email})
    if not user:
        flash("No account found with this email.", "error")
        return redirect(url_for("login"))

    if not user.get("is_verified", False):
        session["pending_email"] = email
        flash("Please verify your email before logging in.", "error")
        return redirect(url_for("verify_otp"))

    if not check_password_hash(user["password_hash"], password):
        flash("Incorrect password.", "error")
        return redirect(url_for("login"))

    session["user_email"] = user["email"]
    session["user_name"] = user.get("username", user.get("full_name", "User"))

    flash("Login successful.", "success")
    return redirect(url_for("home"))

@app.route("/session-history")
def session_history():
    if not is_logged_in():
        return redirect(url_for("login"))

    history_items = list(
        sessions_collection.find(
            {"user_email": session.get("user_email")},
            {"_id": 0}
        ).sort("ended_at", -1)
    )

    return render_template(
        "session_history.html",
        user_name=session.get("user_name", "User"),
        history_items=history_items
    )
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------------------------
# PROTECTED MAIN APP ROUTES
# ---------------------------
@app.route("/chat_fused", methods=["POST"])
def chat_fused():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    user_id = session.get("user_email", "default_user")
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Message is empty"}), 400

    try:
        result = process_fused_message(user_id, user_message, source="chat")
        return jsonify(result)
    except Exception as e:
        print("CHAT FUSED ERROR:", e)
        return jsonify({
            "error": str(e),
            "response": "I'm here with you. Please tell me more."
        }), 500

@app.route("/save_session_summary", methods=["POST"])
def save_session_summary():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}

    session_doc = {
        "user_email": session.get("user_email"),
        "user_name": session.get("user_name", "User"),
        "mode": data.get("mode", "unknown"),
        "duration_min": data.get("duration_min", 0),
        "message_count": data.get("message_count", 0),
        "detected_emotions": data.get("detected_emotions", []),
        "mood_timeline": data.get("mood_timeline", []),
        "face_emotion": data.get("face_emotion", "-"),
        "text_emotion": data.get("text_emotion", "-"),
        "final_emotion": data.get("final_emotion", "-"),
        "ended_at": datetime.utcnow()
    }

    sessions_collection.insert_one(session_doc)

    return jsonify({
        "status": "success",
        "message": "Session summary saved successfully"
    })
@app.route("/voice_fused", methods=["POST"])
def voice_fused():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session.get("user_email", "default_user")

    if "audio" not in request.files:
        return jsonify({"error": "No audio file uploaded"}), 400

    audio_file = request.files["audio"]

    original_name = audio_file.filename or "recorded_audio.webm"
    _, ext = os.path.splitext(original_name)
    ext = ext.lower().strip()

    if ext == "":
        ext = ".webm"

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            temp_path = tmp.name
            audio_file.save(temp_path)

        print("Received voice file:", temp_path)

        transcript = transcribe_audio(temp_path)

        if not transcript.strip():
            return jsonify({
                "source": "voice",
                "text": "",
                "text_emotion": "neutral",
                "face_emotion": "Neutral",
                "final_emotion": "neutral",
                "response": "I couldn't hear anything clearly. Please try again."
            })

        result = process_fused_message(user_id, transcript, source="voice")
        return jsonify(result)

    except Exception as e:
        print("VOICE FUSED ERROR:", e)
        return jsonify({
            "error": str(e),
            "response": "I'm here with you. Please try speaking again."
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, port=5000)
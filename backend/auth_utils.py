import os
import random
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

MAIL_EMAIL = os.getenv("MAIL_EMAIL")
MAIL_APP_PASSWORD = os.getenv("MAIL_APP_PASSWORD")

def generate_otp():
    return str(random.randint(100000, 999999))

def send_otp_email(to_email, otp_code):
    if not MAIL_EMAIL or not MAIL_APP_PASSWORD:
        raise ValueError("Mail credentials are missing in .env")

    subject = "Emotion AI Therapy - OTP Verification"
    body = f"""
Hello,

Your OTP for Emotion AI Therapy account verification is:

{otp_code}

This OTP is valid for 5 minutes.

If you did not request this, please ignore this message.

Regards,
Emotion AI Therapy
"""

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = MAIL_EMAIL
    msg["To"] = to_email

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(MAIL_EMAIL, MAIL_APP_PASSWORD)
        server.sendmail(MAIL_EMAIL, to_email, msg.as_string())
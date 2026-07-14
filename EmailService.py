import os
import logging
from dotenv import load_dotenv
import requests

# Load environment variables explicitly
load_dotenv()

logger = logging.getLogger(__name__)

def send_otp_email(to_email: str, to_name: str, otp: str) -> bool:
    """Send a professional HTML email with the verification OTP using Brevo REST API.
    
    Reads configuration from .env:
    - BREVO_API_KEY
    - EMAIL_FROM
    - EMAIL_NAME
    """
    api_key = os.getenv("BREVO_API_KEY")
    email_from = os.getenv("EMAIL_FROM")
    email_name = os.getenv("EMAIL_NAME", "WeCloud")

    if not api_key:
        logger.error("BREVO_API_KEY is not configured in the environment.")
        return False
    if not email_from:
        logger.error("EMAIL_FROM is not configured in the environment.")
        return False

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }

    # Responsive, modern HTML Email Template matching the WeCloud brand
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your WeCloud Account</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
    }}
    .container {{
      max-width: 540px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }}
    .header {{
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 32px 24px;
      text-align: center;
    }}
    .header h1 {{
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }}
    .content {{
      padding: 40px 32px;
    }}
    .greeting {{
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
    }}
    .instructions {{
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 32px;
    }}
    .otp-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .otp-box {{
      display: inline-block;
      font-size: 38px;
      font-weight: 800;
      color: #4f46e5;
      background-color: #f5f3ff;
      border: 2px dashed #818cf8;
      border-radius: 12px;
      padding: 14px 40px;
      letter-spacing: 0.15em;
      box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.05);
    }}
    .expiry {{
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-top: 16px;
      font-weight: 500;
    }}
    .warning {{
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 8px;
      margin-top: 36px;
      font-size: 13px;
      color: #b45309;
      line-height: 1.5;
    }}
    .footer {{
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
    }}
    .footer p {{
      margin: 4px 0;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WeCloud</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello {to_name},</div>
      <p class="instructions">
        Welcome to WeCloud! To complete your registration and verify your email address, please use the 6-digit verification code below:
      </p>
      <div class="otp-container">
        <span class="otp-box">{otp}</span>
        <div class="expiry">This verification code is valid for <strong>10 minutes</strong>.</div>
      </div>
      <div class="warning">
        <strong>Security Warning:</strong> This is a one-time password (OTP). Do not share this code with anyone. WeCloud staff will never ask for this code. If you did not request this verification, please ignore this email or contact support.
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2026 WeCloud. All rights reserved.</p>
    </div>
  </div>
</body>
</html>"""

    payload = {
        "sender": {"name": email_name, "email": email_from},
        "to": [{"email": to_email, "name": to_name}],
        "subject": "Verify your WeCloud Account",
        "htmlContent": html_content
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code in [200, 201, 202]:
            logger.info(f"Successfully sent OTP email to {to_email}. Response: {response.text}")
            return True
        else:
            print(f"Brevo API Error Status Code: {response.status_code}")
            print(f"Brevo API Error Response Body: {response.text}")
            logger.error(f"Failed to send transactional email via Brevo REST API. Status: {response.status_code}, Body: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Unexpected error when sending email via requests: {e}")
        return False

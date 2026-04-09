from __future__ import annotations
import asyncio
import logging
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import httpx

logger = logging.getLogger("gridiq.briefing")

GMAIL_USER     = "gridiqsupport@gmail.com"
GMAIL_PASSWORD = "ydmy glnk lhdy lniq"
RECIPIENT      = "gridiqsupport@gmail.com"
SEND_HOUR_UTC  = 13
BASE_URL       = "http://127.0.0.1:8001"

async def _fetch(client, path):
    try:
        r = await client.get(f"{BASE_URL}/api/v1{path}", timeout=10)
        return r.json()
    except Exception as e:
        logger.warning(f"Failed to fetch {path}: {e}")
        return {}

async def gather_grid_data():
    async with httpx.AsyncClient() as client:
        weather, outage, predict = await asyncio.gather(
            _fetch(client, "/weather/grid-impact"),
            _fetch(client, "/outage/summary"),
            _fetch(client, "/predict/summary"),
        )
    return {
        "weather": weather,
        "outage": outage,
        "predict": predict,
        "date": datetime.now().strftime("%A, %B %d, %Y"),
    }

async def generate_briefing(data):
    import os
    prompt = f"""You are GridIQ, an AI grid intelligence platform built in Paradise, California.
Write a morning briefing for a rural electric cooperative General Manager.
Today is {data['date']}.

WEATHER AND FIRE RISK:
{data['weather']}

OUTAGE PREDICTION SUMMARY:
{data['outage']}

PREDICTIVE FAULT SCORING SUMMARY:
{data['predict']}

Write a briefing that:
- Opens with one sentence overall status: Green, Yellow, or Red day
- Summarizes weather and fire risk in plain English
- Calls out any equipment showing early signs of failure
- States outage probability for next 24 hours
- Ends with one recommended action for the GM this morning

Write like a trusted colleague briefing their boss over coffee.
Under 300 words. No bullet points. Clear paragraphs only."""

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": os.getenv("ANTHROPIC_API_KEY"),
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        return r.json()["content"][0]["text"]

def send_email(briefing_text, date_str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"GridIQ Morning Briefing - {date_str}"
    msg["From"]    = GMAIL_USER
    msg["To"]      = RECIPIENT
    msg.attach(MIMEText(briefing_text, "plain"))
    html = f"<html><body style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px'><div style='background:#0a0f1e;color:white;padding:16px 24px;border-radius:8px 8px 0 0'><h2 style='margin:0'>GridIQ Morning Briefing</h2><p style='margin:4px 0 0;opacity:0.7'>{date_str}</p></div><div style='border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px'><p>{briefing_text.replace(chr(10), '<br>')}</p><hr style='border:none;border-top:1px solid #e2e8f0;margin:24px 0'><p style='font-size:12px;color:#94a3b8'>Powered by GridIQ - gridiq.ink - Built in Paradise, CA</p></div></body></html>"
    msg.attach(MIMEText(html, "html"))
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(GMAIL_USER, GMAIL_PASSWORD)
        s.send_message(msg)
    logger.info(f"Briefing sent to {RECIPIENT}")

async def run_briefing_scheduler():
    logger.info("Briefing scheduler started")
    sent_today = None
    while True:
        now = datetime.utcnow()
        today = now.date()
        if now.hour == SEND_HOUR_UTC and sent_today != today:
            try:
                logger.info("Generating morning briefing...")
                data = await gather_grid_data()
                briefing = await generate_briefing(data)
                send_email(briefing, data["date"])
                sent_today = today
            except Exception as e:
                logger.error(f"Briefing failed: {e}")
        await asyncio.sleep(60)

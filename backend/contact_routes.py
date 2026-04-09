from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone

contact_router = APIRouter(prefix="/contact", tags=["Contact"])
logger = logging.getLogger("gridiq.contact")

class ContactForm(BaseModel):
    name: str
    utility: str
    email: str
    state: Optional[str] = ""
    size: Optional[str] = ""
    message: Optional[str] = ""

@contact_router.post("", summary="Submit contact form")
async def submit_contact(form: ContactForm):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    logger.info(f"[Contact] INQUIRY {now} | {form.name} | {form.utility} | {form.email} | {form.state} | {form.size} | {form.message}")
    return {"status": "ok", "message": "Thank you — we will be in touch within 24 hours."}

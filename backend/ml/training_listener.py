from __future__ import annotations
import asyncio
import logging
from backend.core.event_bus import EventType, get_event_bus
from backend.ml.anomaly import get_anomaly_detector

logger = logging.getLogger("gridiq.ml")

async def start_ml_training_listener():
    logger.info("[ML] Anomaly detector training listener starting")
    bus = get_event_bus()
    detector = get_anomaly_detector()

    def on_telemetry(event):
        data = event.payload if hasattr(event, "payload") else event
        readings = data.get("readings", [])
        for reading in readings:
            asset_id = reading.get("asset_id")
            if asset_id:
                telemetry = {k: v for k, v in reading.items() if k != "asset_id"}
                detector.ingest(asset_id, telemetry)

    bus.subscribe(EventType.TELEMETRY_BATCH, on_telemetry)
    logger.info("[ML] Subscribed to TELEMETRY_BATCH — training in background")

    while True:
        await asyncio.sleep(30)
        summary = detector.fleet_summary()
        ready = summary["assets_model_ready"]
        total = summary["total_samples_ingested"]
        logger.info(f"[ML] {ready} assets model-ready — {total} total samples ingested")

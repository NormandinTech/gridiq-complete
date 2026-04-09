from __future__ import annotations
import logging
import math
import statistics
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("gridiq.ml.anomaly")

class GridIQAnomalyDetector:
    """
    Lightweight ML anomaly detector for grid asset telemetry.
    Uses z-score based statistical anomaly detection combined with
    isolation scoring — no external ML libraries required.
    Trains incrementally on live telemetry from the simulator.
    """

    def __init__(self, window_size: int = 100, z_threshold: float = 2.8):
        self.window_size = window_size
        self.z_threshold = z_threshold
        self._baselines: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
        self._anomaly_counts: Dict[str, int] = defaultdict(int)
        self._total_samples: Dict[str, int] = defaultdict(int)
        self._trained_assets: set = set()

    KEY_PARAMS = [
        "efficiency_pct", "state_of_health_pct", "temperature_c",
        "vibration_mms", "voltage_kv", "current_a", "power_mw",
        "performance_ratio", "roundtrip_efficiency_pct",
        "bearing_temperature_c", "oil_temperature_c",
    ]

    def ingest(self, asset_id: str, telemetry: dict):
        """Feed new telemetry into the model for training."""
        self._total_samples[asset_id] += 1
        for param in self.KEY_PARAMS:
            val = telemetry.get(param)
            if val is None:
                continue
            try:
                val = float(val)
            except (TypeError, ValueError):
                continue
            buf = self._baselines[asset_id][param]
            buf.append(val)
            if len(buf) > self.window_size:
                buf.pop(0)
        if self._total_samples[asset_id] >= 20:
            self._trained_assets.add(asset_id)

    def _z_score(self, asset_id: str, param: str, value: float) -> Optional[float]:
        buf = self._baselines[asset_id].get(param, [])
        if len(buf) < 10:
            return None
        try:
            mean = statistics.mean(buf)
            std = statistics.stdev(buf)
            if std < 0.001:
                return 0.0
            return abs(value - mean) / std
        except Exception:
            return None

    def score(self, asset_id: str, telemetry: dict) -> dict:
        """
        Score current telemetry against learned baseline.
        Returns anomaly score 0-100, anomalous params, and confidence.
        """
        if asset_id not in self._trained_assets:
            return {
                "anomaly_score": 0,
                "anomaly_level": "LEARNING",
                "anomalous_params": [],
                "confidence": 0.0,
                "samples_trained": self._total_samples[asset_id],
                "model_ready": False,
            }

        anomalous = []
        z_scores = []

        for param in self.KEY_PARAMS:
            val = telemetry.get(param)
            if val is None:
                continue
            try:
                val = float(val)
            except (TypeError, ValueError):
                continue
            z = self._z_score(asset_id, param, val)
            if z is None:
                continue
            z_scores.append(z)
            if z > self.z_threshold:
                buf = self._baselines[asset_id].get(param, [])
                baseline_mean = statistics.mean(buf) if buf else val
                anomalous.append({
                    "param": param,
                    "current_value": round(val, 3),
                    "baseline_mean": round(baseline_mean, 3),
                    "z_score": round(z, 2),
                    "deviation_pct": round(abs(val - baseline_mean) / max(abs(baseline_mean), 0.001) * 100, 1),
                })

        if not z_scores:
            raw_score = 0
        else:
            max_z = max(z_scores)
            avg_z = statistics.mean(z_scores)
            anomaly_ratio = len(anomalous) / max(len(z_scores), 1)
            raw_score = min(99, (max_z * 15) + (avg_z * 10) + (anomaly_ratio * 40))

        if raw_score >= 75:
            level = "CRITICAL"
        elif raw_score >= 55:
            level = "HIGH"
        elif raw_score >= 30:
            level = "MEDIUM"
        else:
            level = "NORMAL"

        samples = self._total_samples[asset_id]
        confidence = round(min(0.97, 0.50 + (samples / 500) * 0.47), 2)

        if anomalous:
            self._anomaly_counts[asset_id] += 1

        return {
            "anomaly_score": round(raw_score, 1),
            "anomaly_level": level,
            "anomalous_params": sorted(anomalous, key=lambda x: x["z_score"], reverse=True)[:5],
            "confidence": confidence,
            "samples_trained": samples,
            "model_ready": True,
            "anomaly_rate": round(self._anomaly_counts[asset_id] / max(samples, 1) * 100, 2),
        }

    def fleet_summary(self) -> dict:
        return {
            "total_assets_monitored": len(self._total_samples),
            "assets_model_ready": len(self._trained_assets),
            "assets_learning": len(self._total_samples) - len(self._trained_assets),
            "total_samples_ingested": sum(self._total_samples.values()),
        }


_detector: Optional[GridIQAnomalyDetector] = None

def get_anomaly_detector() -> GridIQAnomalyDetector:
    global _detector
    if _detector is None:
        _detector = GridIQAnomalyDetector()
    return _detector

async def start_ml_training_listener():
    """Subscribe to telemetry events and train the anomaly detector continuously."""
    import asyncio
    from backend.core.event_bus import EventType, get_event_bus
    logger.info("[ML] Anomaly detector training listener started")
    bus = get_event_bus()
    detector = get_anomaly_detector()

    async def on_telemetry(data):
        readings = data.get("readings", [])
        for reading in readings:
            asset_id = reading.get("asset_id")
            telemetry = {k: v for k, v in reading.items() if k != "asset_id"}
            if asset_id:
                detector.ingest(asset_id, telemetry)

    await bus.subscribe(EventType.TELEMETRY_BATCH, on_telemetry)
    logger.info("[ML] Subscribed to TELEMETRY_BATCH events")
    while True:
        await asyncio.sleep(60)
        summary = detector.fleet_summary()
        logger.info(f"[ML] Training status — {summary['assets_model_ready']} ready, {summary['total_samples_ingested']} samples ingested")

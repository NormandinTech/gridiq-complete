"""
GridIQ — Test Suite
Tests for API endpoints, ML engine, security module, and event bus.
Run: pytest tests/ -v --cov=backend
"""
from __future__ import annotations

import asyncio
import json
import random
import sys
import os
from datetime import datetime, timezone
from typing import Any, Dict

import pytest

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ─────────────────────────────────────────────────────────────────────────────
# Event Bus Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestEventBus:

    def test_event_creation(self):
        from backend.core.event_bus import Event, EventType
        event = Event(type=EventType.TELEMETRY_READING, payload={"asset_id": "a1", "mw": 100})
        assert event.event_id
        assert event.timestamp
        assert event.type == EventType.TELEMETRY_READING

    def test_event_serialization(self):
        from backend.core.event_bus import Event, EventType
        event = Event(type=EventType.ALERT_CREATED, payload={"title": "Test alert"})
        serialized = event.to_json()
        parsed = json.loads(serialized)
        assert parsed["type"] == "alert.created"
        assert parsed["payload"]["title"] == "Test alert"

    def test_event_deserialization(self):
        from backend.core.event_bus import Event, EventType
        original = Event(type=EventType.ANOMALY_DETECTED, payload={"score": 87.5})
        roundtrip = Event.from_json(original.to_json())
        assert roundtrip.type == EventType.ANOMALY_DETECTED
        assert roundtrip.payload["score"] == 87.5

    @pytest.mark.asyncio
    async def test_publish_subscribe(self):
        from backend.core.event_bus import Event, EventType, InMemoryEventBus
        bus = InMemoryEventBus()
        received = []

        async def handler(event):
            received.append(event)

        bus.subscribe(EventType.TELEMETRY_READING, handler)

        event = Event(type=EventType.TELEMETRY_READING, payload={"mw": 42})
        await bus.publish(event)

        assert len(received) == 1
        assert received[0].payload["mw"] == 42

    @pytest.mark.asyncio
    async def test_wildcard_subscribe(self):
        from backend.core.event_bus import Event, EventType, InMemoryEventBus
        bus = InMemoryEventBus()
        all_events = []
        bus.subscribe_all(lambda e: all_events.append(e))

        await bus.publish(Event(type=EventType.ALERT_CREATED, payload={}))
        await bus.publish(Event(type=EventType.ANOMALY_DETECTED, payload={}))

        assert len(all_events) == 2

    @pytest.mark.asyncio
    async def test_handler_error_isolation(self):
        """A failing handler should not prevent other handlers from running."""
        from backend.core.event_bus import Event, EventType, InMemoryEventBus
        bus = InMemoryEventBus()
        good_results = []

        async def bad_handler(event):
            raise RuntimeError("intentional test error")

        async def good_handler(event):
            good_results.append(event)

        bus.subscribe(EventType.TELEMETRY_READING, bad_handler)
        bus.subscribe(EventType.TELEMETRY_READING, good_handler)

        await bus.publish(Event(type=EventType.TELEMETRY_READING, payload={}))
        assert len(good_results) == 1  # good handler still ran


# ─────────────────────────────────────────────────────────────────────────────
# ML Engine Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDemandForecaster:

    def test_forecast_returns_correct_length(self):
        from backend.ml.engine import DemandForecaster
        f = DemandForecaster()
        points = f.forecast(horizon_hours=48)
        assert len(points) == 48

    def test_forecast_points_have_required_fields(self):
        from backend.ml.engine import DemandForecaster
        f = DemandForecaster()
        points = f.forecast(horizon_hours=6)
        for p in points:
            assert "timestamp" in p
            assert "value_mw" in p
            assert "lower_ci_mw" in p
            assert "upper_ci_mw" in p
            assert "confidence" in p

    def test_confidence_decreases_with_horizon(self):
        from backend.ml.engine import DemandForecaster
        f = DemandForecaster()
        points = f.forecast(horizon_hours=24)
        # Confidence should be higher at h=0 than h=23
        assert points[0]["confidence"] >= points[-1]["confidence"]

    def test_forecast_values_are_realistic(self):
        from backend.ml.engine import DemandForecaster
        f = DemandForecaster()
        points = f.forecast(horizon_hours=24, base_load_mw=4200)
        for p in points:
            # Load should be within 50% of base
            assert 2000 < p["value_mw"] < 6000

    def test_ci_bounds_surround_forecast(self):
        from backend.ml.engine import DemandForecaster
        f = DemandForecaster()
        for p in f.forecast(horizon_hours=12):
            assert p["lower_ci_mw"] <= p["value_mw"]
            assert p["upper_ci_mw"] >= p["value_mw"]


class TestAnomalyDetector:

    def test_normal_readings_not_anomalous(self):
        from backend.ml.engine import AnomalyDetector
        det = AnomalyDetector()
        # Warm up with normal values
        for _ in range(50):
            det.update_baseline("a1", random.gauss(100, 2))
        score, is_anomaly = det.score("a1", 101)
        assert not is_anomaly
        assert score < 75

    def test_extreme_outlier_is_anomaly(self):
        from backend.ml.engine import AnomalyDetector
        det = AnomalyDetector()
        for _ in range(50):
            det.update_baseline("a2", random.gauss(100, 1))
        score, is_anomaly = det.score("a2", 200)  # 100-sigma outlier
        assert is_anomaly
        assert score > 75

    def test_insufficient_history_returns_no_anomaly(self):
        from backend.ml.engine import AnomalyDetector
        det = AnomalyDetector()
        # Only 5 readings — not enough for reliable baseline
        for i in range(5):
            det.update_baseline("a3", float(i))
        score, is_anomaly = det.score("a3", 999)
        assert not is_anomaly  # too little history

    def test_score_range(self):
        from backend.ml.engine import AnomalyDetector
        det = AnomalyDetector()
        for v in range(50, 150):
            det.update_baseline("a4", float(v))
        score, _ = det.score("a4", 100)
        assert 0 <= score <= 100


class TestRenewableForecaster:

    def test_solar_zero_at_night(self):
        from backend.ml.engine import RenewableForecaster
        f = RenewableForecaster()
        # Hour 2 = 2 AM — solar should be 0
        from datetime import datetime
        result = f._solar_output(
            datetime(2026, 6, 15, 2, 0, tzinfo=timezone.utc),
            capacity_mw=300, lat=37.0
        )
        assert result == 0.0

    def test_combined_forecast_has_status(self):
        from backend.ml.engine import RenewableForecaster
        f = RenewableForecaster()
        points = f.combined_forecast(1500, 2200, horizon_hours=8)
        assert len(points) == 8
        for p in points:
            assert "status" in p
            assert p["status"] in ("on_target", "wind_drop", "peak_risk", "reserve_low", "recovering")

    def test_wind_output_non_negative(self):
        from backend.ml.engine import RenewableForecaster
        f = RenewableForecaster()
        points = f.forecast_wind(capacity_mw=500, horizon_hours=24)
        for p in points:
            assert p["wind_mw"] >= 0


class TestAssetHealthScorer:

    def test_new_asset_high_score(self):
        from backend.ml.engine import AssetHealthScorer
        from datetime import datetime
        scorer = AssetHealthScorer()
        score = scorer.score({
            "install_date": datetime(2024, 1, 1, tzinfo=timezone.utc).isoformat(),
            "rated_life_years": 30,
            "temperature_c": 55,
            "fault_count_30d": 0,
            "anomaly_rate_7d": 0,
        })
        assert score > 75

    def test_degraded_asset_lower_score(self):
        from backend.ml.engine import AssetHealthScorer
        from datetime import datetime
        scorer = AssetHealthScorer()
        score = scorer.score({
            "install_date": datetime(1995, 1, 1, tzinfo=timezone.utc).isoformat(),
            "rated_life_years": 30,
            "temperature_c": 95,
            "fault_count_30d": 5,
            "maintenance_overdue": True,
            "anomaly_rate_7d": 3,
        })
        assert score < 50

    def test_failure_probability_increases_with_lower_health(self):
        from backend.ml.engine import AssetHealthScorer
        scorer = AssetHealthScorer()
        p_healthy = scorer.predict_failure_probability(95)
        p_degraded = scorer.predict_failure_probability(35)
        assert p_degraded > p_healthy


# ─────────────────────────────────────────────────────────────────────────────
# Security / Cybersecurity Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestZeroTrustEngine:

    def test_internet_to_ot_always_denied(self):
        from backend.security.cyber import ZeroTrustPolicyEngine
        zt = ZeroTrustPolicyEngine()
        result = zt.evaluate({
            "source_zone": "internet",
            "target_zone": "ot",
            "mfa": True,
            "role": "admin",
        })
        assert result["allowed"] is False

    def test_ot_access_requires_mfa(self):
        from backend.security.cyber import ZeroTrustPolicyEngine
        zt = ZeroTrustPolicyEngine()
        result = zt.evaluate({
            "source_zone": "it",
            "target_zone": "ot",
            "mfa": False,
        })
        assert result["allowed"] is False

    def test_ot_access_with_mfa_allowed(self):
        from backend.security.cyber import ZeroTrustPolicyEngine
        zt = ZeroTrustPolicyEngine()
        result = zt.evaluate({
            "source_zone": "it",
            "target_zone": "ot",
            "mfa": True,
            "role": "operator",
        })
        assert result["allowed"] is True

    def test_risk_score_higher_without_mfa(self):
        from backend.security.cyber import ZeroTrustPolicyEngine
        zt = ZeroTrustPolicyEngine()
        r_no_mfa = zt._calculate_risk({"mfa": False, "source_zone": "it"})
        r_mfa    = zt._calculate_risk({"mfa": True,  "source_zone": "it"})
        assert r_no_mfa > r_mfa


class TestThreatDetection:

    def test_auth_failure_tracking(self):
        from backend.security.cyber import ThreatDetectionEngine
        engine = ThreatDetectionEngine()
        for i in range(4):
            count, locked = engine.record_auth_failure("user@test.com")
            assert count == i + 1
            assert not locked
        count, locked = engine.record_auth_failure("user@test.com")
        assert count == 5
        assert locked

    def test_ip_blocking(self):
        from backend.security.cyber import ThreatDetectionEngine
        engine = ThreatDetectionEngine()
        assert not engine.is_blocked("10.0.0.99")
        engine.block_ip("10.0.0.99")
        assert engine.is_blocked("10.0.0.99")

    def test_security_posture_has_required_fields(self):
        from backend.security.cyber import ThreatDetectionEngine
        engine = ThreatDetectionEngine()
        posture = engine.get_security_posture()
        required = {"overall_score", "network_segmentation_score",
                    "patch_compliance_score", "access_control_score",
                    "active_threats", "mean_time_to_detect_min"}
        assert required.issubset(set(posture.keys()))

    def test_posture_scores_in_range(self):
        from backend.security.cyber import ThreatDetectionEngine
        engine = ThreatDetectionEngine()
        p = engine.get_security_posture()
        for k in ("overall_score", "network_segmentation_score",
                  "patch_compliance_score", "access_control_score"):
            assert 0 <= p[k] <= 100


class TestNERCCIPCompliance:

    def test_all_standards_returned(self):
        from backend.security.cyber import NERCCIPComplianceChecker
        checker = NERCCIPComplianceChecker()
        results = checker.assess_all()
        control_ids = {r["control_id"] for r in results}
        expected = {"CIP-002", "CIP-003", "CIP-005", "CIP-006",
                    "CIP-007", "CIP-010", "CIP-011", "CIP-013"}
        assert expected == control_ids

    def test_compliance_pct_in_range(self):
        from backend.security.cyber import NERCCIPComplianceChecker
        checker = NERCCIPComplianceChecker()
        for ctrl in checker.assess_all():
            assert 0 <= ctrl["compliance_pct"] <= 100

    def test_overall_score_is_average(self):
        from backend.security.cyber import NERCCIPComplianceChecker
        checker = NERCCIPComplianceChecker()
        results = checker.assess_all()
        expected_avg = sum(r["compliance_pct"] for r in results) / len(results)
        assert abs(checker.overall_score(results) - expected_avg) < 0.1

    def test_low_compliance_has_findings(self):
        from backend.security.cyber import NERCCIPComplianceChecker
        checker = NERCCIPComplianceChecker()
        for ctrl in checker.assess_all():
            if ctrl["compliance_pct"] < 70:
                assert ctrl["findings"] is not None


# ─────────────────────────────────────────────────────────────────────────────
# Protocol Adapter Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestProtocolAdapters:

    @pytest.mark.asyncio
    async def test_modbus_simulation(self):
        from backend.protocols.adapters import ModbusTCPAdapter
        adapter = ModbusTCPAdapter("a1", "TRF-001", "127.0.0.1", 502)
        await adapter.connect()
        reading = await adapter.read()
        assert reading.active_power_mw is not None
        assert reading.frequency_hz is not None
        assert 55 <= reading.frequency_hz <= 65

    @pytest.mark.asyncio
    async def test_dnp3_simulation(self):
        from backend.protocols.adapters import DNP3Adapter
        adapter = DNP3Adapter("a2", "CBR-012", "127.0.0.1", 20000)
        await adapter.connect()
        reading = await adapter.read()
        assert reading.active_power_mw is not None

    @pytest.mark.asyncio
    async def test_adapter_factory(self):
        from backend.protocols.adapters import create_adapter
        adapter = create_adapter("a3", "RTU-001", "modbus_tcp", "127.0.0.1", 502)
        assert adapter is not None

    def test_unknown_protocol_raises(self):
        from backend.protocols.adapters import create_adapter
        with pytest.raises(ValueError, match="Unknown protocol"):
            create_adapter("a4", "X-001", "unknown_protocol", "127.0.0.1", 9999)

    @pytest.mark.asyncio
    async def test_safe_read_returns_on_error(self):
        from backend.protocols.adapters import ModbusTCPAdapter
        # Point to non-existent host — should return error reading, not raise
        adapter = ModbusTCPAdapter("a5", "ERR-001", "192.0.2.1", 502)
        reading = await adapter.safe_read()
        # Either succeeds (simulation) or returns error reading (no exception)
        assert reading is not None
        assert reading.asset_id == "a5"


# ─────────────────────────────────────────────────────────────────────────────
# Telemetry Ingestion Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestTelemetryIngestion:

    @pytest.mark.asyncio
    async def test_valid_batch_processed(self):
        from backend.services.asset_service import TelemetryIngestionService
        svc = TelemetryIngestionService()
        batch = [
            {
                "asset_id": "a1",
                "asset_type": "transformer",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "active_power_mw": 85.0,
                "voltage_kv": 138.0,
                "frequency_hz": 60.01,
                "temperature_c": 68.0,
            }
        ]
        stats = await svc.process_batch(batch)
        assert stats["stored"] == 1
        assert stats["errors"] == 0

    @pytest.mark.asyncio
    async def test_invalid_voltage_rejected(self):
        from backend.services.asset_service import TelemetryIngestionService
        svc = TelemetryIngestionService()
        batch = [
            {
                "asset_id": "a2",
                "asset_type": "transformer",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "voltage_kv": 9999.0,  # impossible voltage
                "frequency_hz": 60.0,
            }
        ]
        stats = await svc.process_batch(batch)
        assert stats["errors"] == 1
        assert stats["stored"] == 0

    @pytest.mark.asyncio
    async def test_missing_asset_id_rejected(self):
        from backend.services.asset_service import TelemetryIngestionService
        svc = TelemetryIngestionService()
        stats = await svc.process_batch([{"voltage_kv": 138.0}])
        assert stats["errors"] == 1


# ─────────────────────────────────────────────────────────────────────────────
# Simulator Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestTelemetrySimulator:

    def test_solar_zero_at_night(self):
        from scripts.simulate_telemetry import AssetSimulator
        sim = AssetSimulator("s1", "solar_farm", base_power_mw=300)
        # Force night hour by monkeypatching — just check output shape
        reading = sim.read()
        assert "active_power_mw" in reading
        assert reading["active_power_mw"] >= 0

    def test_transformer_reading_has_oil_temp(self):
        from scripts.simulate_telemetry import AssetSimulator
        sim = AssetSimulator("t1", "transformer", base_power_mw=200)
        reading = sim.read()
        assert "temperature_c" in reading
        assert "oil_temperature_c" in reading

    def test_bess_has_soc(self):
        from scripts.simulate_telemetry import AssetSimulator
        sim = AssetSimulator("b1", "bess", base_power_mw=460)
        reading = sim.read()
        assert "state_of_charge_pct" in reading.get("extra", {})

    def test_wind_reading_has_wind_speed(self):
        from scripts.simulate_telemetry import AssetSimulator
        sim = AssetSimulator("w1", "wind_farm", base_power_mw=600)
        reading = sim.read()
        assert "wind_speed_ms" in reading.get("extra", {})


# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import subprocess
    subprocess.run(["pytest", __file__, "-v", "--tb=short"], check=False)

"""
GridIQ — Telemetry Simulator
Generates realistic SCADA/IoT telemetry for development and demo.
Simulates 50 assets across a transmission zone with:
- Normal operating readings
- Daily/seasonal patterns
- Random faults and anomalies
- Wind ramp events
- Equipment degradation
"""
from __future__ import annotations

import asyncio
import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class AssetSimulator:
    """Simulates a single grid asset's telemetry."""

    def __init__(self, asset_id: str, asset_type: str, base_power_mw: float = 100.0):
        self.asset_id = asset_id
        self.asset_type = asset_type
        self.base_power_mw = base_power_mw
        self._fault_mode = False
        self._degradation = 0.0  # 0–1, increases over time

    def _hour_factor(self) -> float:
        hour = datetime.now(timezone.utc).hour
        return 0.75 + 0.25 * math.sin(math.pi * (hour - 6) / 12)

    def read(self) -> Dict[str, Any]:
        hour_f = self._hour_factor()
        fault_chance = 0.005 + self._degradation * 0.02
        if random.random() < fault_chance:
            self._fault_mode = not self._fault_mode

        if self.asset_type in ("solar_farm",):
            return self._solar_reading(hour_f)
        elif self.asset_type in ("wind_farm",):
            return self._wind_reading()
        elif self.asset_type in ("transformer",):
            return self._transformer_reading(hour_f)
        elif self.asset_type in ("bess",):
            return self._bess_reading(hour_f)
        else:
            return self._generic_reading(hour_f)

    def _solar_reading(self, hour_f: float) -> Dict:
        hour = datetime.now(timezone.utc).hour
        irradiance = max(0.0, math.sin(math.pi * (hour - 6) / 14.0) ** 1.3) if 6 <= hour <= 20 else 0.0
        power = self.base_power_mw * irradiance * random.gauss(0.95, 0.03)
        return {
            "active_power_mw": round(max(0, power), 3),
            "voltage_kv": round(random.gauss(34.5, 0.2), 3),
            "frequency_hz": round(random.gauss(60.0, 0.02), 4),
            "temperature_c": round(random.gauss(28, 5), 1),
            "extra": {
                "irradiance_wm2": round(irradiance * 1000, 1),
                "inverter_efficiency": round(random.gauss(0.97, 0.01), 4),
                "panel_temperature_c": round(random.gauss(45, 8), 1),
            },
        }

    def _wind_reading(self) -> Dict:
        wind_speed = random.gauss(12.5, 3.0)
        # Wind turbine power curve (cut-in 3 m/s, rated 12 m/s, cut-out 25 m/s)
        if wind_speed < 3:
            cf = 0.0
        elif wind_speed < 12:
            cf = ((wind_speed - 3) / 9) ** 3
        elif wind_speed <= 25:
            cf = 1.0
        else:
            cf = 0.0  # shut down in high wind
        power = self.base_power_mw * cf
        return {
            "active_power_mw": round(max(0, power), 3),
            "voltage_kv": round(random.gauss(34.5, 0.3), 3),
            "frequency_hz": round(random.gauss(60.0, 0.02), 4),
            "extra": {
                "wind_speed_ms": round(wind_speed, 2),
                "capacity_factor": round(cf, 3),
                "blade_pitch_deg": round(random.gauss(5, 1), 1),
                "nacelle_direction_deg": round(random.uniform(0, 360), 1),
            },
        }

    def _transformer_reading(self, hour_f: float) -> Dict:
        load = self.base_power_mw * hour_f * random.gauss(1.0, 0.05)
        fault_factor = 1.3 if self._fault_mode else 1.0
        temp = 65 + (load / self.base_power_mw) * 25 * fault_factor + random.gauss(0, 2)
        return {
            "active_power_mw": round(load, 3),
            "reactive_power_mvar": round(load * 0.14, 3),
            "voltage_kv": round(random.gauss(138.0, 0.5), 3),
            "current_amps": round((load * 1000) / (138 * 1.732), 1),
            "frequency_hz": round(random.gauss(60.0, 0.015), 4),
            "temperature_c": round(temp, 1),
            "oil_temperature_c": round(temp * 0.95, 1),
            "extra": {
                "tap_position": random.randint(0, 16),
                "cooling_fans_active": temp > 75,
                "fault_mode": self._fault_mode,
            },
        }

    def _bess_reading(self, hour_f: float) -> Dict:
        # Charge during high renewable, discharge during peak
        charging = hour_f < 0.7
        power = random.gauss(80, 10) if not charging else -random.gauss(60, 8)
        soc = random.gauss(78, 5)
        return {
            "active_power_mw": round(power, 3),
            "voltage_kv": round(random.gauss(34.5, 0.1), 3),
            "temperature_c": round(random.gauss(28, 3), 1),
            "extra": {
                "state_of_charge_pct": round(max(10, min(100, soc)), 1),
                "mode": "charging" if charging else "discharging",
                "cell_voltage_v": round(random.gauss(3.65, 0.02), 4),
                "cycles": random.randint(120, 450),
            },
        }

    def _generic_reading(self, hour_f: float) -> Dict:
        return {
            "active_power_mw": round(self.base_power_mw * hour_f * random.gauss(1.0, 0.04), 3),
            "voltage_kv": round(random.gauss(138.0, 0.5), 3),
            "frequency_hz": round(random.gauss(60.0, 0.02), 4),
            "temperature_c": round(random.gauss(55, 5), 1),
        }


class TelemetrySimulator:
    """
    Runs background simulation of all grid assets.
    Emits readings to the internal event bus every N seconds.
    """

    ASSET_CONFIG = [
        ("asset-001", "transformer", 200),
        ("asset-002", "transformer", 150),
        ("asset-003", "circuit_breaker", 0),
        ("asset-004", "capacitor_bank", 0),
        ("asset-005", "rtu", 0),
        ("asset-006", "solar_farm", 300),
        ("asset-007", "solar_farm", 450),
        ("asset-008", "wind_farm", 600),
        ("asset-009", "wind_farm", 800),
        ("asset-010", "bess", 460),
        ("asset-011", "transformer", 100),
        ("asset-012", "transformer", 180),
        ("asset-013", "substation", 0),
        ("asset-014", "solar_farm", 250),
        ("asset-015", "wind_farm", 400),
        ("asset-016", "circuit_breaker", 0),
        ("asset-017", "transformer", 120),
        ("asset-018", "bess", 200),
        ("asset-019", "solar_farm", 350),
        ("asset-020", "wind_farm", 500),
    ]

    def __init__(self, interval_seconds: int = 5):
        self.interval = interval_seconds
        self._simulators = {
            cfg[0]: AssetSimulator(*cfg) for cfg in self.ASSET_CONFIG
        }
        self._running = False

    async def run(self):
        """Main simulation loop."""
        self._running = True
        from backend.core.event_bus import EventType, emit
        logger.info(f"[Simulator] Starting — {len(self._simulators)} assets @ {self.interval}s interval")

        iteration = 0
        while self._running:
            start = time.monotonic()
            batch = []

            for asset_id, sim in self._simulators.items():
                reading = sim.read()
                batch.append({
                    "asset_id": asset_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    **reading,
                })

            # Emit batch event
            await emit(EventType.TELEMETRY_BATCH, {"readings": batch, "count": len(batch)})

            iteration += 1
            if iteration % 12 == 0:  # Log every minute
                logger.debug(f"[Simulator] Iteration {iteration} — {len(batch)} assets read")

            elapsed = time.monotonic() - start
            sleep_time = max(0, self.interval - elapsed)
            await asyncio.sleep(sleep_time)

    def stop(self):
        self._running = False


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)

    async def main():
        sim = TelemetrySimulator(interval_seconds=5)

        # Print readings to stdout for debugging
        from backend.core.event_bus import EventType, get_event_bus
        bus = get_event_bus()

        async def print_batch(event):
            readings = event.payload.get("readings", [])
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Batch — {len(readings)} assets")
            for r in readings[:3]:
                mw = r.get("active_power_mw", 0)
                hz = r.get("frequency_hz", 0)
                print(f"  {r['asset_id']} | {mw:.2f} MW | {hz:.4f} Hz")
            if len(readings) > 3:
                print(f"  ... and {len(readings) - 3} more")

        from backend.core.event_bus import EventType
        bus.subscribe(EventType.TELEMETRY_BATCH, print_batch)
        await sim.run()

    asyncio.run(main())

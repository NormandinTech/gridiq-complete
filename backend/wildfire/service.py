from __future__ import annotations
import random
from datetime import datetime
from typing import Optional

class WildfireEngine:

    CIRCUITS = [
        {"id": "C001", "name": "Sierra 230kV Feeder A", "miles": 14.3, "structures": 2840, "terrain": "steep_forested", "veg_risk": "HIGH"},
        {"id": "C002", "name": "Jarbo Gap Distribution", "miles": 8.7, "structures": 1200, "terrain": "canyon", "veg_risk": "HIGH"},
        {"id": "C003", "name": "Pulga Canyon Feeder", "miles": 6.2, "structures": 340, "terrain": "steep_forested", "veg_risk": "CRITICAL"},
        {"id": "C004", "name": "Feather River Line", "miles": 11.4, "structures": 890, "terrain": "canyon", "veg_risk": "MEDIUM"},
        {"id": "C005", "name": "Paradise Ridge Feeder", "miles": 9.8, "structures": 4200, "terrain": "WUI", "veg_risk": "HIGH"},
        {"id": "C006", "name": "Butte Creek Distribution", "miles": 7.1, "structures": 1560, "terrain": "mixed", "veg_risk": "MEDIUM"},
        {"id": "C007", "name": "Magalia Lateral", "miles": 5.3, "structures": 2100, "terrain": "WUI", "veg_risk": "HIGH"},
    ]

    TERRAIN_MULTIPLIERS = {
        "steep_forested": 2.4,
        "canyon": 2.1,
        "WUI": 1.9,
        "mixed": 1.4,
        "flat": 1.0,
    }

    VEG_SCORES = {"CRITICAL": 95, "HIGH": 75, "MEDIUM": 45, "LOW": 15}

    def _ignition_score(self, circuit: dict, wind_mph: float = 12, humidity: float = 28, temp_f: float = 82) -> dict:
        base = self.VEG_SCORES.get(circuit["veg_risk"], 45)
        wind_factor = min(wind_mph / 25, 1.0) * 30
        humidity_factor = max(0, (40 - humidity) / 40) * 25
        temp_factor = max(0, (temp_f - 70) / 60) * 15
        terrain_mult = self.TERRAIN_MULTIPLIERS.get(circuit["terrain"], 1.0)
        raw = (base + wind_factor + humidity_factor + temp_factor) * (terrain_mult / 2)
        score = min(round(raw), 99)

        if score >= 80:
            level = "CRITICAL"
            color = "#FF2D2D"
        elif score >= 60:
            level = "HIGH"
            color = "#FF6B00"
        elif score >= 40:
            level = "MEDIUM"
            color = "#F59E0B"
        else:
            level = "LOW"
            color = "#22C55E"

        spread_acres_1h = round(circuit["miles"] * terrain_mult * (score / 20))
        spread_acres_4h = spread_acres_1h * 4
        structures_threatened = round(circuit["structures"] * (score / 100) * terrain_mult * 0.3)

        return {
            "circuit_id": circuit["id"],
            "circuit_name": circuit["name"],
            "miles_of_line": circuit["miles"],
            "terrain_type": circuit["terrain"],
            "vegetation_risk": circuit["veg_risk"],
            "ignition_score": score,
            "ignition_level": level,
            "ignition_color": color,
            "structures_in_territory": circuit["structures"],
            "structures_threatened_if_ignition": structures_threatened,
            "estimated_spread_acres_1h": spread_acres_1h,
            "estimated_spread_acres_4h": spread_acres_4h,
            "recommended_action": self._action(level, circuit),
        }

    def _action(self, level: str, circuit: dict) -> str:
        if level == "CRITICAL":
            return f"De-energize {circuit['name']} immediately if Red Flag Warning issued. Pre-position crews."
        elif level == "HIGH":
            return f"Increase patrol frequency on {circuit['name']}. Alert field crews. Review PSPS threshold."
        elif level == "MEDIUM":
            return f"Monitor {circuit['name']} conditions. Ensure vegetation clearance is current."
        else:
            return f"Routine monitoring. No immediate action required."

    def assess_ignition_risk(self) -> dict:
        results = [self._ignition_score(c) for c in self.CIRCUITS]
        results.sort(key=lambda x: x["ignition_score"], reverse=True)
        critical = [r for r in results if r["ignition_level"] == "CRITICAL"]
        high = [r for r in results if r["ignition_level"] == "HIGH"]
        total_structures = sum(r["structures_threatened_if_ignition"] for r in results)
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "critical_circuits": len(critical),
                "high_risk_circuits": len(high),
                "total_structures_at_risk": total_structures,
                "highest_risk_circuit": results[0]["circuit_name"] if results else None,
                "highest_ignition_score": results[0]["ignition_score"] if results else 0,
                "overall_threat_level": "CRITICAL" if critical else "HIGH" if high else "MODERATE",
            },
            "circuits": results,
        }

    def forecast_spread(self) -> dict:
        risk = self.assess_ignition_risk()
        top = risk["circuits"][:3]
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "forecast_horizon_hours": 4,
            "top_threat_corridors": [
                {
                    "circuit_name": c["circuit_name"],
                    "ignition_score": c["ignition_score"],
                    "acres_at_risk_4h": c["estimated_spread_acres_4h"],
                    "structures_at_risk": c["structures_threatened_if_ignition"],
                    "terrain": c["terrain_type"],
                }
                for c in top
            ],
            "total_acres_at_risk_4h": sum(c["estimated_spread_acres_4h"] for c in top),
            "total_structures_at_risk": sum(c["structures_threatened_if_ignition"] for c in top),
        }

_engine: Optional[WildfireEngine] = None

def get_wildfire_engine() -> WildfireEngine:
    global _engine
    if _engine is None:
        _engine = WildfireEngine()
    return _engine

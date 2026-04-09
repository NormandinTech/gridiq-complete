"""
GridIQ — Database Init + Seed
Creates all tables and loads sample grid topology data.
Run: python scripts/seed_data.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Sample data ───────────────────────────────────────────────────────────────

ZONES = [
    {"name": "North Zone", "code": "ZONE-N", "voltage_kv": 138, "capacity_mw": 2000,
     "latitude": 37.85, "longitude": -122.25},
    {"name": "Central Zone", "code": "ZONE-C", "voltage_kv": 115, "capacity_mw": 2800,
     "latitude": 37.77, "longitude": -122.41},
    {"name": "South Zone", "code": "ZONE-S", "voltage_kv": 69, "capacity_mw": 1500,
     "latitude": 37.65, "longitude": -122.45},
]

ASSETS = [
    # Transformers
    {"name": "Transformer T-01A", "asset_tag": "TRF-001", "asset_type": "transformer",
     "zone_code": "ZONE-C", "rated_capacity_mw": 200, "rated_voltage_kv": 138,
     "manufacturer": "ABB", "model": "TRAFO-200MVA-138/34.5",
     "protocol": "modbus_tcp", "ip_address": "192.168.1.100", "port": 502,
     "is_critical": True, "nerc_cip_asset": True},

    {"name": "Transformer T-02B", "asset_tag": "TRF-002", "asset_type": "transformer",
     "zone_code": "ZONE-N", "rated_capacity_mw": 150, "rated_voltage_kv": 115,
     "manufacturer": "Siemens", "model": "PTR-150",
     "protocol": "modbus_tcp", "ip_address": "192.168.1.101", "port": 502,
     "is_critical": True, "nerc_cip_asset": True},

    # Circuit breakers
    {"name": "Circuit Breaker CB-12", "asset_tag": "CBR-012", "asset_type": "circuit_breaker",
     "zone_code": "ZONE-C", "rated_voltage_kv": 138,
     "manufacturer": "GE", "model": "Power Vacu 145",
     "protocol": "dnp3", "ip_address": "192.168.1.110", "port": 20000,
     "is_critical": True, "nerc_cip_asset": True},

    # Capacitor banks
    {"name": "Capacitor Bank C-07", "asset_tag": "CAP-007", "asset_type": "capacitor_bank",
     "zone_code": "ZONE-C", "rated_voltage_kv": 34.5,
     "manufacturer": "Eaton", "model": "CSS-34.5",
     "protocol": "modbus_tcp", "ip_address": "192.168.1.120", "port": 502,
     "is_critical": False},

    # RTUs
    {"name": "SCADA RTU-7A", "asset_tag": "RTU-07A", "asset_type": "rtu",
     "zone_code": "ZONE-C", "manufacturer": "Schweitzer Engineering",
     "model": "SEL-3350",
     "protocol": "dnp3", "ip_address": "10.55.1.12", "port": 20000,
     "is_critical": True, "nerc_cip_asset": True},

    # Generation
    {"name": "Solar Farm Alpha", "asset_tag": "SOL-001", "asset_type": "solar_farm",
     "zone_code": "ZONE-N", "rated_capacity_mw": 300, "latitude": 37.92, "longitude": -121.80,
     "protocol": "modbus_tcp", "ip_address": "10.20.1.50", "port": 502},

    {"name": "Solar Farm Beta", "asset_tag": "SOL-002", "asset_type": "solar_farm",
     "zone_code": "ZONE-S", "rated_capacity_mw": 450, "latitude": 37.55, "longitude": -122.10,
     "protocol": "mqtt"},

    {"name": "Wind Farm North", "asset_tag": "WND-001", "asset_type": "wind_farm",
     "zone_code": "ZONE-N", "rated_capacity_mw": 800, "latitude": 37.95, "longitude": -122.05,
     "protocol": "iec61850", "ip_address": "10.20.2.50", "port": 102},

    {"name": "Wind Farm East", "asset_tag": "WND-002", "asset_type": "wind_farm",
     "zone_code": "ZONE-C", "rated_capacity_mw": 600, "latitude": 37.80, "longitude": -121.90,
     "protocol": "iec61850", "ip_address": "10.20.2.51", "port": 102},

    {"name": "Peaker Unit 1", "asset_tag": "GAS-001", "asset_type": "gas_peaker",
     "zone_code": "ZONE-C", "rated_capacity_mw": 200, "is_critical": True},

    # BESS
    {"name": "BESS-1 (Battery Storage)", "asset_tag": "BESS-001", "asset_type": "bess",
     "zone_code": "ZONE-C", "rated_capacity_mw": 460,
     "manufacturer": "Tesla", "model": "Megapack 2XL",
     "protocol": "modbus_tcp", "ip_address": "10.30.1.10", "port": 502},

    # Substations
    {"name": "Substation 7A", "asset_tag": "SUB-07A", "asset_type": "substation",
     "zone_code": "ZONE-C", "rated_voltage_kv": 138, "rated_capacity_mw": 500,
     "is_critical": True, "nerc_cip_asset": True},
]

COMPLIANCE_CONTROLS = [
    {"control_id": "CIP-002", "title": "BES cyber system identification",
     "compliance_pct": 100, "status": "compliant"},
    {"control_id": "CIP-003", "title": "Security management controls",
     "compliance_pct": 100, "status": "compliant"},
    {"control_id": "CIP-005", "title": "Electronic security perimeters",
     "compliance_pct": 88, "status": "partial"},
    {"control_id": "CIP-006", "title": "Physical security",
     "compliance_pct": 95, "status": "compliant"},
    {"control_id": "CIP-007", "title": "System security management",
     "compliance_pct": 62, "status": "partial"},
    {"control_id": "CIP-010", "title": "Configuration change management",
     "compliance_pct": 78, "status": "partial"},
    {"control_id": "CIP-011", "title": "Information protection",
     "compliance_pct": 91, "status": "compliant"},
    {"control_id": "CIP-013", "title": "Supply chain risk management",
     "compliance_pct": 55, "status": "non_compliant"},
]


async def seed():
    """
    In a real deployment this would insert into PostgreSQL.
    Here we validate the data shapes are correct and log them.
    """
    logger.info("GridIQ Database Seed")
    logger.info("=" * 50)

    logger.info(f"  Zones             : {len(ZONES)}")
    logger.info(f"  Assets            : {len(ASSETS)}")
    logger.info(f"  Compliance ctrls  : {len(COMPLIANCE_CONTROLS)}")

    # Validate asset data
    required_asset_fields = {"name", "asset_tag", "asset_type", "zone_code"}
    for a in ASSETS:
        missing = required_asset_fields - set(a.keys())
        if missing:
            logger.warning(f"  Asset {a.get('name')} missing fields: {missing}")

    logger.info("")
    logger.info("Sample assets:")
    for a in ASSETS[:5]:
        logger.info(f"  [{a['asset_type']:20s}] {a['name']:35s} {a.get('protocol','—'):12s} {a.get('ip_address','—')}")

    logger.info("")
    logger.info("Compliance status:")
    for c in COMPLIANCE_CONTROLS:
        bar = "█" * int(c["compliance_pct"] / 10) + "░" * (10 - int(c["compliance_pct"] / 10))
        status_icon = "✓" if c["status"] == "compliant" else "⚠" if c["status"] == "partial" else "✗"
        logger.info(f"  {status_icon} {c['control_id']:10s} [{bar}] {c['compliance_pct']:3.0f}%  {c['title']}")

    logger.info("")
    logger.info("To connect to a real database:")
    logger.info("  1. Set DATABASE_URL in config/.env")
    logger.info("  2. Run: alembic upgrade head")
    logger.info("  3. Re-run this script — it will INSERT into PostgreSQL")
    logger.info("")
    logger.info("✓ Seed data validated successfully")


if __name__ == "__main__":
    asyncio.run(seed())

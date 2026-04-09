"""
GridIQ — Database Initialization Script
Runs Alembic migrations and seeds initial data.
Called by the deploy script and on first container start.

Usage:
  python scripts/init_db.py          # run migrations + seed
  python scripts/init_db.py --reset  # drop everything and rebuild (dev only)
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def run_migrations() -> None:
    """Run all pending Alembic migrations."""
    from alembic.config import Config
    from alembic import command

    logger.info("Running database migrations...")
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")
    logger.info("Migrations complete")


async def seed_zones() -> None:
    """Seed grid zones if not already present."""
    from backend.db.database import AsyncSessionLocal
    from backend.models.db_models import GridZone
    from sqlalchemy import select
    from uuid import uuid4

    zones = [
        {"id": str(uuid4()), "name": "North Zone",    "code": "ZONE-N",
         "voltage_kv": 138, "capacity_mw": 2000, "latitude": 37.85, "longitude": -122.25},
        {"id": str(uuid4()), "name": "Central Zone",  "code": "ZONE-C",
         "voltage_kv": 115, "capacity_mw": 2800, "latitude": 37.77, "longitude": -122.41},
        {"id": str(uuid4()), "name": "South Zone",    "code": "ZONE-S",
         "voltage_kv":  69, "capacity_mw": 1500, "latitude": 37.65, "longitude": -122.45},
    ]

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(GridZone).limit(1))
        if result.scalar():
            logger.info("Zones already seeded — skipping")
            return

        for z in zones:
            session.add(GridZone(**z))
        await session.commit()
        logger.info(f"Seeded {len(zones)} grid zones")


async def seed_assets() -> None:
    """Seed demo assets if not already present."""
    from backend.db.database import AsyncSessionLocal
    from backend.models.db_models import Asset, GridZone, AssetType, AssetStatus
    from sqlalchemy import select
    from uuid import uuid4
    from datetime import datetime, timezone, timedelta

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Asset).limit(1))
        if result.scalar():
            logger.info("Assets already seeded — skipping")
            return

        # Get zone IDs
        zones = (await session.execute(select(GridZone))).scalars().all()
        zone_map = {z.code: z.id for z in zones}

        assets = [
            {"name": "Transformer T-01A",      "asset_tag": "TRF-001",
             "asset_type": AssetType.TRANSFORMER,    "zone_id": zone_map.get("ZONE-C"),
             "rated_capacity_mw": 200, "rated_voltage_kv": 138,
             "manufacturer": "ABB",    "protocol": "modbus_tcp",
             "ip_address": "192.168.1.100", "port": 502,
             "is_critical": True, "nerc_cip_asset": True, "health_score": 89.0},

            {"name": "Transformer T-02B",      "asset_tag": "TRF-002",
             "asset_type": AssetType.TRANSFORMER,    "zone_id": zone_map.get("ZONE-N"),
             "rated_capacity_mw": 150, "rated_voltage_kv": 115,
             "manufacturer": "Siemens", "protocol": "modbus_tcp",
             "ip_address": "192.168.1.101", "port": 502,
             "is_critical": True, "health_score": 82.0},

            {"name": "Circuit Breaker CB-12",  "asset_tag": "CBR-012",
             "asset_type": AssetType.CIRCUIT_BREAKER, "zone_id": zone_map.get("ZONE-C"),
             "rated_voltage_kv": 138, "manufacturer": "GE",
             "protocol": "dnp3", "ip_address": "192.168.1.110", "port": 20000,
             "is_critical": True, "health_score": 61.0},

            {"name": "Capacitor Bank C-07",    "asset_tag": "CAP-007",
             "asset_type": AssetType.CAPACITOR_BANK, "zone_id": zone_map.get("ZONE-C"),
             "rated_voltage_kv": 34.5, "manufacturer": "Eaton",
             "protocol": "modbus_tcp", "ip_address": "192.168.1.120",
             "health_score": 38.0},

            {"name": "SCADA RTU-7A",           "asset_tag": "RTU-07A",
             "asset_type": AssetType.RTU,            "zone_id": zone_map.get("ZONE-C"),
             "manufacturer": "SEL", "model": "SEL-3350",
             "protocol": "dnp3", "ip_address": "10.55.1.12", "port": 20000,
             "is_critical": True, "nerc_cip_asset": True, "health_score": 97.0},

            {"name": "Solar Farm Alpha",        "asset_tag": "SOL-001",
             "asset_type": AssetType.SOLAR_FARM,     "zone_id": zone_map.get("ZONE-N"),
             "rated_capacity_mw": 300, "latitude": 37.92, "longitude": -121.80,
             "protocol": "modbus_tcp", "ip_address": "10.20.1.50", "health_score": 91.0},

            {"name": "Solar Farm Beta",         "asset_tag": "SOL-002",
             "asset_type": AssetType.SOLAR_FARM,     "zone_id": zone_map.get("ZONE-S"),
             "rated_capacity_mw": 450, "latitude": 37.55, "longitude": -122.10,
             "protocol": "mqtt", "health_score": 88.0},

            {"name": "Wind Farm North",         "asset_tag": "WND-001",
             "asset_type": AssetType.WIND_FARM,      "zone_id": zone_map.get("ZONE-N"),
             "rated_capacity_mw": 800, "latitude": 37.95, "longitude": -122.05,
             "protocol": "iec61850", "ip_address": "10.20.2.50", "health_score": 76.0},

            {"name": "Wind Farm East",          "asset_tag": "WND-002",
             "asset_type": AssetType.WIND_FARM,      "zone_id": zone_map.get("ZONE-C"),
             "rated_capacity_mw": 600, "latitude": 37.80, "longitude": -121.90,
             "protocol": "iec61850", "ip_address": "10.20.2.51", "health_score": 84.0},

            {"name": "Peaker Unit 1",           "asset_tag": "GAS-001",
             "asset_type": AssetType.GAS_PEAKER,     "zone_id": zone_map.get("ZONE-C"),
             "rated_capacity_mw": 200, "is_critical": True, "health_score": 79.0},

            {"name": "BESS-1 Tesla Megapack",   "asset_tag": "BESS-001",
             "asset_type": AssetType.BESS,           "zone_id": zone_map.get("ZONE-C"),
             "rated_capacity_mw": 460, "manufacturer": "Tesla", "model": "Megapack 2XL",
             "protocol": "modbus_tcp", "ip_address": "10.30.1.10", "health_score": 84.0},

            {"name": "Substation 7A",           "asset_tag": "SUB-07A",
             "asset_type": AssetType.SUBSTATION,     "zone_id": zone_map.get("ZONE-C"),
             "rated_voltage_kv": 138, "rated_capacity_mw": 500,
             "is_critical": True, "nerc_cip_asset": True, "health_score": 95.0},
        ]

        for a in assets:
            session.add(Asset(
                id=str(uuid4()),
                status=AssetStatus.ONLINE,
                install_date=datetime.now(timezone.utc) - timedelta(days=1000),
                **a,
            ))
        await session.commit()
        logger.info(f"Seeded {len(assets)} assets")


async def seed_compliance_controls() -> None:
    """Seed NERC CIP compliance controls."""
    from backend.db.database import AsyncSessionLocal
    from backend.models.db_models import ComplianceControl
    from sqlalchemy import select
    from uuid import uuid4
    from datetime import datetime, timezone, timedelta

    controls = [
        {"control_id": "CIP-002", "title": "BES cyber system identification",
         "category": "Asset Management",    "compliance_pct": 100.0, "status": "compliant"},
        {"control_id": "CIP-003", "title": "Security management controls",
         "category": "Governance",          "compliance_pct": 100.0, "status": "compliant"},
        {"control_id": "CIP-005", "title": "Electronic security perimeters",
         "category": "Network Security",    "compliance_pct": 88.0,  "status": "partial"},
        {"control_id": "CIP-006", "title": "Physical security",
         "category": "Physical Security",   "compliance_pct": 95.0,  "status": "compliant"},
        {"control_id": "CIP-007", "title": "System security management",
         "category": "Endpoint Security",   "compliance_pct": 62.0,  "status": "partial",
         "findings": "3 systems have patches overdue. 2 legacy RTUs need hardening."},
        {"control_id": "CIP-010", "title": "Configuration change management",
         "category": "Change Management",   "compliance_pct": 78.0,  "status": "partial"},
        {"control_id": "CIP-011", "title": "Information protection",
         "category": "Data Protection",     "compliance_pct": 91.0,  "status": "compliant"},
        {"control_id": "CIP-013", "title": "Supply chain risk management",
         "category": "Supply Chain",        "compliance_pct": 55.0,  "status": "non_compliant",
         "findings": "Vendor risk assessment incomplete for 4 suppliers."},
    ]

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ComplianceControl).limit(1))
        if result.scalar():
            logger.info("Compliance controls already seeded — skipping")
            return

        for c in controls:
            session.add(ComplianceControl(
                id=str(uuid4()),
                standard="NERC_CIP",
                description=f"NERC CIP {c['control_id']} requirements",
                last_assessed=datetime.now(timezone.utc),
                due_date=datetime.now(timezone.utc) + timedelta(days=60),
                **c,
            ))
        await session.commit()
        logger.info(f"Seeded {len(controls)} compliance controls")


async def main(reset: bool = False) -> None:
    logger.info("=" * 50)
    logger.info("  GridIQ Database Initialization")
    logger.info("=" * 50)

    if reset:
        logger.warning("RESET MODE — dropping all tables")
        from backend.db.database import engine
        from backend.models.db_models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logger.info("All tables dropped")

    await run_migrations()
    await seed_zones()
    await seed_assets()
    await seed_compliance_controls()

    logger.info("")
    logger.info("✓ Database initialization complete")
    logger.info("  Run the API: uvicorn backend.main:app --reload")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    if reset and os.getenv("APP_ENV") == "production":
        logger.error("RESET not allowed in production — set APP_ENV=development first")
        sys.exit(1)
    asyncio.run(main(reset=reset))

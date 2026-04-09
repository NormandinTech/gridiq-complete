from fastapi import APIRouter
from backend.wildfire.service import get_wildfire_engine

wildfire_router = APIRouter(prefix="/wildfire", tags=["Wildfire"])

@wildfire_router.get("/ignition-risk")
async def get_ignition_risk():
    return get_wildfire_engine().assess_ignition_risk()

@wildfire_router.get("/spread-forecast")
async def get_spread_forecast():
    return get_wildfire_engine().forecast_spread()

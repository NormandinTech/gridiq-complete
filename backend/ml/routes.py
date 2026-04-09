from fastapi import APIRouter
from backend.ml.anomaly import get_anomaly_detector

ml_router = APIRouter(prefix="/ml", tags=["ML Anomaly Detection"])

@ml_router.get("/anomaly/fleet")
async def get_fleet_anomalies():
    detector = get_anomaly_detector()
    summary = detector.fleet_summary()
    results = []
    for asset_id, samples in detector._total_samples.items():
        baselines = detector._baselines.get(asset_id, {})
        latest_telemetry = {param: vals[-1] for param, vals in baselines.items() if vals}
        score = detector.score(asset_id, latest_telemetry)
        results.append({
            "asset_id": asset_id,
            "asset_name": asset_id,
            **score,
        })
    results.sort(key=lambda x: x["anomaly_score"], reverse=True)
    critical = [r for r in results if r["anomaly_level"] == "CRITICAL"]
    high = [r for r in results if r["anomaly_level"] == "HIGH"]
    return {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat(),
        "summary": {
            "total_assets": len(results),
            "critical_anomalies": len(critical),
            "high_anomalies": len(high),
            **summary,
        },
        "assets": results,
    }

@ml_router.get("/anomaly/summary/fleet")
async def get_ml_summary():
    return get_anomaly_detector().fleet_summary()

@ml_router.get("/anomaly/{asset_id}")
async def get_asset_anomaly(asset_id: str):
    detector = get_anomaly_detector()
    baselines = detector._baselines.get(asset_id, {})
    if not baselines:
        return {"error": f"No telemetry trained for {asset_id}"}
    latest = {param: vals[-1] for param, vals in baselines.items() if vals}
    return {
        "asset_id": asset_id,
        **detector.score(asset_id, latest),
    }

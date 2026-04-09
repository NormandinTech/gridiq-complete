from fastapi import APIRouter
from fastapi.responses import Response
from datetime import datetime, timezone
from backend.assets.fault_detector import fault_detector
from backend.weather.service import get_weather_service
from backend.predictive.service import get_scoring_engine

pdf_router = APIRouter(prefix="/reports", tags=["Reports"])

def _preds():
    e = get_scoring_engine()
    assets = []
    seen = set()
    for aid in fault_detector._history.keys():
        h = list(fault_detector._history[aid])
        last = h[-1].get("telemetry",{}) if h else {}
        assets.append({"asset_id":aid,"asset_name":last.get("asset_name",aid),"asset_type":last.get("asset_type","default"),"asset_meta":{}})
        seen.add(aid)
    for f in fault_detector.get_active_faults():
        if f.asset_id not in seen:
            assets.append({"asset_id":f.asset_id,"asset_name":f.asset_name,"asset_type":f.asset_type,"asset_meta":{}})
    return e.score_fleet(assets, fault_detector)

CSS = open("/root/report_css.txt").read()

def _build_html(utility_name, faults, preds, weather):
    now = datetime.now(timezone.utc)
    critical = [f for f in faults if f.severity.value=="critical"]
    high = [f for f in faults if f.severity.value=="high"]
    wind = getattr(weather,"wind_speed_mph",None) if weather else None
    hum = getattr(weather,"humidity_pct",None) if weather else None
    temp = getattr(weather,"temperature_f",None) if weather else None
    rflag = getattr(weather,"red_flag_warning",False) if weather else False
    station = getattr(weather,"station_name","N/A") if weather else "N/A"
    top_preds = sorted(preds, key=lambda x: x.score_30d, reverse=True)[:5] if preds else []

    fault_rows = ""
    for f in faults[:15]:
        sc = "#FF4444" if f.severity.value=="critical" else "#F59E0B" if f.severity.value=="high" else "#3A86FF"
        fault_rows += "<tr><td>"+f.asset_name+"</td><td>"+f.asset_type+"</td><td style='color:"+sc+";font-weight:600'>"+f.severity.value.upper()+"</td><td>"+f.fault_code+"</td><td>"+f.title+"</td></tr>"

    pred_rows = ""
    for p in top_preds:
        rc = "#FF4444" if p.risk_level=="CRITICAL" else "#F59E0B" if p.risk_level=="HIGH" else "#3A86FF"
        pred_rows += "<tr><td>"+p.asset_name+"</td><td>"+p.asset_type+"</td><td style='color:"+rc+";font-weight:600'>"+p.risk_level+"</td><td>"+str(p.score_30d)+"%</td><td>"+str(p.score_60d)+"%</td><td>"+str(p.score_90d)+"%</td></tr>"

    action_items = ""
    for f in critical[:5]:
        action_items += "<div class='alert-box'><strong>IMMEDIATE - "+f.asset_name+":</strong> "+f.title+" - Severity: CRITICAL. Dispatch crew within 24 hours per NERC FAC-003-5.</div>"
    for f in high[:5]:
        action_items += "<div class='warn-box'><strong>PRIORITY - "+f.asset_name+":</strong> "+f.title+" - Schedule inspection within 7 days.</div>"
    if not critical and not high:
        action_items = "<div class='ok-box'><strong>No immediate actions required.</strong> Continue routine monitoring.</div>"

    compliance_status = "ACTION REQUIRED" if critical else "COMPLIANT"
    compliance_color = "badge-red" if critical else "badge-green"
    rflag_color = "badge-red" if rflag else "badge-green"
    rflag_text = "WARNING" if rflag else "CLEAR"
    wind_status = "<span class='badge badge-red'>ELEVATED</span>" if wind and wind > 35 else "<span class='badge badge-green'>NORMAL</span>"
    hum_status = "<span class='badge badge-red'>CRITICAL</span>" if hum and hum < 15 else "<span class='badge badge-green'>NORMAL</span>"
    temp_status = "<span class='badge badge-red'>ELEVATED</span>" if temp and temp > 95 else "<span class='badge badge-green'>NORMAL</span>"
    exec_alert = "<div class='alert-box'><strong>COMPLIANCE ACTION REQUIRED:</strong> "+str(len(critical))+" critical fault(s) detected requiring immediate remediation per NERC FAC-003-5 Section 5.</div>" if critical else "<div class='ok-box'><strong>NO CRITICAL VIOLATIONS:</strong> All monitored assets within NERC compliance thresholds.</div>"
    fault_section = "<p style='color:#666;font-style:italic'>No active faults detected.</p>" if not faults else "<table><tr><th>Asset</th><th>Type</th><th>Severity</th><th>Code</th><th>Description</th></tr>"+fault_rows+"</table>"
    pred_section = "<p style='color:#666;font-style:italic'>Insufficient telemetry history.</p>" if not top_preds else "<table><tr><th>Asset</th><th>Type</th><th>Risk</th><th>30d</th><th>60d</th><th>90d</th></tr>"+pred_rows+"</table>"

    return ("<!DOCTYPE html><html><head><meta charset='UTF-8'><style>"+CSS+"</style></head><body>"
        +"<div style='display:flex;justify-content:space-between;margin-bottom:24pt'>"
        +"<div><h1>GridIQ NERC Compliance Report</h1><div style='font-size:12pt;color:#666'>"+utility_name+"</div></div>"
        +"<div style='font-size:10pt;color:#666;text-align:right'>Report ID: CCR-"+now.strftime("%Y%m%d-%H%M%S")+"<br>Generated: "+now.strftime("%B %d, %Y %H:%M UTC")+"<br>GridIQ Platform v1.0.0</div></div>"
        +"<div class='kpi-row'>"
        +"<div class='kpi'><div class='kpi-num' style='color:#FF4444'>"+str(len(critical))+"</div><div class='kpi-label'>Critical Faults</div></div>"
        +"<div class='kpi'><div class='kpi-num' style='color:#F59E0B'>"+str(len(high))+"</div><div class='kpi-label'>High Severity</div></div>"
        +"<div class='kpi'><div class='kpi-num'>"+str(len(faults))+"</div><div class='kpi-label'>Total Faults</div></div>"
        +"<div class='kpi'><div class='kpi-num' style='color:"+("#FF4444" if rflag else "#22C55E")+"'>"+("YES" if rflag else "NO")+"</div><div class='kpi-label'>Red Flag Warning</div></div>"
        +"</div>"
        +"<h2>1. Executive Summary</h2>"
        +"<p>This report documents the operational and compliance status of "+utility_name+" grid assets as monitored by GridIQ as of "+now.strftime("%B %d, %Y")+".</p>"
        +exec_alert
        +"<h2>2. Weather Conditions</h2>"
        +"<table><tr><th>Parameter</th><th>Value</th><th>Threshold</th><th>Status</th></tr>"
        +"<tr><td>Wind Speed</td><td>"+(str(wind)+" mph" if wind else "N/A")+"</td><td>Less than 35 mph</td><td>"+wind_status+"</td></tr>"
        +"<tr><td>Humidity</td><td>"+(str(hum)+"%" if hum else "N/A")+"</td><td>Greater than 15%</td><td>"+hum_status+"</td></tr>"
        +"<tr><td>Temperature</td><td>"+(str(temp)+"F" if temp else "N/A")+"</td><td>Less than 95F</td><td>"+temp_status+"</td></tr>"
        +"<tr><td>Red Flag Warning</td><td>"+("ACTIVE" if rflag else "None")+"</td><td>None active</td><td><span class='badge "+rflag_color+"'>"+rflag_text+"</span></td></tr>"
        +"<tr><td>Station</td><td colspan='3'>"+station+"</td></tr></table>"
        +"<h2>3. Active Fault Inventory</h2>"+fault_section
        +"<h2>4. Predictive Risk — 30/60/90 Day</h2>"+pred_section
        +"<h2>5. NERC Standards Status</h2>"
        +"<table><tr><th>Standard</th><th>Description</th><th>Module</th><th>Status</th></tr>"
        +"<tr><td>FAC-003-5</td><td>Vegetation Management</td><td>Vegetation Risk Engine</td><td><span class='badge badge-green'>MONITORED</span></td></tr>"
        +"<tr><td>FAC-001-3</td><td>Facility Ratings</td><td>Asset Intelligence</td><td><span class='badge badge-green'>MONITORED</span></td></tr>"
        +"<tr><td>TOP-001-5</td><td>Transmission Operations</td><td>PSPS Decision Support</td><td><span class='badge badge-green'>MONITORED</span></td></tr>"
        +"<tr><td>CIP-002-5.1a</td><td>BES Cyber System Categorization</td><td>Security Module</td><td><span class='badge badge-green'>MONITORED</span></td></tr>"
        +"<tr><td>MOD-032-1</td><td>Model Validation</td><td>Digital Twin</td><td><span class='badge "+compliance_color+"'>"+compliance_status+"</span></td></tr>"
        +"</table>"
        +"<h2>6. Recommended Actions</h2>"+action_items
        +"<div class='footer'>GridIQ Platform v1.0.0 - NormandinTECH - Paradise, CA - gridiq.ink<br>Generated "+now.strftime("%Y-%m-%d %H:%M:%S UTC")+"</div>"
        +"</body></html>")

@pdf_router.get("/nerc-compliance")
async def get_nerc_report(utility_name: str = "GridIQ Demo Utility"):
    weather = await get_weather_service().get_conditions(lat=39.7596, lon=-121.6219)
    faults = fault_detector.get_active_faults()
    preds = _preds()
    html = _build_html(utility_name, faults, preds, weather)
    return Response(content=html, media_type="text/html", headers={"Content-Disposition": "inline; filename=GridIQ_NERC_Report.html"})

@pdf_router.get("/nerc-compliance/download")
async def download_nerc_report(utility_name: str = "GridIQ Demo Utility"):
    weather = await get_weather_service().get_conditions(lat=39.7596, lon=-121.6219)
    faults = fault_detector.get_active_faults()
    preds = _preds()
    html = _build_html(utility_name, faults, preds, weather)
    return Response(content=html, media_type="text/html", headers={"Content-Disposition": "attachment; filename=GridIQ_NERC_Report.html"})

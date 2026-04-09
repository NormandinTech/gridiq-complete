from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from backend.scada.service import get_scada_service, PROTOCOL_DEFAULT_PORTS, PROTOCOL_DATA_POINTS
scada_router = APIRouter(prefix="/scada", tags=["SCADA Connector"])
class ConnectionRequest(BaseModel):
    utility_name: str
    protocol: str
    host: str
    port: Optional[int] = None
    asset_id: str
    asset_name: str
    asset_type: str
    unit_id: Optional[int] = 1
@scada_router.get("/summary")
async def get_summary(): return get_scada_service().get_summary()
@scada_router.get("/connections")
async def get_connections():
    conns = get_scada_service().get_all_connections()
    return {"total":len(conns),"connections":[c.__dict__ for c in conns]}
@scada_router.post("/test")
async def test_connection(protocol: str = Query(default="modbus_tcp"), host: str = Query(default="192.168.1.100"), port: Optional[int] = Query(default=None), asset_id: str = Query(default="test"), unit_id: int = Query(default=1)):
    port = port or PROTOCOL_DEFAULT_PORTS.get(protocol, 502)
    result = await get_scada_service().test_connection(protocol, host, port, asset_id, unit_id)
    return result.__dict__
@scada_router.post("/connect")
async def add_connection(req: ConnectionRequest):
    port = req.port or PROTOCOL_DEFAULT_PORTS.get(req.protocol, 502)
    conn = await get_scada_service().add_connection(utility_name=req.utility_name, protocol=req.protocol, host=req.host, port=port, asset_id=req.asset_id, asset_name=req.asset_name, asset_type=req.asset_type, unit_id=req.unit_id or 1)
    return conn.__dict__
@scada_router.get("/poll/{connection_id}")
async def poll_connection(connection_id: str):
    result = await get_scada_service().poll_connection(connection_id)
    if not result: return {"error":"Connection not found"}
    return result
@scada_router.get("/protocols")
async def get_protocols():
    return {"protocols":[{"name":"modbus_tcp","label":"Modbus TCP","default_port":502,"common_use":"PLCs, power meters, RTUs"},{"name":"dnp3","label":"DNP3","default_port":20000,"common_use":"Protection relays, IEDs, substations"},{"name":"iec61850","label":"IEC 61850 MMS","default_port":102,"common_use":"Modern digital substations"},{"name":"mqtt","label":"MQTT","default_port":1883,"common_use":"Smart meters, IoT sensors"}],"data_points":PROTOCOL_DATA_POINTS}

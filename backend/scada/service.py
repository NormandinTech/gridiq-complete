from __future__ import annotations
import logging, hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from backend.protocols.adapters import create_adapter
logger = logging.getLogger("gridiq.scada")
PROTOCOL_DEFAULT_PORTS = {"modbus_tcp":502,"dnp3":20000,"iec61850":102,"mqtt":1883}
PROTOCOL_DATA_POINTS = {"modbus_tcp":["active_power_mw","voltage_kv","current_amps","frequency_hz","temperature_c"],"dnp3":["active_power_mw","voltage_kv","frequency_hz","breaker_state"],"iec61850":["active_power_mw","voltage_kv","frequency_hz","cbr_position"],"mqtt":["active_power_mw","voltage_kv","current_amps"]}
@dataclass
class SCADAConnection:
    connection_id: str
    utility_name: str
    protocol: str
    host: str
    port: int
    asset_id: str
    asset_name: str
    asset_type: str
    unit_id: int
    status: str
    last_read: Optional[str]
    last_error: Optional[str]
    read_count: int
    error_count: int
    created_at: str
    live_mode: bool
@dataclass
class ConnectionTestResult:
    success: bool
    protocol: str
    host: str
    port: int
    latency_ms: float
    data_points_found: List[str]
    sample_reading: Optional[Dict]
    error: Optional[str]
    tested_at: str
DEMO_CONNECTIONS = [
    {"connection_id":"SCADA-001","utility_name":"GridIQ Demo","protocol":"modbus_tcp","host":"192.168.1.100","port":502,"asset_id":"txn-001","asset_name":"Sierra 230kV Line","asset_type":"transmission_line","unit_id":1,"status":"simulated","last_read":None,"last_error":None,"read_count":0,"error_count":0,"live_mode":False},
    {"connection_id":"SCADA-002","utility_name":"GridIQ Demo","protocol":"dnp3","host":"192.168.1.101","port":20000,"asset_id":"bess-002","asset_name":"BESS-2 South Substation","asset_type":"bess","unit_id":10,"status":"simulated","last_read":None,"last_error":None,"read_count":0,"error_count":0,"live_mode":False},
    {"connection_id":"SCADA-003","utility_name":"GridIQ Demo","protocol":"iec61850","host":"192.168.1.102","port":102,"asset_id":"txn-002","asset_name":"Sierra 230kV Tower 22","asset_type":"transmission_line","unit_id":1,"status":"simulated","last_read":None,"last_error":None,"read_count":0,"error_count":0,"live_mode":False},
    {"connection_id":"SCADA-004","utility_name":"GridIQ Demo","protocol":"mqtt","host":"mqtt.gridiq.ink","port":1883,"asset_id":"ami-001","asset_name":"Meter Zone-7","asset_type":"smart_meter","unit_id":1,"status":"simulated","last_read":None,"last_error":None,"read_count":0,"error_count":0,"live_mode":False},
]
class SCADAConnectorService:
    def __init__(self):
        self._connections = {}
        now = datetime.now(timezone.utc).isoformat()
        for d in DEMO_CONNECTIONS:
            c = SCADAConnection(created_at=now, **d)
            self._connections[c.connection_id] = c
    async def test_connection(self, protocol, host, port, asset_id="test", unit_id=1):
        import time
        now = datetime.now(timezone.utc)
        start = time.monotonic()
        try:
            adapter = create_adapter(asset_id=asset_id, asset_tag=asset_id, protocol=protocol, ip_address=host, port=port, unit_id=unit_id)
            connected = await adapter.connect()
            if connected:
                reading = await adapter.safe_read()
                latency = (time.monotonic()-start)*1000
                await adapter.disconnect()
                pts = [k for k,v in reading.__dict__.items() if v is not None and k not in ("asset_id","asset_tag","protocol","timestamp","error","read_latency_ms","extra","status_raw")]
                sample = {k:v for k,v in reading.__dict__.items() if v is not None and k not in ("asset_id","asset_tag","protocol","timestamp","error","status_raw")}
                return ConnectionTestResult(success=reading.error is None, protocol=protocol, host=host, port=port, latency_ms=round(latency,1), data_points_found=pts, sample_reading=sample, error=reading.error, tested_at=now.isoformat())
        except Exception as e:
            latency = (time.monotonic()-start)*1000
            return ConnectionTestResult(success=False, protocol=protocol, host=host, port=port, latency_ms=round(latency,1), data_points_found=[], sample_reading=None, error=str(e), tested_at=now.isoformat())
    async def add_connection(self, utility_name, protocol, host, port, asset_id, asset_name, asset_type, unit_id=1):
        now = datetime.now(timezone.utc)
        cid = "SCADA-" + hashlib.md5(f"{host}{port}{asset_id}".encode()).hexdigest()[:8].upper()
        conn = SCADAConnection(connection_id=cid, utility_name=utility_name, protocol=protocol, host=host, port=port, asset_id=asset_id, asset_name=asset_name, asset_type=asset_type, unit_id=unit_id, status="pending", last_read=None, last_error=None, read_count=0, error_count=0, created_at=now.isoformat(), live_mode=False)
        self._connections[cid] = conn
        logger.info(f"[SCADA] New connection: {cid} {asset_name} via {protocol} @ {host}:{port}")
        test = await self.test_connection(protocol, host, port, asset_id, unit_id)
        conn.status = "connected" if test.success else "error"
        conn.live_mode = test.success and "192.168." not in host
        if not test.success: conn.last_error = test.error
        return conn
    async def poll_connection(self, connection_id):
        conn = self._connections.get(connection_id)
        if not conn: return None
        try:
            adapter = create_adapter(asset_id=conn.asset_id, asset_tag=conn.asset_id, protocol=conn.protocol, ip_address=conn.host, port=conn.port, unit_id=conn.unit_id)
            reading = await adapter.safe_read()
            conn.last_read = datetime.now(timezone.utc).isoformat()
            conn.read_count += 1
            if reading.error:
                conn.error_count += 1; conn.last_error = reading.error; conn.status = "error"
            else:
                conn.status = "connected" if conn.live_mode else "simulated"
            return reading.__dict__
        except Exception as e:
            conn.error_count += 1; conn.last_error = str(e); conn.status = "error"
            return None
    def get_all_connections(self): return list(self._connections.values())
    def get_summary(self):
        conns = list(self._connections.values())
        return {"total_connections":len(conns),"live":sum(1 for c in conns if c.live_mode),"simulated":sum(1 for c in conns if c.status=="simulated"),"error":sum(1 for c in conns if c.status=="error"),"protocols":list(set(c.protocol for c in conns)),"assets_connected":list(set(c.asset_id for c in conns))}
_svc = None
def get_scada_service():
    global _svc
    if _svc is None: _svc = SCADAConnectorService()
    return _svc

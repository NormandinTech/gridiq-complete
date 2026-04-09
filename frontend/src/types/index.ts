// GridIQ Frontend — TypeScript Types
// Mirrors the Pydantic schemas from backend/models/schemas.py

// ── Grid KPIs ─────────────────────────────────────────────────────────────────

export interface GridKPIs {
  timestamp: string
  total_load_mw: number
  total_generation_mw: number
  renewable_mw: number
  renewable_pct: number
  frequency_hz: number
  transmission_capacity_used_pct: number
  voltage_stability_index: number
  co2_intensity_g_kwh: number
  co2_avoided_tonnes_today: number
  system_inertia_pct: number
  active_alerts: number
  assets_online: number
  assets_total: number
}

export interface EnergyMix {
  timestamp: string
  solar_mw: number
  wind_mw: number
  hydro_mw: number
  gas_mw: number
  import_mw: number
  bess_charging_mw: number
  bess_discharging_mw: number
  renewable_pct: number
}

export interface GridTopologyNode {
  id: string
  type: string
  name: string
  mw?: number
  voltage_kv?: number
  soc_pct?: number
  status: 'online' | 'offline' | 'degraded' | 'maintenance'
}

export interface GridTopologyEdge {
  from: string
  to: string
  mw: number
  direction: 'in' | 'out' | 'charging' | 'discharging'
}

export interface GridTopology {
  timestamp: string
  nodes: GridTopologyNode[]
  edges: GridTopologyEdge[]
}

// ── Assets ────────────────────────────────────────────────────────────────────

export type AssetType =
  | 'transformer' | 'circuit_breaker' | 'switch' | 'capacitor_bank'
  | 'rtu' | 'scada_server' | 'solar_farm' | 'wind_farm'
  | 'hydro_plant' | 'gas_peaker' | 'bess' | 'substation'
  | 'transmission_line' | 'smart_meter' | 'ev_charger'

export type AssetStatus = 'online' | 'offline' | 'degraded' | 'maintenance' | 'unknown'

export interface Asset {
  id: string
  name: string
  asset_tag: string
  asset_type: AssetType
  zone_id?: string
  status: AssetStatus
  health_score: number
  rated_capacity_mw?: number
  rated_voltage_kv?: number
  latitude?: number
  longitude?: number
  last_seen?: string
  is_critical: boolean
  created_at: string
  updated_at: string
}

export interface AssetHealth {
  asset_id: string
  asset_name: string
  health_score: number
  status: AssetStatus
  last_seen?: string
  failure_probability_30d?: number
  next_maintenance?: string
  active_alerts: number
  recent_anomalies: number
  telemetry_summary: Record<string, number>
}

export interface TelemetryReading {
  timestamp: string
  active_power_mw?: number
  voltage_kv?: number
  frequency_hz?: number
  temperature_c?: number
  extra?: Record<string, unknown>
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed'
export type AlertCategory = 'operational' | 'security' | 'maintenance' | 'compliance'

export interface Alert {
  id: string
  asset_id?: string
  severity: AlertSeverity
  status: AlertStatus
  title: string
  description?: string
  source: string
  category: AlertCategory
  confidence?: number
  anomaly_score?: number
  recommended_action?: string
  created_at: string
  acknowledged_at?: string
  acknowledged_by?: string
  resolved_at?: string
}

// ── Forecasts ─────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  timestamp: string
  value_mw: number
  lower_ci_mw?: number
  upper_ci_mw?: number
  confidence?: number
}

export interface DemandForecast {
  forecast_type: string
  generated_at: string
  model_version: string
  horizon_hours: number
  points: ForecastPoint[]
  summary: {
    peak_mw: number
    min_mw: number
    avg_mw: number
  }
}

export type RenewableStatus = 'on_target' | 'wind_drop' | 'peak_risk' | 'reserve_low' | 'recovering'

export interface RenewableForecastPoint {
  hour_offset: number
  timestamp: string
  solar_mw: number
  wind_mw: number
  total_renewable_mw: number
  status: RenewableStatus
  note?: string
}

export interface AIRecommendation {
  type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  description: string
  icon: string
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export interface MaintenanceRecord {
  id: string
  asset_id: string
  asset_name?: string
  maintenance_type: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  title: string
  description?: string
  predicted_failure_date?: string
  failure_probability?: number
  scheduled_date?: string
  status: string
  created_at: string
}

// ── Security ──────────────────────────────────────────────────────────────────

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low'

export interface SecurityThreat {
  id: string
  asset_id?: string
  threat_level: ThreatLevel
  network_zone?: string
  title: string
  description?: string
  source_ip?: string
  destination_ip?: string
  protocol?: string
  cve_id?: string
  attack_type?: string
  threat_score?: number
  is_blocked: boolean
  is_active: boolean
  incident_ticket?: string
  detected_at: string
}

export interface SecurityPosture {
  overall_score: number
  network_segmentation_score: number
  patch_compliance_score: number
  access_control_score: number
  endpoint_hardening_score: number
  active_threats: number
  events_today: number
  blocked_today: number
  mean_time_to_detect_min: number
}

export interface ZoneStatus {
  zone_name: string
  zone_code: string
  status: 'secure' | 'warning' | 'critical'
  active_threats: number
  device_count: number
  details: string
}

// ── Compliance ────────────────────────────────────────────────────────────────

export interface ComplianceControl {
  id: string
  standard: string
  control_id: string
  title: string
  description?: string
  compliance_pct: number
  status: 'compliant' | 'partial' | 'non_compliant' | 'unknown'
  last_assessed?: string
  due_date?: string
  findings?: string
}

export interface ComplianceSummary {
  overall_score: number
  compliant_controls: number
  total_controls: number
  critical_gaps: string[]
  next_audit_days: number
  standards: Record<string, number>
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export interface WSMessage {
  type: string
  data?: Record<string, unknown>
  timestamp?: string
}

export interface LiveTelemetryEvent {
  event: string
  asset_id: string
  asset_name: string
  asset_type: AssetType
  timestamp: string
  readings: Record<string, number>
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

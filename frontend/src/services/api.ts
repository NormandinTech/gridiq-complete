// GridIQ — API Client
// All HTTP calls to the FastAPI backend.
// Uses fetch with automatic error handling and type inference.

import type {
  Alert, AlertSeverity, Asset, AssetHealth, ComplianceControl,
  ComplianceSummary, DemandForecast, EnergyMix, GridKPIs,
  GridTopology, MaintenanceRecord, PaginatedResponse,
  RenewableForecastPoint, SecurityPosture, SecurityThreat,
  ZoneStatus, AIRecommendation,
} from '../types'

// In dev, vite proxies /api → http://localhost:8000/api so we use relative paths.
// In production, set VITE_API_URL to your deployed API URL.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'
const WS_URL   = import.meta.env.VITE_WS_URL  ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/v1`

// ── Base fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export const gridApi = {
  getKPIs: () => apiFetch<GridKPIs>('/grid/kpis'),
  getTopology: () => apiFetch<GridTopology>('/grid/topology'),
  getEnergyMix: () => apiFetch<EnergyMix>('/grid/energy-mix'),
}

// ── Assets ────────────────────────────────────────────────────────────────────

export const assetApi = {
  list: (params?: { asset_type?: string; status?: string; page?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return apiFetch<PaginatedResponse<Asset>>(`/assets${q ? `?${q}` : ''}`)
  },
  get: (id: string) => apiFetch<Asset>(`/assets/${id}`),
  getHealth: (id: string) => apiFetch<AssetHealth>(`/assets/${id}/health`),
  getTelemetry: (id: string, hours = 24) =>
    apiFetch<{ asset_id: string; readings: Record<string, unknown>[]; count: number }>(
      `/assets/${id}/telemetry?hours=${hours}`
    ),
}

// ── Forecasts ─────────────────────────────────────────────────────────────────

export const forecastApi = {
  getDemand: (horizonHours = 48) =>
    apiFetch<DemandForecast>(`/forecast/demand?horizon_hours=${horizonHours}`),
  getRenewable: (horizonHours = 12) =>
    apiFetch<{ points: RenewableForecastPoint[] }>(`/forecast/renewable?horizon_hours=${horizonHours}`),
  getRecommendations: () =>
    apiFetch<{ recommendations: AIRecommendation[]; generated_at: string }>('/forecast/recommendations'),
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export const alertApi = {
  list: (params?: { status?: string; severity?: AlertSeverity; limit?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return apiFetch<{ alerts: Alert[]; total: number }>(`/alerts${q ? `?${q}` : ''}`)
  },
  acknowledge: (id: string, acknowledgedBy: string) =>
    apiFetch<Alert>(`/alerts/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    }),
  resolve: (id: string) =>
    apiFetch<Alert>(`/alerts/${id}/resolve`, { method: 'POST' }),
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export const maintenanceApi = {
  list: (params?: { status?: string; priority?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return apiFetch<{ records: MaintenanceRecord[]; total: number }>(
      `/maintenance${q ? `?${q}` : ''}`
    )
  },
}

// ── Security ──────────────────────────────────────────────────────────────────

export const securityApi = {
  getPosture: () => apiFetch<SecurityPosture>('/security/posture'),
  getThreats: (activeOnly = true) =>
    apiFetch<{ threats: SecurityThreat[]; total: number }>(
      `/security/threats?active_only=${activeOnly}`
    ),
  getZones: () => apiFetch<{ zones: ZoneStatus[] }>('/security/zones'),
  evaluateAccess: (request: Record<string, unknown>) =>
    apiFetch<{ allowed: boolean; policy_id: string; reason: string; risk_score: number }>(
      '/security/evaluate-access', { method: 'POST', body: JSON.stringify(request) }
    ),
}

// ── Compliance ────────────────────────────────────────────────────────────────

export const complianceApi = {
  getNERCCIP: () =>
    apiFetch<{ overall_score: number; controls: ComplianceControl[]; next_audit_days: number }>(
      '/compliance/nerc-cip'
    ),
  getSummary: () => apiFetch<ComplianceSummary>('/compliance/summary'),
}

// ── Health ────────────────────────────────────────────────────────────────────

export const systemApi = {
  health: () => apiFetch<{ status: string; version: string; services: Record<string, string> }>('/health'),
}

// ── WebSocket Manager ─────────────────────────────────────────────────────────

export class GridIQWebSocket {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 2000
  private maxDelay = 30000
  private channel: string
  private onMessage: (data: unknown) => void
  private onStatusChange: (connected: boolean) => void

  constructor(
    channel: 'telemetry' | 'alerts' | 'threats',
    onMessage: (data: unknown) => void,
    onStatusChange: (connected: boolean) => void = () => {}
  ) {
    this.channel = channel
    this.onMessage = onMessage
    this.onStatusChange = onStatusChange
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const url = `${WS_URL}/ws/${this.channel}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log(`[WS:${this.channel}] connected`)
      this.reconnectDelay = 2000
      this.onStatusChange(true)
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.onMessage(data)
      } catch {
        console.warn(`[WS:${this.channel}] parse error`)
      }
    }

    this.ws.onerror = (err) => {
      console.warn(`[WS:${this.channel}] error`, err)
    }

    this.ws.onclose = () => {
      console.log(`[WS:${this.channel}] closed — reconnecting in ${this.reconnectDelay}ms`)
      this.onStatusChange(false)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay)
      this.connect()
    }, this.reconnectDelay)
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }
}

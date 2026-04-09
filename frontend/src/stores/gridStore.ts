// GridIQ — Global State Store (Zustand)
// Holds live telemetry, alerts, KPIs and WebSocket connection state.

import { create } from 'zustand'
import type { Alert, GridKPIs, LiveTelemetryEvent, SecurityThreat } from '../types'

interface LiveReading {
  asset_id: string
  asset_name: string
  asset_type: string
  timestamp: string
  readings: Record<string, number>
}

interface GridStore {
  // Connection
  wsConnected: boolean
  setWsConnected: (v: boolean) => void

  // Live KPIs (updated every 10s via polling)
  kpis: GridKPIs | null
  setKPIs: (k: GridKPIs) => void

  // Live telemetry stream (last 50 readings across all assets)
  liveReadings: LiveReading[]
  pushReading: (r: LiveReading) => void

  // Live alerts
  openAlerts: Alert[]
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  acknowledgeAlert: (id: string, by: string) => void
  resolveAlert: (id: string) => void

  // Active threats
  activeThreats: SecurityThreat[]
  setThreats: (threats: SecurityThreat[]) => void

  // UI state
  selectedAssetId: string | null
  setSelectedAsset: (id: string | null) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  sidebarOpen: boolean
  toggleSidebar: () => void
}

export const useGridStore = create<GridStore>((set, get) => ({
  // Connection
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  // KPIs
  kpis: null,
  setKPIs: (k) => set({ kpis: k }),

  // Live readings ring buffer (keep last 50)
  liveReadings: [],
  pushReading: (r) =>
    set((s) => ({
      liveReadings: [...s.liveReadings.slice(-49), r],
    })),

  // Alerts
  openAlerts: [],
  setAlerts: (alerts) => set({ openAlerts: alerts }),
  addAlert: (alert) =>
    set((s) => ({
      openAlerts: [alert, ...s.openAlerts.filter((a) => a.id !== alert.id)],
    })),
  acknowledgeAlert: (id, by) =>
    set((s) => ({
      openAlerts: s.openAlerts.map((a) =>
        a.id === id
          ? { ...a, status: 'acknowledged' as const, acknowledged_by: by, acknowledged_at: new Date().toISOString() }
          : a
      ),
    })),
  resolveAlert: (id) =>
    set((s) => ({
      openAlerts: s.openAlerts.filter((a) => a.id !== id),
    })),

  // Threats
  activeThreats: [],
  setThreats: (threats) => set({ activeThreats: threats }),

  // UI
  selectedAssetId: null,
  setSelectedAsset: (id) => set({ selectedAssetId: id }),
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))

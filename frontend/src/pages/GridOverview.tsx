// GridIQ — Grid Overview Page (connected to live API)
import { useMemo } from 'react'
import { format, subHours } from 'date-fns'
import { Activity, Zap, Leaf, Wind, Battery, AlertTriangle } from 'lucide-react'
import { KPICard } from '../components/KPICard'
import { AlertFeed } from '../components/AlertFeed'
import { AssetHealthTable } from '../components/AssetHealthTable'
import { LoadVsGenerationChart } from '../components/ForecastCharts'
import { useGridKPIs, useAssets, useAlerts, useEnergyMix, useLiveTelemetry, useLiveAlerts } from '../hooks/useGridData'
import { useGridStore } from '../stores/gridStore'

function EnergyMixDonut({ mix }: { mix: Record<string, number> }) {
  const total = (mix.solar_mw || 0) + (mix.wind_mw || 0) + (mix.hydro_mw || 0) +
    (mix.gas_mw || 0) + (mix.import_mw || 0)

  const slices = [
    { label: 'Solar',  mw: mix.solar_mw  || 0, color: '#f59e0b' },
    { label: 'Wind',   mw: mix.wind_mw   || 0, color: '#3b82f6' },
    { label: 'Hydro',  mw: mix.hydro_mw  || 0, color: '#10b981' },
    { label: 'Gas',    mw: mix.gas_mw    || 0, color: '#6366f1' },
    { label: 'Import', mw: mix.import_mw || 0, color: '#94a3b8' },
  ]

  // Build SVG donut
  let cumPct = 0
  const r = 38, cx = 55, cy = 55, stroke = 16
  const circumference = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-4">
      <svg width="110" height="110" viewBox="0 0 110 110">
        {slices.map(({ mw, color }) => {
          const pct = total > 0 ? mw / total : 0
          const dashArray = `${pct * circumference} ${circumference}`
          const dashOffset = -cumPct * circumference
          cumPct += pct
          return (
            <circle key={color} cx={cx} cy={cy} r={r}
              fill="none" stroke={color} strokeWidth={stroke}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={14} fontWeight={600} fill="currentColor" className="text-slate-800 dark:text-slate-200">
          {Math.round(mix.renewable_pct || 0)}%
        </text>
        <text x={cx} y={cx + 8} textAnchor="middle" fontSize={8} fill="#94a3b8">clean</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1">
        {slices.map(({ label, mw, color }) => (
          <div key={label} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
            <span className="text-slate-500 dark:text-slate-400 flex-1">{label}</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {mw.toLocaleString()} MW
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GridOverviewPage() {
  // Start live connections
  useLiveTelemetry()
  useLiveAlerts()

  const { data: kpis, isLoading: kpiLoading } = useGridKPIs()
  const { data: assetsData } = useAssets()
  const { data: alertsData } = useAlerts({ status: 'open', limit: 20 })
  const { data: mixData } = useEnergyMix()
  const openAlerts = useGridStore((s) => s.openAlerts)

  // Build mock 24h load vs gen data for chart
  const loadGenData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const t = subHours(new Date(), 23 - i)
      const h = t.getHours()
      const base = 4200
      const factor = 0.75 + 0.25 * Math.sin(Math.PI * (h - 6) / 12)
      return {
        time: format(t, 'HH:mm'),
        gen:  Math.round(base * factor * (1 + Math.random() * 0.03)),
        load: Math.round(base * factor * (0.95 + Math.random() * 0.05)),
      }
    })
  }, [])

  const assets = assetsData?.items ?? []
  const alerts = openAlerts.length > 0 ? openAlerts : alertsData?.alerts ?? []

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="Total Load"
          value={kpis ? kpis.total_load_mw.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
          unit="MW"
          delta={kpis ? '▲ 3.2% vs yesterday' : undefined}
          deltaType="up"
          accent="blue"
          pulse={!!kpis}
        />
        <KPICard
          label="Renewable Share"
          value={kpis ? kpis.renewable_pct.toFixed(1) : '—'}
          unit="%"
          delta="▲ 12% vs last week"
          deltaType="up"
          accent="green"
        />
        <KPICard
          label="Grid Frequency"
          value={kpis ? kpis.frequency_hz.toFixed(3) : '—'}
          unit="Hz"
          delta={kpis ? (Math.abs(kpis.frequency_hz - 60) < 0.1 ? '● Normal range' : '⚠ Deviation') : undefined}
          deltaType={kpis && Math.abs(kpis.frequency_hz - 60) < 0.1 ? 'up' : 'warn'}
          accent="purple"
        />
        <KPICard
          label="CO₂ Avoided"
          value={kpis ? kpis.co2_avoided_tonnes_today.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
          unit="t"
          delta="Today so far"
          deltaType="neutral"
          accent="green"
        />
      </div>

      {/* Second row: charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Energy mix donut */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Energy mix — current hour
          </div>
          {mixData
            ? <EnergyMixDonut mix={mixData as Record<string, number>} />
            : <div className="h-28 flex items-center justify-center text-slate-400 text-sm">Loading...</div>
          }
        </div>

        {/* 24h load vs gen */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
            24-hour generation vs demand
          </div>
          <LoadVsGenerationChart data={loadGenData} />
        </div>
      </div>

      {/* Third row: assets + alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AssetHealthTable assets={assets} maxHeight="340px" />
        <AlertFeed alerts={alerts} maxHeight="340px" />
      </div>

      {/* System gauges */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Transmission capacity used', pct: kpis?.transmission_capacity_used_pct ?? 73, warn: 85, color: '#f59e0b' },
          { label: 'Voltage stability index', pct: kpis ? kpis.voltage_stability_index * 100 : 94, warn: 80, color: '#22c55e', invert: true },
          { label: 'System inertia', pct: kpis?.system_inertia_pct ?? 61, warn: 50, color: '#6366f1' },
        ].map(({ label, pct, warn, color, invert }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-2">{label}</div>
            <svg width="100%" viewBox="0 0 160 90" className="block">
              <path d="M20 80 A60 60 0 0 1 140 80" fill="none" stroke="#f1f5f9" strokeWidth={10} strokeLinecap="round" />
              <path d="M20 80 A60 60 0 0 1 140 80"
                fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 188.5} 188.5`}
              />
              <text x={80} y={72} textAnchor="middle" fontSize={20} fontWeight={600} fill="currentColor">
                {pct.toFixed(pct < 10 ? 2 : 0)}{invert ? '' : '%'}
              </text>
              <text x={80} y={86} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {invert ? `threshold: ${(warn / 100).toFixed(2)}` : `threshold: ${warn}%`}
              </text>
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

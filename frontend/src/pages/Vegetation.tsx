// GridIQ — Vegetation Risk Intelligence Page
// Live-connected to /api/v1/vegetation/* endpoints
// Shows LiDAR-derived risk scores, encroaching tree map, work orders, NERC FAC-003

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import {
  Leaf, Flame, AlertTriangle, CheckCircle,
  TreePine, MapPin, Zap, ClipboardList,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const get = (path: string) => fetch(`${BASE}${path}`).then(r => r.json())
const post = (path: string) => fetch(`${BASE}${path}`, { method: 'POST' }).then(r => r.json())

// ── Sub-tab nav ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Risk Overview',    icon: TreePine },
  { id: 'map',        label: 'Span Map',         icon: MapPin },
  { id: 'workorders', label: 'Work Orders',      icon: ClipboardList },
  { id: 'fac003',     label: 'NERC FAC-003',     icon: CheckCircle },
  { id: 'fire',       label: 'Fire Risk',        icon: Flame },
]

// ── Risk level config ─────────────────────────────────────────────────────────

const riskConfig = {
  critical: { bg: 'bg-red-50 dark:bg-red-900/20',    text: 'text-red-700 dark:text-red-400',    border: 'border-red-300 dark:border-red-700',    bar: 'bg-red-500',    dot: 'bg-red-500 animate-pulse' },
  high:     { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700', bar: 'bg-amber-500',  dot: 'bg-amber-500 animate-pulse' },
  medium:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-200 dark:border-blue-800',   bar: 'bg-blue-500',   dot: 'bg-blue-400' },
  low:      { bg: 'bg-slate-50 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', bar: 'bg-emerald-500',dot: 'bg-emerald-400' },
}

const priorityConfig = {
  immediate: { bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-400',    label: 'Immediate' },
  '30_days': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: '30 days' },
  '90_days': { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   label: '90 days' },
  annual:    { bg: 'bg-slate-100 dark:bg-slate-700',    text: 'text-slate-500 dark:text-slate-400', label: 'Annual' },
}

const speciesEmoji: Record<string, string> = {
  eucalyptus: '🌿', ponderosa_pine: '🌲', live_oak: '🌳',
  blue_gum: '🌿', cottonwood: '🌳', willow: '🌾',
  chaparral: '🍂', shrub: '🌱', unknown: '🌿',
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function VegKPI({ label, value, unit = '', sub = '', accent = '' }: any) {
  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border px-4 py-3',
      accent ? `border-l-4 ${accent} border-slate-200 dark:border-slate-700`
              : 'border-slate-200 dark:border-slate-700'
    )}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
        {value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
      </div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── SVG Span Map ──────────────────────────────────────────────────────────────

function SpanRiskMap({ spans }: { spans: any[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  if (!spans.length) return null

  // Normalize coordinates to SVG space
  const lats = spans.map(s => s.lat).filter(Boolean)
  const lons = spans.map(s => s.lon).filter(Boolean)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const W = 640, H = 320, PAD = 30

  const toX = (lon: number) => PAD + ((lon - minLon) / (maxLon - minLon || 1)) * (W - PAD * 2)
  const toY = (lat: number) => H - PAD - ((lat - minLat) / (maxLat - minLat || 1)) * (H - PAD * 2)

  const riskColor: Record<string, string> = {
    critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e',
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Transmission corridor risk map
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          {Object.entries(riskColor).map(([level, color]) => (
            <span key={level} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {level}
            </span>
          ))}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* Background grid */}
        {[...Array(5)].map((_, i) => (
          <line key={i} x1={PAD} y1={PAD + i * (H - PAD * 2) / 4}
            x2={W - PAD} y2={PAD + i * (H - PAD * 2) / 4}
            stroke="currentColor" strokeOpacity={0.05} strokeWidth={0.5} />
        ))}

        {/* Draw line segments connecting consecutive spans on same line */}
        {spans.map((span, i) => {
          if (i === 0 || spans[i-1].line_name !== span.line_name) return null
          const prev = spans[i-1]
          if (!span.lat || !prev.lat) return null
          return (
            <line key={`line-${i}`}
              x1={toX(prev.lon)} y1={toY(prev.lat)}
              x2={toX(span.lon)}  y2={toY(span.lat)}
              stroke={riskColor[span.risk_level] ?? '#94a3b8'}
              strokeWidth={span.risk_level === 'critical' ? 3 : 2}
              strokeOpacity={0.6}
            />
          )
        })}

        {/* Draw span dots */}
        {spans.map(span => {
          if (!span.lat) return null
          const x = toX(span.lon)
          const y = toY(span.lat)
          const color = riskColor[span.risk_level] ?? '#94a3b8'
          const r = span.risk_level === 'critical' ? 7 : span.risk_level === 'high' ? 5 : 4
          return (
            <g key={span.span_id}
              onMouseEnter={() => setHovered(span.span_id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}>
              {hovered === span.span_id && (
                <circle cx={x} cy={y} r={r + 6} fill={color} fillOpacity={0.15} />
              )}
              <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.85} />
              {span.clearance_violations > 0 && (
                <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">!</text>
              )}
              {/* Tooltip */}
              {hovered === span.span_id && (
                <g>
                  <rect x={x + 8} y={y - 28} width={130} height={44} rx={4}
                    fill="white" stroke={color} strokeWidth={0.5}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
                  <text x={x + 13} y={y - 14} fontSize={9} fontWeight={500} fill="#1e293b">
                    {span.span_id}
                  </text>
                  <text x={x + 13} y={y - 4} fontSize={8} fill="#64748b">
                    Score: {span.overall_risk_score} · {span.encroaching_trees} trees
                  </text>
                  <text x={x + 13} y={y + 7} fontSize={8} fill="#64748b">
                    {span.dominant_species} · {span.line_name.split(' ')[0]}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Legend: zone labels */}
        <text x={PAD} y={H - 8} fontSize={9} fill="currentColor" fillOpacity={0.4}
          style={{ fontFamily: 'monospace' }}>
          Western US transmission corridors (USGS 3DEP LiDAR)
        </text>
      </svg>
    </div>
  )
}

// ── Span risk row ─────────────────────────────────────────────────────────────

function SpanRow({ span, onTrimComplete }: { span: any; onTrimComplete: (id: string) => void }) {
  const cfg = riskConfig[span.risk_level as keyof typeof riskConfig] ?? riskConfig.low
  const qc = useQueryClient()
  const trim = useMutation({
    mutationFn: () => post(`/vegetation/spans/${span.span_id}/record-trim`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['veg-spans'] })
      qc.invalidateQueries({ queryKey: ['veg-summary'] })
    },
  })

  return (
    <div className={clsx('flex items-center gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors')}>
      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{span.span_id}</span>
          <span className="text-[10px] text-slate-400 font-mono truncate">{span.line_name}</span>
          {span.clearance_violations > 0 && (
            <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">
              {span.clearance_violations} NERC violation{span.clearance_violations > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
          <span>{speciesEmoji[span.dominant_species] ?? '🌿'} {span.dominant_species?.replace(/_/g, ' ')}</span>
          <span>{span.encroaching_trees} encroaching</span>
          <span>min clearance {span.min_clearance_observed_m}m</span>
          {span.years_to_next_violation && (
            <span className="text-amber-500">violation in {span.years_to_next_violation}y</span>
          )}
        </div>
      </div>
      {/* Risk score bar */}
      <div className="hidden sm:flex items-center gap-2 w-28">
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full', cfg.bar)}
               style={{ width: `${span.overall_risk_score}%` }} />
        </div>
        <span className={clsx('text-[10px] font-mono font-bold w-6 text-right', cfg.text)}>
          {Math.round(span.overall_risk_score)}
        </span>
      </div>
      {/* Priority badge */}
      {(() => {
        const p = priorityConfig[span.work_order_priority as keyof typeof priorityConfig]
        return p ? (
          <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-mono hidden md:block', p.bg, p.text)}>
            {p.label}
          </span>
        ) : null
      })()}
      {/* Trim button */}
      <button
        onClick={() => trim.mutate()}
        disabled={trim.isPending}
        className="text-[10px] px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {trim.isPending ? '...' : '✓ Trimmed'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function VegetationPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const qc = useQueryClient()

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['veg-summary'],
    queryFn: () => get('/vegetation/summary'),
    refetchInterval: 60_000,
  })

  const { data: spansData, isLoading: spansLoading } = useQuery({
    queryKey: ['veg-spans', riskFilter],
    queryFn: () => get(`/vegetation/spans${riskFilter !== 'all' ? `?risk_level=${riskFilter}` : ''}?limit=100`),
    refetchInterval: 120_000,
  })

  const { data: workOrders } = useQuery({
    queryKey: ['veg-workorders'],
    queryFn: () => get('/vegetation/work-orders?limit=30'),
    refetchInterval: 120_000,
  })

  const { data: fac003 } = useQuery({
    queryKey: ['veg-fac003'],
    queryFn: () => get('/vegetation/compliance/fac-003'),
    refetchInterval: 300_000,
  })

  const { data: fireRisk } = useQuery({
    queryKey: ['veg-fire'],
    queryFn: () => get('/vegetation/fire-risk'),
    refetchInterval: 300_000,
  })

  const { data: linesData } = useQuery({
    queryKey: ['veg-lines'],
    queryFn: () => get('/vegetation/lines'),
    refetchInterval: 120_000,
  })

  const spans = spansData?.spans ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 overflow-x-auto flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={clsx('flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === id
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <VegKPI label="Total spans assessed" value={summary?.total_spans ?? '—'} accent="border-l-emerald-500" />
              <VegKPI label="NERC violations" value={summary?.nerc_violations ?? '—'}
                sub="Immediate action required" accent={summary?.nerc_violations > 0 ? "border-l-red-500" : "border-l-emerald-500"} />
              <VegKPI label="Immediate work orders" value={summary?.immediate_work_orders ?? '—'}
                sub="Crew dispatch required" accent="border-l-amber-500" />
              <VegKPI label="Avg risk score" value={summary?.avg_risk_score ?? '—'} unit="/100"
                sub="Across all corridors" accent="border-l-blue-500" />
            </div>

            {/* Risk breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['critical','high','medium','low'].map(level => {
                const cfg = riskConfig[level as keyof typeof riskConfig]
                const count = summary?.[level] ?? 0
                return (
                  <button key={level} onClick={() => setRiskFilter(level === riskFilter ? 'all' : level)}
                    className={clsx('rounded-xl border p-3 text-left transition-all',
                      cfg.bg, cfg.border,
                      level === riskFilter ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'
                    )}>
                    <div className={clsx('text-[10px] font-mono uppercase tracking-wider mb-1', cfg.text)}>{level}</div>
                    <div className={clsx('text-2xl font-bold tabular-nums', cfg.text)}>{count}</div>
                    <div className={clsx('text-[10px] mt-0.5', cfg.text)}>spans</div>
                  </button>
                )
              })}
            </div>

            {/* Line summary table */}
            {linesData?.lines && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Transmission lines — risk summary</span>
                </div>
                {linesData.lines.map((line: any) => {
                  const cfg = riskConfig[line.risk_level as keyof typeof riskConfig] ?? riskConfig.low
                  return (
                    <div key={line.line_id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{line.line_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {line.span_count} spans · {line.voltage_kv} kV
                          {line.violations > 0 && <span className="text-red-500 ml-2">{line.violations} NERC violations</span>}
                        </div>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={clsx('h-full rounded-full', cfg.bar)} style={{ width: `${line.max_risk}%` }} />
                      </div>
                      <span className={clsx('text-[10px] font-mono font-bold w-8 text-right', cfg.text)}>
                        {Math.round(line.max_risk)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Span list */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Span risk scores {riskFilter !== 'all' && `— ${riskFilter} only`}
                </span>
                <div className="flex gap-1">
                  {['all','critical','high','medium','low'].map(f => (
                    <button key={f} onClick={() => setRiskFilter(f)}
                      className={clsx('text-[9px] font-mono uppercase px-2 py-1 rounded transition-colors',
                        riskFilter === f
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      )}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: '380px' }} className="overflow-y-auto">
                {spansLoading
                  ? <div className="text-center py-8 text-slate-400 text-sm">Scoring LiDAR data...</div>
                  : spans.map((s: any) => (
                      <SpanRow key={s.span_id} span={s} onTrimComplete={() => qc.invalidateQueries({ queryKey: ['veg-spans'] })} />
                    ))
                }
              </div>
            </div>
          </>
        )}

        {/* ── Map tab ────────────────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <>
            <SpanRiskMap spans={spans} />
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Data sources</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">●</span>
                  <div><strong className="text-slate-700 dark:text-slate-300">USGS 3DEP</strong><br />1m resolution LiDAR · Free nationwide coverage · Updated annually</div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">●</span>
                  <div><strong className="text-slate-700 dark:text-slate-300">NOAA RAWS</strong><br />Remote weather stations · Real-time fire weather · Red Flag alerts</div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">●</span>
                  <div><strong className="text-slate-700 dark:text-slate-300">NLCD Canopy</strong><br />National Land Cover Database · Species classification · Canopy height</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Work Orders tab ────────────────────────────────────────────── */}
        {activeTab === 'workorders' && workOrders && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <VegKPI label="Immediate dispatch" value={workOrders.immediate_count ?? 0} accent="border-l-red-500" />
              <VegKPI label="Total work orders" value={workOrders.total ?? 0} accent="border-l-blue-500" />
              <VegKPI label="Estimated crew days" value={workOrders.estimated_total_crew_days ?? 0} unit="days" accent="border-l-amber-500" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
                AI-prioritized vegetation trim work orders
              </div>
              <div style={{ maxHeight: '520px' }} className="overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                {workOrders.work_orders?.map((wo: any) => {
                  const p = priorityConfig[wo.priority as keyof typeof priorityConfig]
                  const r = riskConfig[wo.risk_level as keyof typeof riskConfig] ?? riskConfig.low
                  return (
                    <div key={wo.work_order_id} className="flex items-start gap-3 px-4 py-3">
                      <span className={clsx('text-[9px] px-2 py-1 rounded-full font-mono font-bold flex-shrink-0 mt-0.5', p?.bg, p?.text)}>
                        {p?.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{wo.work_order_id}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{wo.span_id}</span>
                          <span className={clsx('text-[9px] px-1.5 py-0.5 rounded font-mono', r.bg, r.text)}>
                            {Math.round(wo.risk_score)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{wo.line_name}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">{wo.recommended_action}</div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                          <span>{speciesEmoji[wo.dominant_species] ?? '🌿'} {wo.dominant_species?.replace(/_/g, ' ')}</span>
                          <span>{wo.nerc_violations > 0 ? `⚠ ${wo.nerc_violations} NERC violations` : `${wo.encroaching_trees} encroaching`}</span>
                          <span>~{wo.estimated_crew_days.toFixed(1)} crew days</span>
                          {wo.fire_risk_score > 70 && <span className="text-red-500">🔥 High fire risk</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── NERC FAC-003 tab ───────────────────────────────────────────── */}
        {activeTab === 'fac003' && fac003 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <VegKPI label="FAC-003 compliance" value={`${fac003.compliance_pct}%`}
                accent={fac003.compliance_pct >= 95 ? 'border-l-emerald-500' : 'border-l-red-500'} />
              <VegKPI label="Clearance violations" value={fac003.total_clearance_violations}
                accent={fac003.total_clearance_violations > 0 ? 'border-l-red-500' : 'border-l-emerald-500'} />
              <VegKPI label="Spans assessed" value={fac003.total_spans_assessed} accent="border-l-blue-500" />
              <VegKPI label="Imminent (<2yr)" value={fac003.imminent_violations?.length ?? 0} accent="border-l-amber-500" />
            </div>

            {fac003.violations?.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800">
                <div className="px-4 py-3 border-b border-red-100 dark:border-red-800 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">Active NERC FAC-003 violations</span>
                </div>
                {fac003.violations.map((v: any) => (
                  <div key={v.span_id} className="flex items-center gap-3 px-4 py-3 border-b border-red-50 dark:border-red-900/30 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{v.span_id}</span>
                      <span className="text-[10px] text-slate-400 ml-2">{v.line_name} · {v.voltage_kv}kV</span>
                    </div>
                    <div className="text-[10px] font-mono text-red-600 dark:text-red-400">
                      min {v.min_observed_clearance_m}m / req {v.nerc_min_clearance_m}m
                    </div>
                    <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">
                      {v.violation_count} violation{v.violation_count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {fac003.imminent_violations?.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-800 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Imminent violations — clearance breach within 2 years
                </div>
                {fac003.imminent_violations.map((v: any) => (
                  <div key={v.span_id} className="flex items-center gap-3 px-4 py-3 border-b border-amber-50 dark:border-amber-900/20 last:border-0">
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{v.span_id}</span>
                      <span className="text-[10px] text-slate-400 ml-2">{v.line_name}</span>
                    </div>
                    <span className="text-[10px] text-amber-600 font-mono">
                      {v.years_to_violation.toFixed(1)}y · {v.growth_rate_m_yr}m/yr
                    </span>
                    <span className="text-[10px] text-slate-400">{speciesEmoji[v.dominant_species] ?? '🌿'} {v.dominant_species?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Fire Risk tab ──────────────────────────────────────────────── */}
        {activeTab === 'fire' && fireRisk && (
          <>
            {fireRisk.red_flag_active && (
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl px-4 py-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-red-800 dark:text-red-300">
                  🔴 RED FLAG CONDITIONS ACTIVE — Elevated ignition risk on high-vegetation spans
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <VegKPI label="Extreme fire risk spans" value={fireRisk.spans_at_extreme_fire_risk} accent="border-l-red-500" />
              <VegKPI label="High fire risk spans" value={fireRisk.spans_at_high_fire_risk} accent="border-l-amber-500" />
              <VegKPI label="Data source" value="NOAA RAWS" sub="Real-time weather overlay" accent="border-l-blue-500" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold">
                Top fire-risk spans — vegetation × weather
              </div>
              {fireRisk.top_fire_risk_spans?.map((s: any) => (
                <div key={s.span_id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: `hsl(${Math.round((1 - s.fire_risk_score / 100) * 120)}, 70%, 45%)` }} />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.span_id}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{s.line_name}</span>
                  </div>
                  <span className="text-[10px]">{speciesEmoji[s.dominant_species] ?? '🌿'} {s.dominant_species?.replace(/_/g, ' ')}</span>
                  <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-500"
                      style={{ width: `${s.fire_risk_score}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-red-600 dark:text-red-400 w-6 text-right">
                    {Math.round(s.fire_risk_score)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

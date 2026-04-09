// GridIQ — Sensor Management Page
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { Cpu, CheckCircle, AlertTriangle, BookOpen, Calendar, BarChart3 } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const get  = (p: string) => fetch(`${BASE}${p}`).then(r => r.json())
const post = (p: string) => fetch(`${BASE}${p}`, { method: 'POST' }).then(r => r.json())

const TABS = [
  { id: 'fleet',    label: 'Deployed Fleet',   icon: Cpu },
  { id: 'quality',  label: 'Data Quality',     icon: BarChart3 },
  { id: 'cal',      label: 'Calibration',      icon: Calendar },
  { id: 'catalog',  label: 'Sensor Catalog',   icon: BookOpen },
]

const STATUS_CFG: Record<string, any> = {
  online:     { bg:'bg-emerald-50 dark:bg-emerald-900/20', text:'text-emerald-700 dark:text-emerald-400', dot:'bg-emerald-400' },
  degraded:   { bg:'bg-amber-50 dark:bg-amber-900/20',     text:'text-amber-700 dark:text-amber-400',     dot:'bg-amber-400 animate-pulse' },
  offline:    { bg:'bg-red-50 dark:bg-red-900/20',         text:'text-red-700 dark:text-red-400',         dot:'bg-red-500 animate-pulse' },
  calibrated: { bg:'bg-blue-50 dark:bg-blue-900/20',       text:'text-blue-700 dark:text-blue-400',       dot:'bg-blue-400' },
  planned:    { bg:'bg-slate-50 dark:bg-slate-800',        text:'text-slate-500 dark:text-slate-400',     dot:'bg-slate-300' },
}

const CAT_ICON: Record<string, string> = {
  electrical:'⚡', mechanical:'⚙️', thermal:'🌡️', chemical:'🧪',
  hydraulic:'💧', structural:'🏗️', environmental:'🌤️', optical:'📷', communication:'📡',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400',
  high:     'text-amber-600 dark:text-amber-400',
  standard: 'text-blue-600 dark:text-blue-400',
  optional: 'text-slate-400',
}

function KPI({ label, value, unit='', sub='', accent='' }: any) {
  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border px-4 py-3',
      accent ? `border-l-4 ${accent} border-slate-200 dark:border-slate-700`
              : 'border-slate-200 dark:border-slate-700')}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
      </div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function QualityBar({ score }: { score: number }) {
  const color = score >= 95 ? 'bg-emerald-500' : score >= 85 ? 'bg-blue-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = score >= 95 ? 'text-emerald-600 dark:text-emerald-400' : score >= 85 ? 'text-blue-600 dark:text-blue-400' : score >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className={clsx('text-[10px] font-mono font-bold tabular-nums w-7', textColor)}>{score}</span>
    </div>
  )
}

export function SensorManagementPage() {
  const [tab, setTab] = useState('fleet')
  const [assetFilter, setAssetFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const qc = useQueryClient()

  const { data: summary } = useQuery({ queryKey:['sen-summary'], queryFn:()=>get('/sensors/summary'), refetchInterval:30_000 })
  const { data: fleetData, isLoading:fleetLoading } = useQuery({
    queryKey: ['sen-fleet', assetFilter],
    queryFn: () => get(`/sensors/deployed${assetFilter !== 'all' ? `?asset_type=${assetFilter}` : ''}&limit=100`),
    refetchInterval: 30_000,
  })
  const { data: qualData }   = useQuery({ queryKey:['sen-quality'],  queryFn:()=>get('/sensors/data-quality'),        refetchInterval:30_000 })
  const { data: calData }    = useQuery({ queryKey:['sen-cal'],      queryFn:()=>get('/sensors/calibration-schedule'), refetchInterval:60_000 })
  const { data: catalogData, isLoading:catLoading } = useQuery({
    queryKey: ['sen-catalog', catFilter],
    queryFn: () => get(`/sensors/catalog${catFilter !== 'all' ? `?category=${catFilter}` : ''}`),
    staleTime: Infinity,
  })

  const calibrate = useMutation({
    mutationFn: (sid: string) => post(`/sensors/deployed/${sid}/calibrate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sen-fleet'] }); qc.invalidateQueries({ queryKey: ['sen-cal'] }); qc.invalidateQueries({ queryKey: ['sen-quality'] }) },
  })

  const sensors = fleetData?.sensors ?? []
  const assetTypes = [...new Set(sensors.map((s: any) => s.asset_type))].sort()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-nav */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 overflow-x-auto flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === id ? 'border-violet-500 text-violet-700 dark:text-violet-400'
                         : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Fleet tab ────────────────────────────────────────────────── */}
        {tab === 'fleet' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPI label="Total sensors" value={summary?.total_sensors ?? '—'} accent="border-l-violet-500" />
              <KPI label="Online" value={summary?.online ?? 0} accent="border-l-emerald-500" sub={`${summary?.fleet_availability_pct ?? 0}% availability`} />
              <KPI label="Degraded / Offline" value={(summary?.degraded ?? 0) + (summary?.offline ?? 0)} accent="border-l-red-500" />
              <KPI label="Avg data quality" value={summary?.avg_data_quality ?? '—'} unit="/100" accent="border-l-blue-500" />
            </div>

            {/* Asset type filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setAssetFilter('all')}
                className={clsx('text-[9px] font-mono uppercase px-2 py-1 rounded transition-colors',
                  assetFilter === 'all' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')}>
                All
              </button>
              {assetTypes.map((at: any) => (
                <button key={at} onClick={() => setAssetFilter(at)}
                  className={clsx('text-[9px] font-mono uppercase px-2 py-1 rounded transition-colors',
                    assetFilter === at ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                                       : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')}>
                  {at.replace(/_/g,' ')}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Deployed sensor fleet
              </div>
              <div style={{ maxHeight: '460px' }} className="overflow-y-auto">
                {fleetLoading ? (
                  <div className="py-10 text-center text-slate-400 text-sm">Loading sensors...</div>
                ) : sensors.map((s: any) => {
                  const st = STATUS_CFG[s.status] ?? STATUS_CFG.planned
                  const hasAlerts = s.alerts?.length > 0
                  return (
                    <div key={s.sensor_id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', st.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.sensor_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{s.sensor_id}</span>
                          {hasAlerts && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{s.alerts.length} alert{s.alerts.length > 1 ? 's' : ''}</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {s.asset_name} · <span className="font-mono">{s.installation_point}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 flex-wrap">
                          <span>{s.manufacturer} {s.model}</span>
                          <span className="font-mono">{s.protocol}</span>
                          {s.next_calibration_date && (
                            <span className={clsx(
                              new Date(s.next_calibration_date) < new Date() ? 'text-red-500' : ''
                            )}>
                              Cal: {new Date(s.next_calibration_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {s.alerts?.map((a: string, i: number) => (
                          <div key={i} className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">⚠ {a}</div>
                        ))}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <QualityBar score={s.data_quality_score} />
                        <button
                          onClick={() => calibrate.mutate(s.sensor_id)}
                          disabled={calibrate.isPending}
                          className="text-[9px] px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          {calibrate.isPending ? '...' : '✓ Calibrated'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Data Quality tab ─────────────────────────────────────────── */}
        {tab === 'quality' && qualData && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <KPI label="Avg quality score" value={qualData.avg_quality_score} unit="/100" accent="border-l-blue-500" />
              <KPI label="Poor quality sensors" value={qualData.poor_count} accent="border-l-red-500" sub="Score below 70" />
              <KPI label="Total monitored" value={qualData.sensors?.length ?? 0} accent="border-l-violet-500" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold">Data quality report — all sensors</div>
              <div style={{ maxHeight: '480px' }} className="overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                {qualData.sensors?.map((r: any) => (
                  <div key={r.sensor_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{r.sensor_name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{r.asset_name} · avail {r.availability_pct}% · outliers {r.outlier_rate_pct}%</div>
                      {r.alerts?.map((a: string, i: number) => (
                        <div key={i} className="text-[10px] text-amber-600 mt-0.5">⚠ {a}</div>
                      ))}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <QualityBar score={r.quality_score} />
                      <span className="text-[9px] text-slate-400 capitalize">{r.quality_label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Calibration tab ──────────────────────────────────────────── */}
        {tab === 'cal' && calData && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <KPI label="Overdue" value={calData.overdue_count} accent="border-l-red-500" />
              <KPI label="Due in 30 days" value={calData.due_in_30_days} accent="border-l-amber-500" />
              <KPI label="Total in schedule" value={calData.schedule?.length ?? 0} accent="border-l-blue-500" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold">Calibration schedule — next 90 days</div>
              <div style={{ maxHeight: '480px' }} className="overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                {calData.schedule?.map((c: any) => (
                  <div key={c.sensor_id} className="flex items-center gap-3 px-4 py-3">
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                      c.overdue ? 'bg-red-500 animate-pulse' : c.days_until_due <= 30 ? 'bg-amber-400' : 'bg-blue-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{c.asset_name}</div>
                      <div className="text-[10px] text-slate-400">{c.installation_point}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={clsx('text-[11px] font-bold font-mono',
                        c.overdue ? 'text-red-600' : c.days_until_due <= 30 ? 'text-amber-600' : 'text-slate-600 dark:text-slate-400'
                      )}>
                        {c.overdue ? `${Math.abs(c.days_until_due)}d overdue` : `${c.days_until_due}d`}
                      </div>
                      <div className="text-[9px] text-slate-400">{new Date(c.next_calibration_date).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={() => { calibrate.mutate(c.sensor_id); qc.invalidateQueries({ queryKey: ['sen-cal'] }) }}
                      className="text-[9px] px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 transition-colors flex-shrink-0"
                    >
                      Done ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Catalog tab ──────────────────────────────────────────────── */}
        {tab === 'catalog' && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {['all','electrical','mechanical','thermal','chemical','hydraulic','structural','environmental','optical'].map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={clsx('text-[9px] font-mono uppercase px-2 py-1 rounded transition-colors',
                    catFilter === c ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')}>
                  {CAT_ICON[c] ?? ''} {c}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Sensor catalog — {catalogData?.total ?? 0} sensors
                </span>
                <span className="text-[10px] text-slate-400">compatible with GridIQ fault detection engine</span>
              </div>
              <div style={{ maxHeight: '540px' }} className="overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                {catLoading ? (
                  <div className="py-10 text-center text-slate-400">Loading catalog...</div>
                ) : catalogData?.sensors?.map((s: any) => (
                  <div key={s.sensor_type_id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">{CAT_ICON[s.category] ?? '⚙️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400">{s.sensor_type_id}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.name}</span>
                          <span className={clsx('text-[9px] font-mono uppercase', PRIORITY_COLOR[s.priority])}>
                            {s.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{s.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 flex-wrap">
                          <span>📏 {s.measurement_parameter} ({s.measurement_unit})</span>
                          {s.accuracy_pct && <span>±{s.accuracy_pct}%</span>}
                          {s.cost_usd_lo && <span className="text-emerald-600 dark:text-emerald-400">${s.cost_usd_lo.toLocaleString()}–${s.cost_usd_hi?.toLocaleString()}</span>}
                          {s.lead_time_weeks && <span>{s.lead_time_weeks}wk lead</span>}
                        </div>
                        {s.feeds_fault_codes?.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {s.feeds_fault_codes.map((fc: string) => (
                              <span key={fc} className="text-[9px] font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                {fc}
                              </span>
                            ))}
                          </div>
                        )}
                        {s.roi_description && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 italic">{s.roi_description}</p>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">
                          {s.manufacturers?.slice(0, 3).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

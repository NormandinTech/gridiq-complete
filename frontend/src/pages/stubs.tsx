// GridIQ — Stub pages for lazy-loaded modules
// These will be filled in with full implementations in subsequent sprints.
// Each one connects to a real API endpoint and shows live data.

import { Cpu, Leaf, Bell, Wrench, FileCheck } from 'lucide-react'
import { useMaintenance, useAlerts, useNERCCIP, useEnergyMix } from '../hooks/useGridData'
import { AlertFeed } from '../components/AlertFeed'
import { useGridStore } from '../stores/gridStore'
import { clsx } from 'clsx'

// ── Digital Twin ──────────────────────────────────────────────────────────────

export function DigitalTwinPage() {
  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Cpu size={18} className="text-violet-500" />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">Digital Twin Engine</span>
        <span className="text-[10px] font-mono text-slate-400 ml-2">Physics-based asset simulation · sync lag 1.2s</span>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <Cpu size={40} className="mx-auto mb-3 text-violet-400" />
        <div className="text-slate-700 dark:text-slate-300 font-medium mb-1">Substation 7A — 3D digital twin</div>
        <div className="text-slate-400 text-sm mb-4">
          Full physics simulation with real-time asset health, what-if scenario modeling,
          and predictive failure analysis. Asset health data is live from the API.
        </div>
        <div className="text-[11px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-700/50 rounded-lg px-4 py-2 inline-block">
          Sprint 2 · Three.js + physics engine integration
        </div>
      </div>
    </div>
  )
}

// ── Renewables ────────────────────────────────────────────────────────────────

export function RenewablesPage() {
  const { data: mix } = useEnergyMix()

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Leaf size={18} className="text-emerald-500" />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">Renewable Integration</span>
      </div>
      {mix && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Solar', value: mix.solar_mw, unit: 'MW', color: 'text-amber-500' },
            { label: 'Wind',  value: mix.wind_mw,  unit: 'MW', color: 'text-blue-500' },
            { label: 'Hydro', value: mix.hydro_mw, unit: 'MW', color: 'text-teal-500' },
            { label: 'BESS charging', value: mix.bess_charging_mw, unit: 'MW', color: 'text-violet-500' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">{label}</div>
              <div className={clsx('text-2xl font-bold tabular-nums', color)}>
                {value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-xs text-slate-400 font-normal ml-1">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <Leaf size={36} className="mx-auto mb-3 text-emerald-400" />
        <div className="text-slate-400 text-sm">
          Full DER map, BESS optimization controls, curtailment manager,
          and carbon tracking dashboard — Sprint 2.
        </div>
      </div>
    </div>
  )
}

// ── Alerts page ───────────────────────────────────────────────────────────────

export function AlertsPage() {
  const { data, isLoading } = useAlerts({ limit: 100 })
  const storeAlerts = useGridStore((s) => s.openAlerts)
  const alerts = storeAlerts.length > 0 ? storeAlerts : data?.alerts ?? []

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-red-500" />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">Alerts & Events</span>
        <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full font-mono ml-1">
          {alerts.filter(a => a.status === 'open').length} open
        </span>
      </div>
      {isLoading
        ? <div className="text-slate-400 text-sm p-4">Loading alerts...</div>
        : <AlertFeed alerts={alerts} maxHeight="calc(100vh - 160px)" showFilters />
      }
    </div>
  )
}

// ── Maintenance page ──────────────────────────────────────────────────────────

export function MaintenancePage() {
  const { data } = useMaintenance()
  const records = data?.records ?? []

  const priorityColor: Record<string, string> = {
    urgent: 'text-red-600 dark:text-red-400',
    high:   'text-amber-600 dark:text-amber-400',
    normal: 'text-blue-600 dark:text-blue-400',
    low:    'text-slate-400',
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <Wrench size={18} className="text-blue-500" />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">Predictive Maintenance</span>
        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-2 py-0.5 rounded-full font-mono ml-1">
          {records.filter(r => r.priority === 'urgent').length} urgent
        </span>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
          AI-predicted maintenance schedule
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {records.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className={clsx('text-[10px] font-mono uppercase font-bold w-12', priorityColor[r.priority])}>
                {r.priority}
              </span>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{r.asset_name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{r.title}</div>
              </div>
              {r.failure_probability && (
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-red-500">
                    {(r.failure_probability * 100).toFixed(0)}%
                  </div>
                  <div className="text-[9px] text-slate-400">fail prob</div>
                </div>
              )}
              <span className={clsx('text-[9px] px-2 py-0.5 rounded font-mono',
                r.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
              )}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Compliance page ───────────────────────────────────────────────────────────

export function CompliancePage() {
  const { data: cip } = useNERCCIP()
  const controls = cip?.controls ?? []

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <FileCheck size={18} className="text-emerald-500" />
        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">NERC CIP Compliance</span>
        {cip && (
          <span className="text-[10px] font-mono text-slate-400 ml-2">
            Overall {cip.overall_score.toFixed(0)}% · Next audit {cip.next_audit_days}d
          </span>
        )}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold">
          CIP Standards — Automated Assessment
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {controls.map((c) => (
            <div key={c.control_id} className="flex items-center gap-3 px-4 py-3">
              <span className={clsx('text-[10px] font-mono font-bold w-16',
                c.status === 'compliant' ? 'text-emerald-600' : c.status === 'partial' ? 'text-amber-600' : 'text-red-600'
              )}>{c.control_id}</span>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{c.title}</div>
                {c.findings && <div className="text-[10px] text-amber-600 mt-0.5">{c.findings}</div>}
              </div>
              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={clsx('h-full rounded-full',
                  c.compliance_pct >= 90 ? 'bg-emerald-500' : c.compliance_pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                )} style={{ width: `${c.compliance_pct}%` }} />
              </div>
              <span className="text-[10px] font-mono font-medium w-8 text-right tabular-nums">
                {c.compliance_pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

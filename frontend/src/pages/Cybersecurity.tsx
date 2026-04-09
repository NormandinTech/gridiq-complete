// GridIQ — Cybersecurity Page (connected to live security API)
import { Shield, AlertTriangle, CheckCircle, Lock, Activity } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { useSecurityPosture, useThreats, useZoneStatuses, useNERCCIP } from '../hooks/useGridData'
import type { ThreatLevel } from '../types'

const threatConfig: Record<ThreatLevel, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-900/20',    text: 'text-red-700 dark:text-red-400',    border: 'border-red-200 dark:border-red-800',    dot: 'bg-red-500' },
  high:     { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
  medium:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-400',   border: 'border-blue-200 dark:border-blue-800',   dot: 'bg-blue-500' },
  low:      { bg: 'bg-slate-50 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' },
}

function ScoreRing({ score, label, size = 72 }: { score: number; label: string; size?: number }) {
  const r = size * 0.38, cx = size / 2, cy = size / 2, sw = size * 0.12
  const circ = 2 * Math.PI * r
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${(score / 100) * circ} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.18} fontWeight={600} fill="currentColor">
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-slate-400 text-center leading-tight mt-1">{label}</span>
    </div>
  )
}

export function CybersecurityPage() {
  const { data: posture } = useSecurityPosture()
  const { data: threats } = useThreats()
  const { data: zones }   = useZoneStatuses()
  const { data: cip }     = useNERCCIP()

  const threatList = threats?.threats ?? []
  const zoneList   = zones?.zones   ?? []
  const controls   = cip?.controls  ?? []

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Threat level banner */}
      {threatList.some((t) => t.threat_level === 'critical') && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl px-4 py-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-red-800 dark:text-red-300">
            ELEVATED THREAT LEVEL — {threatList.filter(t => t.threat_level === 'critical').length} critical incident{threatList.filter(t => t.threat_level === 'critical').length > 1 ? 's' : ''} active
          </span>
          <Lock size={14} className="text-red-500 ml-auto" />
        </div>
      )}

      {/* Posture scores */}
      {posture && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className="text-blue-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Security posture</span>
            <span className="ml-auto text-[10px] font-mono text-slate-400">
              MTTD {posture.mean_time_to_detect_min} min · industry avg 38 min
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <ScoreRing score={posture.overall_score} label="Overall" size={80} />
            <div className="flex-1 min-w-48 space-y-2">
              {[
                { label: 'Network segmentation', score: posture.network_segmentation_score },
                { label: 'Patch compliance',      score: posture.patch_compliance_score },
                { label: 'Access controls',       score: posture.access_control_score },
                { label: 'Endpoint hardening',    score: posture.endpoint_hardening_score },
              ].map(({ label, score }) => (
                <div key={label} className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500 w-36">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full transition-all',
                      score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    )} style={{ width: `${score}%` }} />
                  </div>
                  <span className={clsx('font-mono font-medium w-7 text-right tabular-nums',
                    score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {score}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Active threats',  value: posture.active_threats,  color: 'text-red-600' },
                { label: 'Events today',    value: posture.events_today,    color: 'text-slate-700 dark:text-slate-300' },
                { label: 'Auto-blocked',    value: posture.blocked_today,   color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={clsx('text-xl font-bold tabular-nums', color)}>{value.toLocaleString()}</div>
                  <div className="text-[9px] text-slate-400 font-mono uppercase">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Threat feed */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Active threat feed</span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {threatList.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <CheckCircle size={28} className="text-emerald-400 mb-2" />
                <p className="text-sm">No active threats</p>
              </div>
            ) : threatList.map((t) => {
              const cfg = threatConfig[t.threat_level]
              return (
                <div key={t.id} className="flex gap-3 px-4 py-3">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                    <AlertTriangle size={14} className={cfg.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 flex-1 leading-tight">
                        {t.title}
                      </span>
                      <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-mono flex-shrink-0', cfg.bg, cfg.text)}>
                        {t.threat_level.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-400">
                      {t.source_ip && <span>{t.source_ip}</span>}
                      {t.cve_id && <span className="text-red-500">{t.cve_id}</span>}
                      <span>{formatDistanceToNow(new Date(t.detected_at), { addSuffix: true })}</span>
                      {t.is_blocked && (
                        <span className="text-emerald-500">✓ blocked</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Zone health */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Network zone health</span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {zoneList.map((z) => (
              <div key={z.zone_name} className="flex items-center gap-3 px-4 py-2.5">
                <div className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                  z.status === 'secure' ? 'bg-emerald-400'
                  : z.status === 'warning' ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500 animate-pulse'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{z.zone_name}</div>
                  <div className="text-[10px] text-slate-400">{z.details}</div>
                </div>
                <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full',
                  z.status === 'secure'  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : z.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {z.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NERC CIP compliance */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-blue-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">NERC CIP compliance</span>
          </div>
          {cip && (
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
              <span>Overall: <strong className={clsx(cip.overall_score >= 80 ? 'text-emerald-600' : 'text-amber-600')}>{cip.overall_score.toFixed(0)}%</strong></span>
              <span>Next audit: {cip.next_audit_days}d</span>
            </div>
          )}
        </div>
        <div className="space-y-0">
          {controls.map((ctrl) => (
            <div key={ctrl.control_id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
              <span className={clsx(
                'text-[9px] font-mono px-1.5 py-0.5 rounded',
                ctrl.status === 'compliant'     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : ctrl.status === 'partial'      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}>
                {ctrl.control_id}
              </span>
              <span className="flex-1 text-[11px] text-slate-700 dark:text-slate-300 truncate">{ctrl.title}</span>
              <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                <div className={clsx('h-full rounded-full',
                  ctrl.compliance_pct >= 90 ? 'bg-emerald-500' : ctrl.compliance_pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                )} style={{ width: `${ctrl.compliance_pct}%` }} />
              </div>
              <span className={clsx('text-[10px] font-mono font-medium w-10 text-right tabular-nums',
                ctrl.compliance_pct >= 90 ? 'text-emerald-600 dark:text-emerald-400'
                : ctrl.compliance_pct >= 70 ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'
              )}>
                {ctrl.compliance_pct}%
              </span>
              {ctrl.findings && (
                <span title={ctrl.findings} className="text-amber-500 cursor-help text-xs">⚠</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

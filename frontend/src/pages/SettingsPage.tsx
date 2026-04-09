// GridIQ — Settings & Billing Page
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { CreditCard, Users, Settings, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react'
import { billingApi, authApi } from '../../services/authApi'
import { useAuthStore } from '../../stores/authStore'

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const get  = (p: string, token: string) =>
  fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }).then(r => r.json())

const TABS = [
  { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
  { id: 'team',    label: 'Team',           icon: Users },
  { id: 'account', label: 'Account',        icon: Settings },
]

const PLAN_LABELS: Record<string, { name: string; color: string; limit: string }> = {
  pilot:        { name: '90-Day Pilot',    color: 'bg-blue-100 text-blue-700',    limit: '500 assets' },
  starter:      { name: 'Starter',         color: 'bg-slate-100 text-slate-700',  limit: '500 assets' },
  professional: { name: 'Professional',    color: 'bg-violet-100 text-violet-700',limit: '5,000 assets' },
  enterprise:   { name: 'Enterprise',      color: 'bg-amber-100 text-amber-700',  limit: 'Unlimited' },
}

const STATUS_COLORS: Record<string, string> = {
  pilot:      'bg-blue-100 text-blue-700',
  active:     'bg-emerald-100 text-emerald-700',
  past_due:   'bg-red-100 text-red-700',
  onboarding: 'bg-amber-100 text-amber-700',
  cancelled:  'bg-slate-100 text-slate-500',
}

const ROLE_COLORS: Record<string, string> = {
  owner:    'bg-violet-100 text-violet-700',
  admin:    'bg-blue-100 text-blue-700',
  operator: 'bg-slate-100 text-slate-600',
  viewer:   'bg-slate-50 text-slate-400',
}

export function SettingsPage() {
  const [tab, setTab]           = useState('billing')
  const [inviteEmail, setEmail] = useState('')
  const [inviteRole,  setRole]  = useState('operator')
  const [inviteSent,  setSent]  = useState(false)
  const token  = useAuthStore(s => s.accessToken)!
  const user   = useAuthStore(s => s.user)
  const tenant = useAuthStore(s => s.tenant)
  const qc     = useQueryClient()

  const { data: sub }  = useQuery({ queryKey: ['subscription'], queryFn: () => billingApi.getSubscription(token), refetchInterval: 60_000 })
  const { data: team } = useQuery({ queryKey: ['team'],         queryFn: () => authApi.getTeam(token),           refetchInterval: 60_000 })

  const portalMutation = useMutation({
    mutationFn: () => billingApi.getPortal(token) as Promise<{ portal_url: string }>,
    onSuccess: (d) => { window.open(d.portal_url, '_blank') },
  })

  const upgradeMutation = useMutation({
    mutationFn: (plan: string) => billingApi.createCheckout(plan, token) as Promise<{ checkout_url: string }>,
    onSuccess: (d) => { window.location.href = d.checkout_url },
  })

  const inviteMutation = useMutation({
    mutationFn: () => authApi.inviteUser(inviteEmail, inviteRole, token),
    onSuccess: () => { setSent(true); setEmail(''); qc.invalidateQueries({ queryKey: ['team'] }) },
  })

  const plan   = tenant?.plan ?? 'pilot'
  const planCfg = PLAN_LABELS[plan] ?? PLAN_LABELS.pilot

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto h-full">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Settings</h1>

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Billing tab ────────────────────────────────────────────────────── */}
      {tab === 'billing' && (
        <div className="space-y-4">
          {/* Current plan */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">Current plan</div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{planCfg.name}</span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', planCfg.color)}>{planCfg.limit}</span>
                </div>
              </div>
              {sub && (
                <span className={clsx('text-xs px-2 py-1 rounded-full font-medium capitalize', STATUS_COLORS[sub.status] ?? 'bg-slate-100 text-slate-500')}>
                  {sub.status?.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Usage bar */}
            {sub && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Asset usage</span>
                  <span>{sub.current_asset_count ?? 0} / {sub.asset_limit ?? 500}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', ((sub.current_asset_count / sub.asset_limit) > 0.9) ? 'bg-red-500' : 'bg-blue-500')}
                    style={{ width: `${Math.min(100, ((sub.current_asset_count ?? 0) / (sub.asset_limit ?? 500)) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Pilot countdown */}
            {plan === 'pilot' && sub?.pilot_end_date && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertTriangle size={14} className="text-blue-500 flex-shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-400">
                  Pilot ends {new Date(sub.pilot_end_date).toLocaleDateString()}. Your ROI report will be delivered before then.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              {user?.role === 'owner' && (
                <>
                  <button onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                    <ExternalLink size={13} />
                    {portalMutation.isPending ? 'Loading...' : 'Manage billing'}
                  </button>
                  {plan === 'pilot' && (
                    <button onClick={() => upgradeMutation.mutate('starter')}
                      disabled={upgradeMutation.isPending}
                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
                      {upgradeMutation.isPending ? 'Loading...' : 'Upgrade to Starter →'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Plan comparison */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Available plans</div>
            <div className="space-y-3">
              {[
                { plan: 'starter',      name: 'Starter',      price: '$48,000/yr',  assets: '500 assets',     highlight: false },
                { plan: 'professional', name: 'Professional', price: '$240,000/yr', assets: '5,000 assets',   highlight: true },
                { plan: 'enterprise',   name: 'Enterprise',   price: 'Custom',      assets: 'Unlimited',      highlight: false },
              ].map(p => (
                <div key={p.plan} className={clsx('flex items-center justify-between p-4 rounded-xl border',
                  p.highlight ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-700'
                )}>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.assets}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.price}</span>
                    {user?.role === 'owner' && plan !== p.plan && (
                      <button
                        onClick={() => p.plan === 'enterprise' ? window.open('mailto:sales@gridiq.io') : upgradeMutation.mutate(p.plan)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors">
                        {p.plan === 'enterprise' ? 'Talk to sales' : 'Upgrade'}
                      </button>
                    )}
                    {plan === p.plan && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={12} /> Current
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Team tab ───────────────────────────────────────────────────────── */}
      {tab === 'team' && (
        <div className="space-y-4">
          {/* Invite */}
          {user?.role && ['owner','admin'].includes(user.role) && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Invite team member</div>
              {inviteSent && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 mb-4">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">Invitation sent!</span>
                </div>
              )}
              <div className="flex gap-3">
                <input type="email" value={inviteEmail}
                  onChange={e => { setEmail(e.target.value); setSent(false) }}
                  placeholder="colleague@utility.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={inviteRole} onChange={e => setRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {inviteMutation.isPending ? '...' : 'Invite'}
                </button>
              </div>
            </div>
          )}

          {/* Team list */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Team members · {team?.users?.length ?? 0}
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {team?.users?.map((u: any) => (
                <div key={u.user_id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {u.full_name}
                      {u.user_id === user?.user_id && <span className="text-[10px] text-slate-400">(you)</span>}
                    </div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role] ?? 'bg-slate-100 text-slate-500')}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Account tab ────────────────────────────────────────────────────── */}
      {tab === 'account' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Account details</div>
            <div className="space-y-3">
              {[
                { label: 'Utility name', value: tenant?.name },
                { label: 'Your name',    value: user?.full_name },
                { label: 'Email',        value: user?.email },
                { label: 'Role',         value: user?.role },
                { label: 'Tenant ID',    value: tenant?.tenant_id },
                { label: 'Plan',         value: tenant?.plan },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <span className="text-sm text-slate-500 w-32 flex-shrink-0">{label}</span>
                  <span className="text-sm text-slate-800 dark:text-slate-200 font-mono">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Support</div>
            <p className="text-sm text-slate-500 mb-4">Need help? Our team responds within 4 hours on business days.</p>
            <div className="flex gap-3">
              <a href="mailto:support@gridiq.io"
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Email support
              </a>
              <a href="https://docs.gridiq.io" target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <ExternalLink size={13} /> Documentation
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

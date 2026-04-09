// GridIQ — Onboarding Wizard (5 steps)
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { CheckCircle, Zap, Wifi, Database, Eye, CreditCard, ChevronRight, AlertCircle } from 'lucide-react'
import { onboardingApi, billingApi } from '../../services/authApi'
import { useAuthStore } from '../../stores/authStore'

const STEPS = [
  { n: 1, label: 'Grid profile',  icon: Database },
  { n: 2, label: 'Connect data',  icon: Wifi },
  { n: 3, label: 'Import assets', icon: Zap },
  { n: 4, label: 'Review',        icon: Eye },
  { n: 5, label: 'Activate',      icon: CreditCard },
]

interface OnboardingProps { onComplete: () => void }

export function OnboardingWizard({ onComplete }: OnboardingProps) {
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const token = useAuthStore((s) => s.accessToken)!
  const tenant = useAuthStore((s) => s.tenant)
  const updateTenant = useAuthStore((s) => s.updateTenant)

  // Step data
  const [profile, setProfile] = useState({
    utility_type: 'municipal', service_territory: '', state: '',
    estimated_assets: 100, voltage_levels: ['69kV'],
    has_solar: false, has_wind: false, has_hydro: false, has_bess: false,
    primary_scada: 'other', pain_points: [],
  })
  const [connData, setConnData] = useState({
    protocol: 'demo', host: '', port: 502, username: '', password: '',
  })
  const [connResult, setConnResult]   = useState<any>(null)
  const [discoveredAssets, setDiscoveredAssets] = useState<any[]>([])
  const [selectedTags, setSelectedTags]         = useState<string[]>([])
  const [reviewData, setReviewData]   = useState<any>(null)

  const go = async (fn: () => Promise<void>) => {
    setError(''); setLoading(true)
    try { await fn() } catch (e: any) { setError(e.message ?? 'Something went wrong') }
    setLoading(false)
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const submitProfile = () => go(async () => {
    await onboardingApi.saveProfile(profile, token)
    setStep(2)
  })

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const testConn = () => go(async () => {
    const res = await onboardingApi.testConnection(connData, token)
    setConnResult(res)
    if (res.success) {
      updateTenant({ scada_connected: true })
      setStep(3)
    } else {
      setError(res.message ?? 'Connection failed')
    }
  })

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const discoverAssets = () => go(async () => {
    const res = await onboardingApi.discoverAssets(token)
    setDiscoveredAssets(res.assets ?? [])
    setSelectedTags(res.assets?.map((a: any) => a.tag) ?? [])
  })

  useEffect(() => { if (step === 3) discoverAssets() }, [step])

  const confirmAssets = () => go(async () => {
    await onboardingApi.confirmAssets(selectedTags, token)
    const review = await onboardingApi.getReview(token)
    setReviewData(review)
    setStep(4)
  })

  // ── Step 5 ────────────────────────────────────────────────────────────────
  const startCheckout = () => go(async () => {
    // In dev mode, use mock activation
    if (import.meta.env.DEV || import.meta.env.VITE_API_URL?.includes('localhost')) {
      await billingApi.mockActivate(token)
      await onboardingApi.complete(token)
      updateTenant({ onboarding_complete: true, status: 'pilot' })
      onComplete()
      return
    }
    const res = await billingApi.createCheckout('pilot', token) as any
    window.location.href = res.checkout_url
  })

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
          <Zap size={15} className="text-white" />
        </div>
        <span className="font-bold text-slate-900">GridIQ</span>
        <span className="text-slate-300 mx-2">·</span>
        <span className="text-sm text-slate-500">Setting up {tenant?.name}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-10">
          {STEPS.map(({ n, label, icon: Icon }, i) => (
            <div key={n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                  step > n  ? 'bg-emerald-500' :
                  step === n ? 'bg-slate-900' :
                               'bg-slate-100'
                )}>
                  {step > n
                    ? <CheckCircle size={16} className="text-white" />
                    : <Icon size={15} className={step === n ? 'text-white' : 'text-slate-400'} />
                  }
                </div>
                <span className={clsx(
                  'text-[10px] mt-1.5 font-medium hidden sm:block',
                  step === n ? 'text-slate-900' : 'text-slate-400'
                )}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx(
                  'flex-1 h-0.5 mx-3 min-w-[20px]',
                  step > n ? 'bg-emerald-400' : 'bg-slate-200'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
            <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* ── Step 1: Grid profile ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Tell us about your grid</h2>
            <p className="text-sm text-slate-500 mb-6">This helps GridIQ configure the right monitoring for your fleet.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Utility type</label>
                  <select value={profile.utility_type}
                    onChange={e => setProfile(p => ({...p, utility_type: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="municipal">Municipal utility</option>
                    <option value="coop">Rural co-op</option>
                    <option value="iou">Investor-owned (IOU)</option>
                    <option value="ipp">Independent power producer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
                  <input type="text" value={profile.state} placeholder="CA"
                    onChange={e => setProfile(p => ({...p, state: e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Service territory</label>
                <input type="text" value={profile.service_territory} placeholder="e.g. Northern California"
                  onChange={e => setProfile(p => ({...p, service_territory: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Estimated monitored assets</label>
                <input type="number" value={profile.estimated_assets} min={10} max={10000}
                  onChange={e => setProfile(p => ({...p, estimated_assets: +e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-slate-400 mt-1">Transformers, breakers, meters, generation units, etc.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Generation assets (check all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'has_solar', label: '☀️ Solar' },
                    { key: 'has_wind',  label: '🌬️ Wind'  },
                    { key: 'has_hydro', label: '💧 Hydro' },
                    { key: 'has_bess',  label: '🔋 BESS'  },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={(profile as any)[key]}
                        onChange={e => setProfile(p => ({...p, [key]: e.target.checked}))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={submitProfile} disabled={loading}
              className="w-full mt-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Saving...' : <><span>Continue</span><ChevronRight size={15} /></>}
            </button>
          </div>
        )}

        {/* ── Step 2: Connect SCADA ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Connect your data</h2>
            <p className="text-sm text-slate-500 mb-6">GridIQ connects read-only to your existing SCADA or historian. We never write to your OT systems.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Protocol / data source</label>
                <select value={connData.protocol}
                  onChange={e => setConnData(c => ({...c, protocol: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="demo">Demo mode (no real SCADA needed)</option>
                  <option value="modbus_tcp">Modbus TCP</option>
                  <option value="dnp3">DNP3</option>
                  <option value="opc_ua">OPC-UA</option>
                  <option value="iec61850">IEC 61850</option>
                  <option value="mqtt">MQTT</option>
                  <option value="pi">OSIsoft PI Historian</option>
                  <option value="ignition">Ignition (Inductive Automation)</option>
                </select>
              </div>

              {connData.protocol !== 'demo' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Host / IP address</label>
                      <input type="text" value={connData.host} placeholder="192.168.1.100"
                        onChange={e => setConnData(c => ({...c, host: e.target.value}))}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Port</label>
                      <input type="number" value={connData.port}
                        onChange={e => setConnData(c => ({...c, port: +e.target.value}))}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Username (if required)</label>
                    <input type="text" value={connData.username}
                      onChange={e => setConnData(c => ({...c, username: e.target.value}))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              {connData.protocol === 'demo' && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-sm text-blue-700">
                    <strong>Demo mode:</strong> GridIQ will generate realistic simulated telemetry so you can explore the full platform without connecting real SCADA. You can connect real data later from Settings.
                  </p>
                </div>
              )}
            </div>

            <button onClick={testConn} disabled={loading}
              className="w-full mt-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? 'Testing connection...'
                : <><Wifi size={14} /><span>Test connection</span></>
              }
            </button>
          </div>
        )}

        {/* ── Step 3: Import assets ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Import your assets</h2>
            <p className="text-sm text-slate-500 mb-4">We found {discoveredAssets.length} assets. Select which to import.</p>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">{selectedTags.length} of {discoveredAssets.length} selected</span>
              <button onClick={() =>
                selectedTags.length === discoveredAssets.length
                  ? setSelectedTags([])
                  : setSelectedTags(discoveredAssets.map(a => a.tag))
              } className="text-xs text-blue-600 hover:text-blue-700">
                {selectedTags.length === discoveredAssets.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div style={{ maxHeight: '280px' }} className="overflow-y-auto space-y-1.5 mb-6">
              {loading ? (
                <div className="py-8 text-center text-slate-400 text-sm">Scanning SCADA...</div>
              ) : discoveredAssets.map(asset => (
                <label key={asset.tag}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-colors">
                  <input type="checkbox"
                    checked={selectedTags.includes(asset.tag)}
                    onChange={() => toggleTag(asset.tag)}
                    className="rounded border-slate-300 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{asset.name}</div>
                    <div className="text-xs text-slate-400">{asset.asset_type.replace(/_/g,' ')} · {asset.tag}</div>
                  </div>
                  {asset.current_value != null && (
                    <span className="text-xs font-mono text-slate-500">
                      {asset.current_value} {asset.unit}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <button onClick={confirmAssets} disabled={loading || selectedTags.length === 0}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
              {loading ? 'Importing...' : `Import ${selectedTags.length} assets`}
            </button>
          </div>
        )}

        {/* ── Step 4: Review ───────────────────────────────────────────────── */}
        {step === 4 && reviewData && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Looking good!</h2>
            <p className="text-sm text-slate-500 mb-6">Here's what GridIQ found for {reviewData.tenant_name}.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Assets imported', value: reviewData.assets_discovered },
                { label: 'Data connection', value: reviewData.scada_connected ? '✓ Connected' : '○ Demo mode' },
                { label: 'Asset types', value: reviewData.asset_types?.length ?? 0 },
                { label: 'Renewables detected', value: reviewData.has_renewables ? 'Yes' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">{label}</div>
                  <div className="text-base font-bold text-slate-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 mb-6">
              <p className="text-sm font-semibold text-emerald-800 mb-2">Estimated annual value</p>
              <div className="space-y-1">
                {Object.entries(reviewData.estimated_annual_value ?? {}).map(([k, v]: any) => (
                  <div key={k} className="flex justify-between text-xs text-emerald-700">
                    <span className="capitalize">{k.replace(/_/g,' ')}</span>
                    <span className="font-mono font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(5)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 flex items-center justify-center gap-2">
              <span>Choose plan & activate</span><ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* ── Step 5: Activate ─────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Activate GridIQ</h2>
            <p className="text-sm text-slate-500 mb-6">Choose how to get started.</p>

            <div className="rounded-xl border-2 border-slate-900 p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs font-mono uppercase text-slate-400 mb-1">Most popular</div>
                  <div className="font-bold text-slate-900 text-lg">90-Day Pilot</div>
                  <div className="text-sm text-slate-500">Full platform, integration included</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">$10K</div>
                  <div className="text-xs text-slate-400">one-time</div>
                </div>
              </div>
              <ul className="space-y-1.5 mb-4">
                {['All 8 platform modules','Integration engineering (40hrs)','Weekly check-in calls','ROI report at Day 90','100% credited toward Year 1'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={startCheckout} disabled={loading}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">
                {loading
                  ? 'Activating...'
                  : import.meta.env.DEV ? 'Activate pilot (dev mode)' : 'Start pilot — $10,000 →'
                }
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              Want annual pricing instead?{' '}
              <a href="mailto:sales@gridiq.io" className="text-blue-600">Talk to sales →</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// GridIQ — Signup Page
import { useState } from 'react'
import { clsx } from 'clsx'
import { Zap, AlertCircle, CheckCircle } from 'lucide-react'
import { authApi } from '../../services/authApi'

interface SignupPageProps {
  onSuccess: () => void
  onLogin: () => void
}

export function SignupPage({ onSuccess, onLogin }: SignupPageProps) {
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', utility_name: '', phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.signup(form) as any
      setDone(true)
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-500 text-sm">
            We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account.
          </p>
          <button onClick={onLogin} className="mt-6 text-sm text-blue-600 hover:text-blue-700">
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">GridIQ</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Request access</h1>
          <p className="text-sm text-slate-500 mb-6">
            Start your 90-day pilot — $10,000, no commitment beyond that
          </p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Utility name</label>
              <input
                type="text" value={form.utility_name}
                onChange={update('utility_name')}
                placeholder="Pacific Gas & Electric"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Your full name</label>
              <input
                type="text" value={form.full_name}
                onChange={update('full_name')}
                placeholder="Jane Smith"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
              <input
                type="email" value={form.email}
                onChange={update('email')}
                placeholder="jane@utility.com"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password" value={form.password}
                onChange={update('password')}
                placeholder="8+ characters"
                required minLength={8}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Minimum 8 characters</p>
            </div>

            <button
              type="submit" disabled={loading}
              className={clsx(
                'w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-2',
                loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-700'
              )}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {/* Pilot callout */}
          <div className="mt-5 bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>90-day pilot:</strong> $10,000 flat, credited 100% toward Year 1.
              Full platform access, integration engineering included. ROI report at Day 90.
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <button onClick={onLogin} className="text-blue-600 font-medium hover:text-blue-700">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}

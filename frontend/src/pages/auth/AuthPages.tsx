// GridIQ — Forgot Password & Reset Password Pages
import { useState } from 'react'
import { clsx } from 'clsx'
import { Zap, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../../services/authApi'

// ── Forgot Password ───────────────────────────────────────────────────────────

interface ForgotPasswordProps { onBack: () => void }

export function ForgotPasswordPage({ onBack }: ForgotPasswordProps) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [done,    setDone]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">GridIQ</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle size={40} className="text-emerald-500 mx-auto mb-4" />
              <h2 className="font-bold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-6">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent.
              </p>
              <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-700">
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-1">Reset password</h1>
              <p className="text-sm text-slate-500 mb-6">
                Enter your work email and we'll send a reset link.
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
                  <input
                    type="email" value={email} required
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ops@utility.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className={clsx('w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all',
                    loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-700'
                  )}
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        {!done && (
          <p className="text-center text-sm text-slate-500 mt-5">
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700">
              ← Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

// ── Reset Password ────────────────────────────────────────────────────────────

interface ResetPasswordProps { token: string; onSuccess: () => void }

export function ResetPasswordPage({ token, onSuccess }: ResetPasswordProps) {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      onSuccess()
    } catch (err: any) {
      setError(err.message ?? 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">GridIQ</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Set new password</h1>
          <p className="text-sm text-slate-500 mb-6">Choose a strong password for your account.</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password} required minLength={8}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
              <input
                type="password" value={confirm} required
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className={clsx('w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all',
                loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-700'
              )}
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Email Verified ────────────────────────────────────────────────────────────

interface VerifyEmailProps { token: string; onVerified: (token: string, user: any, tenant: any) => void }

export function VerifyEmailPage({ token, onVerified }: VerifyEmailProps) {
  const [error, setError] = useState('')
  const [done,  setDone]  = useState(false)

  // Auto-verify on mount
  useState(() => {
    authApi.verifyEmail(token)
      .then((res: any) => {
        setDone(true)
        setTimeout(() => onVerified(res.access_token, res.user, res.tenant), 1500)
      })
      .catch((err: any) => setError(err.message ?? 'Verification failed'))
  })

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">GridIQ</span>
        </div>

        {error ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
            <h2 className="font-bold text-slate-900 mb-2">Verification failed</h2>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : done ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="font-bold text-slate-900 mb-2">Email verified!</h2>
            <p className="text-sm text-slate-500">Taking you to setup...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="w-10 h-10 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Verifying your email...</p>
          </div>
        )}
      </div>
    </div>
  )
}

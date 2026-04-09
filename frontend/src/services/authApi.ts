// GridIQ SaaS — Auth API Service

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

async function authFetch<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> ?? {}),
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
  return data
}

export const authApi = {
  signup: (body: { email: string; password: string; full_name: string; utility_name: string; phone?: string }) =>
    authFetch('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),

  verifyEmail: (token: string) =>
    authFetch<{ access_token: string; user: any; tenant: any; message: string }>(
      '/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }
    ),

  login: (email: string, password: string) =>
    authFetch<{ access_token: string; user: any; tenant: any }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  logout: () =>
    authFetch('/auth/logout', { method: 'POST' }),

  refresh: () =>
    authFetch<{ access_token: string }>('/auth/refresh', { method: 'POST' }),

  me: (token: string) =>
    authFetch<{ user: any; tenant: any }>('/auth/me', {}, token),

  forgotPassword: (email: string) =>
    authFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, new_password: string) =>
    authFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

  inviteUser: (email: string, role: string, token: string) =>
    authFetch('/auth/invite', { method: 'POST', body: JSON.stringify({ email, role }) }, token),

  getTeam: (token: string) =>
    authFetch<{ users: any[] }>('/auth/team', {}, token),
}

export const onboardingApi = {
  getProgress: (token: string) =>
    authFetch<any>('/onboarding/progress', {}, token),

  saveProfile: (data: any, token: string) =>
    authFetch('/onboarding/step1-profile', { method: 'POST', body: JSON.stringify(data) }, token),

  testConnection: (data: any, token: string) =>
    authFetch<any>('/onboarding/step2-connect', { method: 'POST', body: JSON.stringify(data) }, token),

  discoverAssets: (token: string) =>
    authFetch<any>('/onboarding/step3-discover', { method: 'POST' }, token),

  confirmAssets: (tags: string[], token: string) =>
    authFetch('/onboarding/step3-confirm', { method: 'POST', body: JSON.stringify({ selected_tags: tags }) }, token),

  getReview: (token: string) =>
    authFetch<any>('/onboarding/step4-review', {}, token),

  complete: (token: string) =>
    authFetch('/onboarding/complete', { method: 'POST' }, token),
}

export const billingApi = {
  createCheckout: (plan: string, token: string) =>
    authFetch<{ checkout_url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }, token),

  getPortal: (token: string) =>
    authFetch<{ portal_url: string }>('/billing/portal', {}, token),

  getSubscription: (token: string) =>
    authFetch<any>('/billing/subscription', {}, token),

  mockActivate: (token: string) =>
    authFetch('/billing/mock-activate', { method: 'POST' }, token),
}

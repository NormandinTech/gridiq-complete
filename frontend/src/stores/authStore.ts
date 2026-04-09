// GridIQ SaaS — Auth Store (Zustand)
// Manages the logged-in user, tenant, and JWT token state.

import { create } from 'zustand'

export interface AuthUser {
  user_id:        string
  email:          string
  full_name:      string
  role:           'owner' | 'admin' | 'operator' | 'viewer'
  status:         string
  email_verified: boolean
  last_login:     string | null
  job_title:      string | null
  avatar_url:     string | null
}

export interface AuthTenant {
  tenant_id:           string
  name:                string
  slug:                string
  status:              string
  plan:                string
  plan_asset_limit:    number
  current_asset_count: number
  scada_connected:     boolean
  onboarding_step:     number
  onboarding_complete: boolean
  pilot_start_date:    string | null
  pilot_end_date:      string | null
}

interface AuthStore {
  user:         AuthUser | null
  tenant:       AuthTenant | null
  accessToken:  string | null
  isLoading:    boolean
  isLoggedIn:   boolean

  setAuth:      (user: AuthUser, tenant: AuthTenant, token: string) => void
  setToken:     (token: string) => void
  clearAuth:    () => void
  setLoading:   (v: boolean) => void
  updateTenant: (updates: Partial<AuthTenant>) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:        null,
  tenant:      null,
  accessToken: null,
  isLoading:   true,
  isLoggedIn:  false,

  setAuth: (user, tenant, token) =>
    set({ user, tenant, accessToken: token, isLoggedIn: true, isLoading: false }),

  setToken: (token) => set({ accessToken: token }),

  clearAuth: () =>
    set({ user: null, tenant: null, accessToken: null, isLoggedIn: false }),

  setLoading: (v) => set({ isLoading: v }),

  updateTenant: (updates) =>
    set((s) => ({ tenant: s.tenant ? { ...s.tenant, ...updates } : null })),
}))

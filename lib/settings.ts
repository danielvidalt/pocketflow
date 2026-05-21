export type AppSettings = {
  fortnightDir: 'next' | 'prev'
  showMonth: boolean
  payDayStart: number
  theme: 'dark' | 'light'
}

const DEFAULTS: AppSettings = { fortnightDir: 'next', showMonth: false, payDayStart: 1, theme: 'dark' }
const KEY = 'pf_settings'

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
}

export function saveSettings(s: AppSettings): void {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s))
}

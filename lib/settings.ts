export type AppSettings = {
  fortnightDir: 'next' | 'prev'  // 'next' = esta sem + próxima (default), 'prev' = sem anterior + esta
  showMonth: boolean              // muestra "Este mes" en el selector del inicio
  payDayStart: number             // día de inicio de semana: 0=Dom, 1=Lun(default), 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
}

const DEFAULTS: AppSettings = { fortnightDir: 'next', showMonth: false, payDayStart: 1 }
const KEY = 'pf_settings'

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
}

export function saveSettings(s: AppSettings): void {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s))
}

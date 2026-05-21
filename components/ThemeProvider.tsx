'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getSettings, saveSettings } from '@/lib/settings'

type Theme = 'dark' | 'light'

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'dark',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const t = getSettings().theme || 'dark'
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    saveSettings({ ...getSettings(), theme: t })
  }

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

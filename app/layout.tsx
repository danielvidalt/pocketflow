import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import SplashScreen from '@/components/SplashScreen'

export const metadata: Metadata = { title: 'PocketFlow', description: 'Tu plata, clara.' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#1c1c1a' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* Anti-FOUC: set data-theme before first paint */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{
          __html: `try{var s=JSON.parse(localStorage.getItem('pf_settings')||'{}');document.documentElement.setAttribute('data-theme',s.theme==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}`
        }} />
        <ThemeProvider>
          <div className="app-shell">
            <SplashScreen />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

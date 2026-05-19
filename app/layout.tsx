import type { Metadata, Viewport } from 'next'
import './globals.css'
export const metadata: Metadata = { title:'PocketFlow', description:'Tu plata, clara.' }
export const viewport: Viewport = { width:'device-width', initialScale:1, maximumScale:1, themeColor:'#185FA5' }
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><body><div className="app-shell">{children}</div></body></html>
}

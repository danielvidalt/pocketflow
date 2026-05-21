'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PlusCircle, BarChart3, PiggyBank, Wallet, TrendingUp } from 'lucide-react'

const TABS = [
  { href: '/',           label: 'Inicio',    Icon: Home },
  { href: '/registrar',  label: 'Registrar', Icon: PlusCircle },
  { href: '/gastos',     label: 'Gastos',    Icon: BarChart3 },
  { href: '/ahorros',    label: 'Ahorros',   Icon: PiggyBank },
  { href: '/ingresos',   label: 'Ingresos',  Icon: Wallet },
  { href: '/resumen',    label: 'Resumen',   Icon: TrendingUp },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, label, Icon }) => {
        const active = path === href || (href !== '/' && path.startsWith(href))
        const isRegister = href === '/registrar'
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, gap: 2, paddingTop: isRegister ? 4 : 6, paddingBottom: 4,
              color: active ? (isRegister ? '#fff' : 'var(--blue)') : isRegister ? 'rgba(255,255,255,.85)' : 'var(--text3)',
              textDecoration: 'none', minWidth: 0, overflow: 'hidden',
              background: isRegister ? (active ? '#1a7fd4' : 'var(--blue)') : 'transparent',
              borderRadius: isRegister ? 14 : 0,
              margin: isRegister ? '4px 2px' : 0,
            }}>
            <Icon size={isRegister ? 20 : 19} strokeWidth={active ? 2 : 1.7} />
            <span style={{
              fontSize: 9, fontWeight: active ? 600 : 400,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '100%', lineHeight: 1.2,
            }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, DollarSign, Wallet, BarChart2, PiggyBank } from 'lucide-react'

const TABS = [
  { href: '/',         label: 'Inicio',    Icon: Home },
  { href: '/gastos',   label: 'Gastos',    Icon: DollarSign },
  { href: '/ahorros',  label: 'Ahorros',   Icon: PiggyBank },
  { href: '/ingresos', label: 'Ingresos',  Icon: Wallet },
  { href: '/resumen',  label: 'Resumen',   Icon: BarChart2 },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav className="bottom-nav">
      {TABS.map(({ href, label, Icon }) => {
        const active = path === href || (href !== '/' && path.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, gap: 2, paddingTop: 6, paddingBottom: 4,
              color: active ? 'var(--blue)' : 'var(--text3)',
              textDecoration: 'none', minWidth: 0, overflow: 'hidden',
            }}>
            <Icon size={19} strokeWidth={active ? 2 : 1.7} />
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

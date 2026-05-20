'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, DollarSign, Wallet, BarChart2, PiggyBank } from 'lucide-react'
const TABS=[
  {href:'/',label:'Inicio',Icon:Home},
  {href:'/gastos',label:'Gastos',Icon:DollarSign},
  {href:'/ahorros',label:'Ahorros',Icon:PiggyBank},
  {href:'/ingresos',label:'Ingresos',Icon:Wallet},
  {href:'/resumen',label:'Resumen',Icon:BarChart2},
]
export default function BottomNav(){
  const path=usePathname()
  return(<nav className="bottom-nav">{TABS.map(({href,label,Icon})=>{const active=path===href;return(<Link key={href} href={href} className="flex flex-col items-center flex-1 gap-[3px] py-1 text-[10px]" style={{color:active?'var(--blue)':'var(--text3)'}}><Icon size={20} strokeWidth={active?2:1.7}/><span style={{fontWeight:active?600:400}}>{label}</span></Link>)})}</nav>)
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, LogOut } from 'lucide-react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, weeklyEquivalent } from '@/lib/types'
import { PillTag, BtnGhost, SectionHeader } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { getClient } from '@/lib/supabase'
import { format, isToday, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'

export default function HomePage(){
  const {fetchAll,fetchExchangeRates,incomeSources,incomeEntries,expenses}=usePocketFlow()
  const router=useRouter()
  const [checking,setChecking]=useState(true)

  useEffect(()=>{
    async function init(){
      const {data:{session}}=await getClient().auth.getSession()
      if(!session){router.push('/login');return}
      fetchAll();fetchExchangeRates();setChecking(false)
    }
    init()
  },[])

  async function handleLogout(){
    await getClient().auth.signOut()
    router.push('/login')
  }

  const now=new Date()
  const wkStart=startOfWeek(now,{weekStartsOn:1}); const wkEnd=endOfWeek(now,{weekStartsOn:1})
  const weeklyTotal=useMemo(()=>incomeSources.filter(s=>s.is_active).reduce((sum,s)=>sum+weeklyEquivalent(s),0),[incomeSources])
  const weekEntries=useMemo(()=>incomeEntries.filter(e=>isWithinInterval(parseISO(e.received_at),{start:wkStart,end:wkEnd})),[incomeEntries])
  const collectedThisWeek=weekEntries.reduce((s,e)=>s+e.amount,0)
  const collectedPct=weeklyTotal>0?(collectedThisWeek/weeklyTotal)*100:0
  const todayExps=useMemo(()=>expenses.filter(e=>isToday(parseISO(e.expense_date))),[expenses])
  const todayTotal=todayExps.reduce((s,e)=>s+e.amount,0)
  const weekSources=useMemo(()=>incomeSources.filter(s=>s.is_active&&s.frequency!=='once'),[incomeSources])

  if(checking) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100dvh',background:'var(--bg)',color:'var(--text3)',fontSize:14}}>Cargando…</div>

  return(<>
    <SectionHeader title="Buenos días 👋" subtitle={`${format(now,"EEEE d 'de' MMMM",{locale:es})} · sem ${format(wkStart,'d')}–${format(wkEnd,'d')}`}
      action={
        <div className="flex gap-2">
          <Link href="/calendario" style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Calendar size={18} color="var(--text2)" strokeWidth={1.7}/></Link>
          <button onClick={handleLogout} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><LogOut size={18} color="var(--text2)" strokeWidth={1.7}/></button>
        </div>
      }/>
    <div className="scroll-area" style={{padding:16}}>
      <div style={{background:'var(--blue)',borderRadius:'var(--radius)',padding:18,marginBottom:10}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,.7)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>Disponible esta semana</div>
        <div style={{fontSize:40,fontWeight:700,color:'#fff',letterSpacing:-1,lineHeight:1}}>{formatAUD(weeklyTotal)}</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:6}}>{formatAUD(collectedThisWeek)} cobrado · {formatAUD(weeklyTotal-collectedThisWeek)} por llegar</div>
        <div style={{height:5,background:'rgba(255,255,255,.2)',borderRadius:3,marginTop:12,overflow:'hidden'}}>
          <div style={{height:'100%',background:'#fff',borderRadius:3,width:`${collectedPct}%`,transition:'width .4s'}}/>
        </div>
        <div className="flex justify-between mt-1">
          <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{Math.round(collectedPct)}% cobrado</span>
          <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>equiv. semanal</span>
        </div>
      </div>
      <div className="card" style={{marginBottom:10}}>
        <div className="section-label">Pagos esta semana</div>
        {weekSources.length===0&&<p style={{fontSize:13,color:'var(--text3)'}}>Agregá fuentes en la pestaña Ingresos</p>}
        {weekSources.map((src,i)=>{
          const cobrado=weekEntries.some(e=>e.source_id===src.id)
          return(<div key={src.id} className="flex items-center gap-2.5 py-2" style={{borderBottom:i<weekSources.length-1?'0.5px solid var(--border)':'none'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:src.color,flexShrink:0}}/>
            <div style={{fontSize:13,color:'var(--text1)',flex:1}}>{src.name}</div>
            {cobrado?<PillTag color="green">cobrado</PillTag>:<PillTag color="gray">pendiente</PillTag>}
            <div style={{fontSize:13,fontWeight:500,color:cobrado?'var(--green)':'var(--text3)'}}>{formatAUD(src.amount)}</div>
          </div>)
        })}
      </div>
      <div className="card" style={{marginBottom:10}}>
        <div className="flex items-center justify-between" style={{marginBottom:10}}>
          <div className="section-label" style={{margin:0}}>Hoy gastaste</div>
          <span style={{fontSize:16,fontWeight:700,color:'var(--red)'}}>{formatAUD(todayTotal)}</span>
        </div>
        {todayExps.length===0&&<p style={{fontSize:13,color:'var(--text3)',paddingBottom:4}}>Sin gastos registrados hoy</p>}
        {todayExps.slice(0,3).map((exp,i)=>(<div key={exp.id} className="flex items-center justify-between gap-3 py-2" style={{borderBottom:i<Math.min(todayExps.length,3)-1?'0.5px solid var(--border)':'none'}}>
          <div style={{fontSize:13,color:'var(--text1)'}}>{exp.name}</div>
          <span style={{fontSize:13,fontWeight:500,color:'var(--red)',whiteSpace:'nowrap'}}>−{formatAUD(exp.amount)}</span>
        </div>))}
        <BtnGhost className="mt-2.5"><Link href="/gastos" className="w-full flex items-center justify-center" style={{color:'var(--text2)',fontSize:13}}>Ver todos los gastos</Link></BtnGhost>
      </div>
    </div>
    <BottomNav/>
  </>)
}

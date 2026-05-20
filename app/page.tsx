'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, LogOut, Settings, X } from 'lucide-react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, weeklyEquivalent } from '@/lib/types'
import { PillTag, BtnGhost, SectionHeader } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { getClient } from '@/lib/supabase'
import { format, isToday, parseISO, startOfWeek, endOfWeek, isWithinInterval, subWeeks, addWeeks, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { getSettings, saveSettings } from '@/lib/settings'
import type { AppSettings } from '@/lib/settings'

type Period = 'week' | 'fortnight' | 'month'
const DEFAULTS: AppSettings = { fortnightDir: 'next', showMonth: false }

export default function HomePage(){
  const {fetchAll,fetchExchangeRates,incomeSources,incomeEntries,expenses,weeklyFixedCosts}=usePocketFlow()
  const router=useRouter()
  const [checking,setChecking]=useState(true)
  const [period,setPeriod]=useState<Period>('week')
  const [settings,setSettings]=useState<AppSettings>(DEFAULTS)
  const [showSettings,setShowSettings]=useState(false)

  useEffect(()=>{ setSettings(getSettings()) },[])

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

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]){
    const next={...settings,[key]:value}
    setSettings(next); saveSettings(next)
    if(key==='showMonth'&&!value&&period==='month') setPeriod('week')
  }

  const now=new Date()
  const wkStart=startOfWeek(now,{weekStartsOn:1})
  const wkEnd=endOfWeek(now,{weekStartsOn:1})
  const fnPrevStart=startOfWeek(subWeeks(now,1),{weekStartsOn:1})
  const fnNextEnd=endOfWeek(addWeeks(now,1),{weekStartsOn:1})
  const mthStart=startOfMonth(now)
  const mthEnd=endOfMonth(now)

  function getPeriodRange():{start:Date,end:Date}{
    if(period==='week') return {start:wkStart,end:wkEnd}
    if(period==='month') return {start:mthStart,end:mthEnd}
    return settings.fortnightDir==='next'
      ?{start:wkStart,end:fnNextEnd}
      :{start:fnPrevStart,end:wkEnd}
  }

  const multiplier=period==='week'?1:period==='month'?4.33:2
  const weeklyTotal=useMemo(()=>incomeSources.filter(s=>s.is_active).reduce((sum,s)=>sum+weeklyEquivalent(s),0),[incomeSources])
  const expectedIncome=weeklyTotal*multiplier

  // "Pagos esta semana" always shows the current week regardless of period toggle
  const weekEntries=useMemo(()=>incomeEntries.filter(e=>isWithinInterval(parseISO(e.received_at),{start:wkStart,end:wkEnd})),[incomeEntries])

  const periodEntries=useMemo(()=>{
    const {start,end}=getPeriodRange()
    return incomeEntries.filter(e=>isWithinInterval(parseISO(e.received_at),{start,end}))
  },[incomeEntries,period,settings.fortnightDir])

  const collectedThisPeriod=periodEntries.reduce((s,e)=>s+e.amount,0)
  const collectedPct=expectedIncome>0?(collectedThisPeriod/expectedIncome)*100:0

  const periodExps=useMemo(()=>{
    const {start,end}=getPeriodRange()
    return expenses.filter(e=>isWithinInterval(parseISO(e.expense_date),{start,end}))
  },[expenses,period,settings.fortnightDir])

  const periodSpent=periodExps.reduce((s,e)=>s+e.amount,0)
  const fixedCosts=weeklyFixedCosts()*multiplier
  const remaining=collectedThisPeriod-periodSpent-fixedCosts

  const todayExps=useMemo(()=>expenses.filter(e=>isToday(parseISO(e.expense_date))),[expenses])
  const todayTotal=todayExps.reduce((s,e)=>s+e.amount,0)
  const weekSources=useMemo(()=>incomeSources.filter(s=>s.is_active&&s.frequency!=='once'),[incomeSources])

  const periodLabel=period==='week'
    ?`sem ${format(wkStart,'d')}–${format(wkEnd,'d')}`
    :period==='month'
      ?format(now,"MMMM yyyy",{locale:es})
      :settings.fortnightDir==='next'
        ?`quinc ${format(wkStart,"d MMM",{locale:es})}–${format(fnNextEnd,"d MMM",{locale:es})}`
        :`quinc ${format(fnPrevStart,"d MMM",{locale:es})}–${format(wkEnd,"d MMM",{locale:es})}`

  const periods:[Period,string][]=[
    ['week','Esta semana'],
    ['fortnight','Esta quincena'],
    ...(settings.showMonth?[['month','Este mes'] as [Period,string]]:[]),
  ]

  if(checking) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100dvh',background:'var(--bg)',color:'var(--text3)',fontSize:14}}>Cargando…</div>

  return(<>
    <SectionHeader title="Buenos días 👋" subtitle={`${format(now,"EEEE d 'de' MMMM",{locale:es})} · ${periodLabel}`}
      action={
        <div className="flex gap-2">
          <Link href="/calendario" style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Calendar size={18} color="var(--text2)" strokeWidth={1.7}/></Link>
          <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Settings size={18} color="var(--text2)" strokeWidth={1.7}/></button>
          <button onClick={handleLogout} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><LogOut size={18} color="var(--text2)" strokeWidth={1.7}/></button>
        </div>
      }/>
    <div className="scroll-area" style={{padding:16}}>
      {/* Selector de período */}
      <div style={{display:'flex',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:3,marginBottom:10}}>
        {periods.map(([p,lbl])=>(
          <button key={p} onClick={()=>setPeriod(p)}
            style={{flex:1,padding:7,borderRadius:6,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',background:period===p?'var(--bg)':'transparent',color:period===p?'var(--text1)':'var(--text2)',boxShadow:period===p?'0 1px 3px rgba(0,0,0,.1)':'none'}}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{background:'var(--blue)',borderRadius:'var(--radius)',padding:18,marginBottom:10}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,.7)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>
          {remaining>=0?'Disponible':'Gastaste de más'}
        </div>
        <div style={{fontSize:40,fontWeight:700,color:'#fff',letterSpacing:-1,lineHeight:1}}>{formatAUD(Math.abs(remaining))}</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:6}}>
          {formatAUD(collectedThisPeriod)} ingresado · {formatAUD(periodSpent)} gastado{fixedCosts>0?` · ${formatAUD(fixedCosts)} fijo`:''}
        </div>
        <div style={{height:5,background:'rgba(255,255,255,.2)',borderRadius:3,marginTop:12,overflow:'hidden'}}>
          <div style={{height:'100%',background:'#fff',borderRadius:3,width:`${Math.min(100,collectedPct)}%`,transition:'width .4s'}}/>
        </div>
        <div className="flex justify-between mt-1">
          <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{Math.round(collectedPct)}% ingresado de {formatAUD(expectedIncome)}</span>
          <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{formatAUD(Math.max(0,expectedIncome-collectedThisPeriod))} por llegar</span>
        </div>
      </div>

      <div className="card" style={{marginBottom:10}}>
        <div className="section-label">Pagos esta semana</div>
        {weekSources.length===0&&<p style={{fontSize:13,color:'var(--text3)'}}>Agregá fuentes en la pestaña Ingresos</p>}
        {weekSources.map((src,i)=>{
          const ingresado=weekEntries.some(e=>e.source_id===src.id)
          return(<div key={src.id} className="flex items-center gap-2.5 py-2" style={{borderBottom:i<weekSources.length-1?'0.5px solid var(--border)':'none'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:src.color,flexShrink:0}}/>
            <div style={{fontSize:13,color:'var(--text1)',flex:1}}>{src.name}</div>
            {ingresado?<PillTag color="green">ingresado</PillTag>:<PillTag color="gray">pendiente</PillTag>}
            <div style={{fontSize:13,fontWeight:500,color:ingresado?'var(--green)':'var(--text3)'}}>{formatAUD(src.amount)}</div>
          </div>)
        })}
      </div>

      <div className="card" style={{marginBottom:10}}>
        <div className="flex items-center justify-between" style={{marginBottom:10}}>
          <div className="section-label" style={{margin:0}}>Hoy gastaste</div>
          <span style={{fontSize:16,fontWeight:700,color:'var(--red)'}}>{formatAUD(todayTotal)}</span>
        </div>
        {todayExps.length===0&&<p style={{fontSize:13,color:'var(--text3)',paddingBottom:4}}>Sin gastos registrados hoy</p>}
        {todayExps.map((exp,i)=>(<div key={exp.id} className="flex items-center justify-between gap-3 py-2" style={{borderBottom:i<todayExps.length-1?'0.5px solid var(--border)':'none'}}>
          <div style={{fontSize:13,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{exp.name}</div>
          <span style={{fontSize:13,fontWeight:500,color:'var(--red)',whiteSpace:'nowrap',flexShrink:0}}>−{formatAUD(exp.amount)}</span>
        </div>))}
        <BtnGhost className="mt-2.5"><Link href="/gastos/historial" className="w-full flex items-center justify-center" style={{color:'var(--text2)',fontSize:13}}>Ver todos los gastos</Link></BtnGhost>
      </div>
    </div>

    {/* Panel de ajustes */}
    {showSettings&&(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'flex-end',zIndex:200}}
        onClick={()=>setShowSettings(false)}>
        <div className="slide-up" style={{width:'100%',maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:'20px 20px 0 0',padding:20}}
          onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between" style={{marginBottom:20}}>
            <span style={{fontSize:16,fontWeight:600,color:'var(--text1)'}}>Ajustes</span>
            <button onClick={()=>setShowSettings(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="var(--text3)"/></button>
          </div>

          <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Vista quincenal</div>
          <div style={{display:'flex',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:3,marginBottom:6}}>
            {([['next','Esta sem + próxima'],['prev','Sem anterior + esta']] as const).map(([dir,lbl])=>(
              <button key={dir} onClick={()=>updateSetting('fortnightDir',dir)}
                style={{flex:1,padding:8,borderRadius:6,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',
                  background:settings.fortnightDir===dir?'var(--bg)':'transparent',
                  color:settings.fortnightDir===dir?'var(--text1)':'var(--text2)',
                  boxShadow:settings.fortnightDir===dir?'0 1px 3px rgba(0,0,0,.1)':'none'}}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:20,paddingLeft:4}}>
            {settings.fortnightDir==='next'
              ?`Muestra desde el lunes de esta semana (${format(wkStart,"d MMM",{locale:es})}) hasta el domingo de la semana que viene (${format(fnNextEnd,"d MMM",{locale:es})})`
              :`Muestra desde el lunes pasado (${format(fnPrevStart,"d MMM",{locale:es})}) hasta el domingo de esta semana (${format(wkEnd,"d MMM",{locale:es})})`}
          </div>

          <div className="flex items-center justify-between" style={{paddingTop:16,borderTop:'0.5px solid var(--border)'}}>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--text1)'}}>Vista mensual</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Agrega &quot;Este mes&quot; en el selector del inicio</div>
            </div>
            <button onClick={()=>updateSetting('showMonth',!settings.showMonth)}
              style={{width:44,height:26,borderRadius:13,border:'none',cursor:'pointer',flexShrink:0,
                background:settings.showMonth?'var(--green)':'var(--bg3)',position:'relative',transition:'background .2s'}}>
              <span style={{position:'absolute',top:2,left:settings.showMonth?20:2,width:22,height:22,
                borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
            </button>
          </div>
        </div>
      </div>
    )}
    <BottomNav/>
  </>)
}

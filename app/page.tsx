'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, LogOut, Settings, X } from 'lucide-react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, weeklyEquivalent, FREQ_DIVISORS } from '@/lib/types'
import { PillTag, BtnGhost, SectionHeader } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { getClient } from '@/lib/supabase'
import { format, isToday, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { getSettings, saveSettings } from '@/lib/settings'
import type { AppSettings } from '@/lib/settings'

type Period = 'week' | 'fortnight' | 'month'
const DEFAULTS: AppSettings = { fortnightDir: 'next', showMonth: false, payDayStart: 1 }

// Días en orden Lun→Dom para el selector (convención JS: 0=Dom, 1=Lun, …, 6=Sáb)
const PAY_DAYS: [number, string][] = [[1,'Lun'],[2,'Mar'],[3,'Mié'],[4,'Jue'],[5,'Vie'],[6,'Sáb'],[0,'Dom']]
const PAY_DAY_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function getPayWeekStart(from: Date, startDay: number): Date {
  const d = new Date(from)
  let diff = d.getDay() - startDay
  if (diff < 0) diff += 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function HomePage(){
  const {fetchAll,fetchExchangeRates,incomeSources,incomeEntries,expenses,fixedExpenseAllocations,recurringExpenses,savingsGoals}=usePocketFlow()
  const router=useRouter()
  const [checking,setChecking]=useState(true)
  const [period,setPeriod]=useState<Period>('week')
  const [settings,setSettings]=useState<AppSettings>(DEFAULTS)
  const [showSettings,setShowSettings]=useState(false)
  const [pending,setPending]=useState<AppSettings>(DEFAULTS)

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

  function openSettings(){ setPending(settings); setShowSettings(true) }

  function updatePending<K extends keyof AppSettings>(key: K, value: AppSettings[K]){
    setPending(p=>({...p,[key]:value}))
  }

  function applySettings(){
    setSettings(pending); saveSettings(pending)
    if(!pending.showMonth&&period==='month') setPeriod('week')
    setShowSettings(false)
  }

  const now=new Date()
  const wkStart=getPayWeekStart(now, settings.payDayStart)
  const wkEnd=new Date(wkStart); wkEnd.setDate(wkStart.getDate()+6); wkEnd.setHours(23,59,59,999)
  const fnPrevStart=new Date(wkStart); fnPrevStart.setDate(wkStart.getDate()-7)
  const fnNextEnd=new Date(wkStart); fnNextEnd.setDate(wkStart.getDate()+13); fnNextEnd.setHours(23,59,59,999)
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
  const weekEntries=useMemo(()=>incomeEntries.filter(e=>isWithinInterval(parseISO(e.received_at),{start:wkStart,end:wkEnd})),[incomeEntries,settings.payDayStart])

  const periodEntries=useMemo(()=>{
    const {start,end}=getPeriodRange()
    return incomeEntries.filter(e=>isWithinInterval(parseISO(e.received_at),{start,end}))
  },[incomeEntries,period,settings.fortnightDir,settings.payDayStart])

  const collectedThisPeriod=periodEntries.reduce((s,e)=>s+e.amount,0)
  const collectedPct=expectedIncome>0?(collectedThisPeriod/expectedIncome)*100:0

  const periodExps=useMemo(()=>{
    const {start,end}=getPeriodRange()
    return expenses.filter(e=>isWithinInterval(parseISO(e.expense_date),{start,end}))
  },[expenses,period,settings.fortnightDir,settings.payDayStart])

  const periodSpent=periodExps.reduce((s,e)=>s+e.amount,0)
  const {start:_ps,end:_pe}=getPeriodRange()
  const psStr=format(_ps,'yyyy-MM-dd')
  const peStr=format(_pe,'yyyy-MM-dd')
  const actualFixedSpent=fixedExpenseAllocations
    .filter(a=>a.type==='withdrawal'&&a.allocated_at>=psStr&&a.allocated_at<=peStr)
    .reduce((s,a)=>s+a.amount,0)
  // Gastos diarios ya realizados (excluye contribuciones a ahorros)
  const gastadoRegularPeriod=useMemo(()=>
    periodExps.filter(e=>!e.name.startsWith('Ahorro: ')).reduce((s,e)=>s+e.amount,0),
    [periodExps])
  // Sobres fijos: max(monto planificado del período, depósitos reales en el período)
  const totalFixedCommitted=useMemo(()=>
    recurringExpenses.filter(e=>e.is_active).reduce((total,e)=>{
      const planned=e.amount*(multiplier/FREQ_DIVISORS[e.frequency])
      const deposited=fixedExpenseAllocations
        .filter(a=>a.recurring_expense_id===e.id&&a.type!=='withdrawal'&&a.allocated_at>=psStr&&a.allocated_at<=peStr)
        .reduce((s,a)=>s+a.amount,0)
      return total+Math.max(planned,deposited)
    },0),
    [recurringExpenses,fixedExpenseAllocations,period,settings.fortnightDir,settings.payDayStart])
  // Sobres de ahorro: max(contribución planificada del período, ahorros reales en el período)
  const totalSavingsCommitted=useMemo(()=>{
    const SEP='\x1F'
    return savingsGoals.reduce((total,g)=>{
      const i=g.name.indexOf(SEP)
      const type=i===-1?'$' as const:g.name[i+1] as '%'|'$'
      const value=i===-1?0:(parseFloat(g.name.slice(i+2))||0)
      const freq=g.frequency||'monthly'
      const freqDiv=FREQ_DIVISORS[freq]||4.33
      const planned=type==='%'?weeklyTotal*multiplier*value/100:value*(multiplier/freqDiv)
      const goalName=i===-1?g.name:g.name.slice(0,i)
      const deposited=periodExps.filter(e=>e.name===`Ahorro: ${goalName}`).reduce((s,e)=>s+e.amount,0)
      return total+Math.max(planned,deposited)
    },0)
  },[savingsGoals,periodExps,weeklyTotal,multiplier])
  const totalAGastar=collectedThisPeriod-gastadoRegularPeriod-totalFixedCommitted-totalSavingsCommitted
  const remaining=collectedThisPeriod-periodSpent-actualFixedSpent

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
          <button onClick={openSettings} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Settings size={18} color="var(--text2)" strokeWidth={1.7}/></button>
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
          Total a Gastar
        </div>
        <div style={{fontSize:44,fontWeight:700,color:'#fff',letterSpacing:-1,lineHeight:1}}>{formatAUD(Math.max(0,totalAGastar))}</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,.7)',marginTop:8,display:'flex',gap:12}}>
          <span>Disponible: <span style={{fontWeight:600,color:remaining>=0?'rgba(255,255,255,.95)':'rgba(255,180,180,1)'}}>{formatAUD(remaining)}</span></span>
          {totalSavingsCommitted>0&&<span>Ahorros reservados: <span style={{fontWeight:600,color:'rgba(255,255,255,.9)'}}>{formatAUD(totalSavingsCommitted)}</span></span>}
        </div>
        <div style={{height:5,background:'rgba(255,255,255,.2)',borderRadius:3,marginTop:12,overflow:'hidden'}}>
          <div style={{height:'100%',background:'#fff',borderRadius:3,width:`${Math.min(100,collectedPct)}%`,transition:'width .4s'}}/>
        </div>
        <div className="flex justify-between mt-1" style={{marginBottom:14}}>
          <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{Math.round(collectedPct)}% de {formatAUD(expectedIncome)}</span>
          <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{formatAUD(Math.max(0,expectedIncome-collectedThisPeriod))} por llegar</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div style={{background:'rgba(255,255,255,.15)',borderRadius:8,padding:'8px 10px'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.7)',marginBottom:2}}>Ingresos</div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{formatAUD(collectedThisPeriod)}</div>
          </div>
          <div style={{background:'rgba(255,255,255,.15)',borderRadius:8,padding:'8px 10px'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.7)',marginBottom:2}}>Gastado</div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{formatAUD(periodSpent+actualFixedSpent)}</div>
          </div>
          <div style={{background:'rgba(255,255,255,.15)',borderRadius:8,padding:'8px 10px'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.7)',marginBottom:2}}>Fijos</div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{formatAUD(actualFixedSpent)}</div>
          </div>
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
        <BtnGhost><Link href="/gastos" className="w-full flex items-center justify-center" style={{color:'var(--text2)',fontSize:13}}>Ver gastos</Link></BtnGhost>
      </div>
    </div>

    {/* Panel de ajustes */}
    {showSettings&&(()=>{
      const pw=getPayWeekStart(now,pending.payDayStart)
      const pwe=new Date(pw); pwe.setDate(pw.getDate()+6); pwe.setHours(23,59,59,999)
      const pfp=new Date(pw); pfp.setDate(pw.getDate()-7)
      const pfne=new Date(pw); pfne.setDate(pw.getDate()+13); pfne.setHours(23,59,59,999)
      return(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'flex-end',zIndex:200}}
        onClick={()=>setShowSettings(false)}>
        <div className="slide-up" style={{width:'100%',maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:'20px 20px 0 0',padding:20}}
          onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between" style={{marginBottom:20}}>
            <span style={{fontSize:16,fontWeight:600,color:'var(--text1)'}}>Ajustes</span>
            <button onClick={()=>setShowSettings(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="var(--text3)"/></button>
          </div>

          <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Inicio de semana</div>
          <div style={{display:'flex',gap:4,marginBottom:6}}>
            {PAY_DAYS.map(([day,lbl])=>{
              const on=pending.payDayStart===day
              return(
                <button key={day} onClick={()=>updatePending('payDayStart',day)}
                  style={{flex:1,padding:'7px 0',borderRadius:6,fontSize:11,fontWeight:500,border:'none',cursor:'pointer',
                    background:on?'var(--blue)':'var(--bg2)',color:on?'#fff':'var(--text2)'}}>
                  {lbl}
                </button>
              )
            })}
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:20,paddingLeft:4}}>
            {`Tu semana va del ${PAY_DAY_FULL[pending.payDayStart].toLowerCase()} al ${PAY_DAY_FULL[(pending.payDayStart+6)%7].toLowerCase()}`}
          </div>

          <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8,paddingTop:16,borderTop:'0.5px solid var(--border)'}}>Vista quincenal</div>
          <div style={{display:'flex',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:3,marginBottom:6}}>
            {([['next','Esta sem + próxima'],['prev','Sem anterior + esta']] as const).map(([dir,lbl])=>(
              <button key={dir} onClick={()=>updatePending('fortnightDir',dir)}
                style={{flex:1,padding:8,borderRadius:6,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',
                  background:pending.fortnightDir===dir?'var(--bg)':'transparent',
                  color:pending.fortnightDir===dir?'var(--text1)':'var(--text2)',
                  boxShadow:pending.fortnightDir===dir?'0 1px 3px rgba(0,0,0,.1)':'none'}}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:20,paddingLeft:4}}>
            {pending.fortnightDir==='next'
              ?`Del ${format(pw,"d MMM",{locale:es})} al ${format(pfne,"d MMM",{locale:es})}`
              :`Del ${format(pfp,"d MMM",{locale:es})} al ${format(pwe,"d MMM",{locale:es})}`}
          </div>

          <div className="flex items-center justify-between" style={{paddingTop:16,borderTop:'0.5px solid var(--border)',marginBottom:24}}>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--text1)'}}>Vista mensual</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Agrega &quot;Este mes&quot; en el selector del inicio</div>
            </div>
            <button onClick={()=>updatePending('showMonth',!pending.showMonth)}
              style={{width:44,height:26,borderRadius:13,border:'none',cursor:'pointer',flexShrink:0,
                background:pending.showMonth?'var(--green)':'var(--bg3)',position:'relative',transition:'background .2s'}}>
              <span style={{position:'absolute',top:2,left:pending.showMonth?20:2,width:22,height:22,
                borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
            </button>
          </div>

          <button onClick={applySettings}
            style={{width:'100%',padding:'13px 0',borderRadius:'var(--radius-sm)',background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:600,border:'none',cursor:'pointer'}}>
            Guardar cambios
          </button>
        </div>
      </div>
      )
    })()}
    <BottomNav/>
  </>)
}

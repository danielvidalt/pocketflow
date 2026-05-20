'use client'
import { useState, useMemo } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, weeklyEquivalent, CAT_COLORS, CAT_LABELS } from '@/lib/types'
import type { ExpenseCategory } from '@/lib/types'
import { SectionHeader, ProgressBar, MetricCard } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { startOfWeek,endOfWeek,startOfMonth,endOfMonth,isWithinInterval,parseISO } from 'date-fns'
import { RefreshCw } from 'lucide-react'

export default function ResumenPage(){
  const {incomeSources,incomeEntries,expenses,debtPockets,savingsGoals,exchangeRates}=usePocketFlow()
  const [period,setPeriod]=useState<'week'|'month'>('week')
  const now=new Date()
  const range=period==='week'?{start:startOfWeek(now,{weekStartsOn:1}),end:endOfWeek(now,{weekStartsOn:1})}:{start:startOfMonth(now),end:endOfMonth(now)}
  const entries=useMemo(()=>incomeEntries.filter(e=>isWithinInterval(parseISO(e.received_at),range)),[incomeEntries,period])
  const exps=useMemo(()=>expenses.filter(e=>isWithinInterval(parseISO(e.expense_date),range)),[expenses,period])
  const cobrado=entries.reduce((s,e)=>s+e.amount,0)
  const gastado=exps.reduce((s,e)=>s+e.amount,0)
  const weekly=incomeSources.filter(s=>s.is_active).reduce((sum,s)=>sum+weeklyEquivalent(s),0)
  const expected=period==='week'?weekly:weekly*4.33
  const catDist=useMemo(()=>{const m:Partial<Record<ExpenseCategory,number>>={};exps.forEach(e=>{m[e.category]=(m[e.category]||0)+e.amount});return Object.entries(m).sort(([,a],[,b])=>b-a).map(([c,a])=>({cat:c as ExpenseCategory,amt:a as number}))},[exps])
  const mx=catDist[0]?.amt||1
  return(<>
    <SectionHeader title="Resumen"/>
    <div className="scroll-area" style={{padding:16}}>
      <div style={{display:'flex',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:3,marginBottom:14}}>
        {(['week','month'] as const).map(p=><button key={p} onClick={()=>setPeriod(p)} style={{flex:1,padding:7,borderRadius:6,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',background:period===p?'var(--bg)':'transparent',color:period===p?'var(--text1)':'var(--text2)',boxShadow:period===p?'0 1px 3px rgba(0,0,0,.1)':'none'}}>{p==='week'?'Esta semana':'Este mes'}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2" style={{marginBottom:12}}>
        <MetricCard label="Cobrado" value={formatAUD(cobrado)} valueColor="var(--green)" sub={period==='week'?'esta semana':'este mes'}/>
        <MetricCard label="Gastos" value={formatAUD(gastado)} valueColor="var(--red)" sub="registrados"/>
      </div>
      <div style={{background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:'10px 12px',marginBottom:12}}>
        <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Disponible real</div>
        <div style={{fontSize:26,fontWeight:600,color:'var(--text1)'}}>{formatAUD(Math.max(0,cobrado-gastado))}</div>
        <ProgressBar percent={expected>0?(cobrado/expected)*100:0} color="var(--green)" height={6}/>
        <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{Math.round(expected>0?(cobrado/expected)*100:0)}% de {formatAUD(expected)} esperado</div>
      </div>
      {catDist.length>0&&<div className="card" style={{marginBottom:10}}>
        <div className="section-label">Por categoría</div>
        {catDist.map(({cat,amt})=><div key={cat} className="flex items-center gap-2.5 py-1.5" style={{borderBottom:'0.5px solid var(--border)'}}>
          <div style={{fontSize:12,color:'var(--text2)',width:90,flexShrink:0}}>{CAT_LABELS[cat]}</div>
          <div style={{flex:1,height:5,background:'var(--bg2)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:CAT_COLORS[cat],width:`${(amt/mx)*100}%`,transition:'width .4s'}}/></div>
          <div style={{fontSize:12,fontWeight:500,color:'var(--text1)',whiteSpace:'nowrap'}}>{formatAUD(amt)}</div>
        </div>)}
      </div>}
      {debtPockets.map(d=>{
        const rate=exchangeRates[d.target_currency]||1
        const tAUD=d.target_currency==='AUD'?d.target_amount:d.target_amount/rate
        const pct=Math.min(100,(d.current_amount_aud/tAUD)*100)
        return(<div key={d.id} className="card" style={{marginBottom:10}}>
          <div className="flex items-center justify-between" style={{marginBottom:8}}>
            <div><div className="flex items-center gap-1"><span style={{fontSize:18}}>{d.emoji}</span><span style={{fontSize:14,fontWeight:600,color:'var(--text1)'}}>{d.name}</span></div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Meta: {d.target_amount.toLocaleString()} {d.target_currency}</div></div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:16,fontWeight:700,color:'var(--text1)'}}>{formatAUD(d.current_amount_aud)}</div>
              <div className="flex items-center gap-1 justify-end" style={{marginTop:4}}><RefreshCw size={10} color="var(--text3)"/><span style={{fontSize:10,color:'var(--text3)'}}>1 AUD = {rate.toLocaleString()} {d.target_currency}</span></div>
            </div>
          </div>
          <ProgressBar percent={pct} color="var(--amber)" height={8}/>
          <div className="flex justify-between" style={{marginTop:6,fontSize:12}}>
            <span style={{color:'var(--text3)'}}>{Math.round(pct)}% completado</span>
            <span style={{color:'var(--text1)',fontWeight:500}}>Faltan {formatAUD(Math.max(0,tAUD-d.current_amount_aud))}</span>
          </div>
          {d.weekly_goal_aud&&<div style={{marginTop:8,padding:8,background:'var(--amber-bg)',borderRadius:'var(--radius-sm)'}}>
            <div style={{fontSize:12,color:'var(--amber)',fontWeight:500}}>Separar {formatAUD(d.weekly_goal_aud)} / semana</div>
          </div>}
        </div>)
      })}
      {savingsGoals.map(g=>{
        const displayName=g.name.split('\x1F')[0]
        const hasTarget=g.target_amount>0
        const pct=hasTarget?Math.min(100,(g.current_amount/g.target_amount)*100):0
        return(<div key={g.id} className="card" style={{marginBottom:10}}>
          <div className="flex items-center justify-between" style={{marginBottom:8}}>
            <div className="section-label" style={{margin:0}}>{displayName}</div>
            <span style={{fontSize:10,fontWeight:500,padding:'3px 8px',borderRadius:20,background:'var(--blue-bg)',color:'var(--blue)'}}>{formatAUD(g.current_amount)}{hasTarget?` / ${formatAUD(g.target_amount)}`:''}</span>
          </div>
          {hasTarget&&<><ProgressBar percent={pct} color={g.color} height={8}/>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>{Math.round(pct)}% alcanzado</div></>}
        </div>)
      })}
    </div>
    <BottomNav/>
  </>)
}

'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory } from '@/lib/types'
import { MetricCard, SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CATS=Object.entries(CAT_LABELS) as [ExpenseCategory,string][]
const ICONS: Record<ExpenseCategory,string>={food:'🍽️',transport:'🚌',leisure:'🎬',shopping:'🛍️',health:'💊',housing:'🏠',subscriptions:'📱',other:'···'}

export default function GastosPage(){
  const {expenses,addExpense,deleteExpense,weeklyIncome}=usePocketFlow()
  const [amount,setAmount]=useState(''); const [note,setNote]=useState(''); const [selCat,setSelCat]=useState<ExpenseCategory>('food'); const [saving,setSaving]=useState(false)
  const ref=useRef<HTMLInputElement>(null); useEffect(()=>{ref.current?.focus()},[])
  const today=new Date().toISOString().split('T')[0]
  const todayExps=useMemo(()=>expenses.filter(e=>isToday(parseISO(e.expense_date))),[expenses])
  const ayerExps=useMemo(()=>expenses.filter(e=>isYesterday(parseISO(e.expense_date))),[expenses])
  const todayTotal=todayExps.reduce((s,e)=>s+e.amount,0)
  const available=Math.max(0,weeklyIncome()/7-todayTotal)

  async function save(){
    const amt=parseFloat(amount); if(!amt||amt<=0)return; setSaving(true)
    await addExpense({name:note.trim()||CAT_LABELS[selCat],amount:amt,category:selCat,expense_date:today,is_recurring:false,note:note.trim()||null})
    setAmount('');setNote('');setSelCat('food');setSaving(false);ref.current?.focus()
  }

  return(<>
    <SectionHeader title="Gastos del día" subtitle={format(new Date(),"EEEE d 'de' MMMM",{locale:es})}/>
    <div className="grid grid-cols-2 gap-2" style={{padding:'14px 16px 0',flexShrink:0}}>
      <MetricCard label="Hoy gastaste" value={formatAUD(todayTotal)} valueColor="var(--red)"/>
      <MetricCard label="Disponible hoy" value={formatAUD(available)} valueColor="var(--green)"/>
    </div>
    <div style={{padding:'12px 16px',borderBottom:'0.5px solid var(--border)',flexShrink:0}}>
      <div style={{fontSize:10,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.05em',fontWeight:500}}>Registrar gasto</div>
      <div className="flex items-center gap-2" style={{marginBottom:12}}>
        <span style={{fontSize:22,fontWeight:600,color:'var(--text3)'}}>$</span>
        <input ref={ref} type="number" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="0.00"
          style={{flex:1,fontSize:28,fontWeight:600,color:'var(--text1)',border:'none',background:'transparent',outline:'none',borderBottom:'2px solid var(--blue)',paddingBottom:2}}/>
        <button onClick={save} disabled={saving||!amount} style={{fontSize:13,fontWeight:500,padding:'10px 16px',borderRadius:'var(--radius-sm)',background:'var(--blue)',color:'#fff',border:'none',cursor:'pointer',whiteSpace:'nowrap',opacity:(!amount||saving)?.5:1}}>
          {saving?'...':'Guardar'}
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{scrollbarWidth:'none',marginBottom:10}}>
        {CATS.map(([id,label])=>{const on=selCat===id;return(
          <button key={id} onClick={()=>setSelCat(id)} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,background:on?CAT_COLORS[id]:'transparent',color:on?'#fff':'var(--text3)',border:on?`1.5px solid ${CAT_COLORS[id]}`:'1px solid var(--border2)',fontWeight:on?500:400}}>
            <span>{ICONS[id]}</span>{label}
          </button>
        )})}
      </div>
      <input type="text" value={note} onChange={e=>setNote(e.target.value)} placeholder="Nota opcional…" style={{width:'100%',fontSize:13,color:'var(--text2)',border:'none',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:'8px 12px',outline:'none'}}/>
    </div>
    <div className="scroll-area" style={{padding:'0 16px 16px'}}>
      {[['HOY',todayExps],['AYER',ayerExps]].map(([lbl,items]:any)=>{
        if(!items.length)return null; const total=items.reduce((s:number,e:any)=>s+e.amount,0)
        return(<div key={lbl} style={{marginTop:12}}>
          <div className="flex justify-between pb-1.5" style={{borderBottom:'0.5px solid var(--border)'}}>
            <span style={{fontSize:10,fontWeight:600,color:'var(--text3)',textTransform:'uppercase'}}>{lbl}</span>
            <span style={{fontSize:10,fontWeight:600,color:'var(--red)'}}>−{formatAUD(total)}</span>
          </div>
          {items.map((e:any)=>(<div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{borderBottom:'0.5px solid var(--border)'}}>
            <div style={{fontSize:18,width:34,height:34,borderRadius:9,background:CAT_COLORS[e.category as ExpenseCategory]+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ICONS[e.category as ExpenseCategory]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.name}</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{CAT_LABELS[e.category as ExpenseCategory]}</div>
            </div>
            <span style={{fontSize:13,fontWeight:500,color:'var(--red)',whiteSpace:'nowrap'}}>−{formatAUD(e.amount)}</span>
            <button onClick={()=>deleteExpense(e.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
          </div>))}
        </div>)
      })}
      {todayExps.length+ayerExps.length===0&&<EmptyState message="Sin gastos registrados"/>}
    </div>
    <BottomNav/>
  </>)
}

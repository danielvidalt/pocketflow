'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory, FREQ_LABELS, weeklyExpenseEquivalent } from '@/lib/types'
import type { RecurringExpense } from '@/lib/types'
import { MetricCard, SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CATS=Object.entries(CAT_LABELS) as [ExpenseCategory,string][]
const ICONS: Record<ExpenseCategory,string>={food:'🍽️',transport:'🚌',leisure:'🎬',shopping:'🛍️',health:'💊',housing:'🏠',subscriptions:'📱',other:'···'}
const FIXED_FREQS: Array<{id:'weekly'|'fortnightly'|'monthly',label:string}> = [
  {id:'weekly',label:'Semanal'},
  {id:'fortnightly',label:'Quincenal'},
  {id:'monthly',label:'Mensual'},
]

export default function GastosPage(){
  const {expenses,addExpense,deleteExpense,weeklyIncome,weeklyFixedCosts,recurringExpenses,addRecurringExpense,deleteRecurringExpense}=usePocketFlow()
  const [tab,setTab]=useState<'daily'|'fixed'>('daily')

  // daily tab state
  const [amount,setAmount]=useState(''); const [note,setNote]=useState(''); const [selCat,setSelCat]=useState<ExpenseCategory>('food'); const [saving,setSaving]=useState(false)
  const ref=useRef<HTMLInputElement>(null); useEffect(()=>{if(tab==='daily')ref.current?.focus()},[tab])
  const today=new Date().toISOString().split('T')[0]
  const todayExps=useMemo(()=>expenses.filter(e=>isToday(parseISO(e.expense_date))),[expenses])
  const ayerExps=useMemo(()=>expenses.filter(e=>isYesterday(parseISO(e.expense_date))),[expenses])
  const todayTotal=todayExps.reduce((s,e)=>s+e.amount,0)
  const available=Math.max(0,(weeklyIncome()-weeklyFixedCosts())/7-todayTotal)

  async function save(){
    const amt=parseFloat(amount); if(!amt||amt<=0)return; setSaving(true)
    await addExpense({name:note.trim()||CAT_LABELS[selCat],amount:amt,category:selCat,expense_date:today,is_recurring:false,note:note.trim()||null})
    setAmount('');setNote('');setSelCat('food');setSaving(false);ref.current?.focus()
  }

  // fixed tab state
  const [fAmount,setFAmount]=useState(''); const [fName,setFName]=useState(''); const [fCat,setFCat]=useState<ExpenseCategory>('other'); const [fFreq,setFFreq]=useState<'weekly'|'fortnightly'|'monthly'>('monthly'); const [fSaving,setFSaving]=useState(false)
  const fRef=useRef<HTMLInputElement>(null); useEffect(()=>{if(tab==='fixed')fRef.current?.focus()},[tab])
  const weeklyFixed=weeklyFixedCosts()
  const activeFixed=recurringExpenses.filter(e=>e.is_active)

  async function saveFixed(){
    const amt=parseFloat(fAmount); if(!amt||amt<=0)return; setFSaving(true)
    await addRecurringExpense({name:fName.trim()||CAT_LABELS[fCat],amount:amt,category:fCat,frequency:fFreq,is_active:true})
    setFAmount('');setFName('');setFCat('other');setFFreq('monthly');setFSaving(false);fRef.current?.focus()
  }

  return(<>
    <SectionHeader title="Gastos" subtitle={format(new Date(),"EEEE d 'de' MMMM",{locale:es})}/>
    <div style={{display:'flex',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:3,margin:'8px 16px 0',flexShrink:0}}>
      {([['daily','Diario'],['fixed','Fijos']] as const).map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:7,borderRadius:6,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',background:tab===id?'var(--bg)':'transparent',color:tab===id?'var(--text1)':'var(--text2)',boxShadow:tab===id?'0 1px 3px rgba(0,0,0,.1)':'none'}}>{lbl}</button>
      ))}
    </div>

    {tab==='daily'&&<>
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
    </>}

    {tab==='fixed'&&<>
      <div className="grid grid-cols-2 gap-2" style={{padding:'14px 16px 0',flexShrink:0}}>
        <MetricCard label="Costo semanal" value={formatAUD(weeklyFixed)} valueColor="var(--red)"/>
        <MetricCard label="Costo mensual" value={formatAUD(weeklyFixed*4.33)} valueColor="var(--text2)"/>
      </div>
      <div style={{padding:'12px 16px',borderBottom:'0.5px solid var(--border)',flexShrink:0}}>
        <div style={{fontSize:10,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.05em',fontWeight:500}}>Agregar gasto fijo</div>
        <div className="flex items-center gap-2" style={{marginBottom:12}}>
          <span style={{fontSize:22,fontWeight:600,color:'var(--text3)'}}>$</span>
          <input ref={fRef} type="number" inputMode="decimal" value={fAmount} onChange={e=>setFAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveFixed()} placeholder="0.00"
            style={{flex:1,fontSize:28,fontWeight:600,color:'var(--text1)',border:'none',background:'transparent',outline:'none',borderBottom:'2px solid var(--blue)',paddingBottom:2}}/>
          <button onClick={saveFixed} disabled={fSaving||!fAmount} style={{fontSize:13,fontWeight:500,padding:'10px 16px',borderRadius:'var(--radius-sm)',background:'var(--blue)',color:'#fff',border:'none',cursor:'pointer',whiteSpace:'nowrap',opacity:(!fAmount||fSaving)?.5:1}}>
            {fSaving?'...':'Agregar'}
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{scrollbarWidth:'none',marginBottom:8}}>
          {FIXED_FREQS.map(({id,label})=>{const on=fFreq===id;return(
            <button key={id} onClick={()=>setFFreq(id)} style={{padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,background:on?'var(--blue)':'transparent',color:on?'#fff':'var(--text3)',border:on?'1.5px solid var(--blue)':'1px solid var(--border2)',fontWeight:on?500:400}}>
              {label}
            </button>
          )})}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{scrollbarWidth:'none',marginBottom:10}}>
          {CATS.map(([id,label])=>{const on=fCat===id;return(
            <button key={id} onClick={()=>setFCat(id)} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:20,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,background:on?CAT_COLORS[id]:'transparent',color:on?'#fff':'var(--text3)',border:on?`1.5px solid ${CAT_COLORS[id]}`:'1px solid var(--border2)',fontWeight:on?500:400}}>
              <span>{ICONS[id]}</span>{label}
            </button>
          )})}
        </div>
        <input type="text" value={fName} onChange={e=>setFName(e.target.value)} placeholder="Nombre del gasto (ej: Renta, Netflix…)" style={{width:'100%',fontSize:13,color:'var(--text2)',border:'none',background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:'8px 12px',outline:'none'}}/>
      </div>
      <div className="scroll-area" style={{padding:'0 16px 16px'}}>
        {activeFixed.length===0&&<EmptyState message="Sin gastos fijos registrados"/>}
        {activeFixed.length>0&&<div style={{marginTop:12}}>
          <div className="flex justify-between pb-1.5" style={{borderBottom:'0.5px solid var(--border)'}}>
            <span style={{fontSize:10,fontWeight:600,color:'var(--text3)',textTransform:'uppercase'}}>ACTIVOS</span>
            <span style={{fontSize:10,fontWeight:600,color:'var(--text3)'}}>{activeFixed.length} gastos</span>
          </div>
          {activeFixed.map((e:RecurringExpense)=>(
            <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{borderBottom:'0.5px solid var(--border)'}}>
              <div style={{fontSize:18,width:34,height:34,borderRadius:9,background:CAT_COLORS[e.category]+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ICONS[e.category]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.name}</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>{FREQ_LABELS[e.frequency]} · {formatAUD(weeklyExpenseEquivalent(e))}/sem</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:500,color:'var(--red)'}}>{formatAUD(e.amount)}</div>
                <div style={{fontSize:10,color:'var(--text3)'}}>{FREQ_LABELS[e.frequency].toLowerCase()}</div>
              </div>
              <button onClick={()=>deleteRecurringExpense(e.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
            </div>
          ))}
        </div>}
      </div>
    </>}
    <BottomNav/>
  </>)
}

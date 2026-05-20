'use client'
import { useState, useMemo } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, weeklyEquivalent, FREQ_LABELS, DOW_LABELS } from '@/lib/types'
import type { IncomeSource, Frequency } from '@/lib/types'
import { SectionHeader, Divider, BtnPrimary } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { Plus, X } from 'lucide-react'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'

const FQ: Frequency[]=['weekly','fortnightly','monthly','annual']
const COLORS=['#534AB7','#1D9E75','#BA7517','#D85A30','#185FA5','#993556','#3B6D11']

function fmtDay(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

export default function IngresosPage(){
  const {incomeSources,incomeEntries,registerPayment,addIncomeSource,deleteIncomeSource,weeklyIncome}=usePocketFlow()
  const today = new Date().toISOString().split('T')[0]
  const [showForm,setShowForm]=useState(false)
  const [payDate,setPayDate]=useState(today)
  const [registeringId,setRegisteringId]=useState<string|null>(null)

  const recurring=useMemo(()=>incomeSources.filter(s=>s.is_active&&s.frequency!=='once'),[incomeSources])

  function paid(srcId:string){
    const ws=new Date(); ws.setDate(ws.getDate()-((ws.getDay()+6)%7)); ws.setHours(0,0,0,0)
    return incomeEntries.some(e=>e.source_id===srcId&&new Date(e.received_at)>=ws)
  }

  async function handleRegister(src: IncomeSource) {
    await registerPayment(src.id, src.amount, payDate)
    setRegisteringId(null)
    setPayDate(today)
  }

  return(<>
    <SectionHeader title="Mis ingresos" subtitle={`${formatAUD(weeklyIncome())} / semana equivalente`}
      action={<button onClick={()=>setShowForm(true)} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Plus size={18} color="var(--text2)" strokeWidth={1.7}/></button>}/>
    <div className="scroll-area" style={{padding:16}}>
      <div className="section-label">Fuentes recurrentes</div>
      {recurring.length===0&&<p style={{fontSize:13,color:'var(--text3)',marginBottom:12}}>Tocá + para agregar tu primera fuente</p>}
      {recurring.map(src=>{
        const isPaid=paid(src.id)
        const isRegistering=registeringId===src.id
        return(<div key={src.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${src.color}`}}>
          <div className="flex items-center justify-between">
            <span style={{fontSize:14,fontWeight:600,color:'var(--text1)'}}>{src.name}</span>
            <div className="flex items-center gap-2">
              <span style={{fontSize:10,fontWeight:500,padding:'3px 8px',borderRadius:20,background:src.color+'22',color:src.color}}>{FREQ_LABELS[src.frequency]}{src.day_of_week!==null?` · ${DOW_LABELS[src.day_of_week].slice(0,3)}`:''}</span>
              <button onClick={()=>deleteIncomeSource(src.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)'}}><X size={14}/></button>
            </div>
          </div>
          <div style={{fontSize:22,fontWeight:700,color:'var(--text1)',margin:'4px 0'}}>{formatAUD(src.amount)}</div>
          {src.frequency!=='weekly'&&<div style={{fontSize:11,color:'var(--text3)'}}>= {formatAUD(weeklyEquivalent(src))} / semana</div>}
          <div style={{fontSize:12,color:'var(--text2)',marginTop:8,paddingTop:8,borderTop:'0.5px solid var(--border)'}}>
            {isPaid?<span style={{color:'var(--green)',fontWeight:500}}>✓ Cobrado esta semana</span>:'Pendiente de cobro esta semana'}
          </div>
          {!isPaid&&(
            isRegistering ? (
              <div style={{marginTop:10}}>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>¿Cuándo lo recibiste?</div>
                <div className="flex gap-2 items-center">
                  <div style={{position:'relative',flex:1}}>
                    <div style={{fontSize:12,fontWeight:500,color:'var(--blue)',background:'var(--bg2)',borderRadius:8,padding:'8px 12px',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}}>
                      📅 {fmtDay(payDate)}
                    </div>
                    <input type="date" value={payDate} max={today} onChange={e=>setPayDate(e.target.value||today)}
                      style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}}/>
                  </div>
                  <button onClick={()=>handleRegister(src)}
                    style={{padding:'8px 16px',borderRadius:8,background:src.color,color:'#fff',fontSize:12,fontWeight:500,border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>
                    Confirmar — {formatAUD(src.amount)}
                  </button>
                  <button onClick={()=>setRegisteringId(null)}
                    style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>
                </div>
              </div>
            ) : (
              <button onClick={()=>setRegisteringId(src.id)}
                style={{marginTop:10,width:'100%',padding:9,borderRadius:'var(--radius-sm)',background:src.color+'22',color:src.color,fontSize:12,fontWeight:500,border:'none',cursor:'pointer'}}>
                Registré este cobro — {formatAUD(src.amount)}
              </button>
            )
          )}
        </div>)
      })}
      <Divider margin="6px 0 14px"/>
      <button onClick={()=>setShowForm(true)} className="card flex items-center gap-3" style={{width:'100%',border:'0.5px dashed var(--border2)',cursor:'pointer'}}>
        <div style={{width:34,height:34,borderRadius:9,background:'var(--bg2)',border:'0.5px solid var(--border2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Plus size={16} color="var(--text3)"/></div>
        <div style={{textAlign:'left'}}>
          <div style={{fontSize:13,color:'var(--text1)',fontWeight:500}}>Agregar ingreso extra</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Proyecto, venta, regalo…</div>
        </div>
      </button>
    </div>
    {showForm&&<Modal onClose={()=>setShowForm(false)} onSave={addIncomeSource} onRegister={registerPayment}/>}
    <BottomNav/>
  </>)
}

function Modal({onClose,onSave,onRegister}:{onClose:()=>void;onSave:(d:any)=>Promise<void>;onRegister:(id:string|null,amt:number,date?:string)=>Promise<void>}){
  const today = new Date().toISOString().split('T')[0]
  const [name,setName]=useState(''); const [amount,setAmount]=useState('')
  const [freq,setFreq]=useState<Frequency>('weekly'); const [dow,setDow]=useState(0)
  const [color,setColor]=useState(COLORS[0]); const [saving,setSaving]=useState(false)
  const [incomeDate,setIncomeDate]=useState(today)

  async function save(){
    const amt=parseFloat(amount); if(!name.trim()||!amt)return; setSaving(true)
    await onSave({name:name.trim(),amount:amt,frequency:freq,day_of_week:freq==='once'?null:dow,color,icon:'briefcase',is_active:true})
    if(freq==='once') await onRegister(null,amt,incomeDate)
    onClose()
  }

  return(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'flex-end',zIndex:200}}>
    <div className="slide-up" style={{width:'100%',maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:'20px 20px 0 0',padding:20}}>
      <div className="flex items-center justify-between" style={{marginBottom:16}}>
        <span style={{fontSize:16,fontWeight:600,color:'var(--text1)'}}>Nueva fuente de ingreso</span>
        <button onClick={onClose}><X size={20} color="var(--text3)"/></button>
      </div>
      <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Nombre</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Trabajo, freelance…" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:12,outline:'none'}}/>
      <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Monto (AUD)</label>
      <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:12,outline:'none'}}/>
      <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Frecuencia</label>
      <select value={freq} onChange={e=>setFreq(e.target.value as Frequency)} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:12,outline:'none'}}>
        {FQ.map(f=><option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
        <option value="once">Puntual (una vez)</option>
      </select>
      {freq==='once'&&<>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>¿Cuándo lo recibiste?</label>
        <div style={{position:'relative',marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:500,color:'var(--blue)',background:'var(--bg2)',borderRadius:8,padding:'10px 12px',cursor:'pointer',userSelect:'none'}}>
            📅 {formatDate(incomeDate)}
          </div>
          <input type="date" value={incomeDate} max={today} onChange={e=>setIncomeDate(e.target.value||today)}
            style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}}/>
        </div>
      </>}
      {freq!=='once'&&<>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Día de cobro</label>
        <div className="flex gap-1.5 flex-wrap" style={{marginBottom:12}}>
          {[0,1,2,3,4,5,6].map(d=><button key={d} onClick={()=>setDow(d)} style={{padding:'6px 10px',borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:dow===d?600:400,background:dow===d?color:'var(--bg2)',color:dow===d?'#fff':'var(--text2)',border:dow===d?`1.5px solid ${color}`:'0.5px solid var(--border2)'}}>{DOW_LABELS[d].slice(0,3)}</button>)}
        </div>
      </>}
      <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Color</label>
      <div className="flex gap-2" style={{marginBottom:16}}>
        {COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:24,height:24,borderRadius:'50%',background:c,border:color===c?'2px solid var(--text1)':'2px solid transparent',cursor:'pointer'}}/>)}
      </div>
      <BtnPrimary onClick={save} disabled={saving||!name||!amount}>{saving?'Guardando…':'Agregar fuente'}</BtnPrimary>
    </div>
  </div>)
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

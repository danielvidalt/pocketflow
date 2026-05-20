'use client'
import { useState } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD } from '@/lib/types'
import { SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X } from 'lucide-react'

const D = '\x1F'
const COLORS = ['#534AB7','#1D9E75','#BA7517','#D85A30','#185FA5','#993556','#3B6D11','#5F5E5A']

function encEnv(name: string, type: '%'|'$', value: number) {
  return `${name}${D}${type}${value}`
}
function decEnv(raw: string): { name: string; type: '%'|'$'; value: number } {
  const i = raw.indexOf(D)
  if (i === -1) return { name: raw, type: '$', value: 0 }
  const rule = raw.slice(i + 1)
  const type = rule[0] as '%'|'$'
  const value = parseFloat(rule.slice(1)) || 0
  return { name: raw.slice(0, i), type, value }
}
function fmtDay(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

export default function AhorrosPage() {
  const { savingsGoals, addSavingsGoal, deleteSavingsGoal, addToSavings, weeklyIncome } = usePocketFlow()
  const today = new Date().toISOString().split('T')[0]
  const [showNew, setShowNew] = useState(false)
  const [addingTo, setAddingTo] = useState<string|null>(null)
  const [addAmt, setAddAmt] = useState('')
  const [addDate, setAddDate] = useState(today)
  const [saving, setSaving] = useState(false)

  const wIncome = weeklyIncome()
  const totalSaved = savingsGoals.reduce((s, g) => s + g.current_amount, 0)

  async function handleAdd(id: string) {
    const amt = parseFloat(addAmt); if (!amt || amt <= 0) return
    setSaving(true)
    await addToSavings(id, amt)
    setAddAmt(''); setAddDate(today); setAddingTo(null); setSaving(false)
  }

  return (<>
    <SectionHeader title="Sobres de Ahorro" subtitle={`Total guardado: ${formatAUD(totalSaved)}`}
      action={<button onClick={() => setShowNew(true)} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Plus size={18} color="var(--text2)" strokeWidth={1.7}/></button>}/>
    <div className="scroll-area" style={{padding:16}}>
      {savingsGoals.length === 0 && <EmptyState message="Tocá + para crear tu primer sobre de ahorro"/>}
      {savingsGoals.map(g => {
        const { name, type, value } = decEnv(g.name)
        const weeklyAlloc = type === '%' ? wIncome * value / 100 : value
        return (
          <div key={g.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${g.color}`}}>
            <div className="flex items-center justify-between" style={{marginBottom:6}}>
              <span style={{fontSize:14,fontWeight:600,color:'var(--text1)'}}>{name}</span>
              <button onClick={() => deleteSavingsGoal(g.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)'}}><X size={14}/></button>
            </div>
            <div style={{fontSize:28,fontWeight:700,color:'var(--text1)',marginBottom:2}}>{formatAUD(g.current_amount)}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
              Asignación: {type === '%' ? `${value}% del ingreso semanal` : `${formatAUD(value)}/sem`}
              {weeklyAlloc > 0 && <span style={{color:'var(--blue)',fontWeight:500}}> = {formatAUD(weeklyAlloc)}/sem</span>}
            </div>
            {addingTo === g.id ? (
              <div>
                <div className="flex gap-2 items-center" style={{marginBottom:8}}>
                  <span style={{fontSize:20,fontWeight:600,color:'var(--text3)'}}>$</span>
                  <input type="number" inputMode="decimal" value={addAmt} autoFocus
                    onChange={e => setAddAmt(e.target.value)}
                    placeholder="0.00"
                    style={{flex:1,fontSize:22,fontWeight:600,color:'var(--text1)',border:'none',background:'transparent',outline:'none',borderBottom:'2px solid var(--blue)',paddingBottom:2}}/>
                </div>
                <div className="flex gap-2 items-center">
                  <div style={{position:'relative',flex:1}}>
                    <div style={{fontSize:12,fontWeight:500,color:'var(--blue)',background:'var(--bg2)',borderRadius:8,padding:'8px 12px',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}}>
                      📅 {fmtDay(addDate)}
                    </div>
                    <input type="date" value={addDate} max={today} onChange={e => setAddDate(e.target.value||today)}
                      style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}}/>
                  </div>
                  <button onClick={() => handleAdd(g.id)} disabled={saving||!addAmt}
                    style={{padding:'8px 18px',borderRadius:8,background:'var(--green)',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer',opacity:(!addAmt||saving)?.5:1}}>
                    {saving ? '…' : 'Guardar'}
                  </button>
                  <button onClick={() => { setAddingTo(null); setAddAmt('') }}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:20,lineHeight:1}}>×</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingTo(g.id)}
                style={{width:'100%',padding:9,borderRadius:'var(--radius-sm)',background:g.color+'22',color:g.color,fontSize:12,fontWeight:500,border:'none',cursor:'pointer'}}>
                + Agregar al sobre
              </button>
            )}
          </div>
        )
      })}
    </div>
    {showNew && <NewEnvModal onClose={() => setShowNew(false)} onSave={addSavingsGoal} weeklyIncome={wIncome}/>}
    <BottomNav/>
  </>)
}

function NewEnvModal({ onClose, onSave, weeklyIncome }: { onClose:()=>void; onSave:(d:any)=>Promise<void>; weeklyIncome:number }) {
  const [name, setName] = useState('')
  const [allocType, setAllocType] = useState<'%'|'$'>('%')
  const [allocValue, setAllocValue] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  const val = parseFloat(allocValue) || 0
  const preview = allocType === '%' ? weeklyIncome * val / 100 : val

  async function save() {
    if (!name.trim() || !val) return
    setSaving(true)
    await onSave({ name: encEnv(name.trim(), allocType, val), target_amount: 0, current_amount: 0, deadline: null, color })
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'flex-end',zIndex:200}}>
      <div className="slide-up" style={{width:'100%',maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:'20px 20px 0 0',padding:20}}>
        <div className="flex items-center justify-between" style={{marginBottom:16}}>
          <span style={{fontSize:16,fontWeight:600,color:'var(--text1)'}}>Nuevo sobre de ahorro</span>
          <button onClick={onClose}><X size={20} color="var(--text3)"/></button>
        </div>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Vacaciones, Emergencias, iPhone…"
          style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:14,outline:'none'}}/>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Asignación semanal</label>
        <div className="flex gap-2" style={{marginBottom:10}}>
          {([['%', '% del ingreso'], ['$', '$ fijo / sem']] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => setAllocType(t)}
              style={{flex:1,padding:'9px 0',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',background:allocType===t?'var(--blue)':'var(--bg2)',color:allocType===t?'#fff':'var(--text2)',border:'none'}}>
              {lbl}
            </button>
          ))}
        </div>
        <input type="number" inputMode="decimal" value={allocValue} onChange={e => setAllocValue(e.target.value)}
          placeholder={allocType === '%' ? 'Ej: 10  →  10% del ingreso' : 'Ej: 150  →  $150/sem'}
          style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:6,outline:'none'}}/>
        {val > 0 && weeklyIncome > 0 && (
          <div style={{fontSize:12,color:'var(--blue)',marginBottom:12,paddingLeft:4}}>
            = {formatAUD(preview)} por semana
          </div>
        )}
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Color</label>
        <div className="flex gap-2" style={{marginBottom:18}}>
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)} style={{width:26,height:26,borderRadius:'50%',background:c,border:color===c?'2.5px solid var(--text1)':'2px solid transparent',cursor:'pointer'}}/>)}
        </div>
        <button onClick={save} disabled={saving||!name||!allocValue}
          style={{width:'100%',padding:13,borderRadius:10,background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:500,border:'none',cursor:'pointer',opacity:(!name||!allocValue||saving)?.5:1}}>
          {saving ? 'Guardando…' : 'Crear sobre'}
        </button>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD } from '@/lib/types'
import type { SavingsGoal } from '@/lib/types'
import { SectionHeader, EmptyState, ProgressBar } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, MoreHorizontal } from 'lucide-react'

const D = '\x1F'
const COLORS = ['#534AB7','#1D9E75','#BA7517','#D85A30','#185FA5','#993556','#3B6D11','#5F5E5A']
const FREQS: Array<{ id: 'weekly'|'fortnightly'|'monthly'; label: string; short: string }> = [
  { id: 'weekly',      label: 'Semanal',   short: 'sem'   },
  { id: 'fortnightly', label: 'Quincenal', short: 'quinc' },
  { id: 'monthly',     label: 'Mensual',   short: 'mes'   },
]
const FREQ_DIVISORS: Record<string, number> = { weekly: 1, fortnightly: 2, monthly: 4.33 }

function encEnv(name: string, type: '%'|'$', value: number) { return `${name}${D}${type}${value}` }
function decEnv(raw: string): { name: string; type: '%'|'$'; value: number } {
  const i = raw.indexOf(D)
  if (i === -1) return { name: raw, type: '$', value: 0 }
  const rule = raw.slice(i + 1)
  return { name: raw.slice(0, i), type: rule[0] as '%'|'$', value: parseFloat(rule.slice(1)) || 0 }
}
function fmtDay(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

export default function AhorrosPage() {
  const { savingsGoals, expenses, savingsWithdrawals, addSavingsGoal, updateSavingsGoal,
    deleteSavingsGoal, addToSavings, weeklyIncome, deleteSavingsEntry,
    deleteSavingsWithdrawal, addSavingsWithdrawal } = usePocketFlow()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [showNew,        setShowNew]        = useState(false)
  const [editingGoal,    setEditingGoal]    = useState<SavingsGoal | null>(null)
  const [addingTo,       setAddingTo]       = useState<string | null>(null)
  const [addAmt,         setAddAmt]         = useState('')
  const [addDate,        setAddDate]        = useState(today)
  const [saving,         setSaving]         = useState(false)
  const [menuId,         setMenuId]         = useState<string | null>(null)
  const [historialId,    setHistorialId]    = useState<string | null>(null)
  const [undoItem, setUndoItem] = useState<{ label: string; restore: () => Promise<void> } | null>(null)

  function scheduleUndo(label: string, restore: () => Promise<void>) {
    setUndoItem({ label, restore })
    setTimeout(() => setUndoItem(null), 5000)
  }

  const wIncome = weeklyIncome()
  const totalSaved = savingsGoals.reduce((s, g) => {
    const withdrawn = savingsWithdrawals.filter(w => w.savings_goal_id === g.id).reduce((a, w) => a + w.amount, 0)
    return s + Math.max(0, g.current_amount - withdrawn)
  }, 0)

  async function handleAdd(id: string) {
    const amt = parseFloat(addAmt); if (!amt || amt <= 0) return
    setSaving(true)
    await addToSavings(id, amt, addDate)
    setAddAmt(''); setAddDate(today); setAddingTo(null); setSaving(false)
  }

  return (<>
    <SectionHeader title="Sobres de Ahorro" subtitle={`Disponible total: ${formatAUD(totalSaved)}`}
      action={<button onClick={() => setShowNew(true)} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}><Plus size={18} color="var(--text2)" strokeWidth={1.7}/></button>}/>

    <div className="scroll-area" style={{paddingTop:16,paddingLeft:16,paddingRight:16}}>
      {savingsGoals.length === 0 && <EmptyState message="Tocá + para crear tu primer sobre de ahorro"/>}

      {savingsGoals.map(g => {
        const { name, type: allocType, value } = decEnv(g.name)
        const freq = g.frequency || 'monthly'
        const freqInfo = FREQS.find(f => f.id === freq)!
        const plannedPerPeriod = allocType === '%'
          ? wIncome * FREQ_DIVISORS[freq] * value / 100
          : value

        const goalWithdrawals = savingsWithdrawals.filter(w => w.savings_goal_id === g.id)
        const totalWithdrawn = goalWithdrawals.reduce((s, w) => s + w.amount, 0)
        const available = g.current_amount - totalWithdrawn
        const isOver = available < 0
        const pct = plannedPerPeriod > 0 ? Math.min(100, (available / plannedPerPeriod) * 100) : 0

        const allDeposits = expenses.filter(e => e.name === `Ahorro: ${name}`)
        const totalMovements = allDeposits.length + goalWithdrawals.length

        return (
          <div key={g.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${isOver?'var(--red)':g.color}`}}>

            {/* Header */}
            <div className="flex items-center justify-between" style={{marginBottom:12}}>
              <span style={{fontSize:14,fontWeight:600,color:'var(--text1)'}}>{name}</span>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                {addingTo !== g.id && (
                  <button onClick={() => setAddingTo(g.id)} title="Agregar fondos"
                    style={{width:28,height:28,borderRadius:8,background:g.color+'22',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Plus size={14} color={g.color} strokeWidth={2.5}/>
                  </button>
                )}
                <div style={{position:'relative'}}>
                  <button onClick={() => setMenuId(menuId===g.id?null:g.id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:'0 4px'}}>
                    <MoreHorizontal size={16}/>
                  </button>
                  {menuId === g.id && (
                    <>
                      <div style={{position:'fixed',inset:0,zIndex:99}} onClick={()=>setMenuId(null)}/>
                      <div style={{position:'absolute',right:0,top:22,background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'4px 0',zIndex:100,minWidth:130,boxShadow:'0 4px 16px rgba(0,0,0,.15)'}}>
                        <button onClick={()=>{setMenuId(null);setEditingGoal(g)}}
                          style={{display:'block',width:'100%',padding:'10px 16px',textAlign:'left',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--text1)'}}>Editar</button>
                        <button onClick={()=>{setMenuId(null);deleteSavingsGoal(g.id)}}
                          style={{display:'block',width:'100%',padding:'10px 16px',textAlign:'left',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--red)'}}>Eliminar sobre</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* DISPONIBLE — métrica primaria */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:32,fontWeight:700,lineHeight:1,color:isOver?'var(--red)':g.current_amount>0?'var(--text1)':'var(--text3)'}}>
                {formatAUD(available)}
              </div>
              <div style={{fontSize:10,color:'var(--text3)',marginTop:3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Disponible</div>
            </div>

            <ProgressBar percent={Math.max(0,pct)} color={isOver?'var(--red)':g.color} height={6}/>

            {/* Planificado + desglose */}
            <div style={{marginTop:8,marginBottom:10}}>
              <div style={{fontSize:11,color:'var(--text3)'}}>
                {freqInfo.label} · Planificado: <strong style={{color:'var(--text2)'}}>{formatAUD(plannedPerPeriod)}</strong>
              </div>
              <div style={{display:'flex',gap:12,marginTop:4}}>
                <span style={{fontSize:11,color:'var(--text3)'}}>
                  Guardado: <span style={{color:g.current_amount>0?g.color:'var(--text3)',fontWeight:g.current_amount>0?600:400}}>{formatAUD(g.current_amount)}</span>
                </span>
                {totalWithdrawn > 0 && (
                  <span style={{fontSize:11,color:'var(--text3)'}}>
                    Gastado: <span style={{color:'var(--red)',fontWeight:600}}>−{formatAUD(totalWithdrawn)}</span>
                  </span>
                )}
              </div>
              {g.target_amount > 0 && (
                <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                  Meta: {formatAUD(g.target_amount)}
                  {available >= g.target_amount && <span style={{color:'var(--green)',fontWeight:600}}> ✓</span>}
                </div>
              )}
            </div>

            {/* Ver movimientos */}
            <button onClick={() => setHistorialId(historialId===g.id?null:g.id)}
              style={{width:'100%',padding:'8px 0',borderRadius:8,background:'var(--bg2)',border:'none',cursor:'pointer',fontSize:12,color:'var(--text2)',fontWeight:500}}>
              Ver movimientos{totalMovements > 0 ? ` (${totalMovements})` : ''}
            </button>

            {/* Formulario de depósito */}
            {addingTo === g.id && (
              <div style={{marginTop:10}}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:6,fontWeight:600,textTransform:'uppercase'}}>Agregar fondos al sobre</div>
                <div className="flex gap-2 items-center" style={{marginBottom:8}}>
                  <span style={{fontSize:20,fontWeight:600,color:'var(--text3)'}}>$</span>
                  <input type="number" inputMode="decimal" value={addAmt} autoFocus
                    onChange={e => setAddAmt(e.target.value)} placeholder="0.00"
                    style={{flex:1,fontSize:22,fontWeight:600,color:'var(--text1)',border:'none',background:'transparent',outline:'none',borderBottom:`2px solid ${g.color}`,paddingBottom:2}}/>
                </div>
                <div style={{position:'relative',marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:500,color:g.color,background:'var(--bg2)',borderRadius:8,padding:'8px 12px',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}}>
                    📅 {fmtDay(addDate)}
                  </div>
                  <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value||today)}
                    style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAdd(g.id)} disabled={saving||!addAmt}
                    style={{flex:1,padding:'10px 0',borderRadius:8,background:g.color,color:'#fff',border:'none',fontSize:14,fontWeight:600,cursor:'pointer',opacity:(!addAmt||saving)?.5:1}}>
                    {saving ? 'Guardando…' : 'Guardar fondos'}
                  </button>
                  <button onClick={() => { setAddingTo(null); setAddAmt('') }}
                    style={{padding:'10px 14px',borderRadius:8,background:'var(--bg2)',border:'none',cursor:'pointer',color:'var(--text2)',fontSize:13}}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>

    {/* Modal historial de sobre de ahorro */}
    {historialId && (() => {
      const goal = savingsGoals.find(g => g.id === historialId)
      if (!goal) return null
      const { name: gName } = decEnv(goal.name)
      const goalWithdrawals = savingsWithdrawals.filter(w => w.savings_goal_id === historialId)
      const allDeposits = expenses.filter(e => e.name === `Ahorro: ${gName}`)
      const allMovements = [
        ...allDeposits.map(e => ({ kind: 'deposit' as const, date: e.expense_date, amount: e.amount, id: e.id, expenseId: e.id as string|null })),
        ...goalWithdrawals.map(w => ({ kind: 'withdrawal' as const, date: w.withdrawn_at, amount: w.amount, id: w.id, expenseId: w.expense_id })),
      ].sort((a, b) => b.date.localeCompare(a.date))
      const totDeposited = allDeposits.reduce((s, e) => s + e.amount, 0)
      const totWithdrawn = goalWithdrawals.reduce((s, w) => s + w.amount, 0)
      return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:200,display:'flex',alignItems:'flex-end'}}>
          <div className="slide-up" style={{width:'100%',maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:'20px 20px 0 0',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'16px 20px 12px',borderBottom:'0.5px solid var(--border)',flexShrink:0}}>
              <div className="flex items-center justify-between" style={{marginBottom:8}}>
                <span style={{fontSize:16,fontWeight:600,color:'var(--text1)'}}>{gName}</span>
                <button onClick={() => setHistorialId(null)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color="var(--text3)"/></button>
              </div>
              <div style={{display:'flex',gap:16}}>
                <div>
                  <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase'}}>Guardado</div>
                  <div style={{fontSize:15,fontWeight:600,color:goal.color}}>+{formatAUD(totDeposited)}</div>
                </div>
                {totWithdrawn > 0 && (
                  <div>
                    <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase'}}>Gastado</div>
                    <div style={{fontSize:15,fontWeight:600,color:'var(--red)'}}>−{formatAUD(totWithdrawn)}</div>
                  </div>
                )}
                <div>
                  <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase'}}>Disponible</div>
                  <div style={{fontSize:15,fontWeight:700,color:totDeposited-totWithdrawn>=0?'var(--text1)':'var(--red)'}}>{formatAUD(totDeposited-totWithdrawn)}</div>
                </div>
              </div>
            </div>
            <div style={{overflowY:'auto',padding:'4px 20px 24px',flex:1}}>
              {allMovements.length === 0 && <div style={{textAlign:'center',color:'var(--text3)',padding:'24px 0',fontSize:13}}>Sin movimientos registrados</div>}
              {allMovements.map(m => {
                const isW = m.kind === 'withdrawal'
                const linkedExp = isW && m.expenseId ? expenses.find(ex => ex.id === m.expenseId) : null
                return (
                  <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                    <div style={{width:32,height:32,borderRadius:8,background:isW?'rgba(220,38,38,.12)':goal.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:isW?'var(--red)':goal.color,flexShrink:0}}>
                      {isW?'−':'+'}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,color:'var(--text1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {isW ? (linkedExp?.name || 'Gasto del sobre') : 'Depósito'}
                      </div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>{fmtDay(m.date)}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:600,color:isW?'var(--red)':goal.color,whiteSpace:'nowrap'}}>
                      {isW?'−':'+'}{formatAUD(m.amount)}
                    </span>
                    <button onClick={() => {
                      if (isW) {
                        deleteSavingsWithdrawal(m.id)
                        scheduleUndo('Retiro eliminado', async () => { await addSavingsWithdrawal(goal.id, m.amount, m.expenseId??undefined, m.date) })
                      } else {
                        deleteSavingsEntry(m.id, goal.id, m.amount)
                        scheduleUndo('Depósito eliminado', async () => { await addToSavings(goal.id, m.amount, m.date) })
                      }
                    }} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16,lineHeight:1,flexShrink:0}}>×</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    })()}

    {showNew && (
      <EnvModal onClose={() => setShowNew(false)} onSave={async (d) => { await addSavingsGoal(d) }} weeklyIncome={wIncome} />
    )}
    {editingGoal && (
      <EnvModal initial={editingGoal} onClose={() => setEditingGoal(null)}
        onSave={async (d) => { await updateSavingsGoal(editingGoal.id, d) }} weeklyIncome={wIncome} />
    )}

    {undoItem && (
      <div style={{position:'fixed',bottom:88,left:'50%',transform:'translateX(-50%)',background:'var(--text1)',color:'var(--bg)',borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:16,zIndex:150,fontSize:13,maxWidth:380,width:'calc(100% - 32px)',boxShadow:'0 4px 16px rgba(0,0,0,.3)'}}>
        <span style={{flex:1}}>{undoItem.label}</span>
        <button onClick={async () => { await undoItem.restore(); setUndoItem(null) }} style={{color:'#4ea8ff',fontWeight:700,background:'none',border:'none',cursor:'pointer',fontSize:13,padding:0}}>Deshacer</button>
      </div>
    )}
    <BottomNav/>
  </>)
}

function EnvModal({ onClose, onSave, weeklyIncome, initial }: {
  onClose: () => void
  onSave: (d: Omit<SavingsGoal,'id'|'user_id'>) => Promise<void>
  weeklyIncome: number
  initial?: SavingsGoal
}) {
  const existing = initial ? decEnv(initial.name) : null
  const [name,        setName]        = useState(existing?.name ?? '')
  const [allocType,   setAllocType]   = useState<'%'|'$'>(existing?.type ?? '%')
  const [allocValue,  setAllocValue]  = useState(existing ? String(existing.value) : '')
  const [color,       setColor]       = useState(initial?.color ?? COLORS[0])
  const [freq,        setFreq]        = useState<'weekly'|'fortnightly'|'monthly'>(initial?.frequency ?? 'monthly')
  const [targetAmount,setTargetAmount]= useState(initial?.target_amount ? String(initial.target_amount) : '')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)

  const freqInfo = FREQS.find(f => f.id === freq)!
  const val = parseFloat(allocValue) || 0
  const weeklyPreview = allocType === '%' ? weeklyIncome * val / 100 : val / (FREQ_DIVISORS[freq])

  async function save() {
    if (!name.trim() || !val) return
    setSaving(true); setSaveError(null)
    try {
      await onSave({
        name: encEnv(name.trim(), allocType, val),
        target_amount: parseFloat(targetAmount) || 0,
        current_amount: initial?.current_amount ?? 0,
        deadline: null, color, frequency: freq,
      })
      onClose()
    } catch (e: any) {
      setSaveError(e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'flex-end',zIndex:200}}>
      <div className="slide-up" style={{width:'100%',maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:'20px 20px 0 0',padding:20}}>
        <div className="flex items-center justify-between" style={{marginBottom:16}}>
          <span style={{fontSize:16,fontWeight:600,color:'var(--text1)'}}>{initial ? 'Editar sobre' : 'Nuevo sobre de ahorro'}</span>
          <button onClick={onClose}><X size={20} color="var(--text3)"/></button>
        </div>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Vacaciones, Emergencias, iPhone…"
          style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:14,outline:'none'}}/>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Frecuencia de ahorro</label>
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {FREQS.map(f => (
            <button key={f.id} onClick={() => setFreq(f.id)}
              style={{flex:1,padding:'8px 0',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',background:freq===f.id?'var(--blue)':'var(--bg2)',color:freq===f.id?'#fff':'var(--text2)',border:'none'}}>
              {f.label}
            </button>
          ))}
        </div>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Asignación por {freqInfo.label.toLowerCase()}</label>
        <div className="flex gap-2" style={{marginBottom:10}}>
          {([['%', '% del ingreso'], ['$', `$ fijo`]] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => setAllocType(t)}
              style={{flex:1,padding:'9px 0',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',background:allocType===t?'var(--blue)':'var(--bg2)',color:allocType===t?'#fff':'var(--text2)',border:'none'}}>
              {lbl}
            </button>
          ))}
        </div>
        <input type="number" inputMode="decimal" value={allocValue} onChange={e => setAllocValue(e.target.value)}
          placeholder={allocType === '%' ? `Ej: 10  →  10% del ingreso` : `Ej: 150`}
          style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:6,outline:'none'}}/>
        {val > 0 && weeklyIncome > 0 && (
          <div style={{fontSize:12,color:'var(--blue)',marginBottom:12,paddingLeft:4}}>≈ {formatAUD(weeklyPreview)}/sem</div>
        )}
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:8}}>Color</label>
        <div className="flex gap-2" style={{marginBottom:18}}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{width:26,height:26,borderRadius:'50%',background:c,border:color===c?'2.5px solid var(--text1)':'2px solid transparent',cursor:'pointer'}}/>
          ))}
        </div>
        <label style={{fontSize:12,color:'var(--text3)',display:'block',marginBottom:4}}>Meta total (opcional)</label>
        <input type="number" inputMode="decimal" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
          placeholder="Ej: 1500"
          style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:14,marginBottom:16,outline:'none'}}/>
        {saveError && <div style={{background:'var(--red-bg)',color:'var(--red)',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:10}}>⚠️ {saveError}</div>}
        <button onClick={save} disabled={saving||!name||!allocValue}
          style={{width:'100%',padding:13,borderRadius:10,background:'var(--blue)',color:'#fff',fontSize:14,fontWeight:500,border:'none',cursor:'pointer',opacity:(!name||!allocValue||saving)?.5:1}}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear sobre'}
        </button>
      </div>
    </div>
  )
}

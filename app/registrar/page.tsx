'use client'
import { useState, useMemo, useRef } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory } from '@/lib/types'
import { SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { parseISO, format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronUp } from 'lucide-react'

function localToday() { return format(new Date(), 'yyyy-MM-dd') }
function fmtDay(d: string) {
  const today = localToday()
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  if (d === today) return 'Hoy'
  if (d === yesterday) return 'Ayer'
  return format(parseISO(d), "d MMM", { locale: es })
}

const D = '\x1F'
function decName(raw: string) { const i = raw.indexOf(D); return i === -1 ? raw : raw.slice(0, i) }

function periodRange(frequency: 'weekly' | 'fortnightly' | 'monthly') {
  const now = new Date(); const todayStr = format(now, 'yyyy-MM-dd')
  if (frequency === 'weekly') {
    const diff = (now.getDay() === 0 ? -6 : 1) - now.getDay()
    const mon = new Date(now); mon.setDate(now.getDate() + diff)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: format(mon, 'yyyy-MM-dd'), end: format(sun, 'yyyy-MM-dd') }
  }
  if (frequency === 'fortnightly') {
    const s = new Date(now); s.setDate(now.getDate() - 13)
    return { start: format(s, 'yyyy-MM-dd'), end: todayStr }
  }
  return { start: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'), end: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd') }
}

const CAT_ICONS: Record<ExpenseCategory, string> = { food: '🍽️', supermarket: '🛒', transport: '🚌', leisure: '🎬', shopping: '🛍️', health: '💊', housing: '🏠', subscriptions: '📱', debt: '💳', bank: '🏦', other: '···' }
const CATS = Object.entries(CAT_LABELS) as [ExpenseCategory, string][]
type ExpType = 'daily' | 'fixed' | 'savings'

export default function RegistrarPage() {
  const { expenses, addExpense, deleteExpense, recurringExpenses, fixedExpenseAllocations,
    addFixedAllocation, savingsGoals, savingsWithdrawals, addSavingsWithdrawal } = usePocketFlow()

  const today = localToday()
  const [expType, setExpType] = useState<ExpType>('daily')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [expDate, setExpDate] = useState(today)
  const [selCat, setSelCat] = useState<ExpenseCategory>('food')
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null)
  const [selectedSav, setSelectedSav] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [histExpanded, setHistExpanded] = useState(false)
  const amtRef = useRef<HTMLInputElement>(null)

  const activeFixed = recurringExpenses.filter(e => e.is_active)

  // Últimos movimientos (últimos 20, sin transferencias a ahorro)
  const recentExpenses = useMemo(() =>
    expenses.filter(e => !e.name.startsWith('Ahorro: ')).slice(0, 20),
    [expenses]
  )

  // Agrupar los recientes por fecha
  const recentGroups = useMemo(() => {
    const map = new Map<string, typeof expenses>()
    for (const e of recentExpenses) {
      if (!map.has(e.expense_date)) map.set(e.expense_date, [])
      map.get(e.expense_date)!.push(e)
    }
    return Array.from(map.keys()).sort((a, b) => b.localeCompare(a)).map(date => ({
      date, label: fmtDay(date), items: map.get(date)!,
    }))
  }, [recentExpenses])

  const visibleGroups = histExpanded ? recentGroups : recentGroups.slice(0, 2)

  const typeColor = expType === 'daily' ? 'var(--blue)' : expType === 'fixed' ? 'var(--red)' : 'var(--green)'
  const typeLabel = expType === 'daily' ? 'Gasto Diario' : expType === 'fixed' ? 'Gasto Fijo' : 'Ahorro'

  async function save() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    setSaving(true); setSaveError(null)
    try {
      if (expType === 'daily') {
        await addExpense({ name: note.trim() || CAT_LABELS[selCat], amount: amt, category: selCat, expense_date: expDate, is_recurring: false, note: note.trim() || null })
        setNote('')
      } else if (expType === 'fixed') {
        if (!selectedEnv) { setSaveError('Seleccioná un sobre'); setSaving(false); return }
        await addFixedAllocation(selectedEnv, amt, expDate, undefined, 'withdrawal')
        setSelectedEnv(null)
      } else {
        if (!selectedSav) { setSaveError('Seleccioná un sobre de ahorro'); setSaving(false); return }
        await addSavingsWithdrawal(selectedSav, amt, undefined, expDate)
        setSelectedSav(null)
      }
      setAmount(''); setExpDate(today)
      amtRef.current?.focus()
    } catch (e: any) {
      setSaveError(e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (<>
    <SectionHeader title="Registrar" subtitle="Nuevo movimiento" />

    <div className="scroll-area" style={{ padding: '12px 16px 24px' }}>

      {/* ── FORMULARIO ── */}
      <div className="card" style={{ marginBottom: 16, borderTop: `3px solid ${typeColor}` }}>

        {/* Selector de tipo */}
        <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
          {([['daily', 'Gasto Diario'], ['fixed', 'Gasto Fijo'], ['savings', 'Ahorro']] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => { setExpType(t); setSaveError(null) }}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', lineHeight: 1.3,
                background: expType === t ? (t === 'daily' ? 'var(--blue)' : t === 'fixed' ? 'var(--red)' : 'var(--green)') : 'transparent',
                color: expType === t ? '#fff' : 'var(--text3)',
                boxShadow: expType === t ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Monto (siempre visible) */}
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--text3)' }}>$</span>
          <input ref={amtRef} type="number" inputMode="decimal" value={amount} autoFocus
            onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="0.00"
            style={{ flex: 1, fontSize: 32, fontWeight: 700, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: `2.5px solid ${typeColor}`, paddingBottom: 2 }} />
        </div>

        {/* Nombre / nota (siempre visible) */}
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder={expType === 'daily' ? 'Nombre o nota (opcional)…' : 'Nota (opcional)…'}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, color: 'var(--text2)', border: 'none', background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', outline: 'none', marginBottom: 12 }} />

        {/* ── Condicional: Categorías (Diario) ── */}
        {expType === 'daily' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none', marginBottom: 12 }}>
            {CATS.map(([id, label]) => { const on = selCat === id; return (
              <button key={id} onClick={() => setSelCat(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: on ? CAT_COLORS[id] : 'transparent', color: on ? '#fff' : 'var(--text3)', border: on ? `1.5px solid ${CAT_COLORS[id]}` : '1px solid var(--border2)', fontWeight: on ? 600 : 400 }}>
                <span>{CAT_ICONS[id]}</span>{label}
              </button>
            )})}
          </div>
        )}

        {/* ── Condicional: Sobres Fijos ── */}
        {expType === 'fixed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>Elegí el sobre a descontar</div>
            {activeFixed.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sin sobres fijos. Creá uno en Gastos → Fijos.</div>
              : activeFixed.map(env => {
                  const name = decName(env.name)
                  const envCol = CAT_COLORS[env.category]
                  const pr = periodRange(env.frequency)
                  const allocs = fixedExpenseAllocations.filter(a => a.recurring_expense_id === env.id && a.allocated_at >= pr.start && a.allocated_at <= pr.end)
                  const avail = allocs.filter(a => a.type !== 'withdrawal').reduce((s, a) => s + a.amount, 0) - allocs.filter(a => a.type === 'withdrawal').reduce((s, a) => s + a.amount, 0)
                  const on = selectedEnv === env.id
                  return (
                    <button key={env.id} onClick={() => setSelectedEnv(on ? null : env.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: on ? envCol + '18' : 'var(--bg2)', border: on ? `2px solid ${envCol}` : `1.5px solid ${envCol}33` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: envCol, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Disponible: <span style={{ color: avail >= 0 ? envCol : 'var(--red)', fontWeight: 600 }}>{formatAUD(avail)}</span></div>
                      </div>
                      {on && <span style={{ color: envCol, fontSize: 14 }}>✓</span>}
                    </button>
                  )
                })
            }
          </div>
        )}

        {/* ── Condicional: Sobres de Ahorro ── */}
        {expType === 'savings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>Elegí el sobre a descontar</div>
            {savingsGoals.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sin sobres de ahorro. Creá uno en Ahorros.</div>
              : savingsGoals.map(goal => {
                  const name = decName(goal.name)
                  const totalW = savingsWithdrawals.filter(w => w.savings_goal_id === goal.id).reduce((s, w) => s + w.amount, 0)
                  const avail = goal.current_amount - totalW
                  const on = selectedSav === goal.id
                  return (
                    <button key={goal.id} onClick={() => setSelectedSav(on ? null : goal.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: on ? goal.color + '18' : 'var(--bg2)', border: on ? `2px solid ${goal.color}` : `1.5px solid ${goal.color}33` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: goal.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Disponible: <span style={{ color: avail >= 0 ? goal.color : 'var(--red)', fontWeight: 600 }}>{formatAUD(avail)}</span></div>
                      </div>
                      {on && <span style={{ color: goal.color, fontSize: 14 }}>✓</span>}
                    </button>
                  )
                })
            }
          </div>
        )}

        {/* Fecha (siempre visible) */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📅</span>
            <span style={{ color: 'var(--text2)' }}>{format(parseISO(expDate), "EEEE d 'de' MMMM", { locale: es })}</span>
          </div>
          <input type="date" value={expDate} onChange={e => setExpDate(e.target.value || today)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>

        {saveError && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>⚠️ {saveError}</div>}

        <button onClick={save} disabled={saving || !amount}
          style={{ width: '100%', padding: '13px 0', borderRadius: 10, background: typeColor, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (!amount || saving) ? .5 : 1 }}>
          {saving ? 'Guardando…' : `Guardar ${typeLabel}`}
        </button>
      </div>

      {/* ── ÚLTIMOS MOVIMIENTOS ── */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Últimos movimientos</span>
          {recentGroups.length > 2 && (
            <button onClick={() => setHistExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {histExpanded ? <><ChevronUp size={13} /> Ver menos</> : <><ChevronDown size={13} /> Ver más</>}
            </button>
          )}
        </div>

        {recentExpenses.length === 0 && <EmptyState message="Sin movimientos aún" />}

        {visibleGroups.map(({ date, label, items }) => {
          const dayTotal = items.reduce((s, e) => s + e.amount, 0)
          return (
            <div key={date} className="card" style={{ marginBottom: 8, padding: '10px 14px', borderLeft: '3px solid var(--red)' }}>
              <div className="flex justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(dayTotal)}</span>
              </div>
              {items.map(e => (
                <div key={e.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 14, width: 26, height: 26, borderRadius: 7, background: CAT_COLORS[e.category] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{CAT_ICONS[e.category]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{CAT_LABELS[e.category]}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', whiteSpace: 'nowrap' }}>−{formatAUD(e.amount)}</span>
                  <button onClick={() => deleteExpense(e.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
    <BottomNav />
  </>)
}

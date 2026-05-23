'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_LABELS, CAT_COLORS, ExpenseCategory } from '@/lib/types'
import { SectionHeader } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check } from 'lucide-react'
import { getSettings } from '@/lib/settings'

type ExpenseType = 'daily' | 'fixed' | 'savings'

const CATS = Object.entries(CAT_LABELS) as [ExpenseCategory, string][]
const CAT_ICONS: Record<ExpenseCategory, string> = {
  food:'🍽️', supermarket:'🛒', transport:'🚌', leisure:'🎬', shopping:'🛍️',
  health:'💊', housing:'🏠', subscriptions:'📱', debt:'💳', bank:'🏦', other:'···'
}

const D = '\x1F'
function decFixed(raw: string) {
  const i = raw.indexOf(D)
  return i === -1 ? { name: raw, date: '' } : { name: raw.slice(0, i), date: raw.slice(i + 1) }
}
function decEnv(raw: string): { name: string; type: '%'|'$'; value: number } {
  const i = raw.indexOf(D)
  if (i === -1) return { name: raw, type: '$', value: 0 }
  const rule = raw.slice(i + 1)
  return { name: raw.slice(0, i), type: rule[0] as '%'|'$', value: parseFloat(rule.slice(1)) || 0 }
}

function localToday() { return format(new Date(), 'yyyy-MM-dd') }
function fmtDay(d: string) {
  return format(parseISO(d), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}
function getWeekRange(payDayStart: number) {
  const now = new Date()
  const d = new Date(now)
  let diff = d.getDay() - payDayStart
  if (diff < 0) diff += 7
  d.setDate(d.getDate() - diff); d.setHours(0, 0, 0, 0)
  const end = new Date(d); end.setDate(d.getDate() + 6); end.setHours(23, 59, 59, 999)
  return { start: format(d, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
}

export default function RegistrarPage() {
  const router = useRouter()
  const { addExpense, addFixedAllocation, addSavingsWithdrawal,
    incomeSources, incomeEntries, expenses,
    recurringExpenses, fixedExpenseAllocations,
    savingsGoals, savingsWithdrawals } = usePocketFlow()

  const today = localToday()
  const [expenseType, setExpenseType] = useState<ExpenseType>('daily')
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fixed envelope selector
  const activeFixed = useMemo(() => recurringExpenses.filter(e => e.is_active), [recurringExpenses])
  const [selectedFixedId, setSelectedFixedId] = useState<string | null>(null)

  // Fixed envelope available balance (all-time deposited − withdrawn)
  const fixedAvailable = useMemo(() => {
    const result: Record<string, number> = {}
    activeFixed.forEach(e => {
      const deposited = fixedExpenseAllocations
        .filter(a => a.recurring_expense_id === e.id && a.type !== 'withdrawal')
        .reduce((s, a) => s + a.amount, 0)
      const withdrawn = fixedExpenseAllocations
        .filter(a => a.recurring_expense_id === e.id && a.type === 'withdrawal')
        .reduce((s, a) => s + a.amount, 0)
      result[e.id] = deposited - withdrawn
    })
    return result
  }, [activeFixed, fixedExpenseAllocations])

  // Savings goal selector
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  // Savings available balance (current_amount − sum(withdrawals))
  const savingsAvailable = useMemo(() => {
    const result: Record<string, number> = {}
    savingsGoals.forEach(g => {
      const withdrawn = savingsWithdrawals
        .filter(w => w.savings_goal_id === g.id)
        .reduce((s, w) => s + w.amount, 0)
      result[g.id] = Math.max(0, g.current_amount - withdrawn)
    })
    return result
  }, [savingsGoals, savingsWithdrawals])

  // Income source picker (only when >1 active source, daily expenses only)
  const activeSources = useMemo(() =>
    incomeSources.filter(s => s.is_active && s.frequency !== 'once'),
    [incomeSources]
  )
  const showSourcePicker = activeSources.length > 1 && expenseType === 'daily'
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const selectedSource = activeSources.find(s => s.id === selectedSourceId)

  const weekRange = useMemo(() => getWeekRange(getSettings().payDayStart), [])
  const sourceAvailable = useMemo(() => {
    const result: Record<string, number> = {}
    activeSources.forEach(src => {
      const received = incomeEntries
        .filter(e => e.source_id === src.id && e.received_at >= weekRange.start && e.received_at <= weekRange.end)
        .reduce((s, e) => s + e.amount, 0)
      const spent = expenses
        .filter(e => e.income_source_id === src.id && e.expense_date >= weekRange.start && e.expense_date <= weekRange.end)
        .reduce((s, e) => s + e.amount, 0)
      result[src.id] = received - spent
    })
    return result
  }, [activeSources, incomeEntries, expenses, weekRange])

  const isValid = (() => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return false
    if (expenseType === 'daily') return !!name.trim()
    if (expenseType === 'fixed') return !!selectedFixedId
    if (expenseType === 'savings') return !!selectedGoalId
    return false
  })()

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!isValid) return
    setSaving(true); setError(null)
    try {
      if (expenseType === 'daily') {
        await addExpense({
          name: name.trim(), amount: amt, category,
          expense_date: date, is_recurring: false,
          note: note.trim() || null, income_source_id: selectedSourceId || null,
        })
      } else if (expenseType === 'fixed') {
        const envelope = activeFixed.find(e => e.id === selectedFixedId)!
        const envName = decFixed(envelope.name).name
        const expense = await addExpense({
          name: name.trim() || envName, amount: amt,
          category: envelope.category, expense_date: date, is_recurring: false,
          note: note.trim() || null, income_source_id: null,
        })
        await addFixedAllocation(selectedFixedId!, amt, date, expense.id, 'withdrawal', note.trim() || undefined)
      } else {
        const goal = savingsGoals.find(g => g.id === selectedGoalId)!
        const goalName = decEnv(goal.name).name
        const expense = await addExpense({
          name: name.trim() || `Retiro: ${goalName}`, amount: amt,
          category: 'other', expense_date: date, is_recurring: false,
          note: note.trim() || null, income_source_id: null,
        })
        await addSavingsWithdrawal(selectedGoalId!, amt, expense.id, date, note.trim() || undefined)
      }
      router.push('/gastos')
    } catch (e: any) {
      setError(e?.message || 'Error al guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (<>
    <SectionHeader title="Registrar gasto" subtitle={fmtDay(today)} />
    <div className="scroll-area" style={{ padding: 16 }}>

      {/* Tipo de gasto */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { id: 'daily' as const, label: '💳 Diario', desc: 'Gasto común' },
            { id: 'fixed' as const, label: '📦 Fijo', desc: 'De un sobre' },
            { id: 'savings' as const, label: '🐷 Ahorro', desc: 'Usar ahorros' },
          ]).map(t => (
            <button key={t.id} onClick={() => setExpenseType(t.id)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: expenseType === t.id ? 'var(--blue)' : 'var(--bg2)',
                color: expenseType === t.id ? '#fff' : 'var(--text2)',
                fontWeight: expenseType === t.id ? 600 : 400, fontSize: 12 }}>
              <div>{t.label}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Monto */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--text3)' }}>$</span>
        <input
          type="number" inputMode="decimal" autoFocus
          value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          style={{ flex: 1, fontSize: 36, fontWeight: 700, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', letterSpacing: -1 }}
        />
      </div>

      {/* Selector de sobre fijo */}
      {expenseType === 'fixed' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
            ¿De qué sobre se descuenta?
          </div>
          {activeFixed.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No tenés gastos fijos configurados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeFixed.map(e => {
                const envName = decFixed(e.name).name
                const available = fixedAvailable[e.id] ?? 0
                const color = CAT_COLORS[e.category]
                const selected = selectedFixedId === e.id
                return (
                  <button key={e.id} onClick={() => setSelectedFixedId(selected ? null : e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                      border: selected ? `1.5px solid ${color}` : '1px solid var(--border)',
                      background: selected ? color + '18' : 'var(--bg2)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: selected ? 600 : 400, color: 'var(--text1)' }}>{envName}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: available >= 0 ? color : 'var(--red)' }}>{formatAUD(available)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>disponible</div>
                    </div>
                    {selected && <Check size={14} color={color} strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Selector de meta de ahorro */}
      {expenseType === 'savings' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
            ¿De qué ahorro se descuenta?
          </div>
          {savingsGoals.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No tenés metas de ahorro configuradas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {savingsGoals.map(g => {
                const goalName = decEnv(g.name).name
                const available = savingsAvailable[g.id] ?? 0
                const selected = selectedGoalId === g.id
                return (
                  <button key={g.id} onClick={() => setSelectedGoalId(selected ? null : g.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                      border: selected ? `1.5px solid ${g.color}` : '1px solid var(--border)',
                      background: selected ? g.color + '18' : 'var(--bg2)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: selected ? 600 : 400, color: 'var(--text1)' }}>{goalName}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: available > 0 ? g.color : 'var(--red)' }}>{formatAUD(available)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>ahorrado</div>
                    </div>
                    {selected && <Check size={14} color={g.color} strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Nombre / Descripción */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>
          {expenseType === 'daily' ? '¿En qué gastaste?' : 'Descripción (opcional)'}
        </div>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder={
            expenseType === 'daily' ? 'Ej: Almuerzo, Nafta, Ropa…' :
            expenseType === 'fixed' ? 'Ej: Pago parcial, Cuota…' : 'Ej: Ropa de vacaciones…'
          }
          style={{ width: '100%', fontSize: 15, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none' }}
        />
      </div>

      {/* Categoría (solo para gasto diario) */}
      {expenseType === 'daily' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>Categoría</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATS.map(([cat, lbl]) => {
              const active = category === cat
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{ padding: '6px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
                    background: active ? CAT_COLORS[cat] : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)' }}>
                  {CAT_ICONS[cat]} {lbl}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Fecha */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Fecha</div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--blue)', cursor: 'pointer' }}>📅 {fmtDay(date)}</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value || today)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* Nota opcional */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Nota (opcional)</div>
        <input
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Agregar detalle…"
          style={{ width: '100%', fontSize: 14, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none' }}
        />
      </div>

      {/* Atribución a ingreso (solo gasto diario con >1 fuente activa) */}
      {showSourcePicker && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>
            ¿Este gasto corresponde a un ingreso en particular?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeSources.map(src => {
              const selected = selectedSourceId === src.id
              return (
                <button key={src.id} onClick={() => setSelectedSourceId(selected ? null : src.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: selected ? `1.5px solid ${src.color}` : '1px solid var(--border)',
                    background: selected ? src.color + '18' : 'var(--bg2)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: src.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: selected ? 600 : 400, color: 'var(--text1)' }}>{src.name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: (sourceAvailable[src.id] ?? 0) >= 0 ? src.color : 'var(--red)' }}>{formatAUD(sourceAvailable[src.id] ?? 0)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>disponible</div>
                  </div>
                  {selected && <Check size={14} color={src.color} strokeWidth={2.5} />}
                </button>
              )
            })}
            <button onClick={() => setSelectedSourceId(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                border: selectedSourceId === null ? '1.5px solid var(--text3)' : '1px solid var(--border)',
                background: selectedSourceId === null ? 'var(--bg3)' : 'var(--bg2)', cursor: 'pointer' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>No, gasto general</span>
              {selectedSourceId === null && <Check size={14} color="var(--text3)" strokeWidth={2.5} style={{ marginLeft: 'auto' }} />}
            </button>
          </div>
          {selectedSource && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: selectedSource.color + '18', border: `1px solid ${selectedSource.color}44`, fontSize: 12, color: selectedSource.color, fontWeight: 500 }}>
              Te quedan <strong>{formatAUD(sourceAvailable[selectedSource.id] ?? 0)}</strong> libres en <strong>{selectedSource.name}</strong> esta semana
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !isValid}
        style={{ width: '100%', padding: 14, borderRadius: 'var(--radius-sm)', background: 'var(--blue)', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer',
          opacity: (!isValid || saving) ? .5 : 1, marginBottom: 4 }}>
        {saving ? 'Guardando…' : `Guardar${amount ? ' — ' + (isNaN(parseFloat(amount)) ? '' : formatAUD(parseFloat(amount))) : ''}`}
      </button>

      <div style={{ height: 80 }} />
    </div>
    <BottomNav />
  </>)
}

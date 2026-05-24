'use client'
import { useState, useMemo } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_LABELS, CAT_COLORS, ExpenseCategory } from '@/lib/types'
import { SectionHeader } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check } from 'lucide-react'

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
function fmtGroupDate(d: string) {
  const date = parseISO(d)
  if (isToday(date)) return 'Hoy'
  if (isYesterday(date)) return 'Ayer'
  return format(date, "EEEE d 'de' MMMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

export default function RegistrarPage() {
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

  // Income source picker
  const activeSources = useMemo(() =>
    incomeSources.filter(s => s.is_active && s.frequency !== 'once'),
    [incomeSources]
  )
  const showSourcePicker = activeSources.length > 1 && expenseType === 'daily'
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const selectedSource = activeSources.find(s => s.id === selectedSourceId)

  const sourceAvailable = useMemo(() => {
    const result: Record<string, number> = {}
    activeSources.forEach(src => {
      const received = incomeEntries
        .filter(e => e.source_id === src.id)
        .reduce((s, e) => s + e.amount, 0)
      const spent = expenses
        .filter(e => e.income_source_id === src.id)
        .reduce((s, e) => s + e.amount, 0)
      result[src.id] = received - spent
    })
    return result
  }, [activeSources, incomeEntries, expenses])

  // History: classify all expenses by type
  const fixedWithdrawalIds = useMemo(() =>
    new Set(fixedExpenseAllocations.filter(a => a.type === 'withdrawal' && a.expense_id).map(a => a.expense_id!)),
    [fixedExpenseAllocations]
  )
  const savingsWithdrawalIds = useMemo(() =>
    new Set(savingsWithdrawals.filter(w => w.expense_id).map(w => w.expense_id!)),
    [savingsWithdrawals]
  )

  const historyGroups = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at))
    const map = new Map<string, typeof expenses>()
    for (const e of sorted) {
      if (!map.has(e.expense_date)) map.set(e.expense_date, [])
      map.get(e.expense_date)!.push(e)
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
  }, [expenses])

  function getExpenseKind(e: typeof expenses[0]): { label: string; color: string } {
    if (fixedWithdrawalIds.has(e.id)) return { label: '📦 Fijo', color: CAT_COLORS[e.category] }
    if (savingsWithdrawalIds.has(e.id) || e.name.startsWith('Ahorro: ')) return { label: '🐷 Ahorro', color: 'var(--green)' }
    return { label: '💳 Diario', color: 'var(--blue)' }
  }

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
      // Reset form, stay on page so the history updates
      setAmount(''); setName(''); setNote(''); setDate(today)
      setSelectedFixedId(null); setSelectedGoalId(null); setSelectedSourceId(null)
    } catch (e: any) {
      setError(e?.message || 'Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (<>
    <SectionHeader title="Registrar" subtitle={fmtDay(today)} />
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

      {/* Atribución a ingreso */}
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
              Te quedan <strong>{formatAUD(sourceAvailable[selectedSource.id] ?? 0)}</strong> disponibles de <strong>{selectedSource.name}</strong>
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
          opacity: (!isValid || saving) ? .5 : 1, marginBottom: 20 }}>
        {saving ? 'Guardando…' : `Guardar${amount ? ' — ' + (isNaN(parseFloat(amount)) ? '' : formatAUD(parseFloat(amount))) : ''}`}
      </button>

      {/* ── HISTORIAL ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        Historial de movimientos
      </div>

      {historyGroups.length === 0 ? (
        <div className="card" style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
          Todavía no hay registros
        </div>
      ) : (
        historyGroups.map(({ date: groupDate, items }) => (
          <div key={groupDate} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, paddingLeft: 2 }}>
              {fmtGroupDate(groupDate)}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {items.map((e, i) => {
                const kind = getExpenseKind(e)
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderBottom: i < items.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{CAT_ICONS[e.category]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.name}
                      </div>
                      <div style={{ fontSize: 11, color: kind.color, fontWeight: 500, marginTop: 1 }}>
                        {kind.label}
                        {e.note && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {e.note}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', flexShrink: 0 }}>
                      −{formatAUD(e.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <div style={{ height: 80 }} />
    </div>
    <BottomNav />
  </>)
}

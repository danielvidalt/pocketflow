'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory, FREQ_LABELS } from '@/lib/types'
import type { RecurringExpense, Expense } from '@/lib/types'
import { MetricCard, SectionHeader, EmptyState, ProgressBar } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { parseISO, format, subDays } from 'date-fns'
import { getSettings } from '@/lib/settings'
import { es } from 'date-fns/locale'
import { Plus, X, MoreHorizontal } from 'lucide-react'

// Siempre usa hora LOCAL (evita el bug UTC vs hora australiana)
function localToday() { return format(new Date(), 'yyyy-MM-dd') }

function fmtDay(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

const D = '\x1F'
function encFixed(name: string, date: string) { return `${name}${D}${date}` }
function decFixed(raw: string): { name: string; date: string } {
  const i = raw.indexOf(D)
  if (i === -1) return { name: raw, date: '' }
  return { name: raw.slice(0, i), date: raw.slice(i + 1) }
}

function periodRange(frequency: 'weekly'|'fortnightly'|'monthly') {
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  if (frequency === 'weekly') {
    const day = now.getDay(); const diff = (day === 0 ? -6 : 1) - day
    const mon = new Date(now); mon.setDate(now.getDate() + diff)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: format(mon, 'yyyy-MM-dd'), end: format(sun, 'yyyy-MM-dd') }
  }
  if (frequency === 'fortnightly') {
    const start = new Date(now); start.setDate(now.getDate() - 13)
    return { start: format(start, 'yyyy-MM-dd'), end: todayStr }
  }
  return {
    start: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'),
  }
}

const CATS = Object.entries(CAT_LABELS) as [ExpenseCategory, string][]
const ICONS: Record<ExpenseCategory, string> = { food: '🍽️', supermarket: '🛒', transport: '🚌', leisure: '🎬', shopping: '🛍️', health: '💊', housing: '🏠', subscriptions: '📱', other: '···' }
const FIXED_FREQS: Array<{ id: 'weekly' | 'fortnightly' | 'monthly'; label: string }> = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'fortnightly', label: 'Quincenal' },
  { id: 'monthly', label: 'Mensual' },
]

export default function GastosPage() {
  const { expenses, addExpense, deleteExpense, weeklyIncome, weeklyFixedCosts, recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense, fixedExpenseAllocations, addFixedAllocation, deleteFixedAllocation, incomeEntries, incomeSources } = usePocketFlow()
  const [tab, setTab] = useState<'daily' | 'fixed'>('daily')

  // ── Daily tab ──────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [selCat, setSelCat] = useState<ExpenseCategory>('food')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string|null>(null)
  const [expDate, setExpDate] = useState(localToday)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (tab === 'daily') ref.current?.focus() }, [tab])

  // ── Undo toast ──────────────────────────────────────────────────────────────
  const [undoItem, setUndoItem] = useState<{ label: string; restore: () => Promise<void> } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleUndo(label: string, restore: () => Promise<void>) {
    setUndoItem({ label, restore })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoItem(null), 5000)
  }
  async function handleUndo() {
    if (!undoItem) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    await undoItem.restore(); setUndoItem(null)
  }

  // Modal de asignación a sobre (aparece tras guardar un gasto diario)
  const [justSavedExpense, setJustSavedExpense] = useState<Expense | null>(null)
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const activeFixed = recurringExpenses.filter(e => e.is_active)

  // Hora LOCAL siempre, evita que gastos "se sumen pero no aparezcan"
  const today = localToday()
  const todayTotal = useMemo(() =>
    expenses.filter(e => e.expense_date === today).reduce((s, e) => s + e.amount, 0),
    [expenses, today]
  )
  const available = Math.max(0, (weeklyIncome() - weeklyFixedCosts()) / 7 - todayTotal)

  // Semana actual (hora local)
  const { wkStart, wkEnd } = useMemo(() => {
    const now = new Date(); const day = now.getDay(); const diff = (day === 0 ? -6 : 1) - day
    const mon = new Date(now); mon.setDate(now.getDate() + diff)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { wkStart: format(mon, 'yyyy-MM-dd'), wkEnd: format(sun, 'yyyy-MM-dd') }
  }, [])

  const weekCollected = useMemo(() =>
    incomeEntries.filter(e => e.received_at >= wkStart && e.received_at <= wkEnd).reduce((s, e) => s + e.amount, 0),
    [incomeEntries, wkStart, wkEnd]
  )
  const weekSpent = useMemo(() =>
    expenses.filter(e => e.expense_date >= wkStart && e.expense_date <= wkEnd).reduce((s, e) => s + e.amount, 0),
    [expenses, wkStart, wkEnd]
  )
  const weekRemaining = weekCollected - weekSpent

  // Historial completo de gastos (todos, no solo 7 días), agrupado por fecha local
  const expGroups = useMemo(() => {
    const todayStr = localToday()
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const map = new Map<string, typeof expenses>()
    for (const e of expenses) {
      if (!map.has(e.expense_date)) map.set(e.expense_date, [])
      map.get(e.expense_date)!.push(e)
    }
    return Array.from(map.keys())
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        label: date === todayStr ? 'HOY' : date === yesterdayStr ? 'AYER' : fmtDay(date).toUpperCase(),
        items: map.get(date)!,
      }))
  }, [expenses])

  // Ingresos de esta semana
  const weekIncomes = useMemo(() =>
    incomeEntries
      .filter(e => e.received_at >= wkStart && e.received_at <= wkEnd)
      .sort((a, b) => b.received_at.localeCompare(a.received_at)),
    [incomeEntries, wkStart, wkEnd]
  )

  async function save() {
    const amt = parseFloat(amount); if (!amt || amt <= 0) return
    setSaving(true); setSaveError(null)
    try {
      const expense = await addExpense({ name: note.trim() || CAT_LABELS[selCat], amount: amt, category: selCat, expense_date: expDate, is_recurring: false, note: note.trim() || null })
      setAmount(''); setNote(''); setSelCat('food')
      if (activeFixed.length > 0) { setSelectedEnvId(null); setAssignError(null); setJustSavedExpense(expense) }
    } catch (e: any) {
      setSaveError(e?.message || 'Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false); ref.current?.focus()
    }
  }

  // ── Fixed tab ──────────────────────────────────────────────────────────────
  const [showNewFixed, setShowNewFixed] = useState(false)
  const [editingFixed, setEditingFixed] = useState<RecurringExpense | null>(null)
  const [fixedMenuId, setFixedMenuId] = useState<string | null>(null)
  const [expandedFixedId, setExpandedFixedId] = useState<string | null>(null)
  const [addingToFixed, setAddingToFixed] = useState<string|null>(null)
  const [fixedAddAmt, setFixedAddAmt] = useState('')
  const [fixedAddDate, setFixedAddDate] = useState(today)
  const [fixedSaving, setFixedSaving] = useState(false)
  const weeklyFixed = weeklyFixedCosts()
  const showMonthFixed = getSettings().showMonth

  return (<>
    <SectionHeader title="Gastos" subtitle={format(new Date(), "EEEE d 'de' MMMM", { locale: es })} />
    <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: 3, margin: '8px 16px 0', flexShrink: 0 }}>
      {([['daily', 'Diario'], ['fixed', 'Fijos']] as const).map(([id, lbl]) => (
        <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: 7, borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === id ? 'var(--bg)' : 'transparent', color: tab === id ? 'var(--text1)' : 'var(--text2)', boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{lbl}</button>
      ))}
    </div>

    {/* ── TAB DIARIO ── */}
    {tab === 'daily' && <>
      <div className="grid grid-cols-2 gap-2" style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <MetricCard label="Hoy gastaste" value={formatAUD(todayTotal)} valueColor="var(--red)" />
        <MetricCard label="Disponible hoy" value={formatAUD(available)} valueColor="var(--green)" />
      </div>
      <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
        <MetricCard
          label="Restante esta semana"
          value={formatAUD(Math.abs(weekRemaining))}
          valueColor={weekRemaining >= 0 ? 'var(--green)' : 'var(--red)'}
          sub={weekRemaining >= 0
            ? `${formatAUD(weekCollected)} ingresado · ${formatAUD(weekSpent)} gastado`
            : `Gastaste ${formatAUD(Math.abs(weekRemaining))} más de lo ingresado`} />
      </div>

      {/* Formulario */}
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500 }}>Registrar gasto</div>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text3)' }}>$</span>
          <input ref={ref} type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="0.00"
            style={{ flex: 1, fontSize: 28, fontWeight: 600, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: '2px solid var(--blue)', paddingBottom: 2 }} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none', marginBottom: 10 }}>
          {CATS.map(([id, label]) => { const on = selCat === id; return (
            <button key={id} onClick={() => setSelCat(id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: on ? CAT_COLORS[id] : 'transparent', color: on ? '#fff' : 'var(--text3)', border: on ? `1.5px solid ${CAT_COLORS[id]}` : '1px solid var(--border2)', fontWeight: on ? 500 : 400 }}>
              <span>{ICONS[id]}</span>{label}
            </button>
          )})}
        </div>
        <div className="flex gap-2" style={{ marginBottom: 10 }}>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Nota opcional…" style={{ flex: 1, fontSize: 13, color: 'var(--text2)', border: 'none', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', outline: 'none' }} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
              📅 {format(parseISO(expDate), 'd MMM', { locale: es })}
            </div>
            <input type="date" value={expDate} onChange={e => setExpDate(e.target.value || today)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </div>
        </div>
        {saveError && (
          <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>
            ⚠️ {saveError}
          </div>
        )}
        <button onClick={save} disabled={saving || !amount} style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--radius-sm)', background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (!amount || saving) ? .5 : 1 }}>
          {saving ? 'Guardando…' : 'Guardar gasto'}
        </button>
      </div>

      {/* Historial */}
      <div className="scroll-area" style={{ paddingLeft: 16, paddingRight: 16 }}>
        {/* Gastos — todos, sin límite de días */}
        {expGroups.length === 0 && <EmptyState message="Sin gastos registrados" />}
        {expGroups.map(({ label, items }) => {
          const total = items.reduce((s, e) => s + e.amount, 0)
          return (
            <div key={label} style={{ marginTop: 12 }}>
              <div className="flex justify-between pb-1.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(total)}</span>
              </div>
              {items.map(e => (
                <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 18, width: 34, height: 34, borderRadius: 9, background: CAT_COLORS[e.category] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ICONS[e.category]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{CAT_LABELS[e.category]}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--red)', whiteSpace: 'nowrap' }}>−{formatAUD(e.amount)}</span>
                  <button onClick={() => { const snap = e; deleteExpense(snap.id); scheduleUndo(`"${snap.name}" eliminado`, async () => { await addExpense({ name: snap.name, amount: snap.amount, category: snap.category, expense_date: snap.expense_date, is_recurring: snap.is_recurring, note: snap.note }) }) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )
        })}

        {/* Ingresos de la semana */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px solid var(--border)' }}>
          <div className="flex justify-between pb-1.5" style={{ borderBottom: '0.5px solid var(--border)', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>Ingresos esta semana</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)' }}>+{formatAUD(weekCollected)}</span>
          </div>
          {weekIncomes.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', padding: '10px 0' }}>Sin ingresos registrados esta semana</div>}
          {weekIncomes.map(e => {
            const src = incomeSources.find(s => s.id === e.source_id)
            return (
              <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: (src?.color || '#1D9E75') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>💰</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src?.name || 'Ingreso'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDay(e.received_at)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)', whiteSpace: 'nowrap' }}>+{formatAUD(e.amount)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>}

    {/* ── TAB FIJOS ── */}
    {tab === 'fixed' && <>
      <div className="grid grid-cols-2 gap-2" style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <MetricCard label="Costo semanal" value={formatAUD(weeklyFixed)} valueColor="var(--red)" />
        <MetricCard label="Costo quincenal" value={formatAUD(weeklyFixed * 2)} valueColor="var(--text2)" />
      </div>
      {showMonthFixed && (
        <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
          <MetricCard label="Costo mensual" value={formatAUD(weeklyFixed * 4.33)} valueColor="var(--text3)" />
        </div>
      )}
      <div className="scroll-area" style={{ paddingTop: 12, paddingLeft: 16, paddingRight: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>Sobres de gasto fijo</span>
          <button onClick={() => setShowNewFixed(true)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg2)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={14} color="var(--text2)" strokeWidth={1.7} />
          </button>
        </div>
        {activeFixed.length === 0 && <EmptyState message="Tocá + para agregar tu primer gasto fijo" />}
        {activeFixed.map((e: RecurringExpense) => {
          const { name: eName } = decFixed(e.name)
          const color = CAT_COLORS[e.category]
          const period = periodRange(e.frequency)
          const periodEntries = fixedExpenseAllocations
            .filter(a => a.recurring_expense_id === e.id && a.allocated_at >= period.start && a.allocated_at <= period.end)
            .sort((a, b) => b.allocated_at.localeCompare(a.allocated_at))
          const allEntries = fixedExpenseAllocations
            .filter(a => a.recurring_expense_id === e.id)
            .sort((a, b) => b.allocated_at.localeCompare(a.allocated_at))
          const isExpandedFixed = expandedFixedId === e.id
          const visibleEntries = isExpandedFixed ? allEntries : periodEntries
          const allocated = periodEntries.reduce((s, a) => s + a.amount, 0)
          const pct = e.amount > 0 ? (allocated / e.amount) * 100 : 0
          const isOver = e.amount > 0 && allocated > e.amount
          const funded = pct >= 100

          return (
            <div key={e.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${isOver ? 'var(--red)' : color}` }}>
              {/* Header con 3 puntitos */}
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 16 }}>{ICONS[e.category]}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{eName}</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setFixedMenuId(fixedMenuId === e.id ? null : e.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '0 4px' }}>
                    <MoreHorizontal size={16} />
                  </button>
                  {fixedMenuId === e.id && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setFixedMenuId(null)} />
                      <div style={{ position: 'absolute', right: 0, top: 22, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '4px 0', zIndex: 100, minWidth: 130, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
                        <button onClick={() => { setFixedMenuId(null); setEditingFixed(e) }}
                          style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text1)' }}>Editar</button>
                        <button onClick={() => { setFixedMenuId(null); deleteRecurringExpense(e.id) }}
                          style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}>Eliminar sobre</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-2" style={{ marginBottom: 2 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: isOver ? 'var(--red)' : 'var(--text1)' }}>{formatAUD(allocated)}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>de {formatAUD(e.amount)}</div>
              </div>
              <div style={{ fontSize: 11, marginBottom: 8, fontWeight: (funded || isOver) ? 600 : 400, color: isOver ? 'var(--red)' : funded ? 'var(--green)' : 'var(--text3)' }}>
                {FREQ_LABELS[e.frequency]} · {isOver ? `Excede ${formatAUD(allocated - e.amount)}` : funded ? '✓ Completado' : `Faltan ${formatAUD(e.amount - allocated)}`}
              </div>
              <ProgressBar percent={Math.min(100, pct)} color={isOver ? 'var(--red)' : funded ? 'var(--green)' : color} height={8} />

              {allEntries.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>
                      {isExpandedFixed ? 'Todos los movimientos' : 'Este período'}
                    </span>
                    {allEntries.length > periodEntries.length && (
                      <button onClick={() => setExpandedFixedId(isExpandedFixed ? null : e.id)}
                        style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                        {isExpandedFixed ? 'Ver menos' : `Ver todos (${allEntries.length})`}
                      </button>
                    )}
                  </div>
                  {visibleEntries.map(a => {
                    const linkedExp = a.expense_id ? expenses.find(ex => ex.id === a.expense_id) : null
                    return (
                      <div key={a.id} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {linkedExp ? linkedExp.name : fmtDay(a.allocated_at)}
                          </div>
                          {linkedExp && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtDay(a.allocated_at)}</div>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: linkedExp ? 'var(--text2)' : color, whiteSpace: 'nowrap' }}>
                          {linkedExp ? '' : '+'}{formatAUD(a.amount)}
                        </span>
                        <button onClick={() => { const snap = a; deleteFixedAllocation(snap.id); scheduleUndo('Depósito eliminado', async () => { await addFixedAllocation(snap.recurring_expense_id, snap.amount, snap.allocated_at, snap.expense_id ?? undefined) }) }}
                          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {addingToFixed === e.id ? (
                <div style={{ marginTop: 10 }}>
                  <div className="flex gap-2 items-center" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text3)' }}>$</span>
                    <input type="number" inputMode="decimal" value={fixedAddAmt} autoFocus
                      onChange={ev => setFixedAddAmt(ev.target.value)} placeholder="0.00"
                      style={{ flex: 1, fontSize: 22, fontWeight: 600, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: `2px solid ${color}`, paddingBottom: 2 }} />
                  </div>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color, background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                      📅 {fmtDay(fixedAddDate)}
                    </div>
                    <input type="date" value={fixedAddDate} onChange={ev => setFixedAddDate(ev.target.value || today)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      const amt = parseFloat(fixedAddAmt); if (!amt || amt <= 0) return
                      setFixedSaving(true)
                      await addFixedAllocation(e.id, amt, fixedAddDate)
                      setFixedAddAmt(''); setFixedAddDate(today); setAddingToFixed(null); setFixedSaving(false)
                    }} disabled={fixedSaving || !fixedAddAmt}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: color, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!fixedAddAmt || fixedSaving) ? .5 : 1 }}>
                      {fixedSaving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={() => { setAddingToFixed(null); setFixedAddAmt('') }}
                      style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddingToFixed(e.id); setFixedAddDate(today) }}
                  style={{ width: '100%', marginTop: 10, padding: 9, borderRadius: 'var(--radius-sm)', background: color + '22', color, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  + Agregar al sobre
                </button>
              )}
            </div>
          )
        })}
      </div>
      {showNewFixed && <NewFixedModal onClose={() => setShowNewFixed(false)} onSave={addRecurringExpense} />}
      {editingFixed && (
        <NewFixedModal
          onClose={() => setEditingFixed(null)}
          onSave={async (d) => { await updateRecurringExpense(editingFixed.id, d); setEditingFixed(null) }}
          initial={editingFixed}
        />
      )}
    </>}

    {/* Modal: asignar gasto diario a un sobre */}
    {justSavedExpense && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
        <div className="slide-up" style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)' }}>¿Asignar a un sobre?</span>
            <button onClick={() => setJustSavedExpense(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--text3)" /></button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
            Gasto registrado: <strong style={{ color: 'var(--text1)' }}>{justSavedExpense.name}</strong> · {formatAUD(justSavedExpense.amount)}
          </div>

          {/* Lista de sobres — tocar selecciona, no guarda aún */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
            {activeFixed.map(env => {
              const { name: envName } = decFixed(env.name)
              const envColor = CAT_COLORS[env.category]
              const period = periodRange(env.frequency)
              const envAllocated = fixedExpenseAllocations
                .filter(a => a.recurring_expense_id === env.id && a.allocated_at >= period.start && a.allocated_at <= period.end)
                .reduce((s, a) => s + a.amount, 0)
              const isSelected = selectedEnvId === env.id
              return (
                <button key={env.id} onClick={() => setSelectedEnvId(isSelected ? null : env.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: isSelected ? envColor + '18' : 'var(--bg2)',
                    border: isSelected ? `2px solid ${envColor}` : `1.5px solid ${envColor}33` }}>
                  <span style={{ fontSize: 20 }}>{ICONS[env.category]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{envName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{FREQ_LABELS[env.frequency]} · {formatAUD(envAllocated)} de {formatAUD(env.amount)}</div>
                  </div>
                  {isSelected && <span style={{ fontSize: 16, color: envColor, flexShrink: 0 }}>✓</span>}
                </button>
              )
            })}
          </div>

          {assignError && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>
              ⚠️ {assignError}
            </div>
          )}

          {/* Botón de confirmación — solo activo si hay sobre seleccionado */}
          <button disabled={!selectedEnvId || assignSaving} onClick={async () => {
            if (!selectedEnvId) return
            setAssignSaving(true); setAssignError(null)
            try {
              await addFixedAllocation(selectedEnvId, justSavedExpense.amount, justSavedExpense.expense_date, justSavedExpense.id)
              setJustSavedExpense(null)
            } catch {
              setAssignError('No se pudo asignar. Verificá que la migración de Supabase esté aplicada.')
            } finally {
              setAssignSaving(false)
            }
          }} style={{ width: '100%', padding: '12px 0', borderRadius: 8, background: selectedEnvId ? 'var(--blue)' : 'var(--bg3)', color: selectedEnvId ? '#fff' : 'var(--text3)', border: 'none', fontSize: 14, fontWeight: 600, cursor: selectedEnvId ? 'pointer' : 'default', marginBottom: 8, opacity: assignSaving ? .6 : 1 }}>
            {assignSaving ? 'Guardando…' : selectedEnvId ? `Confirmar asignación` : 'Seleccioná un sobre'}
          </button>
          <button onClick={() => setJustSavedExpense(null)}
            style={{ width: '100%', padding: '11px 0', borderRadius: 8, background: 'var(--bg2)', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
            No asignar
          </button>
        </div>
      </div>
    )}
    {undoItem && (
      <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--text1)', color: 'var(--bg)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 150, fontSize: 13, maxWidth: 380, width: 'calc(100% - 32px)', boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
        <span style={{ flex: 1 }}>{undoItem.label}</span>
        <button onClick={handleUndo} style={{ color: '#4ea8ff', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>Deshacer</button>
      </div>
    )}
    <BottomNav />
  </>)
}

function NewFixedModal({ onClose, onSave, initial }: { onClose: () => void; onSave: (d: any) => Promise<void>; initial?: RecurringExpense }) {
  const today = localToday()
  const existingName = initial ? decFixed(initial.name).name : ''
  const [fAmount, setFAmount] = useState(initial ? String(initial.amount) : '')
  const [fName, setFName] = useState(existingName)
  const [fCat, setFCat] = useState<ExpenseCategory>((initial?.category as ExpenseCategory) ?? 'housing')
  const [fFreq, setFFreq] = useState<'weekly' | 'fortnightly' | 'monthly'>(initial?.frequency ?? 'monthly')
  const [fDate, setFDate] = useState(initial ? decFixed(initial.name).date || today : today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseFloat(fAmount); if (!amt || amt <= 0) return
    setSaving(true); setError(null)
    try {
      await onSave({ name: encFixed(fName.trim() || CAT_LABELS[fCat], fDate), amount: amt, category: fCat, frequency: fFreq, is_active: true })
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div className="slide-up" style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)' }}>{initial ? 'Editar sobre' : 'Nuevo gasto fijo'}</span>
          <button onClick={onClose}><X size={20} color="var(--text3)" /></button>
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Monto</label>
        <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text3)' }}>$</span>
          <input type="number" inputMode="decimal" autoFocus value={fAmount} onChange={e => setFAmount(e.target.value)}
            placeholder="0.00"
            style={{ flex: 1, fontSize: 28, fontWeight: 600, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: '2px solid var(--blue)', paddingBottom: 2 }} />
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Frecuencia</label>
        <div className="flex gap-2" style={{ marginBottom: 14 }}>
          {FIXED_FREQS.map(({ id, label }) => (
            <button key={id} onClick={() => setFFreq(id)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: fFreq === id ? 'var(--blue)' : 'var(--bg2)', color: fFreq === id ? '#fff' : 'var(--text2)', border: 'none' }}>
              {label}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Categoría</label>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none', marginBottom: 14 }}>
          {CATS.map(([id, label]) => { const on = fCat === id; return (
            <button key={id} onClick={() => setFCat(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: on ? CAT_COLORS[id] : 'transparent', color: on ? '#fff' : 'var(--text3)', border: on ? `1.5px solid ${CAT_COLORS[id]}` : '1px solid var(--border2)', fontWeight: on ? 500 : 400 }}>
              <span>{ICONS[id]}</span>{label}
            </button>
          )})}
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Nombre</label>
        <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ej: Alquiler, Netflix, Gym…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, marginBottom: 14, outline: 'none' }} />
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Fecha de inicio</label>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)', background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
            📅 {fmtDay(fDate)}
          </div>
          <input type="date" value={fDate} onChange={e => setFDate(e.target.value || today)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
        {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>⚠️ {error}</div>}
        <button onClick={save} disabled={saving || !fAmount}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: (!fAmount || saving) ? .5 : 1 }}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear sobre de gasto'}
        </button>
      </div>
    </div>
  )
}

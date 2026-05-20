'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory, FREQ_LABELS, weeklyExpenseEquivalent } from '@/lib/types'
import type { RecurringExpense } from '@/lib/types'
import { MetricCard, SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { parseISO, format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

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

const CATS = Object.entries(CAT_LABELS) as [ExpenseCategory, string][]
const ICONS: Record<ExpenseCategory, string> = { food: '🍽️', supermarket: '🛒', transport: '🚌', leisure: '🎬', shopping: '🛍️', health: '💊', housing: '🏠', subscriptions: '📱', other: '···' }
const FIXED_FREQS: Array<{ id: 'weekly' | 'fortnightly' | 'monthly'; label: string }> = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'fortnightly', label: 'Quincenal' },
  { id: 'monthly', label: 'Mensual' },
]

export default function GastosPage() {
  const { expenses, addExpense, deleteExpense, weeklyIncome, weeklyFixedCosts, recurringExpenses, addRecurringExpense, deleteRecurringExpense, incomeEntries, incomeSources } = usePocketFlow()
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
      await addExpense({ name: note.trim() || CAT_LABELS[selCat], amount: amt, category: selCat, expense_date: expDate, is_recurring: false, note: note.trim() || null })
      setAmount(''); setNote(''); setSelCat('food')
    } catch (e: any) {
      setSaveError(e?.message || 'Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false); ref.current?.focus()
    }
  }

  // ── Fixed tab ──────────────────────────────────────────────────────────────
  const [fAmount, setFAmount] = useState('')
  const [fName, setFName] = useState('')
  const [fCat, setFCat] = useState<ExpenseCategory>('other')
  const [fFreq, setFFreq] = useState<'weekly' | 'fortnightly' | 'monthly'>('monthly')
  const [fSaving, setFSaving] = useState(false)
  const [fSaveError, setFSaveError] = useState<string|null>(null)
  const [fDate, setFDate] = useState(localToday)
  const fRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (tab === 'fixed') fRef.current?.focus() }, [tab])
  const weeklyFixed = weeklyFixedCosts()
  const activeFixed = recurringExpenses.filter(e => e.is_active)

  async function saveFixed() {
    const amt = parseFloat(fAmount); if (!amt || amt <= 0) return
    setFSaving(true); setFSaveError(null)
    try {
      await addRecurringExpense({ name: encFixed(fName.trim() || CAT_LABELS[fCat], fDate), amount: amt, category: fCat, frequency: fFreq, is_active: true })
      setFAmount(''); setFName(''); setFCat('other'); setFFreq('monthly'); setFDate(localToday())
    } catch (e: any) {
      setFSaveError(e?.message || 'Error al guardar. Intentá de nuevo.')
    } finally {
      setFSaving(false); fRef.current?.focus()
    }
  }

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
            <input type="date" value={expDate} max={today} onChange={e => setExpDate(e.target.value || today)}
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
      <div className="scroll-area" style={{ padding: '0 16px 16px' }}>
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
                  <button onClick={() => deleteExpense(e.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
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
        <MetricCard label="Costo mensual" value={formatAUD(weeklyFixed * 4.33)} valueColor="var(--text2)" />
      </div>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500 }}>Agregar gasto fijo</div>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text3)' }}>$</span>
          <input ref={fRef} type="number" inputMode="decimal" value={fAmount} onChange={e => setFAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFixed()} placeholder="0.00"
            style={{ flex: 1, fontSize: 28, fontWeight: 600, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: '2px solid var(--blue)', paddingBottom: 2 }} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none', marginBottom: 8 }}>
          {FIXED_FREQS.map(({ id, label }) => { const on = fFreq === id; return (
            <button key={id} onClick={() => setFFreq(id)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: on ? 'var(--blue)' : 'transparent', color: on ? '#fff' : 'var(--text3)', border: on ? '1.5px solid var(--blue)' : '1px solid var(--border2)', fontWeight: on ? 500 : 400 }}>
              {label}
            </button>
          )})}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none', marginBottom: 10 }}>
          {CATS.map(([id, label]) => { const on = fCat === id; return (
            <button key={id} onClick={() => setFCat(id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, background: on ? CAT_COLORS[id] : 'transparent', color: on ? '#fff' : 'var(--text3)', border: on ? `1.5px solid ${CAT_COLORS[id]}` : '1px solid var(--border2)', fontWeight: on ? 500 : 400 }}>
              <span>{ICONS[id]}</span>{label}
            </button>
          )})}
        </div>
        <div className="flex gap-2" style={{ marginBottom: 10 }}>
          <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="Nombre (ej: Renta, Netflix…)" style={{ flex: 1, fontSize: 13, color: 'var(--text2)', border: 'none', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', outline: 'none' }} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
              📅 {format(parseISO(fDate), 'd MMM', { locale: es })}
            </div>
            <input type="date" value={fDate} max={today} onChange={e => setFDate(e.target.value || today)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </div>
        </div>
        {fSaveError && (
          <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>
            ⚠️ {fSaveError}
          </div>
        )}
        <button onClick={saveFixed} disabled={fSaving || !fAmount} style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--radius-sm)', background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (!fAmount || fSaving) ? .5 : 1 }}>
          {fSaving ? 'Guardando…' : 'Agregar gasto fijo'}
        </button>
      </div>
      <div className="scroll-area" style={{ padding: '0 16px 16px' }}>
        {activeFixed.length === 0 && <EmptyState message="Sin gastos fijos registrados" />}
        {activeFixed.length > 0 && <div style={{ marginTop: 12 }}>
          <div className="flex justify-between pb-1.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>ACTIVOS</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>{activeFixed.length} gastos</span>
          </div>
          {activeFixed.map((e: RecurringExpense) => {
            const { name: eName, date: eDate } = decFixed(e.name)
            const startDate = eDate || e.created_at.split('T')[0]
            return (
              <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 18, width: 34, height: 34, borderRadius: 9, background: CAT_COLORS[e.category] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ICONS[e.category]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{FREQ_LABELS[e.frequency]} · {formatAUD(weeklyExpenseEquivalent(e))}/sem · desde {fmtDay(startDate)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--red)' }}>{formatAUD(e.amount)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{FREQ_LABELS[e.frequency].toLowerCase()}</div>
                </div>
                <button onClick={() => deleteRecurringExpense(e.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            )
          })}
        </div>}
      </div>
    </>}
    <BottomNav />
  </>)
}

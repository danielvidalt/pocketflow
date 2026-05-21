'use client'
import { useState, useMemo } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory } from '@/lib/types'
import type { RecurringExpense } from '@/lib/types'
import { SectionHeader, EmptyState, ProgressBar } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { parseISO, format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, X, MoreHorizontal, Search, SlidersHorizontal, History } from 'lucide-react'
import Link from 'next/link'

function localToday() { return format(new Date(), 'yyyy-MM-dd') }
function fmtDay(d: string) { return format(parseISO(d), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase()) }

const D = '\x1F'
function decFixed(raw: string) { const i = raw.indexOf(D); return i === -1 ? { name: raw, date: '' } : { name: raw.slice(0, i), date: raw.slice(i + 1) } }
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

const CATS = Object.entries(CAT_LABELS) as [ExpenseCategory, string][]
const CAT_ICONS: Record<ExpenseCategory, string> = { food: '🍽️', supermarket: '🛒', transport: '🚌', leisure: '🎬', shopping: '🛍️', health: '💊', housing: '🏠', subscriptions: '📱', debt: '💳', bank: '🏦', other: '···' }
const ENV_COLORS: [ExpenseCategory, string][] = [['food', '#1D9E75'], ['transport', '#534AB7'], ['leisure', '#BA7517'], ['shopping', '#993556'], ['health', '#3B6D11'], ['housing', '#185FA5'], ['subscriptions', '#D85A30'], ['debt', '#C0392B'], ['bank', '#1A6EA8'], ['other', '#5F5E5A']]
const FIXED_FREQS = [{ id: 'weekly' as const, label: 'Semanal' }, { id: 'fortnightly' as const, label: 'Quincenal' }, { id: 'monthly' as const, label: 'Mensual' }]

export default function GastosPage() {
  const { expenses, addExpense, deleteExpense, weeklyFixedCosts, recurringExpenses,
    addRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
    fixedExpenseAllocations, addFixedAllocation, deleteFixedAllocation } = usePocketFlow()

  const today = localToday()
  const todayStr = today
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const [tab, setTab] = useState<'daily' | 'fixed'>('daily')

  // Search/filter
  const [query, setQuery] = useState('')
  const [filterCat, setFilterCat] = useState<ExpenseCategory | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const hasFilters = query.trim() !== '' || filterCat !== null || dateFrom !== '' || dateTo !== ''
  function clearFilters() { setQuery(''); setFilterCat(null); setDateFrom(''); setDateTo('') }

  // Fixed tab
  const [showNewFixed, setShowNewFixed] = useState(false)
  const [editingFixed, setEditingFixed] = useState<RecurringExpense | null>(null)
  const [fixedMenuId, setFixedMenuId] = useState<string | null>(null)
  const [addingToFixed, setAddingToFixed] = useState<string | null>(null)
  const [fixedAddAmt, setFixedAddAmt] = useState('')
  const [fixedAddDate, setFixedAddDate] = useState(today)
  const [fixedSaving, setFixedSaving] = useState(false)
  const [historialFixedId, setHistorialFixedId] = useState<string | null>(null)
  const activeFixed = recurringExpenses.filter(e => e.is_active)

  // Undo
  const [undoItem, setUndoItem] = useState<{ label: string; restore: () => Promise<void> } | null>(null)
  function scheduleUndo(label: string, restore: () => Promise<void>) {
    setUndoItem({ label, restore })
    setTimeout(() => setUndoItem(null), 5000)
  }

  const expGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, typeof expenses>()
    for (const e of expenses) {
      if (e.name.startsWith('Ahorro: ')) continue
      if (q && !e.name.toLowerCase().includes(q) && !(e.note ?? '').toLowerCase().includes(q)) continue
      if (filterCat && e.category !== filterCat) continue
      if (dateFrom && e.expense_date < dateFrom) continue
      if (dateTo && e.expense_date > dateTo) continue
      if (!map.has(e.expense_date)) map.set(e.expense_date, [])
      map.get(e.expense_date)!.push(e)
    }
    return Array.from(map.keys()).sort((a, b) => b.localeCompare(a)).map(date => ({
      date, label: date === todayStr ? 'HOY' : date === yesterdayStr ? 'AYER' : fmtDay(date).toUpperCase(),
      items: map.get(date)!,
    }))
  }, [expenses, query, filterCat, dateFrom, dateTo, todayStr, yesterdayStr])

  return (<>
    <SectionHeader title="Gastos" subtitle={format(new Date(), "EEEE d 'de' MMMM", { locale: es })} />

    {/* Tabs */}
    <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: 3, margin: '8px 16px 0', flexShrink: 0 }}>
      {([['daily', 'Diarios'], ['fixed', 'Fijos']] as const).map(([id, lbl]) => (
        <button key={id} onClick={() => setTab(id)}
          style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === id ? 'var(--bg)' : 'transparent', color: tab === id ? 'var(--text1)' : 'var(--text2)', boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
          {lbl}
        </button>
      ))}
    </div>

    {/* ── TAB DIARIOS ── */}
    {tab === 'daily' && <>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Buscar gasto…" value={query} onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 28px 8px 30px', fontSize: 13, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text1)', outline: 'none' }} />
            {query !== '' && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}><X size={13} /></button>}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            style={{ padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: showFilters || filterCat || dateFrom || dateTo ? 'var(--blue)' : 'var(--bg2)', color: showFilters || filterCat || dateFrom || dateTo ? '#fff' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <SlidersHorizontal size={14} /><span style={{ fontSize: 12, fontWeight: 500 }}>Filtros</span>
          </button>
        </div>
        {showFilters && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATS.map(([cat, label]) => { const active = filterCat === cat; return (
                <button key={cat} onClick={() => setFilterCat(active ? null : cat)}
                  style={{ padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, background: active ? CAT_COLORS[cat] : 'var(--bg3)', color: active ? '#fff' : 'var(--text2)' }}>
                  {CAT_ICONS[cat]} {label}
                </button>
              )})}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Desde</div>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: dateFrom ? 'var(--text1)' : 'var(--text3)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Hasta</div>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: dateTo ? 'var(--text1)' : 'var(--text3)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ label: 'Hoy', from: todayStr, to: todayStr }, { label: 'Ayer', from: yesterdayStr, to: yesterdayStr }, { label: 'Últimos 7 días', from: format(subDays(new Date(), 6), 'yyyy-MM-dd'), to: todayStr }, { label: 'Últimos 30 días', from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: todayStr }].map(s => {
                const active = dateFrom === s.from && dateTo === s.to
                return <button key={s.label} onClick={() => { if (active) { setDateFrom(''); setDateTo('') } else { setDateFrom(s.from); setDateTo(s.to) } }} style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, background: active ? 'var(--blue)' : 'var(--bg3)', color: active ? '#fff' : 'var(--text2)' }}>{s.label}</button>
              })}
            </div>
          </div>
        )}
        {hasFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>
              {[query.trim() && `"${query.trim()}"`, filterCat && CAT_LABELS[filterCat], (dateFrom || dateTo) && [dateFrom && `desde ${dateFrom}`, dateTo && `hasta ${dateTo}`].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
            </span>
            <button onClick={clearFilters} style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpiar</button>
          </div>
        )}
      </div>
      <div className="scroll-area" style={{ paddingLeft: 16, paddingRight: 16 }}>
        <div className="flex items-center justify-between" style={{ paddingTop: 12, paddingBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>Historial completo</span>
          <Link href="/gastos/historial" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}>
            <History size={12} /> Ver todo
          </Link>
        </div>
        {expGroups.length === 0 && <EmptyState message={hasFilters ? 'Sin resultados' : 'Sin gastos registrados'} />}
        {expGroups.map(({ date, label, items }) => {
          const dayTotal = items.reduce((s, e) => s + e.amount, 0)
          return (
            <div key={date} className="card" style={{ marginBottom: 10, borderLeft: '3px solid var(--red)' }}>
              <div className="flex justify-between pb-2" style={{ borderBottom: '0.5px solid var(--border)', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(dayTotal)}</span>
              </div>
              {items.map(e => (
                <div key={e.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 16, width: 30, height: 30, borderRadius: 8, background: CAT_COLORS[e.category] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{CAT_ICONS[e.category]}</div>
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
      </div>
    </>}

    {/* ── TAB FIJOS ── */}
    {tab === 'fixed' && <>
      <div className="scroll-area" style={{ paddingTop: 12, paddingLeft: 16, paddingRight: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>Sobres de gasto fijo</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>sem: {formatAUD(weeklyFixedCosts())}</span>
          </div>
          <button onClick={() => setShowNewFixed(true)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg2)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={14} color="var(--text2)" strokeWidth={1.7} />
          </button>
        </div>
        {activeFixed.length === 0 && <EmptyState message="Tocá + para agregar tu primer gasto fijo" />}
        {activeFixed.map((e: RecurringExpense) => {
          const { name: eName } = decFixed(e.name)
          const color = CAT_COLORS[e.category]
          const pr = periodRange(e.frequency)
          const envAllocs = fixedExpenseAllocations.filter(a => a.recurring_expense_id === e.id)
          const pAllocs = envAllocs.filter(a => a.allocated_at >= pr.start && a.allocated_at <= pr.end)
          const pFunded = pAllocs.filter(a => a.type !== 'withdrawal').reduce((s, a) => s + a.amount, 0)
          const pSpent  = pAllocs.filter(a => a.type === 'withdrawal').reduce((s, a) => s + a.amount, 0)
          const pAvail  = pFunded - pSpent
          const pct = e.amount > 0 ? Math.min(100, (pAvail / e.amount) * 100) : 0
          const isOver = pAvail < 0
          return (
            <div key={e.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${isOver ? 'var(--red)' : color}` }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{eName}</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {addingToFixed !== e.id && (
                    <button onClick={() => { setAddingToFixed(e.id); setFixedAddDate(today) }} title="Agregar fondos"
                      style={{ width: 28, height: 28, borderRadius: 8, background: color + '22', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={14} color={color} strokeWidth={2.5} />
                    </button>
                  )}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setFixedMenuId(fixedMenuId === e.id ? null : e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '0 4px' }}><MoreHorizontal size={16} /></button>
                    {fixedMenuId === e.id && (<>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setFixedMenuId(null)} />
                      <div style={{ position: 'absolute', right: 0, top: 22, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '4px 0', zIndex: 100, minWidth: 130, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
                        <button onClick={() => { setFixedMenuId(null); setEditingFixed(e) }} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text1)' }}>Editar</button>
                        <button onClick={() => { setFixedMenuId(null); deleteRecurringExpense(e.id) }} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}>Eliminar sobre</button>
                      </div>
                    </>)}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: isOver ? 'var(--red)' : pFunded > 0 ? 'var(--text1)' : 'var(--text3)' }}>{formatAUD(pAvail)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Disponible</div>
              </div>
              <ProgressBar percent={Math.max(0, pct)} color={isOver ? 'var(--red)' : color} height={6} />
              <div style={{ marginTop: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Planificado: <strong style={{ color: 'var(--text2)' }}>{formatAUD(e.amount)}</strong> · {e.frequency === 'weekly' ? 'Semanal' : e.frequency === 'fortnightly' ? 'Quincenal' : 'Mensual'}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Fondos: <span style={{ color: pFunded > 0 ? color : 'var(--text3)', fontWeight: pFunded > 0 ? 600 : 400 }}>{formatAUD(pFunded)}</span></span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Gastado: <span style={{ color: pSpent > 0 ? 'var(--red)' : 'var(--text3)', fontWeight: pSpent > 0 ? 600 : 400 }}>−{formatAUD(pSpent)}</span></span>
                </div>
              </div>
              <button onClick={() => setHistorialFixedId(historialFixedId === e.id ? null : e.id)}
                style={{ width: '100%', padding: '8px 0', borderRadius: 8, background: 'var(--bg2)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                Ver movimientos{envAllocs.length > 0 ? ` (${envAllocs.length})` : ''}
              </button>
              {addingToFixed === e.id && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Agregar fondos al sobre</div>
                  <div className="flex gap-2 items-center" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text3)' }}>$</span>
                    <input type="number" inputMode="decimal" value={fixedAddAmt} autoFocus onChange={ev => setFixedAddAmt(ev.target.value)} placeholder="0.00"
                      style={{ flex: 1, fontSize: 22, fontWeight: 600, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: `2px solid ${color}`, paddingBottom: 2 }} />
                  </div>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color, background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}>📅 {fmtDay(fixedAddDate)}</div>
                    <input type="date" value={fixedAddDate} onChange={ev => setFixedAddDate(ev.target.value || today)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => { const amt = parseFloat(fixedAddAmt); if (!amt || amt <= 0) return; setFixedSaving(true); await addFixedAllocation(e.id, amt, fixedAddDate, undefined, 'deposit'); setFixedAddAmt(''); setFixedAddDate(today); setAddingToFixed(null); setFixedSaving(false) }} disabled={fixedSaving || !fixedAddAmt}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: color, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (!fixedAddAmt || fixedSaving) ? .5 : 1 }}>
                      {fixedSaving ? 'Guardando…' : 'Guardar fondos'}
                    </button>
                    <button onClick={() => { setAddingToFixed(null); setFixedAddAmt('') }} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {showNewFixed && <NewFixedModal onClose={() => setShowNewFixed(false)} onSave={addRecurringExpense} />}
      {editingFixed && <NewFixedModal onClose={() => setEditingFixed(null)} onSave={async (d) => { await updateRecurringExpense(editingFixed.id, d) }} initial={editingFixed} />}
      {historialFixedId && (() => {
        const env = activeFixed.find(e => e.id === historialFixedId); if (!env) return null
        const { name: eName } = decFixed(env.name); const envColor = CAT_COLORS[env.category]
        const allAllocs = fixedExpenseAllocations.filter(a => a.recurring_expense_id === historialFixedId).sort((a, b) => b.allocated_at.localeCompare(a.allocated_at))
        const totF = allAllocs.filter(a => a.type !== 'withdrawal').reduce((s, a) => s + a.amount, 0)
        const totS = allAllocs.filter(a => a.type === 'withdrawal').reduce((s, a) => s + a.amount, 0)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
            <div className="slide-up" style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)' }}>{eName}</span>
                  <button onClick={() => setHistorialFixedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--text3)" /></button>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Fondos</div><div style={{ fontSize: 15, fontWeight: 600, color: envColor }}>+{formatAUD(totF)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Gastado</div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(totS)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase' }}>Disponible</div><div style={{ fontSize: 15, fontWeight: 700, color: totF - totS >= 0 ? 'var(--text1)' : 'var(--red)' }}>{formatAUD(totF - totS)}</div></div>
                </div>
              </div>
              <div style={{ overflowY: 'auto', padding: '4px 20px 24px', flex: 1 }}>
                {allAllocs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0', fontSize: 13 }}>Sin movimientos</div>}
                {allAllocs.map(a => {
                  const isW = a.type === 'withdrawal'; const linked = a.expense_id ? expenses.find(ex => ex.id === a.expense_id) : null
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isW ? 'rgba(220,38,38,.12)' : envColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: isW ? 'var(--red)' : envColor, flexShrink: 0 }}>{isW ? '−' : '+'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isW ? (linked?.name || 'Gasto') : 'Depósito'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDay(a.allocated_at)}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isW ? 'var(--red)' : envColor, whiteSpace: 'nowrap' }}>{isW ? '−' : '+'}{formatAUD(a.amount)}</span>
                      <button onClick={() => { deleteFixedAllocation(a.id); scheduleUndo(isW ? 'Gasto eliminado' : 'Depósito eliminado', async () => { await addFixedAllocation(env.id, a.amount, a.allocated_at, a.expense_id ?? undefined, a.type) }) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </>}

    {undoItem && (
      <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--text1)', color: 'var(--bg)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 150, fontSize: 13, maxWidth: 380, width: 'calc(100% - 32px)', boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
        <span style={{ flex: 1 }}>{undoItem.label}</span>
        <button onClick={async () => { await undoItem.restore(); setUndoItem(null) }} style={{ color: '#4ea8ff', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>Deshacer</button>
      </div>
    )}
    <BottomNav />
  </>)
}

function NewFixedModal({ onClose, onSave, initial }: { onClose: () => void; onSave: (d: any) => Promise<void>; initial?: RecurringExpense }) {
  const today = localToday()
  const [fAmount, setFAmount] = useState(initial ? String(initial.amount) : '')
  const [fName, setFName] = useState(initial ? decFixed(initial.name).name : '')
  const [fColor, setFColor] = useState<ExpenseCategory>((initial?.category as ExpenseCategory) ?? 'food')
  const [fFreq, setFFreq] = useState<'weekly' | 'fortnightly' | 'monthly'>(initial?.frequency ?? 'monthly')
  const [fDate, setFDate] = useState(initial ? decFixed(initial.name).date || today : today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseFloat(fAmount); if (!amt || amt <= 0) return
    setSaving(true); setError(null)
    try {
      await onSave({ name: `${fName.trim() || 'Sobre'}${D}${fDate}`, amount: amt, category: fColor, frequency: fFreq, is_active: true })
      onClose()
    } catch (e: any) { setError(e?.message || 'Error al guardar') } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div className="slide-up" style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)' }}>{initial ? 'Editar sobre' : 'Nuevo gasto fijo'}</span>
          <button onClick={onClose}><X size={20} color="var(--text3)" /></button>
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Monto planificado</label>
        <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text3)' }}>$</span>
          <input type="number" inputMode="decimal" autoFocus value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00"
            style={{ flex: 1, fontSize: 28, fontWeight: 600, color: 'var(--text1)', border: 'none', background: 'transparent', outline: 'none', borderBottom: '2px solid var(--blue)', paddingBottom: 2 }} />
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Frecuencia</label>
        <div className="flex gap-2" style={{ marginBottom: 14 }}>
          {FIXED_FREQS.map(({ id, label }) => (
            <button key={id} onClick={() => setFFreq(id)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: fFreq === id ? 'var(--blue)' : 'var(--bg2)', color: fFreq === id ? '#fff' : 'var(--text2)', border: 'none' }}>{label}</button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Color del sobre</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {ENV_COLORS.map(([cat, hex]) => (
            <button key={cat} onClick={() => setFColor(cat)} style={{ width: 28, height: 28, borderRadius: '50%', background: hex, border: fColor === cat ? '3px solid var(--text1)' : '2px solid transparent', cursor: 'pointer' }} />
          ))}
        </div>
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Nombre</label>
        <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ej: Alquiler, Netflix, Gym…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, marginBottom: 14, outline: 'none' }} />
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Fecha de inicio</label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)', background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}>📅 {fmtDay(fDate)}</div>
          <input type="date" value={fDate} onChange={e => setFDate(e.target.value || today)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
        {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>⚠️ {error}</div>}
        <button onClick={save} disabled={saving || !fAmount} style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: (!fAmount || saving) ? .5 : 1 }}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear sobre'}
        </button>
      </div>
    </div>
  )
}

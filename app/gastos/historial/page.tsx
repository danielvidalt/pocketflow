'use client'
import { useMemo, useState } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory } from '@/lib/types'
import { SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2, Search, X, SlidersHorizontal } from 'lucide-react'

function localToday() { return format(new Date(), 'yyyy-MM-dd') }
function fmtDay(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

const ICONS: Record<ExpenseCategory, string> = {
  food: '🍽️', supermarket: '🛒', transport: '🚌', leisure: '🎬',
  shopping: '🛍️', health: '💊', housing: '🏠', subscriptions: '📱',
  debt: '💳', bank: '🏦', other: '···',
}

const ALL_CATEGORIES = Object.keys(CAT_LABELS) as ExpenseCategory[]

export default function HistorialPage() {
  const { expenses, deleteExpense, deleteExpensesByDate } = usePocketFlow()
  const [confirmDate, setConfirmDate] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState<ExpenseCategory | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const todayStr = localToday()
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const hasFilters = query.trim() !== '' || selectedCat !== null || dateFrom !== '' || dateTo !== ''

  function clearFilters() {
    setQuery('')
    setSelectedCat(null)
    setDateFrom('')
    setDateTo('')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return expenses.filter(e => {
      if (q && !e.name.toLowerCase().includes(q) && !(e.note ?? '').toLowerCase().includes(q)) return false
      if (selectedCat && e.category !== selectedCat) return false
      if (dateFrom && e.expense_date < dateFrom) return false
      if (dateTo && e.expense_date > dateTo) return false
      return true
    })
  }, [expenses, query, selectedCat, dateFrom, dateTo])

  const total = filtered.reduce((s, e) => s + e.amount, 0)

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const e of filtered) {
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
  }, [filtered, todayStr, yesterdayStr])

  async function handleDeleteDay(date: string) {
    await deleteExpensesByDate(date)
    setConfirmDate(null)
  }

  const subtitle = hasFilters
    ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} · ${formatAUD(total)}`
    : `${expenses.length} registros · ${formatAUD(total)} total`

  return (<>
    <SectionHeader title="Todos los gastos" subtitle={subtitle} back />

    {/* Search bar */}
    <div style={{ padding: '0 16px 8px' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o nota…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 32px 9px 30px',
              fontSize: 13, borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text1)',
              outline: 'none',
            }}
          />
          {query !== '' && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{
            padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: showFilters || (selectedCat || dateFrom || dateTo) ? 'var(--accent)' : 'var(--bg2)',
            color: showFilters || (selectedCat || dateFrom || dateTo) ? '#fff' : 'var(--text2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}
        >
          <SlidersHorizontal size={14} />
          <span style={{ fontSize: 12, fontWeight: 500 }}>Filtros</span>
        </button>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Category chips */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Categoría</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_CATEGORIES.map(cat => {
                const active = selectedCat === cat
                return (
                  <button key={cat} onClick={() => setSelectedCat(active ? null : cat)}
                    style={{
                      padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                      background: active ? CAT_COLORS[cat] : 'var(--bg3)',
                      color: active ? '#fff' : 'var(--text2)',
                    }}>
                    {ICONS[cat]} {CAT_LABELS[cat]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Desde</div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px', fontSize: 12, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg2)',
                  color: dateFrom ? 'var(--text1)' : 'var(--text3)',
                }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Hasta</div>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px', fontSize: 12, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg2)',
                  color: dateTo ? 'var(--text1)' : 'var(--text3)',
                }} />
            </div>
          </div>

          {/* Shortcuts de fecha */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'Hoy', from: todayStr, to: todayStr },
              { label: 'Ayer', from: yesterdayStr, to: yesterdayStr },
              { label: 'Últimos 7 días', from: format(subDays(new Date(), 6), 'yyyy-MM-dd'), to: todayStr },
              { label: 'Últimos 30 días', from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: todayStr },
            ].map(s => {
              const active = dateFrom === s.from && dateTo === s.to
              return (
                <button key={s.label}
                  onClick={() => { if (active) { setDateFrom(''); setDateTo('') } else { setDateFrom(s.from); setDateTo(s.to) } }}
                  style={{
                    padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    background: active ? 'var(--accent)' : 'var(--bg3)',
                    color: active ? '#fff' : 'var(--text2)',
                  }}>
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Active filters summary + clear */}
      {hasFilters && (
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>
            {[
              query.trim() && `"${query.trim()}"`,
              selectedCat && CAT_LABELS[selectedCat],
              (dateFrom || dateTo) && [dateFrom && `desde ${dateFrom}`, dateTo && `hasta ${dateTo}`].filter(Boolean).join(' '),
            ].filter(Boolean).join(' · ')}
          </span>
          <button onClick={clearFilters} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>

    <div className="scroll-area" style={{ padding: '0 16px 16px' }}>
      {groups.length === 0 && <EmptyState message={hasFilters ? 'Sin resultados para esta búsqueda' : 'Sin gastos registrados'} />}
      {groups.map(({ date, label, items }) => {
        const dayTotal = items.reduce((s, e) => s + e.amount, 0)
        const isConfirming = confirmDate === date
        return (
          <div key={date} style={{ marginTop: 12 }}>
            <div className="flex items-center gap-2 pb-1.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(dayTotal)}</span>
              {!hasFilters && (isConfirming ? (<>
                <button onClick={() => handleDeleteDay(date)}
                  style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: 'var(--red)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                  Borrar {items.length}
                </button>
                <button onClick={() => setConfirmDate(null)}
                  style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px' }}>
                  No
                </button>
              </>) : (
                <button onClick={() => setConfirmDate(date)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '2px 4px' }}>
                  <Trash2 size={12} />
                </button>
              ))}
            </div>
            {items.map(e => (
              <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 18, width: 34, height: 34, borderRadius: 9, background: CAT_COLORS[e.category] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {ICONS[e.category]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{CAT_LABELS[e.category]}{e.note ? ` · ${e.note}` : ''}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--red)', whiteSpace: 'nowrap' }}>−{formatAUD(e.amount)}</span>
                <button onClick={() => deleteExpense(e.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )
      })}

      {/* Total filtrado */}
      {hasFilters && filtered.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{filtered.length} gasto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(total)}</span>
        </div>
      )}
    </div>
    <BottomNav />
  </>)
}

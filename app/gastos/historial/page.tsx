'use client'
import { useMemo } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, ExpenseCategory } from '@/lib/types'
import { SectionHeader, EmptyState } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

function localToday() { return format(new Date(), 'yyyy-MM-dd') }
function fmtDay(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

const ICONS: Record<ExpenseCategory, string> = {
  food: '🍽️', supermarket: '🛒', transport: '🚌', leisure: '🎬',
  shopping: '🛍️', health: '💊', housing: '🏠', subscriptions: '📱', other: '···',
}

export default function HistorialPage() {
  const { expenses, deleteExpense } = usePocketFlow()

  const todayStr = localToday()
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const groups = useMemo(() => {
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
  }, [expenses, todayStr, yesterdayStr])

  return (<>
    <SectionHeader title="Todos los gastos" subtitle={`${expenses.length} registros · ${formatAUD(total)} total`} />
    <div className="scroll-area" style={{ padding: '0 16px 16px' }}>
      {groups.length === 0 && <EmptyState message="Sin gastos registrados" />}
      {groups.map(({ label, items }) => {
        const dayTotal = items.reduce((s, e) => s + e.amount, 0)
        return (
          <div key={label} style={{ marginTop: 12 }}>
            <div className="flex justify-between pb-1.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)' }}>−{formatAUD(dayTotal)}</span>
            </div>
            {items.map(e => (
              <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 18, width: 34, height: 34, borderRadius: 9, background: CAT_COLORS[e.category] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {ICONS[e.category]}
                </div>
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
    </div>
    <BottomNav />
  </>)
}

'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, CAT_COLORS, CAT_LABELS, FREQ_DIVISORS, weeklyEquivalent } from '@/lib/types'
import type { ExpenseCategory } from '@/lib/types'
import { SectionHeader, ProgressBar, MetricCard } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { getSettings } from '@/lib/settings'

function getPayWeekStart(from: Date, startDay: number): Date {
  const d = new Date(from)
  let diff = d.getDay() - startDay
  if (diff < 0) diff += 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const CAT_ICONS: Record<ExpenseCategory, string> = { food:'🍽️', supermarket:'🛒', transport:'🚌', leisure:'🎬', shopping:'🛍️', health:'💊', housing:'🏠', subscriptions:'📱', debt:'💳', bank:'🏦', other:'···' }

function periodRange(frequency: 'weekly'|'fortnightly'|'monthly') {
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

function decName(raw: string) { const i = raw.indexOf('\x1F'); return i === -1 ? raw : raw.slice(0, i) }

export default function ResumenPage() {
  const { incomeEntries, expenses, debtPockets, savingsGoals, savingsWithdrawals,
    exchangeRates, deleteAllData, recurringExpenses, fixedExpenseAllocations, incomeSources } = usePocketFlow()
  const router = useRouter()
  const [period, setPeriod] = useState<'week'|'fortnight'|'month'>('week')
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const now = new Date()
  const settings = getSettings()
  const wkStart = getPayWeekStart(now, settings.payDayStart)
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6); wkEnd.setHours(23, 59, 59, 999)
  const fnPrevStart = new Date(wkStart); fnPrevStart.setDate(wkStart.getDate() - 7)
  const fnNextEnd = new Date(wkStart); fnNextEnd.setDate(wkStart.getDate() + 13); fnNextEnd.setHours(23, 59, 59, 999)

  const range = period === 'week'
    ? { start: wkStart, end: wkEnd }
    : period === 'fortnight'
      ? (settings.fortnightDir === 'next' ? { start: wkStart, end: fnNextEnd } : { start: fnPrevStart, end: wkEnd })
      : { start: startOfMonth(now), end: endOfMonth(now) }

  const entries = useMemo(() => incomeEntries.filter(e => isWithinInterval(parseISO(e.received_at), range)), [incomeEntries, period])
  const exps = useMemo(() => expenses.filter(e => isWithinInterval(parseISO(e.expense_date), range)), [expenses, period])
  const cobrado = entries.reduce((s, e) => s + e.amount, 0)
  const gastadoRegular = exps.filter(e => !e.name.startsWith('Ahorro: ')).reduce((s, e) => s + e.amount, 0)
  const gastadoAhorros = exps.filter(e => e.name.startsWith('Ahorro: ')).reduce((s, e) => s + e.amount, 0)
  const rangeStartStr = format(range.start, 'yyyy-MM-dd')
  const rangeEndStr = format(range.end, 'yyyy-MM-dd')
  const gastadoFijoReal = fixedExpenseAllocations
    .filter(a => a.type === 'withdrawal' && a.allocated_at >= rangeStartStr && a.allocated_at <= rangeEndStr)
    .reduce((s, a) => s + a.amount, 0)
  const gastadoTotal = gastadoRegular + gastadoAhorros
  const multiplier = period === 'week' ? 1 : period === 'fortnight' ? 2 : 4.33
  const weeklyTotal = incomeSources.filter(s => s.is_active).reduce((sum, s) => sum + weeklyEquivalent(s), 0)
  // Sobres fijos: max(monto planificado del período, depósitos reales en el período)
  const totalFixedCommitted = useMemo(() =>
    recurringExpenses.filter(e => e.is_active).reduce((total, e) => {
      const planned = e.amount * (multiplier / FREQ_DIVISORS[e.frequency])
      const deposited = fixedExpenseAllocations
        .filter(a => a.recurring_expense_id === e.id && a.type !== 'withdrawal' && a.allocated_at >= rangeStartStr && a.allocated_at <= rangeEndStr)
        .reduce((s, a) => s + a.amount, 0)
      return total + Math.max(planned, deposited)
    }, 0),
    [recurringExpenses, fixedExpenseAllocations, period])
  // Sobres de ahorro: max(contribución planificada del período, ahorros reales en el período)
  const totalSavingsCommitted = useMemo(() => {
    const SEP = '\x1F'
    return savingsGoals.reduce((total, g) => {
      const i = g.name.indexOf(SEP)
      const type = i === -1 ? '$' as const : g.name[i + 1] as '%' | '$'
      const value = i === -1 ? 0 : (parseFloat(g.name.slice(i + 2)) || 0)
      const freq = g.frequency || 'monthly'
      const freqDiv = FREQ_DIVISORS[freq] || 4.33
      const planned = type === '%' ? weeklyTotal * multiplier * value / 100 : value * (multiplier / freqDiv)
      const goalName = i === -1 ? g.name : g.name.slice(0, i)
      const deposited = exps.filter(e => e.name === `Ahorro: ${goalName}`).reduce((s, e) => s + e.amount, 0)
      return total + Math.max(planned, deposited)
    }, 0)
  }, [savingsGoals, exps, weeklyTotal, multiplier])
  const totalAGastar = cobrado - gastadoRegular - totalFixedCommitted - totalSavingsCommitted

  const catDist = useMemo(() => {
    const m: Partial<Record<ExpenseCategory, number>> = {}
    exps.filter(e => !e.name.startsWith('Ahorro: ')).forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount })
    return Object.entries(m).sort(([, a], [, b]) => b - a).map(([c, a]) => ({ cat: c as ExpenseCategory, amt: a as number }))
  }, [exps])
  const mx = catDist[0]?.amt || 1

  const activeFixed = recurringExpenses.filter(e => e.is_active)

  const totalFijoSpent = useMemo(() =>
    activeFixed.reduce((sum, e) => {
      const pr = periodRange(e.frequency)
      const allocs = fixedExpenseAllocations.filter(a => a.recurring_expense_id === e.id && a.allocated_at >= pr.start && a.allocated_at <= pr.end)
      return sum + allocs.filter(a => a.type === 'withdrawal').reduce((s, a) => s + a.amount, 0)
    }, 0),
    [activeFixed, fixedExpenseAllocations]
  )

  // Savings totals
  const totalAhorros = savingsGoals.reduce((s, g) => {
    const w = savingsWithdrawals.filter(x => x.savings_goal_id === g.id).reduce((a, x) => a + x.amount, 0)
    return s + Math.max(0, g.current_amount - w)
  }, 0)

  function SectionTitle({ label, href, count }: { label: string; href: string; count?: number }) {
    return (
      <button onClick={() => router.push(href)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0 8px', textAlign: 'left' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{label}</span>
          {count !== undefined && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{count} sobres</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--blue)' }}>ver →</span>
          <ChevronRight size={14} color="var(--blue)" />
        </div>
      </button>
    )
  }

  return (<>
    <SectionHeader title="Resumen" />
    <div className="scroll-area" style={{ padding: 16 }}>
      {/* Selector de período */}
      <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 14 }}>
        {([['week', 'Esta semana'], ['fortnight', 'Esta quincena'], ['month', 'Este mes']] as const).map(([p, lbl]) => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ flex: 1, padding: 7, borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: period === p ? 'var(--bg)' : 'transparent', color: period === p ? 'var(--text1)' : 'var(--text2)', boxShadow: period === p ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Total a Gastar hero */}
      <div style={{ background: 'var(--blue)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Total a Gastar</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: -0.5, lineHeight: 1 }}>{formatAUD(Math.max(0, totalAGastar))}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>
          Disponible tras gastos diarios: <span style={{ fontWeight: 600, color: cobrado - gastadoTotal - gastadoFijoReal >= 0 ? 'rgba(255,255,255,.9)' : 'rgba(255,180,180,1)' }}>{formatAUD(cobrado - gastadoTotal - gastadoFijoReal)}</span>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 12 }}>
        <MetricCard label="Ingresos" value={formatAUD(cobrado)} valueColor="var(--green)" />
        <MetricCard label="Gastado" value={formatAUD(gastadoRegular)} valueColor="var(--red)" />
        <MetricCard label="Ahorros" value={formatAUD(gastadoAhorros)} valueColor="var(--blue)" />
      </div>

      {/* ── GASTOS DIARIOS ── */}
      <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0 14px' }}>
          <SectionTitle label="Gastos Diarios" href="/gastos" />
        </div>
        {catDist.length === 0
          ? <div style={{ padding: '8px 14px 14px', fontSize: 13, color: 'var(--text3)' }}>Sin gastos este período</div>
          : <div style={{ padding: '0 14px 12px' }}>
              {catDist.map(({ cat, amt }) => (
                <div key={cat} className="flex items-center gap-2.5 py-2" style={{ borderTop: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 15, width: 24, textAlign: 'center', flexShrink: 0 }}>{CAT_ICONS[cat]}</span>
                  <div style={{ fontSize: 12, color: 'var(--text2)', width: 86, flexShrink: 0 }}>{CAT_LABELS[cat]}</div>
                  <div style={{ flex: 1, height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: CAT_COLORS[cat], width: `${(amt / mx) * 100}%`, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text1)', whiteSpace: 'nowrap', width: 70, textAlign: 'right' }}>{formatAUD(amt)}</div>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Total gastado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>−{formatAUD(gastadoRegular)}</span>
              </div>
            </div>
        }
      </div>

      {/* ── GASTOS FIJOS ── */}
      <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0 14px' }}>
          <SectionTitle label="Gastos Fijos" href="/gastos" count={activeFixed.length} />
        </div>
        {activeFixed.length === 0
          ? <div style={{ padding: '8px 14px 14px', fontSize: 13, color: 'var(--text3)' }}>Sin sobres fijos configurados</div>
          : <div style={{ padding: '0 14px 12px' }}>
              {activeFixed.map(e => {
                const name = decName(e.name)
                const pr = periodRange(e.frequency)
                const allocs = fixedExpenseAllocations.filter(a => a.recurring_expense_id === e.id && a.allocated_at >= pr.start && a.allocated_at <= pr.end)
                const funded = allocs.filter(a => a.type !== 'withdrawal').reduce((s, a) => s + a.amount, 0)
                const spent = allocs.filter(a => a.type === 'withdrawal').reduce((s, a) => s + a.amount, 0)
                const avail = funded - spent
                const pct = e.amount > 0 ? Math.min(100, Math.max(0, (avail / e.amount) * 100)) : 0
                const color = CAT_COLORS[e.category]
                return (
                  <div key={e.id} style={{ paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>{name}</span>
                      {spent > 0
                        ? <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>−{formatAUD(spent)}</span>
                            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>descontado</span>
                          </div>
                        : <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sin descuentos</span>
                      }
                    </div>
                    <div style={{ fontSize: 11, color: avail < 0 ? 'var(--red)' : 'var(--text3)', marginBottom: 4 }}>
                      Disponible: <span style={{ fontWeight: 600, color: avail < 0 ? 'var(--red)' : color }}>{formatAUD(avail)}</span>
                      <span style={{ color: 'var(--text3)' }}> de {formatAUD(e.amount)}</span>
                    </div>
                    <ProgressBar percent={pct} color={avail < 0 ? 'var(--red)' : color} height={4} />
                  </div>
                )
              })}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Total descontado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: totalFijoSpent > 0 ? 'var(--red)' : 'var(--text3)' }}>{totalFijoSpent > 0 ? `−${formatAUD(totalFijoSpent)}` : formatAUD(0)}</span>
              </div>
            </div>
        }
      </div>

      {/* ── AHORROS ── */}
      <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0 14px' }}>
          <SectionTitle label="Ahorros" href="/ahorros" count={savingsGoals.length} />
        </div>
        {savingsGoals.length === 0
          ? <div style={{ padding: '8px 14px 14px', fontSize: 13, color: 'var(--text3)' }}>Sin sobres de ahorro configurados</div>
          : <div style={{ padding: '0 14px 12px' }}>
              {savingsGoals.map(g => {
                const name = decName(g.name)
                const withdrawn = savingsWithdrawals.filter(w => w.savings_goal_id === g.id).reduce((s, w) => s + w.amount, 0)
                const avail = g.current_amount - withdrawn
                const pct = g.target_amount > 0 ? Math.min(100, Math.max(0, (avail / g.target_amount) * 100)) : 0
                return (
                  <div key={g.id} style={{ paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>{name}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{formatAUD(avail)}</span>
                        {g.target_amount > 0 && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>/ {formatAUD(g.target_amount)}</span>}
                      </div>
                    </div>
                    {g.target_amount > 0 && <ProgressBar percent={pct} color={g.color} height={4} />}
                  </div>
                )
              })}
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Total ahorrado</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatAUD(totalAhorros)}</span>
              </div>
            </div>
        }
      </div>

      {/* Deudas / bolsillos (si existen) */}
      {debtPockets.map(d => {
        const rate = exchangeRates[d.target_currency] || 1
        const tAUD = d.target_currency === 'AUD' ? d.target_amount : d.target_amount / rate
        const pct = Math.min(100, (d.current_amount_aud / tAUD) * 100)
        return (
          <div key={d.id} className="card" style={{ marginBottom: 10 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div>
                <div className="flex items-center gap-1"><span style={{ fontSize: 18 }}>{d.emoji}</span><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{d.name}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Meta: {d.target_amount.toLocaleString()} {d.target_currency}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>{formatAUD(d.current_amount_aud)}</div>
                <div className="flex items-center gap-1 justify-end" style={{ marginTop: 4 }}><RefreshCw size={10} color="var(--text3)" /><span style={{ fontSize: 10, color: 'var(--text3)' }}>1 AUD = {rate.toLocaleString()} {d.target_currency}</span></div>
              </div>
            </div>
            <ProgressBar percent={pct} color="var(--amber)" height={8} />
            <div className="flex justify-between" style={{ marginTop: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--text3)' }}>{Math.round(pct)}% completado</span>
              <span style={{ color: 'var(--text1)', fontWeight: 500 }}>Faltan {formatAUD(Math.max(0, tAUD - d.current_amount_aud))}</span>
            </div>
          </div>
        )
      })}

      {/* Zona de peligro */}
      <div style={{ marginTop: 32, marginBottom: 48, padding: '12px 16px', background: 'var(--red-bg)', borderRadius: 'var(--radius)', border: '0.5px solid rgba(239,68,68,0.25)' }}>
        <button onClick={() => setShowDeleteAll(true)}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.85)', color: '#fff', border: '1px solid rgba(239,68,68,0.95)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          Borrar todos los datos
        </button>
      </div>
      <div style={{ height: 80 }} />
    </div>

    {showDeleteAll && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
        <div className="slide-up" style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 24 }}>
          <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)', textAlign: 'center', marginBottom: 8 }}>¿Borrar todos los datos?</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 22 }}>Se eliminarán gastos, ingresos, fuentes de ingreso, gastos fijos y ahorros.<br />Esta acción no se puede deshacer.</div>
          <button onClick={async () => { setDeletingAll(true); try { await deleteAllData() } finally { setDeletingAll(false); setShowDeleteAll(false) } }} disabled={deletingAll}
            style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--red)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10, opacity: deletingAll ? .6 : 1 }}>
            {deletingAll ? 'Borrando…' : 'Confirmar, borrar todo'}
          </button>
          <button onClick={() => setShowDeleteAll(false)} style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    )}
    <BottomNav />
  </>)
}

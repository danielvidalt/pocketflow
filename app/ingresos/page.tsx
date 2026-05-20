'use client'
import { useState, useMemo, useRef } from 'react'
import { usePocketFlow } from '@/lib/store'
import { formatAUD, weeklyEquivalent, FREQ_LABELS, DOW_LABELS } from '@/lib/types'
import type { IncomeSource, Frequency } from '@/lib/types'
import { SectionHeader, Divider, BtnPrimary } from '@/components/ui'
import BottomNav from '@/components/BottomNav'
import { Plus, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const FQ: Frequency[] = ['weekly', 'fortnightly', 'monthly', 'annual']
const COLORS = ['#534AB7', '#1D9E75', '#BA7517', '#D85A30', '#185FA5', '#993556', '#3B6D11']

// Hora LOCAL siempre (evita bug UTC en Australia)
function localToday() { return format(new Date(), 'yyyy-MM-dd') }
function fmtDay(d: string) {
  return format(parseISO(d), "EEEE, d MMM", { locale: es }).replace(/\b\w/g, c => c.toUpperCase())
}

// Semana local (lunes → domingo)
function weekStart() {
  const now = new Date(); const day = now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7)); mon.setHours(0, 0, 0, 0)
  return format(mon, 'yyyy-MM-dd')
}

export default function IngresosPage() {
  const { incomeSources, incomeEntries, registerPayment, addIncomeSource, deleteIncomeSource, weeklyIncome, deleteIncomeEntry, deleteAllIncomeEntries } = usePocketFlow()
  const [showForm, setShowForm] = useState(false)
  const [registeringId, setRegisteringId] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(localToday)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const today = localToday()
  const wkStart = weekStart()

  const recurring = useMemo(() =>
    incomeSources.filter(s => s.is_active && s.frequency !== 'once'),
    [incomeSources]
  )

  // Comparación por string de fecha (inmune a timezone), no por objetos Date
  function paid(srcId: string) {
    return incomeEntries.some(e => e.source_id === srcId && e.received_at >= wkStart)
  }

  async function handleRegister(src: IncomeSource) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await registerPayment(src.id, src.amount, payDate)
      setRegisteringId(null)
      setPayDate(localToday())
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (<>
    <SectionHeader title="Mis ingresos" subtitle={`${formatAUD(weeklyIncome())} / semana equivalente`}
      action={<button onClick={() => setShowForm(true)} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} color="var(--text2)" strokeWidth={1.7} /></button>} />

    <div className="scroll-area" style={{ paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
      {error && (
        <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', float: 'right', fontSize: 16 }}>×</button>
        </div>
      )}

      <div className="section-label">Fuentes recurrentes</div>
      {recurring.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Tocá + para agregar tu primera fuente</p>}

      {recurring.map(src => {
        const isPaid = paid(src.id)
        const isRegistering = registeringId === src.id
        return (
          <div key={src.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${src.color}` }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{src.name}</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: src.color + '22', color: src.color }}>
                  {FREQ_LABELS[src.frequency]}{src.day_of_week !== null ? ` · ${DOW_LABELS[src.day_of_week].slice(0, 3)}` : ''}
                </span>
                <button onClick={() => deleteIncomeSource(src.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={14} /></button>
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', margin: '4px 0' }}>{formatAUD(src.amount)}</div>
            {src.frequency !== 'weekly' && <div style={{ fontSize: 11, color: 'var(--text3)' }}>= {formatAUD(weeklyEquivalent(src))} / semana</div>}
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
              {isPaid
                ? <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Ingresado esta semana</span>
                : 'Pendiente esta semana'}
            </div>

            {!isPaid && (
              isRegistering ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>¿Cuándo lo recibiste?</div>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue)', background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}>
                      📅 {fmtDay(payDate)}
                    </div>
                    <input type="date" value={payDate}
                      onChange={e => setPayDate(e.target.value || today)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRegister(src)}
                      disabled={saving}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 8, background: src.color, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                      {saving ? 'Guardando…' : `Registrar ingreso — ${formatAUD(src.amount)}`}
                    </button>
                    <button onClick={() => { setRegisteringId(null); setError(null) }}
                      style={{ padding: '11px 14px', borderRadius: 8, background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setRegisteringId(src.id); setPayDate(localToday()); setError(null) }}
                  style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', background: src.color + '22', color: src.color, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  Registré este cobro — {formatAUD(src.amount)}
                </button>
              )
            )}
          </div>
        )
      })}

      <Divider margin="6px 0 14px" />
      <button onClick={() => setShowForm(true)} className="card flex items-center gap-3" style={{ width: '100%', border: '0.5px dashed var(--border2)', cursor: 'pointer' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg2)', border: '0.5px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={16} color="var(--text3)" /></div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>Agregar ingreso / fuente</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Sueldo, freelance, venta, regalo…</div>
        </div>
      </button>

      {/* Historial de ingresos */}
      {incomeEntries.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1.5px solid var(--border)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>Historial de ingresos</div>
            <button onClick={() => deleteAllIncomeEntries()}
              style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
              Borrar historial
            </button>
          </div>
          {incomeEntries
            .sort((a, b) => b.received_at.localeCompare(a.received_at))
            .map(e => {
              const src = incomeSources.find(s => s.id === e.source_id)
              return (
                <div key={e.id} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: src?.color || 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src?.name || 'Ingreso'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDay(e.received_at)}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)', whiteSpace: 'nowrap' }}>+{formatAUD(e.amount)}</span>
                  <button onClick={() => { const snap = e; const snapSrc = src; deleteIncomeEntry(snap.id); scheduleUndo(`Ingreso eliminado`, async () => { await registerPayment(snapSrc?.id ?? null, snap.amount, snap.received_at, snap.note ?? undefined) }) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              )
            })}
        </div>
      )}
    </div>

    {showForm && <Modal onClose={() => setShowForm(false)} onSave={addIncomeSource} onRegister={registerPayment} />}
    <BottomNav />
  </>)
}

function Modal({ onClose, onSave, onRegister }: {
  onClose: () => void
  onSave: (d: any) => Promise<void>
  onRegister: (id: string | null, amt: number, date?: string) => Promise<void>
}) {
  const today = localToday()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [freq, setFreq] = useState<Frequency>('weekly')
  const [dow, setDow] = useState(0)
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [incomeDate, setIncomeDate] = useState(today)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const amt = parseFloat(amount)
    if (!name.trim() || !amt || amt <= 0) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), amount: amt, frequency: freq, day_of_week: freq === 'once' ? null : dow, color, icon: 'briefcase', is_active: true })
      if (freq === 'once') await onRegister(null, amt, incomeDate)
      onClose()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div className="slide-up" style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text1)' }}>Nueva fuente de ingreso</span>
          <button onClick={onClose}><X size={20} color="var(--text3)" /></button>
        </div>
        {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Trabajo, freelance…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, marginBottom: 12, outline: 'none' }} />
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Monto (AUD)</label>
        <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, marginBottom: 12, outline: 'none' }} />
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Frecuencia</label>
        <select value={freq} onChange={e => setFreq(e.target.value as Frequency)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '0.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text1)', fontSize: 14, marginBottom: 12, outline: 'none' }}>
          {FQ.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
          <option value="once">Puntual (una vez)</option>
        </select>
        {freq === 'once' && <>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>¿Cuándo lo recibiste?</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue)', background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}>
              📅 {fmtDay(incomeDate)}
            </div>
            <input type="date" value={incomeDate} onChange={e => setIncomeDate(e.target.value || today)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </div>
        </>}
        {freq !== 'once' && <>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Día de cobro</label>
          <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(d => (
              <button key={d} onClick={() => setDow(d)} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontWeight: dow === d ? 600 : 400, background: dow === d ? color : 'var(--bg2)', color: dow === d ? '#fff' : 'var(--text2)', border: dow === d ? `1.5px solid ${color}` : '0.5px solid var(--border2)' }}>
                {DOW_LABELS[d].slice(0, 3)}
              </button>
            ))}
          </div>
        </>}
        <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 8 }}>Color</label>
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid var(--text1)' : '2px solid transparent', cursor: 'pointer' }} />)}
        </div>
        <BtnPrimary onClick={save} disabled={saving || !name || !amount}>{saving ? 'Guardando…' : 'Agregar fuente'}</BtnPrimary>
      </div>
    </div>
  )
}

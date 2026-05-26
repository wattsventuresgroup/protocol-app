'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '../components/BottomSheet'

type SupStatus = 'tobuy' | 'notstarted' | 'active' | 'paused' | 'discontinued'

type Supplement = {
  id: string
  patient_id: string
  name: string
  dose: string | null
  timing: string | null
  cadence: string | null
  intake_conditions: string | null
  titration_instructions: string | null
  notes_for_patient: string | null
  purchase_source: string | null
  buy_link: string | null
  source: string
  status: SupStatus
  sort_order: number
  created_at: string
}

const supabase = createClient()

const TIMING_ORDER = ['Morning', 'Midday', 'Afternoon', 'Evening', 'Bedtime', 'As needed']

const EMPTY_FORM = {
  name: '',
  dose: '',
  timing: '',
  cadence: '',
  intakeConditions: '',
  notes: '',
  purchaseSource: 'None',
  buyLink: '',
  startingStatus: 'tobuy' as SupStatus,
}

function dotColor(status: SupStatus) {
  if (status === 'active') return '#1D9E75'
  if (status === 'paused') return '#EF9F27'
  if (status === 'discontinued') return '#E24B4A'
  return '#D3D1C7'
}

function Pill({ children }: { children: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: 'var(--color-primary-light)',
      color: 'var(--color-primary-mid)',
      borderRadius: '100px',
      fontSize: '11px',
      lineHeight: '18px',
    }}>
      {children}
    </span>
  )
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '13px',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  marginBottom: '14px',
  boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '5px',
}

const sectionHead: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--color-text-hint)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  marginBottom: '10px',
}

const NO_BUYLINK_SOURCES = new Set(['None', 'Pharmacy (Rx)', 'Pharmacy (OTC)'])

export default function PlanPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showDiscontinued, setShowDiscontinued] = useState(false)
  const [discontinueId, setDiscontinueId] = useState<string | null>(null)
  const [discontinueNote, setDiscontinueNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('supplements')
        .select('*')
        .eq('patient_id', user.id)
        .order('sort_order')
        .order('created_at')
      setSupplements(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function logEvent(suppId: string, suppName: string, event: string, note?: string) {
    if (!userId) return
    await supabase.from('regimen_events').insert({
      patient_id: userId,
      supplement_id: suppId,
      supplement_name: suppName,
      event,
      initiated_by: 'patient',
      date: new Date().toISOString(),
      note: note ?? null,
    })
  }

  async function setStatus(supp: Supplement, newStatus: SupStatus, event: string, note?: string) {
    await supabase
      .from('supplements')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', supp.id)
    await logEvent(supp.id, supp.name, event, note)
    setSupplements(prev => prev.map(s => s.id === supp.id ? { ...s, status: newStatus } : s))
  }

  async function handleSave() {
    if (!form.name.trim() || !userId) return
    setSaving(true)
    const { data: row, error } = await supabase
      .from('supplements')
      .insert({
        patient_id: userId,
        name: form.name.trim(),
        dose: form.dose.trim() || null,
        timing: form.timing || null,
        cadence: form.cadence || null,
        intake_conditions: form.intakeConditions.trim() || null,
        notes_for_patient: form.notes.trim() || null,
        purchase_source: form.purchaseSource !== 'None' ? form.purchaseSource : null,
        buy_link: form.buyLink.trim() || null,
        source: 'self',
        status: form.startingStatus,
      })
      .select()
      .single()
    if (!error && row) {
      await logEvent(row.id, row.name, 'added')
      setSupplements(prev => [...prev, row])
    }
    setSaving(false)
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
  }

  async function handleDiscontinueConfirm(supp: Supplement) {
    await setStatus(supp, 'discontinued', 'discontinued', discontinueNote || undefined)
    setDiscontinueId(null)
    setDiscontinueNote('')
    setExpandedId(null)
  }

  const toBuy = supplements.filter(s => s.status === 'tobuy')
  const planSupps = supplements.filter(s => ['notstarted', 'active', 'paused'].includes(s.status))
  const discSupps = supplements.filter(s => s.status === 'discontinued')

  const timingGroups = TIMING_ORDER
    .map(t => ({ timing: t, items: planSupps.filter(s => (s.timing || 'As needed') === t) }))
    .filter(g => g.items.length > 0)

  function renderCard(supp: Supplement) {
    const open = expandedId === supp.id
    const confirming = discontinueId === supp.id

    return (
      <div
        key={supp.id}
        style={{
          background: 'var(--color-surface-raised)',
          borderRadius: '12px',
          marginBottom: '8px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div
          onClick={() => setExpandedId(open ? null : supp.id)}
          style={{ cursor: 'pointer', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor(supp.status) }} />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{supp.name}</span>
            </div>
            {(supp.dose || supp.timing || supp.cadence) && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 16 }}>
                {supp.dose && <Pill>{supp.dose}</Pill>}
                {supp.timing && <Pill>{supp.timing}</Pill>}
                {supp.cadence && <Pill>{supp.cadence}</Pill>}
              </div>
            )}
          </div>
          <span style={{ fontSize: '16px', color: 'var(--color-text-hint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, marginTop: 1, lineHeight: 1 }}>›</span>
        </div>

        {/* Expanded body */}
        {open && (
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px 14px' }}>
            {supp.titration_instructions && (
              <div style={{ background: 'var(--color-warning-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-warning)', display: 'block', marginBottom: 2 }}>Titration schedule</span>
                <span style={{ fontSize: '12px' }}>{supp.titration_instructions}</span>
              </div>
            )}
            {supp.notes_for_patient && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{supp.notes_for_patient}</p>
            )}
            {supp.intake_conditions && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: 10 }}>Take: {supp.intake_conditions}</p>
            )}

            {!confirming && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {supp.status === 'notstarted' && (
                  <button onClick={() => setStatus(supp, 'active', 'started')} style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Mark as started
                  </button>
                )}
                {supp.status === 'active' && (
                  <button onClick={() => setStatus(supp, 'paused', 'paused')} style={{ padding: '8px 14px', background: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Pause
                  </button>
                )}
                {supp.status === 'paused' && (
                  <button onClick={() => setStatus(supp, 'active', 'resumed')} style={{ padding: '8px 14px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Resume
                  </button>
                )}
                <button onClick={() => setDiscontinueId(supp.id)} style={{ padding: '8px 14px', background: 'none', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
                  Discontinue
                </button>
                {supp.buy_link && (
                  <a href={supp.buy_link} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 14px', background: 'var(--color-gold-bg)', color: 'var(--color-gold)', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>
                    Buy on {supp.purchase_source ?? 'Store'} →
                  </a>
                )}
              </div>
            )}

            {confirming && (
              <div style={{ background: 'var(--color-danger-light)', borderRadius: 8, padding: '12px', marginTop: 4 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-danger)', marginBottom: 8 }}>Discontinue {supp.name}?</p>
                <input
                  type="text"
                  value={discontinueNote}
                  onChange={e => setDiscontinueNote(e.target.value)}
                  placeholder="Reason (optional)"
                  style={{ ...input, background: '#fff', marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setDiscontinueId(null); setDiscontinueNote('') }} style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleDiscontinueConfirm(supp)} style={{ flex: 1, padding: '8px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <div style={{ height: 28, background: 'var(--color-border)', borderRadius: 8, width: '35%', marginBottom: 6 }} />
        <div style={{ height: 14, background: 'var(--color-border)', borderRadius: 6, width: '55%', marginBottom: 28 }} />
        {[1, 2, 3].map(i => <div key={i} style={{ height: 68, background: 'var(--color-border)', borderRadius: 12, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', margin: 0, marginBottom: 4 }}>My Plan</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Your current tracker</p>
        </div>
        <a href="/app/activity" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'var(--color-primary-light)', textDecoration: 'none', fontSize: '15px' }} title="View history">
          ⏱
        </a>
      </div>

      {/* TO BUY */}
      {toBuy.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionHead}>To Buy</h2>
          {toBuy.map(supp => (
            <div key={supp.id} style={{ background: 'var(--color-surface-raised)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, border: '1px solid var(--color-border)' }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{supp.name}</span>
                {supp.dose && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: 8 }}>{supp.dose}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {supp.buy_link && (
                  <a href={supp.buy_link} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 11px', background: 'var(--color-gold-bg)', color: 'var(--color-gold)', borderRadius: 6, fontSize: '11px', fontWeight: 500, textDecoration: 'none' }}>
                    {supp.purchase_source ?? 'Buy'} →
                  </a>
                )}
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`${supp.name}${supp.dose ? ' ' + supp.dose : ''}`)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 11px', background: 'var(--color-primary-light)', color: 'var(--color-primary-mid)', borderRadius: 6, fontSize: '11px', textDecoration: 'none' }}>
                  Search
                </a>
                <button onClick={() => setStatus(supp, 'notstarted', 'purchased')} style={{ padding: '5px 11px', background: 'var(--color-success-light)', color: 'var(--color-success)', border: 'none', borderRadius: 6, fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                  Got it ✓
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* MY PLAN */}
      {planSupps.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionHead}>My Plan</h2>
          {timingGroups.map(({ timing, items }) => (
            <div key={timing} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{timing}</p>
              {items.map(s => renderCard(s))}
            </div>
          ))}
        </section>
      )}

      {/* Empty state */}
      {planSupps.length === 0 && toBuy.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>No supplements yet</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Tap + to add your first supplement</p>
        </div>
      )}

      {/* DISCONTINUED */}
      {discSupps.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <button onClick={() => setShowDiscontinued(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: showDiscontinued ? 10 : 0 }}>
            <span style={sectionHead}>Discontinued ({discSupps.length})</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-hint)', display: 'inline-block', transform: showDiscontinued ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', lineHeight: 1 }}>›</span>
          </button>
          {showDiscontinued && discSupps.map(supp => (
            <div key={supp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E24B4A', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{supp.name}</span>
              {supp.dose && <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginLeft: 2 }}>{supp.dose}</span>}
            </div>
          ))}
        </section>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddSheet(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)',
          right: 'max(16px, calc((100vw - 500px) / 2 + 16px))',
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--color-primary)', color: '#fff',
          border: 'none', cursor: 'pointer',
          fontSize: '26px', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(26,74,58,0.28)',
          zIndex: 50,
        }}
      >
        +
      </button>

      {/* Add supplement sheet */}
      <BottomSheet open={showAddSheet} onClose={() => { setShowAddSheet(false); setForm(EMPTY_FORM) }} title="Add supplement">
        <label style={label}>Name *</label>
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Magnesium Glycinate" style={input} />

        <label style={label}>Dose</label>
        <input type="text" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="e.g. 400mg, 2 capsules" style={input} />

        <label style={label}>Timing</label>
        <select value={form.timing} onChange={e => setForm(f => ({ ...f, timing: e.target.value }))} style={input}>
          <option value="">— Not set —</option>
          {['Morning', 'Midday', 'Afternoon', 'Evening', 'Bedtime', 'As needed'].map(t => <option key={t}>{t}</option>)}
        </select>

        <label style={label}>Cadence</label>
        <select value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))} style={input}>
          <option value="">— Not set —</option>
          {['Daily', '2x/week', '3x/week', 'Every other day', 'As needed'].map(c => <option key={c}>{c}</option>)}
        </select>

        <label style={label}>Intake conditions</label>
        <input type="text" value={form.intakeConditions} onChange={e => setForm(f => ({ ...f, intakeConditions: e.target.value }))} placeholder="e.g. with food, before bed" style={input} />

        <label style={label}>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes" rows={3} style={{ ...input, resize: 'vertical' as const }} />

        <label style={label}>Purchase source</label>
        <select value={form.purchaseSource} onChange={e => setForm(f => ({ ...f, purchaseSource: e.target.value }))} style={input}>
          {['None', 'Fullscript', 'Amazon', 'iHerb', 'Brand Direct', 'Pharmacy (Rx)', 'Pharmacy (OTC)', 'External link'].map(s => <option key={s}>{s}</option>)}
        </select>

        {!NO_BUYLINK_SOURCES.has(form.purchaseSource) && (
          <>
            <label style={label}>Buy link</label>
            <input type="url" value={form.buyLink} onChange={e => setForm(f => ({ ...f, buyLink: e.target.value }))} placeholder="https://" style={input} />
          </>
        )}

        <label style={label}>Add to</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {([['tobuy', 'To Buy list'], ['notstarted', 'My Plan directly']] as const).map(([val, lbl]) => (
            <label key={val} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: `1px solid ${form.startingStatus === val ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, cursor: 'pointer', background: form.startingStatus === val ? 'var(--color-primary-pale)' : 'transparent' }}>
              <input type="radio" name="startingStatus" value={val} checked={form.startingStatus === val} onChange={() => setForm(f => ({ ...f, startingStatus: val }))} style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '12px' }}>{lbl}</span>
            </label>
          ))}
        </div>

        <button onClick={handleSave} disabled={!form.name.trim() || saving} style={{ display: 'block', width: '100%', padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: !form.name.trim() || saving ? 'not-allowed' : 'pointer', opacity: !form.name.trim() || saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Add supplement'}
        </button>
      </BottomSheet>
    </div>
  )
}

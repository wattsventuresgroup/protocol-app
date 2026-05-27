'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '../components/BottomSheet'
import HamburgerMenu from '../components/HamburgerMenu'
import SmartSearch from '@/lib/components/SmartSearch'

type SupStatus = 'tobuy' | 'notstarted' | 'active' | 'paused' | 'discontinued'

type Supplement = {
  id: string
  patient_id: string
  name: string
  type: string | null
  brand: string | null
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

type RegimenEvent = {
  id: string
  supplement_id: string | null
  supplement_name: string
  event: string
  date: string
  note: string | null
  initiated_by: string
}

const supabase = createClient()

const TIMING_ORDER = ['Morning', 'Midday', 'Evening', 'Bedtime', 'Multiple times daily', 'Anytime']

const MULTI_DOSE_CADENCES = new Set(['Twice daily', 'Three times daily (with each meal)'])

function timingGroup(timing: string | null, cadence: string | null): string {
  if (cadence && MULTI_DOSE_CADENCES.has(cadence)) return 'Multiple times daily'
  if (!timing || timing === 'As needed') return 'Anytime'
  return timing
}

const STATUS_LABELS: Record<SupStatus, string> = {
  tobuy: 'To buy',
  notstarted: 'Not started',
  active: 'Active',
  paused: 'Paused',
  discontinued: 'Discontinued',
}

const EVENT_LABELS: Record<string, string> = {
  started: 'Started',
  paused: 'Paused',
  resumed: 'Resumed',
  discontinued: 'Discontinued',
  added: 'Added',
  purchased: 'Purchased',
  removed: 'Removed',
}

const TIMING_MAP: Record<string, string> = {
  morning: 'Morning', midday: 'Midday', evening: 'Evening', bedtime: 'Bedtime',
  'as needed': 'As needed', asneeded: 'As needed', 'with meals': '',
}
const CADENCE_MAP: Record<string, string> = {
  'once daily': 'Once daily', daily: 'Once daily',
  'twice daily': 'Twice daily',
  'three times daily': 'Three times daily (with each meal)',
  'three times daily (with each meal)': 'Three times daily (with each meal)',
  'every other day': 'Every other day',
  weekly: 'Weekly', 'as needed': 'As needed',
}
function mapTiming(t?: string): string { return t ? (TIMING_MAP[t.toLowerCase()] ?? t) : '' }
function mapCadence(c?: string): string { return c ? (CADENCE_MAP[c.toLowerCase()] ?? c) : '' }

const EMPTY_FORM = {
  name: '',
  type: 'supplement' as string,
  brand: '',
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TypeBadge({ type }: { type: string | null }) {
  const t = type ?? 'supplement'
  const styles: Record<string, { bg: string; color: string }> = {
    supplement: { bg: 'var(--color-primary-light)', color: 'var(--color-primary-mid)' },
    medication: { bg: 'var(--color-info-light)', color: 'var(--color-info)' },
    nutrition: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  }
  const labels: Record<string, string> = {
    supplement: 'Supplement',
    medication: 'Medication',
    nutrition: 'Nutrition',
  }
  const s = styles[t] ?? styles.supplement
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: '10px', fontWeight: 500, background: s.bg, color: s.color, flexShrink: 0 }}>
      {labels[t] ?? t}
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

const frmLbl: React.CSSProperties = {
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

const cardBase: React.CSSProperties = {
  background: 'var(--color-surface-raised)',
  borderRadius: '12px',
  marginBottom: '8px',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  overflow: 'hidden',
}

const NO_BUYLINK_SOURCES = new Set(['None', 'Pharmacy (Rx)', 'Pharmacy (OTC)'])

export default function PlanPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [events, setEvents] = useState<RegimenEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showDiscontinued, setShowDiscontinued] = useState(false)
  const [discontinueId, setDiscontinueId] = useState<string | null>(null)
  const [discontinueNote, setDiscontinueNote] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingSupp, setEditingSupp] = useState<Supplement | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSearchId, setExpandedSearchId] = useState<string | null>(null)
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [searchApplied, setSearchApplied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data: supps }, { data: evts }] = await Promise.all([
        supabase.from('supplements').select('*').eq('patient_id', user.id).order('sort_order').order('created_at'),
        supabase.from('regimen_events').select('*').eq('patient_id', user.id).order('date', { ascending: false }),
      ])
      setSupplements(supps ?? [])
      setEvents(evts ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function logEvent(suppId: string, suppName: string, event: string, note?: string, uid?: string) {
    const effectiveUid = uid ?? userId
    if (!effectiveUid) return
    const payload = {
      patient_id: effectiveUid,
      supplement_id: suppId,
      supplement_name: suppName,
      event,
      initiated_by: 'patient',
      date: new Date().toISOString(),
      note: note ?? null,
    }
    const { data: row } = await supabase.from('regimen_events').insert(payload).select().single()
    if (row) setEvents(prev => [row, ...prev])
  }

  async function setStatus(supp: Supplement, newStatus: SupStatus, event: string, note?: string) {
    await supabase.from('supplements').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', supp.id)
    await logEvent(supp.id, supp.name, event, note)
    setSupplements(prev => prev.map(s => s.id === supp.id ? { ...s, status: newStatus } : s))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    const { data: row, error } = await supabase
      .from('supplements')
      .insert({
        patient_id: user.id,
        name: form.name.trim(),
        type: form.type,
        brand: form.brand.trim() || null,
        dose: form.dose.trim() || null,
        timing: MULTI_DOSE_CADENCES.has(form.cadence) ? null : (form.timing || null),
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
      await logEvent(row.id, row.name, 'added', undefined, user.id)
      setSupplements(prev => [...prev, row])
    }
    setSaving(false)
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
  }

  async function handleEditSave() {
    if (!form.name.trim() || !editingSupp) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    const updates = {
      name: form.name.trim(),
      type: form.type,
      brand: form.brand.trim() || null,
      dose: form.dose.trim() || null,
      timing: MULTI_DOSE_CADENCES.has(form.cadence) ? null : (form.timing || null),
      cadence: form.cadence || null,
      intake_conditions: form.intakeConditions.trim() || null,
      notes_for_patient: form.notes.trim() || null,
      purchase_source: form.purchaseSource !== 'None' ? form.purchaseSource : null,
      buy_link: form.buyLink.trim() || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('supplements').update(updates).eq('id', editingSupp.id)
    await logEvent(editingSupp.id, form.name.trim(), 'added', 'edited', user.id)
    setSupplements(prev => prev.map(s => s.id === editingSupp!.id ? { ...s, ...updates } : s))
    setSaving(false)
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
    setEditingSupp(null)
  }

  async function handleDiscontinueConfirm(supp: Supplement) {
    await setStatus(supp, 'discontinued', 'discontinued', discontinueNote || undefined)
    setDiscontinueId(null)
    setDiscontinueNote('')
    setExpandedId(null)
  }

  async function handleDeleteSupplement(supp: Supplement) {
    if (!userId) return
    await logEvent(supp.id, supp.name, 'removed')
    await supabase.from('supplements').delete().eq('id', supp.id)
    setSupplements(prev => prev.filter(s => s.id !== supp.id))
    setDeleteConfirmId(null)
  }

  function openEditSheet(supp: Supplement) {
    setEditingSupp(supp)
    setForm({
      name: supp.name,
      type: supp.type ?? 'supplement',
      brand: supp.brand ?? '',
      dose: supp.dose ?? '',
      timing: supp.timing ?? '',
      cadence: supp.cadence ?? '',
      intakeConditions: supp.intake_conditions ?? '',
      notes: supp.notes_for_patient ?? '',
      purchaseSource: supp.purchase_source ?? 'None',
      buyLink: supp.buy_link ?? '',
      startingStatus: supp.status,
    })
    setShowAddSheet(true)
  }

  function closeSheet() {
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
    setEditingSupp(null)
  }

  function closeSearch() {
    setShowSearch(false)
    setSearchQuery('')
    setExpandedSearchId(null)
    setSearchFrom('')
    setSearchTo('')
    setSearchApplied(false)
  }

  const toBuy = supplements.filter(s => s.status === 'tobuy')
  const planSupps = supplements.filter(s => ['notstarted', 'active', 'paused'].includes(s.status))
  const discSupps = supplements.filter(s => s.status === 'discontinued')

  const timingGroups = TIMING_ORDER
    .map(t => ({ timing: t, items: planSupps.filter(s => timingGroup(s.timing, s.cadence) === t) }))
    .filter(g => g.items.length > 0)

  const hasFilter = searchQuery.trim() || searchApplied
  const searchResults = hasFilter ? supplements.filter(s => {
    if (searchQuery.trim() && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (searchApplied) {
      const d = s.created_at.slice(0, 10)
      if (searchFrom && d < searchFrom) return false
      if (searchTo && d > searchTo) return false
    }
    return true
  }) : []

  function renderCard(supp: Supplement) {
    const open = expandedId === supp.id
    const confirming = discontinueId === supp.id
    const secondaryLine = [supp.dose, supp.cadence, supp.intake_conditions].filter(Boolean).join(' · ')

    return (
      <div key={supp.id} style={cardBase}>
        <div
          onClick={() => setExpandedId(open ? null : supp.id)}
          style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: (supp.brand || secondaryLine) ? 4 : 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor(supp.status) }} />
              <TypeBadge type={supp.type} />
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supp.name}</span>
            </div>
            {supp.brand && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', margin: '0 0 2px', paddingLeft: 14 }}>{supp.brand}</p>
            )}
            {secondaryLine && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, paddingLeft: 14 }}>{secondaryLine}</p>
            )}
            {supp.status === 'notstarted' && (
              <button
                onClick={e => { e.stopPropagation(); setStatus(supp, 'active', 'started') }}
                style={{ padding: '4px 10px', background: 'transparent', color: '#1D9E75', border: '1px solid #1D9E75', borderRadius: 6, fontSize: '11px', cursor: 'pointer', marginTop: 6, marginLeft: 14, fontFamily: 'var(--font-sans)', fontWeight: 500 }}
              >
                Mark as started
              </button>
            )}
            {supp.status === 'paused' && (
              <button
                onClick={e => { e.stopPropagation(); setStatus(supp, 'active', 'resumed') }}
                style={{ padding: '4px 10px', background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 6, fontSize: '11px', cursor: 'pointer', marginTop: 6, marginLeft: 14, fontFamily: 'var(--font-sans)' }}
              >
                Resume
              </button>
            )}
          </div>
          <span style={{ fontSize: '16px', color: 'var(--color-text-hint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, marginTop: 1, lineHeight: 1 }}>›</span>
        </div>

        {open && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '12px 16px 16px' }}>
            {supp.titration_instructions && (
              <div style={{ background: 'var(--color-warning-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-warning)', display: 'block', marginBottom: 2 }}>Titration schedule</span>
                <span style={{ fontSize: '12px' }}>{supp.titration_instructions}</span>
              </div>
            )}
            {supp.notes_for_patient ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>{supp.notes_for_patient}</p>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginBottom: 12 }}>No notes.</p>
            )}

            {!confirming && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {supp.status === 'notstarted' && (
                  <button onClick={() => setStatus(supp, 'active', 'started')} style={{ padding: '7px 12px', background: 'transparent', color: '#1D9E75', border: '1px solid #1D9E75', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Mark as started
                  </button>
                )}
                {supp.status === 'active' && (
                  <button onClick={() => setStatus(supp, 'paused', 'paused')} style={{ padding: '7px 12px', background: 'transparent', color: 'var(--color-warning)', border: '1px solid var(--color-warning)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
                    Pause
                  </button>
                )}
                {supp.status === 'paused' && (
                  <button onClick={() => setStatus(supp, 'active', 'resumed')} style={{ padding: '7px 12px', background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
                    Resume
                  </button>
                )}
                <button onClick={() => openEditSheet(supp)} style={{ padding: '7px 12px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => setDiscontinueId(supp.id)} style={{ padding: '7px 12px', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
                  Discontinue
                </button>
                {supp.buy_link && (
                  <a href={supp.buy_link} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 12px', background: 'var(--color-gold-bg)', color: 'var(--color-gold)', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>
                    Buy on {supp.purchase_source ?? 'Store'} →
                  </a>
                )}
              </div>
            )}

            {confirming && (
              <div style={{ background: 'var(--color-danger-light)', borderRadius: 8, padding: '12px' }}>
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

  function renderToBuyCard(supp: Supplement) {
    const confirming = deleteConfirmId === supp.id

    return (
      <div key={supp.id} style={cardBase}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: supp.dose ? 4 : 10 }}>
            <TypeBadge type={supp.type} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{supp.name}</span>
          </div>
          {supp.dose && (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>{supp.dose}</p>
          )}

          {!confirming && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {supp.buy_link && (
                <a href={supp.buy_link} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 11px', background: 'var(--color-gold-bg)', color: 'var(--color-gold)', borderRadius: 6, fontSize: '11px', fontWeight: 500, textDecoration: 'none' }}>
                  {supp.purchase_source ?? 'Buy'} →
                </a>
              )}
              <a href={`https://www.google.com/search?q=${encodeURIComponent(supp.name)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 11px', background: 'var(--color-primary-light)', color: 'var(--color-primary-mid)', borderRadius: 6, fontSize: '11px', textDecoration: 'none' }}>
                Search
              </a>
              <button onClick={() => setStatus(supp, 'notstarted', 'purchased')} style={{ padding: '5px 11px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}>
                Got it
              </button>
              <button onClick={() => openEditSheet(supp)} style={{ padding: '5px 11px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => setDeleteConfirmId(supp.id)} style={{ padding: '5px 11px', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          )}

          {confirming && (
            <div style={{ background: 'var(--color-danger-light)', borderRadius: 8, padding: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-danger)', marginBottom: 12 }}>Remove {supp.name}?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                  Cancel
                </button>
                <button onClick={() => handleDeleteSupplement(supp)} style={{ flex: 1, padding: '8px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <div style={{ height: 36, background: 'var(--color-border)', borderRadius: 8, width: '25%', marginLeft: 'auto', marginBottom: 20 }} />
        {[1, 2, 3].map(i => <div key={i} style={{ height: 68, background: 'var(--color-border)', borderRadius: 12, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px 0' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: showSearch ? 12 : 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', lineHeight: 1.15, margin: '0 0 2px' }}>
            My Plan
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Your daily protocol</p>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!showSearch && (
            <a href="/app/import" style={{ fontSize: '11px', color: 'var(--color-primary-mid)', textDecoration: 'none', padding: '5px 10px', border: '1px solid var(--color-primary-mid)', borderRadius: 6 }}>
              Import
            </a>
          )}
          <button
            onClick={() => showSearch ? closeSearch() : setShowSearch(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: showSearch ? 'var(--color-primary)' : 'var(--color-text-hint)', display: 'flex', alignItems: 'center' }}
          >
            {showSearch ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </button>
          <HamburgerMenu />
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setExpandedSearchId(null) }}
              placeholder="Search supplements..."
              autoFocus
              style={{ ...input, marginBottom: 0, flex: 1 }}
            />
            <button
              onClick={closeSearch}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 500, padding: '4px 0', flexShrink: 0, fontFamily: 'var(--font-sans)' }}
            >
              Cancel
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <input
              type="date"
              value={searchFrom}
              onChange={e => setSearchFrom(e.target.value)}
              style={{ ...input, flex: 1, minWidth: 120, marginBottom: 0, fontSize: '12px', padding: '8px 10px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-hint)', flexShrink: 0 }}>to</span>
            <input
              type="date"
              value={searchTo}
              onChange={e => setSearchTo(e.target.value)}
              style={{ ...input, flex: 1, minWidth: 120, marginBottom: 0, fontSize: '12px', padding: '8px 10px' }}
            />
            <button
              onClick={() => setSearchApplied(true)}
              style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
            >
              Apply
            </button>
            <button
              onClick={() => { setSearchFrom(''); setSearchTo(''); setSearchApplied(false) }}
              style={{ padding: '8px 12px', background: 'none', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
            >
              Clear
            </button>
          </div>

          {hasFilter && (
            <div style={{ marginTop: 4 }}>
              {searchResults.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-hint)', padding: '12px 0' }}>No supplements found</p>
              ) : (
                searchResults.map(supp => {
                  const suppEvents = events.filter(e => e.supplement_id === supp.id)
                  const isOpen = expandedSearchId === supp.id
                  return (
                    <div key={supp.id} style={cardBase}>
                      <div onClick={() => setExpandedSearchId(isOpen ? null : supp.id)} style={{ cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(supp.status), flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{supp.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginLeft: 8 }}>{STATUS_LABELS[supp.status]}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', flexShrink: 0 }}>{formatDate(supp.created_at)}</span>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 16px 12px' }}>
                          {suppEvents.length === 0 ? (
                            <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>No history yet</p>
                          ) : suppEvents.map(ev => (
                            <div key={ev.id} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-border)', flexShrink: 0, marginTop: 5 }} />
                              <div>
                                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{EVENT_LABELS[ev.event] ?? ev.event}</span>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginLeft: 6 }}>{formatDate(ev.date)}</span>
                                {ev.note && <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 2 }}>{ev.note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {!showSearch && (
        <>
          {/* TO BUY */}
          {toBuy.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={sectionHead}>To Buy</h2>
              {toBuy.map(supp => renderToBuyCard(supp))}
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
                <span style={sectionHead}>Discontinued · {discSupps.length}</span>
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
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddSheet(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)',
          right: 'max(16px, calc((100vw - var(--app-max-width)) / 2 + 16px))',
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

      {/* Add / Edit supplement sheet */}
      <BottomSheet open={showAddSheet} onClose={closeSheet} title={editingSupp ? 'Edit supplement' : 'Add supplement'}>
        <label style={frmLbl}>Name *</label>
        <SmartSearch
          placeholder="e.g. Magnesium Glycinate"
          databases={['supplements', 'medications']}
          value={form.name}
          onChange={v => setForm(f => ({ ...f, name: v }))}
          onSelect={entry => setForm(f => ({
            ...f,
            name: entry.name,
            type: entry.type || 'supplement',
            brand: entry.brand || '',
            dose: entry.dose || '',
            timing: mapTiming(entry.timing),
            cadence: mapCadence(entry.cadence),
            intakeConditions: entry.intakeConditions || '',
            notes: entry.notes || '',
          }))}
        />

        <label style={frmLbl}>Brand</label>
        <input type="text" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Designs for Health, Thorne" style={input} />

        <label style={frmLbl}>Type</label>
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={input}>
          <option value="supplement">Supplement</option>
          <option value="medication">Medication</option>
          <option value="nutrition">Nutrition</option>
        </select>

        <label style={frmLbl}>Dose</label>
        <input type="text" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="e.g. 400mg, 2 capsules" style={input} />

        <label style={frmLbl}>Cadence</label>
        <select value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))} style={input}>
          <option value="">— Not set —</option>
          {['Once daily', 'Twice daily', 'Three times daily (with each meal)', 'Every other day', 'Weekly', 'As needed'].map(c => <option key={c}>{c}</option>)}
        </select>

        {MULTI_DOSE_CADENCES.has(form.cadence) ? (
          <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginBottom: 14, fontStyle: 'italic' }}>Timing varies — based on meal schedule</p>
        ) : (
          <>
            <label style={frmLbl}>Time of Day</label>
            <select value={form.timing} onChange={e => setForm(f => ({ ...f, timing: e.target.value }))} style={input}>
              <option value="">No preference</option>
              {['Morning', 'Midday', 'Evening', 'Bedtime', 'As needed'].map(t => <option key={t}>{t}</option>)}
            </select>
          </>
        )}

        <label style={frmLbl}>Intake conditions</label>
        <input type="text" value={form.intakeConditions} onChange={e => setForm(f => ({ ...f, intakeConditions: e.target.value }))} placeholder="e.g. with food, before bed" style={input} />

        <label style={frmLbl}>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes" rows={3} style={{ ...input, resize: 'vertical' as const }} />

        <label style={frmLbl}>Purchase source</label>
        <select value={form.purchaseSource} onChange={e => setForm(f => ({ ...f, purchaseSource: e.target.value }))} style={input}>
          {['None', 'Fullscript', 'Amazon', 'iHerb', 'Brand Direct', 'Pharmacy (Rx)', 'Pharmacy (OTC)', 'External link'].map(s => <option key={s}>{s}</option>)}
        </select>

        {!NO_BUYLINK_SOURCES.has(form.purchaseSource) && (
          <>
            <label style={frmLbl}>Buy link</label>
            <input type="url" value={form.buyLink} onChange={e => setForm(f => ({ ...f, buyLink: e.target.value }))} placeholder="https://" style={input} />
          </>
        )}

        {!editingSupp && (
          <>
            <label style={frmLbl}>Add to</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {([['tobuy', 'To Buy list'], ['notstarted', 'My Plan directly']] as const).map(([val, lbl]) => (
                <label key={val} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: `1px solid ${form.startingStatus === val ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, cursor: 'pointer', background: form.startingStatus === val ? 'var(--color-primary-pale)' : 'transparent' }}>
                  <input type="radio" name="startingStatus" value={val} checked={form.startingStatus === val} onChange={() => setForm(f => ({ ...f, startingStatus: val }))} style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px' }}>{lbl}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <button
          onClick={editingSupp ? handleEditSave : handleSave}
          disabled={!form.name.trim() || saving}
          style={{ display: 'block', width: '100%', padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: !form.name.trim() || saving ? 'not-allowed' : 'pointer', opacity: !form.name.trim() || saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : editingSupp ? 'Save changes' : 'Add supplement'}
        </button>
      </BottomSheet>
    </div>
  )
}

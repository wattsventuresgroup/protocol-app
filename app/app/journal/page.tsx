'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '../components/BottomSheet'
import HamburgerMenu from '../components/HamburgerMenu'

type Symptom = { name: string; scale: string }

type JournalConfig = {
  id: string
  patient_id: string
  cadence: string
  symptoms: Symptom[]
  allow_free_text: boolean
  instructions: string | null
}

type JournalEntry = {
  id: string
  entry_date: string
  entry_type: 'checkin' | 'freetext'
  text: string | null
  symptoms: Record<string, string> | null
  linked_supplement_id: string | null
  created_at: string
}

type ActiveSupplement = { id: string; name: string }

const supabase = createClient()

const SCALES: Record<string, string[]> = {
  'Same/Improving/Worsening': ['Same', 'Improving', 'Worsening'],
  'Present/No Impact': ['Present', 'No Impact'],
}

const EMPTY_CONFIG = {
  cadence: 'Weekly',
  symptoms: [{ name: '', scale: 'Same/Improving/Worsening' }] as Symptom[],
  allowFreeText: true,
  instructions: '',
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

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '5px',
}

function formatEntryDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Today'
  if (dateStr === yest) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getEntryPreview(entry: JournalEntry): string {
  if (entry.text) return entry.text
  if (entry.symptoms) {
    const pairs = Object.entries(entry.symptoms)
    if (pairs.length > 0) return pairs.map(([k, v]) => `${k}: ${v}`).join(', ')
  }
  return ''
}

function BarChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function StethoscopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

export default function JournalPage() {
  const [config, setConfig] = useState<JournalConfig | null | undefined>(undefined)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [activeSupps, setActiveSupps] = useState<ActiveSupplement[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showConfigSheet, setShowConfigSheet] = useState(false)
  const [showCheckin, setShowCheckin] = useState(false)
  const [noteFormType, setNoteFormType] = useState<'symptom' | 'care' | null>(null)
  const [showInlineSetup, setShowInlineSetup] = useState(false)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editText, setEditText] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [searchApplied, setSearchApplied] = useState(false)

  const [configForm, setConfigForm] = useState(EMPTY_CONFIG)

  const [ciDate, setCiDate] = useState(new Date().toISOString().slice(0, 10))
  const [ciRatings, setCiRatings] = useState<Record<string, string>>({})
  const [ciText, setCiText] = useState('')

  const [ntDate, setNtDate] = useState(new Date().toISOString().slice(0, 10))
  const [ntText, setNtText] = useState('')
  const [ntSuppId, setNtSuppId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: cfg }, { data: ents }, { data: supps }] = await Promise.all([
        supabase.from('journal_configs').select('*').eq('patient_id', user.id).maybeSingle(),
        supabase.from('journal_entries').select('*').eq('patient_id', user.id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('supplements').select('id, name').eq('patient_id', user.id).in('status', ['active', 'paused', 'notstarted']),
      ])

      setConfig(cfg ?? null)
      setEntries(ents ?? [])
      setActiveSupps(supps ?? [])

      if (cfg) {
        setConfigForm({
          cadence: cfg.cadence,
          symptoms: cfg.symptoms?.length ? cfg.symptoms : [{ name: '', scale: 'Same/Improving/Worsening' }],
          allowFreeText: cfg.allow_free_text,
          instructions: cfg.instructions ?? '',
        })
      }
    }
    load()
  }, [])

  async function saveConfig() {
    if (!userId) return
    setSaving(true)
    const cleanSymptoms = configForm.symptoms.filter(s => s.name.trim())
    const { data: row } = await supabase
      .from('journal_configs')
      .upsert({
        patient_id: userId,
        cadence: configForm.cadence,
        symptoms: cleanSymptoms,
        allow_free_text: configForm.allowFreeText,
        instructions: configForm.instructions.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'patient_id' })
      .select()
      .single()
    if (row) setConfig(row)
    setSaving(false)
    setShowConfigSheet(false)
  }

  async function saveInlineSetup() {
    if (!userId) return
    setSaving(true)
    const cleanSymptoms = configForm.symptoms.filter(s => s.name.trim())
    const { data: row } = await supabase
      .from('journal_configs')
      .upsert({
        patient_id: userId,
        cadence: configForm.cadence,
        symptoms: cleanSymptoms,
        allow_free_text: configForm.allowFreeText,
        instructions: configForm.instructions.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'patient_id' })
      .select()
      .single()
    if (row) {
      setConfig(row)
      setShowInlineSetup(false)
      setShowCheckin(true)
    }
    setSaving(false)
  }

  async function saveCheckin() {
    if (!userId) return
    setSaving(true)
    const { data: row } = await supabase
      .from('journal_entries')
      .insert({
        patient_id: userId,
        entry_date: ciDate,
        entry_type: 'checkin',
        symptoms: Object.keys(ciRatings).length ? ciRatings : null,
        text: ciText.trim() || null,
      })
      .select()
      .single()
    if (row) setEntries(prev => [row, ...prev])
    setSaving(false)
    setShowCheckin(false)
    setCiRatings({})
    setCiText('')
    setCiDate(new Date().toISOString().slice(0, 10))
  }

  async function saveNote() {
    if (!userId || !ntText.trim()) return
    setSaving(true)
    const { data: row } = await supabase
      .from('journal_entries')
      .insert({
        patient_id: userId,
        entry_date: ntDate,
        entry_type: 'freetext',
        text: ntText.trim(),
        linked_supplement_id: ntSuppId || null,
      })
      .select()
      .single()
    if (row) setEntries(prev => [row, ...prev])
    setSaving(false)
    setNoteFormType(null)
    setNtText('')
    setNtSuppId('')
    setNtDate(new Date().toISOString().slice(0, 10))
  }

  async function handleDeleteEntry(entry: JournalEntry) {
    await supabase.from('journal_entries').delete().eq('id', entry.id)
    setEntries(prev => prev.filter(e => e.id !== entry.id))
    setExpandedEntryId(null)
  }

  function openEditEntry(entry: JournalEntry) {
    setEditingEntry(entry)
    setEditDate(entry.entry_date)
    setEditText(entry.text ?? '')
  }

  async function saveEditEntry() {
    if (!editingEntry || !userId) return
    setSaving(true)
    const updates = {
      entry_date: editDate,
      text: editText.trim() || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('journal_entries').update(updates).eq('id', editingEntry.id)
    setEntries(prev => prev.map(e => e.id === editingEntry!.id ? { ...e, ...updates } : e))
    setSaving(false)
    setEditingEntry(null)
  }

  function setSymptom(idx: number, field: 'name' | 'scale', value: string) {
    setConfigForm(f => ({
      ...f,
      symptoms: f.symptoms.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }))
  }

  function addSymptom() {
    if (configForm.symptoms.length >= 3) return
    setConfigForm(f => ({ ...f, symptoms: [...f.symptoms, { name: '', scale: 'Same/Improving/Worsening' }] }))
  }

  function removeSymptom(idx: number) {
    setConfigForm(f => ({ ...f, symptoms: f.symptoms.filter((_, i) => i !== idx) }))
  }

  function closeSearch() {
    setShowSearch(false)
    setSearchQuery('')
    setSearchFrom('')
    setSearchTo('')
    setSearchApplied(false)
  }

  const suppMap = Object.fromEntries(activeSupps.map(s => [s.id, s.name]))

  const hasFilter = searchQuery.trim() || searchApplied
  const filteredEntries = hasFilter ? entries.filter(entry => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const inText = entry.text?.toLowerCase().includes(q) ?? false
      const inSymptoms = entry.symptoms
        ? Object.keys(entry.symptoms).some(k => k.toLowerCase().includes(q))
        : false
      if (!inText && !inSymptoms) return false
    }
    if (searchApplied) {
      if (searchFrom && entry.entry_date < searchFrom) return false
      if (searchTo && entry.entry_date > searchTo) return false
    }
    return true
  }) : entries

  const showForms = showCheckin || noteFormType !== null || showInlineSetup

  if (config === undefined) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <div style={{ height: 36, background: 'var(--color-border)', borderRadius: 8, width: '25%', marginLeft: 'auto', marginBottom: 20 }} />
        {[1, 2].map(i => <div key={i} style={{ height: 80, background: 'var(--color-border)', borderRadius: 12, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px 32px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: showSearch ? 12 : 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', lineHeight: 1.15, margin: '0 0 2px' }}>
            Journal
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Private — only you can see this</p>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
        </div>
      )}

      {/* New entry button + config link */}
      {!showForms && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowTypeSelector(true)}
            style={{ width: '100%', padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 10 }}
          >
            + New entry
          </button>
          <button
            onClick={() => setShowConfigSheet(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: config ? 'var(--color-text-hint)' : 'var(--color-primary)', padding: 0, fontFamily: 'var(--font-sans)' }}
          >
            {config ? 'Configure check-ins' : 'Set up check-ins →'}
          </button>
        </div>
      )}

      {/* Inline setup form */}
      {showInlineSetup && (
        <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Quick setup</span>
            <button onClick={() => setShowInlineSetup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', fontSize: '18px', lineHeight: 1 }}>✕</button>
          </div>
          <label style={lbl}>How often?</label>
          <select value={configForm.cadence} onChange={e => setConfigForm(f => ({ ...f, cadence: e.target.value }))} style={input}>
            {['Daily', 'Weekly', 'Biweekly', 'As needed'].map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ ...lbl, marginBottom: 10 }}>What to track (up to 3)</label>
          {configForm.symptoms.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input type="text" value={s.name} onChange={e => setSymptom(i, 'name', e.target.value)} placeholder={`e.g. ${['Energy', 'Nausea', 'Sleep'][i] ?? 'Symptom'}`} style={{ ...input, marginBottom: 0, flex: 1 }} />
              <button onClick={() => removeSymptom(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', fontSize: '18px', lineHeight: 1, padding: '8px 4px', flexShrink: 0 }}>✕</button>
            </div>
          ))}
          {configForm.symptoms.length < 3 && (
            <button onClick={addSymptom} style={{ background: 'none', border: '1px dashed var(--color-border)', borderRadius: 8, padding: '8px 14px', fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: 14, width: '100%' }}>
              + Add symptom
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setShowInlineSetup(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
            <button onClick={saveInlineSetup} disabled={saving} style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Set up & check in'}
            </button>
          </div>
        </div>
      )}

      {/* Check-in form */}
      {showCheckin && config && (
        <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>New check-in</span>
            <button onClick={() => setShowCheckin(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', fontSize: '18px', lineHeight: 1 }}>✕</button>
          </div>

          <label style={lbl}>Date</label>
          <input type="date" value={ciDate} onChange={e => setCiDate(e.target.value)} style={input} />

          {config.symptoms?.map((symptom, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <label style={lbl}>{symptom.name || `Symptom ${i + 1}`}</label>
              {SCALES[symptom.scale] ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SCALES[symptom.scale].map(opt => (
                    <button key={opt} onClick={() => setCiRatings(r => ({ ...r, [symptom.name]: opt }))} style={{ padding: '7px 14px', borderRadius: 8, fontSize: '12px', cursor: 'pointer', border: '1px solid', borderColor: ciRatings[symptom.name] === opt ? 'var(--color-primary)' : 'var(--color-border)', background: ciRatings[symptom.name] === opt ? 'var(--color-primary-light)' : 'transparent', color: ciRatings[symptom.name] === opt ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: ciRatings[symptom.name] === opt ? 500 : 400 }}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input type="text" value={ciRatings[symptom.name] ?? ''} onChange={e => setCiRatings(r => ({ ...r, [symptom.name]: e.target.value }))} placeholder="Your notes" style={input} />
              )}
            </div>
          ))}

          {config.allow_free_text && (
            <>
              <label style={lbl}>Notes</label>
              <textarea value={ciText} onChange={e => setCiText(e.target.value)} placeholder="How are you feeling?" rows={3} style={{ ...input, resize: 'vertical' as const }} />
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setShowCheckin(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
            <button onClick={saveCheckin} disabled={saving} style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save check-in'}</button>
          </div>
        </div>
      )}

      {/* Note form */}
      {noteFormType !== null && (
        <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{noteFormType === 'symptom' ? 'Log symptom' : 'Log care visit'}</span>
            <button onClick={() => setNoteFormType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', fontSize: '18px', lineHeight: 1 }}>✕</button>
          </div>

          <label style={lbl}>Date</label>
          <input type="date" value={ntDate} onChange={e => setNtDate(e.target.value)} style={input} />

          <label style={lbl}>{noteFormType === 'symptom' ? 'Describe the symptom *' : 'Notes *'}</label>
          <textarea value={ntText} onChange={e => setNtText(e.target.value)} placeholder={noteFormType === 'symptom' ? 'e.g. Noticed improved energy, less bloating' : "e.g. Saw Dr. Smith — adjusted dosage plan"} rows={4} style={{ ...input, resize: 'vertical' as const }} />

          {activeSupps.length > 0 && (
            <>
              <label style={lbl}>Linked supplement (optional)</label>
              <select value={ntSuppId} onChange={e => setNtSuppId(e.target.value)} style={input}>
                <option value="">— None —</option>
                {activeSupps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setNoteFormType(null)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
            <button onClick={saveNote} disabled={!ntText.trim() || saving} style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: !ntText.trim() || saving ? 'not-allowed' : 'pointer', opacity: !ntText.trim() || saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* Feed */}
      {filteredEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>{hasFilter ? 'No entries match your search' : 'No entries yet'}</p>
          {!hasFilter && <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Tap + New entry to start</p>}
        </div>
      ) : (
        <div>
          {filteredEntries.map(entry => {
            const expanded = expandedEntryId === entry.id
            const isEditing = editingEntry?.id === entry.id
            const preview = getEntryPreview(entry)
            return (
              <div key={entry.id} style={{ background: 'var(--color-surface-raised)', borderRadius: 12, marginBottom: 8, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                {/* Collapsed row */}
                <div
                  onClick={() => { setExpandedEntryId(expanded ? null : entry.id); if (!expanded) setEditingEntry(null) }}
                  style={{ cursor: 'pointer', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: preview ? 4 : 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '100px', background: entry.entry_type === 'checkin' ? 'var(--color-primary-light)' : 'var(--color-surface)', color: entry.entry_type === 'checkin' ? 'var(--color-primary)' : 'var(--color-text-secondary)', border: entry.entry_type === 'checkin' ? 'none' : '1px solid var(--color-border)', flexShrink: 0 }}>
                        {entry.entry_type === 'checkin' ? 'Check-in' : 'Note'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-hint)', flexShrink: 0 }}>{formatEntryDate(entry.entry_date)}</span>
                    </div>
                    {preview && (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: '16px', color: 'var(--color-text-hint)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, lineHeight: 1 }}>›</span>
                </div>

                {/* Expanded content */}
                {expanded && !isEditing && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px 14px' }}>
                    {entry.symptoms && (
                      <div style={{ marginBottom: 10 }}>
                        {Object.entries(entry.symptoms).map(([name, rating]) => (
                          <div key={name} style={{ fontSize: '13px', marginBottom: 5, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <span style={{ color: 'var(--color-text-secondary)', minWidth: 80 }}>{name}</span>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{rating}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.text && (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.6, marginBottom: 12 }}>{entry.text}</p>
                    )}
                    {entry.linked_supplement_id && suppMap[entry.linked_supplement_id] && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginBottom: 12 }}>
                        Linked: {suppMap[entry.linked_supplement_id]}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                      <button
                        onClick={() => openEditEntry(entry)}
                        style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--color-danger)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline edit form */}
                {expanded && isEditing && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px 14px' }}>
                    <label style={lbl}>Date</label>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={input} />
                    <label style={lbl}>Notes</label>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4} style={{ ...input, resize: 'vertical' as const }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingEntry(null)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                        Cancel
                      </button>
                      <button onClick={saveEditEntry} disabled={saving} style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'var(--font-sans)' }}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Type selector sheet */}
      <BottomSheet open={showTypeSelector} onClose={() => setShowTypeSelector(false)} title="New entry">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
          {[
            {
              key: 'checkin',
              title: 'Weekly check-in',
              desc: 'Track your symptoms over time',
              icon: <BarChartIcon />,
              onClick: () => { setShowTypeSelector(false); if (config) setShowCheckin(true); else setShowInlineSetup(true) },
            },
            {
              key: 'symptom',
              title: 'Log symptom',
              desc: 'Record a symptom or observation',
              icon: <PencilIcon />,
              onClick: () => { setShowTypeSelector(false); setNoteFormType('symptom') },
            },
            {
              key: 'care',
              title: 'Log care visit',
              desc: 'Record a visit or appointment',
              icon: <StethoscopeIcon />,
              onClick: () => { setShowTypeSelector(false); setNoteFormType('care') },
            },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={opt.onClick}
              style={{ width: '100%', display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {opt.icon}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{opt.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Journal config sheet */}
      <BottomSheet open={showConfigSheet} onClose={() => setShowConfigSheet(false)} title="Configure check-ins">
        <label style={lbl}>Cadence</label>
        <select value={configForm.cadence} onChange={e => setConfigForm(f => ({ ...f, cadence: e.target.value }))} style={input}>
          {['Daily', 'Weekly', 'Biweekly', 'As needed'].map(c => <option key={c}>{c}</option>)}
        </select>

        <label style={{ ...lbl, marginBottom: 10 }}>Symptoms to track (up to 3)</label>
        {configForm.symptoms.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input type="text" value={s.name} onChange={e => setSymptom(i, 'name', e.target.value)} placeholder={`e.g. ${['Energy', 'Nausea', 'Sleep'][i] ?? 'Symptom'}`} style={{ ...input, marginBottom: 6 }} />
              <select value={s.scale} onChange={e => setSymptom(i, 'scale', e.target.value)} style={{ ...input, marginBottom: 0 }}>
                <option>Same/Improving/Worsening</option>
                <option>Present/No Impact</option>
                <option>Custom</option>
              </select>
            </div>
            <button onClick={() => removeSymptom(i)} style={{ marginTop: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', fontSize: '18px', lineHeight: 1, padding: '8px 4px', flexShrink: 0 }}>✕</button>
          </div>
        ))}
        {configForm.symptoms.length < 3 && (
          <button onClick={addSymptom} style={{ background: 'none', border: '1px dashed var(--color-border)', borderRadius: 8, padding: '8px 14px', fontSize: '12px', color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: 16, width: '100%' }}>
            + Add symptom
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <label style={{ ...lbl, marginBottom: 0 }}>Allow free text notes</label>
          <button onClick={() => setConfigForm(f => ({ ...f, allowFreeText: !f.allowFreeText }))} style={{ width: 44, height: 26, borderRadius: 13, background: configForm.allowFreeText ? 'var(--color-primary)' : 'var(--color-border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: configForm.allowFreeText ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        <label style={lbl}>Instructions (optional)</label>
        <input type="text" value={configForm.instructions} onChange={e => setConfigForm(f => ({ ...f, instructions: e.target.value }))} placeholder="e.g. Fill this out each Monday morning" style={input} />

        <button onClick={saveConfig} disabled={saving} style={{ display: 'block', width: '100%', padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
      </BottomSheet>
    </div>
  )
}

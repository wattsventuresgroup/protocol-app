'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '../components/BottomSheet'

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

export default function JournalPage() {
  const [config, setConfig] = useState<JournalConfig | null | undefined>(undefined)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [activeSupps, setActiveSupps] = useState<ActiveSupplement[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showConfigSheet, setShowConfigSheet] = useState(false)
  const [showCheckin, setShowCheckin] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [showInlineSetup, setShowInlineSetup] = useState(false)
  const [saving, setSaving] = useState(false)

  // Config form state
  const [configForm, setConfigForm] = useState(EMPTY_CONFIG)

  // Check-in form
  const [ciDate, setCiDate] = useState(new Date().toISOString().slice(0, 10))
  const [ciRatings, setCiRatings] = useState<Record<string, string>>({})
  const [ciText, setCiText] = useState('')

  // Note form
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
    setShowNote(false)
    setNtText('')
    setNtSuppId('')
    setNtDate(new Date().toISOString().slice(0, 10))
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

  const suppMap = Object.fromEntries(activeSupps.map(s => [s.id, s.name]))

  // loading state
  if (config === undefined) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <div style={{ height: 28, background: 'var(--color-border)', borderRadius: 8, width: '30%', marginBottom: 6 }} />
        <div style={{ height: 14, background: 'var(--color-border)', borderRadius: 6, width: '50%', marginBottom: 28 }} />
        {[1, 2].map(i => <div key={i} style={{ height: 80, background: 'var(--color-border)', borderRadius: 12, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', margin: 0, marginBottom: 4 }}>Journal</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Private to you</p>
        </div>
        {config !== null && (
          <button onClick={() => setShowConfigSheet(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-hint)', padding: '4px 6px' }} title="Configure check-ins">
            ⚙️
          </button>
        )}
      </div>

      {/* Action buttons */}
      {!showCheckin && !showNote && !showInlineSetup && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={() => config ? setShowCheckin(true) : setShowInlineSetup(true)} style={{ flex: 1, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            New check-in
          </button>
          <button onClick={() => setShowNote(true)} style={{ flex: 1, padding: '10px', background: 'var(--color-surface-raised)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>
            Add note
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
          {showNote && (
            <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Add note</span>
                <button onClick={() => setShowNote(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', fontSize: '18px', lineHeight: 1 }}>✕</button>
              </div>

              <label style={lbl}>Date</label>
              <input type="date" value={ntDate} onChange={e => setNtDate(e.target.value)} style={input} />

              <label style={lbl}>Note *</label>
              <textarea value={ntText} onChange={e => setNtText(e.target.value)} placeholder="What's on your mind?" rows={4} style={{ ...input, resize: 'vertical' as const }} />

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
                <button onClick={() => setShowNote(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
                <button onClick={saveNote} disabled={!ntText.trim() || saving} style={{ flex: 2, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: !ntText.trim() || saving ? 'not-allowed' : 'pointer', opacity: !ntText.trim() || saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save note'}</button>
              </div>
            </div>
          )}

          {/* Feed */}
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--color-text-secondary)' }}>
              <p style={{ fontSize: '14px', marginBottom: 6 }}>No entries yet</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Tap 'New check-in' to start</p>
            </div>
          ) : (
            <div>
              {entries.map(entry => (
                <div key={entry.id} style={{ background: 'var(--color-surface-raised)', borderRadius: 12, padding: '14px', marginBottom: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{formatEntryDate(entry.entry_date)}</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', background: entry.entry_type === 'checkin' ? 'var(--color-primary-light)' : 'var(--color-surface)', color: entry.entry_type === 'checkin' ? 'var(--color-primary)' : 'var(--color-text-secondary)', border: entry.entry_type === 'checkin' ? 'none' : '1px solid var(--color-border)' }}>
                      {entry.entry_type === 'checkin' ? 'Check-in' : 'Note'}
                    </span>
                  </div>
                  {entry.symptoms && Object.entries(entry.symptoms).map(([name, rating]) => (
                    <div key={name} style={{ fontSize: '12px', marginBottom: 4, display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{name}:</span>
                      <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{rating}</span>
                    </div>
                  ))}
                  {entry.text && (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.55, marginTop: entry.symptoms ? 8 : 0, marginBottom: 0 }}>{entry.text}</p>
                  )}
                  {entry.linked_supplement_id && suppMap[entry.linked_supplement_id] && (
                    <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--color-text-hint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>↗</span>
                      <span>{suppMap[entry.linked_supplement_id]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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

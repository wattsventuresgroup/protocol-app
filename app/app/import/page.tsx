'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ExtractedSupplement = {
  name: string
  dose: string | null
  timing: string | null
  cadence: string | null
  intakeConditions: string | null
  notesForPatient: string | null
  purchaseSource: string | null
  confidence: 'high' | 'low'
}

type ExtractedWellness = {
  category: 'nutrition' | 'testing' | 'care'
  name: string
  note: string | null
  cadence: string | null
  confidence: 'high' | 'low'
}

type ExtractedPrompt = {
  symptom: string
  instruction: string | null
}

type Extracted = {
  supplements: ExtractedSupplement[]
  wellnessItems: ExtractedWellness[]
  journalPrompts: ExtractedPrompt[]
}

type ExtendedItemStatus = 'new' | 'duplicate' | 'low' | 'possible_update' | 'possible_match'

type ExistingSupp = {
  id: string
  name: string
  dose: string | null
  timing: string | null
}

type SaveResult = {
  suppAdded: number
  suppUpdated: number
  suppFailed: string[]
  wellnessAdded: number
  wellnessFailed: string[]
}

const supabase = createClient()

const TIMING_MAP: Record<string, string> = {
  morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon',
  evening: 'Evening', bedtime: 'Bedtime', asneeded: 'As needed',
}

const baseInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '13px',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const reviewLbl: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '3px',
}

const reviewInput: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '12px',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

function detectSuppStatus(name: string, dose: string | null, existing: ExistingSupp[], confidence: 'high' | 'low'): ExtendedItemStatus {
  const nameLower = name.toLowerCase()
  const exact = existing.find(e => e.name.toLowerCase() === nameLower)
  if (exact) {
    if (dose && exact.dose && dose.trim() !== exact.dose.trim()) return 'possible_update'
    return 'duplicate'
  }
  const words = nameLower.split(/\s+/).filter(w => w.length > 4)
  const similar = existing.find(e => {
    const eWords = e.name.toLowerCase().split(/\s+/)
    return words.some(w => eWords.some(ew => ew.includes(w) || w.includes(ew)))
  })
  if (similar) return 'possible_match'
  if (confidence === 'low') return 'low'
  return 'new'
}

function statusBorderColor(status: ExtendedItemStatus): string {
  if (status === 'new') return '#1D9E75'
  if (status === 'possible_update') return 'var(--color-info)'
  if (status === 'low' || status === 'possible_match') return '#EF9F27'
  return 'var(--color-border)'
}

function StatusBadge({ status }: { status: ExtendedItemStatus }) {
  const styles: Record<ExtendedItemStatus, React.CSSProperties> = {
    new: { background: '#E8F5F0', color: '#1D9E75' },
    duplicate: { background: 'var(--color-surface)', color: 'var(--color-text-hint)' },
    low: { background: 'var(--color-warning-light)', color: 'var(--color-warning)' },
    possible_update: { background: 'var(--color-info-light)', color: 'var(--color-info)' },
    possible_match: { background: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  }
  const labels: Record<ExtendedItemStatus, string> = {
    new: 'New',
    duplicate: 'Already tracked',
    low: 'Low confidence',
    possible_update: 'Update available',
    possible_match: 'Similar exists',
  }
  return (
    <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: 4, ...styles[status] }}>
      {labels[status]}
    </span>
  )
}

export default function ImportPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'paste' | 'pdf'>('paste')
  const [pasteText, setPasteText] = useState('')
  const [phase, setPhase] = useState<'input' | 'loading' | 'review' | 'saving' | 'result' | 'error'>('input')
  const [errorMsg, setErrorMsg] = useState('')
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [existingSuppDetails, setExistingSuppDetails] = useState<ExistingSupp[]>([])
  const [activeSuppNames, setActiveSuppNames] = useState<string[]>([])
  const [existingWellness, setExistingWellness] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showExistingSupps, setShowExistingSupps] = useState(false)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)

  const [editedSupps, setEditedSupps] = useState<ExtractedSupplement[]>([])
  const [editedWellness, setEditedWellness] = useState<ExtractedWellness[]>([])
  const [editedPrompts, setEditedPrompts] = useState<ExtractedPrompt[]>([])

  const [suppChecked, setSuppChecked] = useState<boolean[]>([])
  const [suppStatuses, setSuppStatuses] = useState<ExtendedItemStatus[]>([])
  const [suppUpdateChoice, setSuppUpdateChoice] = useState<('update' | 'add_new')[]>([])
  const [wellnessChecked, setWellnessChecked] = useState<boolean[]>([])
  const [promptChecked, setPromptChecked] = useState<boolean[]>([])

  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data: supps }, { data: wellness }] = await Promise.all([
        supabase.from('supplements').select('id, name, dose, timing, status').eq('patient_id', user.id),
        supabase.from('wellness_items').select('name').eq('patient_id', user.id),
      ])
      setExistingSuppDetails((supps ?? []).map(s => ({ id: s.id, name: s.name, dose: s.dose, timing: s.timing })))
      setActiveSuppNames((supps ?? []).filter(s => s.status !== 'discontinued').map(s => s.name))
      setExistingWellness((wellness ?? []).map(w => w.name))
    }
    load()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPdfFile(file)
    setErrorMsg('')
  }

  const canExtract = (tab === 'paste' ? pasteText.trim().length > 0 : pdfFile !== null) && phase !== 'loading'

  async function runAiExtract(payload: { text?: string; images?: string[] }) {
    setLoadingMsg('Analyzing…')
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setErrorMsg('Something went wrong. Please try again.')
      setPhase('error')
      return
    }
    const { result, error } = await res.json()
    if (error) {
      setErrorMsg('Something went wrong. Please try again.')
      setPhase('error')
      return
    }
    let parsed: Extracted
    try {
      parsed = JSON.parse(result)
    } catch {
      setErrorMsg('Nothing was found in this text. Try pasting a more detailed appointment summary.')
      setPhase('error')
      return
    }
    if (!parsed.supplements?.length && !parsed.wellnessItems?.length && !parsed.journalPrompts?.length) {
      setErrorMsg('Nothing was found in this text. Try pasting a more detailed appointment summary.')
      setPhase('error')
      return
    }
    setExtracted(parsed)
    setEditedSupps(parsed.supplements ?? [])
    setEditedWellness(parsed.wellnessItems ?? [])
    setEditedPrompts(parsed.journalPrompts ?? [])

    const statuses = (parsed.supplements ?? []).map(s =>
      detectSuppStatus(s.name, s.dose, existingSuppDetails, s.confidence)
    )
    setSuppStatuses(statuses)
    setSuppChecked(statuses.map(st => st !== 'duplicate' && st !== 'low'))
    setSuppUpdateChoice(statuses.map(() => 'update' as const))
    setWellnessChecked((parsed.wellnessItems ?? []).map(w => {
      const isDup = existingWellness.some(e => e.toLowerCase() === w.name.toLowerCase())
      return !isDup && w.confidence !== 'low'
    }))
    setPromptChecked((parsed.journalPrompts ?? []).map(() => false))
    setPhase('review')
  }

  async function handleExtractPaste() {
    if (!pasteText.trim() || phase === 'loading') return
    setPhase('loading')
    setErrorMsg('')
    try {
      await runAiExtract({ text: pasteText })
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  async function handleExtractPdf() {
    if (!pdfFile || phase === 'loading') return
    setPhase('loading')
    setErrorMsg('')
    try {
      setLoadingMsg('Reading PDF…')
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`

      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

      const images: string[] = []
      const maxPages = Math.min(pdf.numPages, 10)
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        images.push(base64)
      }

      if (images.length === 0) {
        setErrorMsg("This PDF couldn't be read. Try copying and pasting the content instead.")
        setPhase('error')
        return
      }

      await runAiExtract({ images })
    } catch (err) {
      console.error('PDF error:', err)
      setErrorMsg("This PDF couldn't be read. Try copying and pasting the content instead.")
      setPhase('error')
    }
  }

  function handleExtract() {
    if (tab === 'paste') handleExtractPaste()
    else handleExtractPdf()
  }

  function moveToWellness(idx: number) {
    const supp = editedSupps[idx]
    setEditedSupps(prev => prev.filter((_, i) => i !== idx))
    setSuppChecked(prev => prev.filter((_, i) => i !== idx))
    setSuppStatuses(prev => prev.filter((_, i) => i !== idx))
    setSuppUpdateChoice(prev => prev.filter((_, i) => i !== idx))
    const newItem: ExtractedWellness = {
      category: 'nutrition',
      name: supp.name,
      note: supp.notesForPatient,
      cadence: null,
      confidence: 'high',
    }
    setEditedWellness(prev => [...prev, newItem])
    setWellnessChecked(prev => [...prev, true])
  }

  async function handleSave() {
    if (!userId) return
    setPhase('saving')

    const result: SaveResult = {
      suppAdded: 0,
      suppUpdated: 0,
      suppFailed: [],
      wellnessAdded: 0,
      wellnessFailed: [],
    }

    for (let i = 0; i < editedSupps.length; i++) {
      if (!suppChecked[i]) continue
      const supp = editedSupps[i]
      const status = suppStatuses[i]
      const updateChoice = suppUpdateChoice[i]

      try {
        if (status === 'possible_update' && updateChoice === 'update') {
          const existingSupp = existingSuppDetails.find(e => e.name.toLowerCase() === supp.name.toLowerCase())
          if (existingSupp) {
            await supabase.from('supplements').update({
              dose: supp.dose || null,
              timing: supp.timing ? (TIMING_MAP[supp.timing] ?? supp.timing) : null,
              cadence: supp.cadence || null,
              intake_conditions: supp.intakeConditions || null,
              notes_for_patient: supp.notesForPatient || null,
              updated_at: new Date().toISOString(),
            }).eq('id', existingSupp.id)
            await supabase.from('regimen_events').insert({
              patient_id: userId,
              supplement_id: existingSupp.id,
              supplement_name: existingSupp.name,
              event: 'added',
              initiated_by: 'patient',
              date: new Date().toISOString(),
              note: 'Updated from import',
            })
            result.suppUpdated++
          }
        } else {
          const { data: row, error } = await supabase.from('supplements').insert({
            patient_id: userId,
            name: supp.name,
            dose: supp.dose || null,
            timing: supp.timing ? (TIMING_MAP[supp.timing] ?? supp.timing) : null,
            cadence: supp.cadence || null,
            intake_conditions: supp.intakeConditions || null,
            notes_for_patient: supp.notesForPatient || null,
            source: 'self',
            status: 'tobuy',
          }).select().single()
          if (error || !row) {
            result.suppFailed.push(supp.name)
          } else {
            await supabase.from('regimen_events').insert({
              patient_id: userId,
              supplement_id: row.id,
              supplement_name: row.name,
              event: 'added',
              initiated_by: 'patient',
              date: new Date().toISOString(),
              note: null,
            })
            result.suppAdded++
          }
        }
      } catch {
        result.suppFailed.push(supp.name)
      }
    }

    for (let i = 0; i < editedWellness.length; i++) {
      if (!wellnessChecked[i]) continue
      const item = editedWellness[i]
      try {
        const { error } = await supabase.from('wellness_items').insert({
          patient_id: userId,
          category: item.category,
          name: item.name,
          note: item.note || null,
          cadence: item.cadence || null,
          source: 'self',
        })
        if (error) result.wellnessFailed.push(item.name)
        else result.wellnessAdded++
      } catch {
        result.wellnessFailed.push(item.name)
      }
    }

    const promptsToAdd = editedPrompts.filter((_, i) => promptChecked[i])
    if (promptsToAdd.length > 0) {
      const newSymptoms = promptsToAdd.map(p => ({ name: p.symptom, scale: 'Same/Improving/Worsening' }))
      const { data: existing } = await supabase.from('journal_configs').select('*').eq('patient_id', userId).maybeSingle()
      if (existing) {
        const merged = [...(existing.symptoms ?? []), ...newSymptoms].slice(0, 3)
        await supabase.from('journal_configs').update({ symptoms: merged, updated_at: new Date().toISOString() }).eq('patient_id', userId)
      } else {
        await supabase.from('journal_configs').insert({
          patient_id: userId,
          cadence: 'Weekly',
          symptoms: newSymptoms.slice(0, 3),
          allow_free_text: true,
          instructions: null,
        })
      }
    }

    setSaveResult(result)
    setPhase('result')
  }

  const sectionHead: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-hint)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '10px',
    marginTop: '20px',
  }

  return (
    <div style={{ padding: '16px 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.push('/app/plan')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {phase === 'input' || phase === 'error' ? (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
            {(['paste', 'pdf'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setErrorMsg('') }}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: tab === t ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontSize: '13px',
                  fontWeight: tab === t ? 500 : 400,
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {t === 'paste' ? 'Paste text' : 'Upload PDF'}
              </button>
            ))}
          </div>

          {tab === 'paste' ? (
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste your appointment notes, transcript, or summary here..."
              rows={10}
              style={{ ...baseInput, resize: 'vertical' as const, lineHeight: 1.6 }}
            />
          ) : (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: '1.5px dashed var(--color-border)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer' }}
              >
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  {fileName || 'Tap to select a PDF'}
                </p>
                {pdfFile && <p style={{ fontSize: '11px', color: '#1D9E75', marginTop: 6 }}>Ready</p>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>
          )}

          {errorMsg && (
            <p style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: 10, lineHeight: 1.5 }}>{errorMsg}</p>
          )}

          <button
            onClick={handleExtract}
            disabled={!canExtract}
            style={{ display: 'block', width: '100%', padding: '12px', marginTop: 16, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: canExtract ? 'pointer' : 'not-allowed', opacity: canExtract ? 1 : 0.5 }}
          >
            Extract
          </button>
        </>
      ) : phase === 'loading' ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{loadingMsg || 'Processing…'}</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginTop: 6 }}>This may take a moment</p>
        </div>
      ) : phase === 'saving' ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Saving…</p>
        </div>
      ) : phase === 'result' && saveResult ? (
        <div style={{ paddingTop: 8 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', marginBottom: 20 }}>Import complete</h2>

          <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
            {saveResult.suppAdded > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{saveResult.suppAdded} supplement{saveResult.suppAdded !== 1 ? 's' : ''} added to To Buy</span>
              </div>
            )}
            {saveResult.suppUpdated > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{saveResult.suppUpdated} supplement{saveResult.suppUpdated !== 1 ? 's' : ''} updated</span>
              </div>
            )}
            {saveResult.wellnessAdded > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{saveResult.wellnessAdded} wellness item{saveResult.wellnessAdded !== 1 ? 's' : ''} added</span>
              </div>
            )}
            {saveResult.suppAdded === 0 && saveResult.suppUpdated === 0 && saveResult.wellnessAdded === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Nothing was saved.</p>
            )}
          </div>

          {(saveResult.suppFailed.length > 0 || saveResult.wellnessFailed.length > 0) && (
            <div style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-danger)', marginBottom: 6 }}>Failed to save:</p>
              {[...saveResult.suppFailed, ...saveResult.wellnessFailed].map(name => (
                <p key={name} style={{ fontSize: '12px', color: 'var(--color-danger)' }}>• {name}</p>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push('/app/plan')}
            style={{ display: 'block', width: '100%', padding: '12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
          >
            Go to My Plan
          </button>
        </div>
      ) : phase === 'review' && extracted ? (
        <>
          {/* Already in your plan */}
          {activeSuppNames.length > 0 && (
            <div style={{ marginBottom: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setShowExistingSupps(v => !v)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Already in your plan ({activeSuppNames.length})
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-hint)', transform: showExistingSupps ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', lineHeight: 1 }}>›</span>
              </button>
              {showExistingSupps && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeSuppNames.map(name => (
                    <span key={name} style={{ padding: '3px 10px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '100px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUPPLEMENTS */}
          {editedSupps.length > 0 && (
            <>
              <h2 style={sectionHead}>Supplements</h2>
              {editedSupps.map((supp, i) => {
                const status = suppStatuses[i] ?? 'new'
                return (
                  <div
                    key={i}
                    style={{
                      borderLeft: `3px solid ${statusBorderColor(status)}`,
                      background: status === 'duplicate' ? 'var(--color-surface)' : 'var(--color-surface-raised)',
                      borderRadius: '0 10px 10px 0',
                      padding: '12px 14px',
                      marginBottom: 10,
                    }}
                  >
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <input
                        type="checkbox"
                        checked={suppChecked[i] ?? false}
                        onChange={e => {
                          const next = [...suppChecked]
                          next[i] = e.target.checked
                          setSuppChecked(next)
                        }}
                        style={{ accentColor: 'var(--color-primary)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <StatusBadge status={status} />
                      {status === 'low' && (
                        <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 500 }}>Please verify</span>
                      )}
                      <button
                        onClick={() => moveToWellness(i)}
                        style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-text-hint)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                      >
                        → Wellness
                      </button>
                    </div>

                    {/* Update choice for possible_update */}
                    {status === 'possible_update' && suppChecked[i] && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        {(['update', 'add_new'] as const).map(choice => (
                          <label key={choice} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '12px', color: suppUpdateChoice[i] === choice ? 'var(--color-info)' : 'var(--color-text-secondary)' }}>
                            <input
                              type="radio"
                              name={`choice-${i}`}
                              value={choice}
                              checked={suppUpdateChoice[i] === choice}
                              onChange={() => {
                                const next = [...suppUpdateChoice]
                                next[i] = choice
                                setSuppUpdateChoice(next)
                              }}
                              style={{ accentColor: 'var(--color-info)' }}
                            />
                            {choice === 'update' ? 'Update existing' : 'Add as new'}
                          </label>
                        ))}
                      </div>
                    )}

                    <label style={reviewLbl}>Supplement name</label>
                    <input
                      value={editedSupps[i].name}
                      onChange={e => {
                        const next = [...editedSupps]
                        next[i] = { ...next[i], name: e.target.value }
                        setEditedSupps(next)
                      }}
                      style={{ ...reviewInput, fontWeight: 500, marginBottom: 8 }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={reviewLbl}>Dose</label>
                        <input
                          value={editedSupps[i].dose ?? ''}
                          onChange={e => {
                            const next = [...editedSupps]
                            next[i] = { ...next[i], dose: e.target.value || null }
                            setEditedSupps(next)
                          }}
                          placeholder="e.g. 400mg"
                          style={reviewInput}
                        />
                      </div>
                      <div>
                        <label style={reviewLbl}>Time of day</label>
                        <select
                          value={editedSupps[i].timing ?? ''}
                          onChange={e => {
                            const next = [...editedSupps]
                            next[i] = { ...next[i], timing: e.target.value || null }
                            setEditedSupps(next)
                          }}
                          style={reviewInput}
                        >
                          <option value="">No preference</option>
                          <option value="morning">Morning</option>
                          <option value="midday">Midday</option>
                          <option value="afternoon">Afternoon</option>
                          <option value="evening">Evening</option>
                          <option value="bedtime">Bedtime</option>
                          <option value="asneeded">As needed</option>
                        </select>
                      </div>
                    </div>

                    <label style={reviewLbl}>Intake conditions</label>
                    <input
                      value={editedSupps[i].intakeConditions ?? ''}
                      onChange={e => {
                        const next = [...editedSupps]
                        next[i] = { ...next[i], intakeConditions: e.target.value || null }
                        setEditedSupps(next)
                      }}
                      placeholder="e.g. with food, before bed"
                      style={{ ...reviewInput, marginBottom: 8 }}
                    />

                    <label style={reviewLbl}>Additional notes</label>
                    <input
                      value={editedSupps[i].notesForPatient ?? ''}
                      onChange={e => {
                        const next = [...editedSupps]
                        next[i] = { ...next[i], notesForPatient: e.target.value || null }
                        setEditedSupps(next)
                      }}
                      placeholder="Additional notes"
                      style={reviewInput}
                    />
                  </div>
                )
              })}
            </>
          )}

          {/* WELLNESS */}
          {editedWellness.length > 0 && (
            <>
              <h2 style={sectionHead}>Wellness</h2>
              {editedWellness.map((item, i) => {
                const isDup = existingWellness.some(e => e.toLowerCase() === item.name.toLowerCase())
                const status: ExtendedItemStatus = isDup ? 'duplicate' : item.confidence === 'low' ? 'low' : 'new'
                return (
                  <div
                    key={i}
                    style={{
                      borderLeft: `3px solid ${statusBorderColor(status)}`,
                      background: status === 'duplicate' ? 'var(--color-surface)' : 'var(--color-surface-raised)',
                      borderRadius: '0 10px 10px 0',
                      padding: '12px 14px',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <input
                        type="checkbox"
                        checked={wellnessChecked[i] ?? false}
                        onChange={e => {
                          const next = [...wellnessChecked]
                          next[i] = e.target.checked
                          setWellnessChecked(next)
                        }}
                        style={{ accentColor: 'var(--color-primary)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <StatusBadge status={status} />
                      {status === 'low' && (
                        <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 500 }}>Please verify</span>
                      )}
                    </div>

                    <label style={reviewLbl}>Category</label>
                    <select
                      value={editedWellness[i].category}
                      onChange={e => {
                        const next = [...editedWellness]
                        next[i] = { ...next[i], category: e.target.value as 'nutrition' | 'testing' | 'care' }
                        setEditedWellness(next)
                      }}
                      style={{ ...reviewInput, marginBottom: 8 }}
                    >
                      <option value="nutrition">Nutrition</option>
                      <option value="testing">Testing</option>
                      <option value="care">Ongoing Care & Treatment</option>
                    </select>

                    <label style={reviewLbl}>Item</label>
                    <input
                      value={editedWellness[i].name}
                      onChange={e => {
                        const next = [...editedWellness]
                        next[i] = { ...next[i], name: e.target.value }
                        setEditedWellness(next)
                      }}
                      style={{ ...reviewInput, fontWeight: 500, marginBottom: 8 }}
                    />

                    <label style={reviewLbl}>Instructions</label>
                    <input
                      value={editedWellness[i].note ?? ''}
                      onChange={e => {
                        const next = [...editedWellness]
                        next[i] = { ...next[i], note: e.target.value || null }
                        setEditedWellness(next)
                      }}
                      placeholder="Details or instructions"
                      style={{ ...reviewInput, marginBottom: 8 }}
                    />

                    <label style={reviewLbl}>How often</label>
                    <input
                      value={editedWellness[i].cadence ?? ''}
                      onChange={e => {
                        const next = [...editedWellness]
                        next[i] = { ...next[i], cadence: e.target.value || null }
                        setEditedWellness(next)
                      }}
                      placeholder="e.g. Daily, Weekly"
                      style={reviewInput}
                    />
                  </div>
                )
              })}
            </>
          )}

          {/* JOURNAL PROMPTS */}
          {editedPrompts.length > 0 && (
            <>
              <h2 style={sectionHead}>Journal Prompts</h2>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: 10 }}>These will be added to your check-in symptoms</p>
              {editedPrompts.map((prompt, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={promptChecked[i] ?? false}
                    onChange={e => {
                      const next = [...promptChecked]
                      next[i] = e.target.checked
                      setPromptChecked(next)
                    }}
                    style={{ flexShrink: 0, accentColor: 'var(--color-primary)', width: 15, height: 15 }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{prompt.symptom}</span>
                    {prompt.instruction && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: 2 }}>{prompt.instruction}</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setPhase('input'); setExtracted(null) }}
              style={{ flex: 1, padding: '11px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
            >
              Back
            </button>
            <button
              onClick={handleSave}
              style={{ flex: 2, padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Add to my plan
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '../components/BottomSheet'

type Category = 'nutrition' | 'testing' | 'care'

type WellnessItem = {
  id: string
  patient_id: string
  category: Category
  name: string
  note: string | null
  cadence: string | null
  link_url: string | null
  source: string
  sort_order: number
}

const supabase = createClient()

const CATEGORY_META: Record<Category, { label: string; color: string; bg: string; headColor: string }> = {
  nutrition: {
    label: 'Nutrition',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-light)',
    headColor: 'var(--color-primary)',
  },
  testing: {
    label: 'Testing',
    color: 'var(--color-info)',
    bg: 'var(--color-info-light)',
    headColor: 'var(--color-info)',
  },
  care: {
    label: 'Care',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-light)',
    headColor: 'var(--color-warning)',
  },
}

const CATEGORIES: Category[] = ['nutrition', 'testing', 'care']

const EMPTY_FORM = {
  category: 'nutrition' as Category,
  name: '',
  note: '',
  cadence: '',
  linkUrl: '',
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

export default function WellnessPage() {
  const [items, setItems] = useState<WellnessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('wellness_items')
        .select('*')
        .eq('patient_id', user.id)
        .order('sort_order')
        .order('created_at')
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!form.name.trim() || !userId) return
    setSaving(true)
    const { data: row, error } = await supabase
      .from('wellness_items')
      .insert({
        patient_id: userId,
        category: form.category,
        name: form.name.trim(),
        note: form.note.trim() || null,
        cadence: form.cadence.trim() || null,
        link_url: form.linkUrl.trim() || null,
        source: 'self',
      })
      .select()
      .single()
    if (!error && row) setItems(prev => [...prev, row])
    setSaving(false)
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
  }

  const grouped = CATEGORIES
    .map(cat => ({ cat, catItems: items.filter(i => i.category === cat) }))
    .filter(g => g.catItems.length > 0)

  if (loading) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <div style={{ height: 28, background: 'var(--color-border)', borderRadius: 8, width: '35%', marginBottom: 6 }} />
        <div style={{ height: 14, background: 'var(--color-border)', borderRadius: 6, width: '50%', marginBottom: 28 }} />
        {[1, 2, 3].map(i => <div key={i} style={{ height: 56, background: 'var(--color-border)', borderRadius: 12, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', margin: 0, marginBottom: 4 }}>Wellness</h1>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Your wellness plan</p>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>No wellness guidance yet</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Tap + to add your first item</p>
        </div>
      )}

      {/* Sections */}
      {grouped.map(({ cat, catItems }) => {
        const meta = CATEGORY_META[cat]
        return (
          <section key={cat} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: meta.headColor, marginBottom: 10 }}>
              {meta.label}
            </h2>
            {catItems.map(item => {
              const open = expandedId === item.id
              return (
                <div key={item.id} style={{ background: 'var(--color-surface-raised)', borderRadius: 12, marginBottom: 8, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                  {/* Header row */}
                  <div onClick={() => setExpandedId(open ? null : item.id)} style={{ cursor: 'pointer', padding: '13px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', background: meta.bg, color: meta.color, textTransform: 'uppercase' as const, letterSpacing: '0.03em' }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.name}</span>
                      </div>
                      {item.cadence && (
                        <div style={{ marginTop: 5, paddingLeft: 0 }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary-mid)', borderRadius: '100px', fontSize: '11px', lineHeight: '18px' }}>
                            {item.cadence}
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '16px', color: 'var(--color-text-hint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, lineHeight: 1 }}>›</span>
                  </div>

                  {/* Expanded */}
                  {open && (
                    <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 14px 14px' }}>
                      {item.note && (
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: item.link_url ? 12 : 0 }}>
                          {item.note}
                        </p>
                      )}
                      {item.link_url && (
                        <a href={item.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: meta.bg, color: meta.color, borderRadius: 8, fontSize: '12px', fontWeight: 500, textDecoration: 'none', marginTop: item.note ? 0 : 4 }}>
                          Open link →
                        </a>
                      )}
                      {!item.note && !item.link_url && (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>No additional details.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

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

      {/* Add wellness item sheet */}
      <BottomSheet open={showAddSheet} onClose={() => { setShowAddSheet(false); setForm(EMPTY_FORM) }} title="Add wellness item">
        <label style={lbl}>Category *</label>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))} style={input}>
          <option value="nutrition">Nutrition</option>
          <option value="testing">Testing</option>
          <option value="care">Care</option>
        </select>

        <label style={lbl}>Name *</label>
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Reduce high-histamine foods, Urinalysis, Pelvic floor PT" style={input} />

        <label style={lbl}>Note</label>
        <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Details or instructions" rows={3} style={{ ...input, resize: 'vertical' as const }} />

        <label style={lbl}>Cadence</label>
        <input type="text" value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))} placeholder="e.g. Weekly, Every 2 weeks, Daily" style={input} />

        <label style={lbl}>Link (optional)</label>
        <input type="url" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="https://" style={input} />

        <button onClick={handleSave} disabled={!form.name.trim() || saving} style={{ display: 'block', width: '100%', padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: !form.name.trim() || saving ? 'not-allowed' : 'pointer', opacity: !form.name.trim() || saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Add item'}
        </button>
      </BottomSheet>
    </div>
  )
}

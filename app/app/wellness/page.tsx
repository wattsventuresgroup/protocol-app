'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '../components/BottomSheet'
import HamburgerMenu from '../components/HamburgerMenu'
import SmartSearch from '@/lib/components/SmartSearch'

type Category = 'nutrition' | 'testing' | 'care' | 'approved_products'

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
  created_at: string
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
    label: 'Ongoing Care & Treatment',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-light)',
    headColor: 'var(--color-warning)',
  },
  approved_products: {
    label: 'Approved Products',
    color: 'var(--color-gold)',
    bg: 'var(--color-gold-bg)',
    headColor: 'var(--color-gold)',
  },
}

const CATEGORIES: Category[] = ['nutrition', 'testing', 'care', 'approved_products']

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingItem, setEditingItem] = useState<WellnessItem | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [searchApplied, setSearchApplied] = useState(false)

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
    if (!form.name.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    const { data: row, error } = await supabase
      .from('wellness_items')
      .insert({
        patient_id: user.id,
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

  async function handleEditSave() {
    if (!form.name.trim() || !editingItem) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    const updates = {
      category: form.category,
      name: form.name.trim(),
      note: form.note.trim() || null,
      cadence: form.cadence.trim() || null,
      link_url: form.linkUrl.trim() || null,
    }
    await supabase.from('wellness_items').update(updates).eq('id', editingItem.id)
    setItems(prev => prev.map(i => i.id === editingItem!.id ? { ...i, ...updates } : i))
    setSaving(false)
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
    setEditingItem(null)
  }

  async function handleDelete(item: WellnessItem) {
    await supabase.from('wellness_items').delete().eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setExpandedId(null)
    setDeleteConfirmId(null)
  }

  function openEditSheet(item: WellnessItem) {
    setEditingItem(item)
    setForm({
      category: item.category,
      name: item.name,
      note: item.note ?? '',
      cadence: item.cadence ?? '',
      linkUrl: item.link_url ?? '',
    })
    setShowAddSheet(true)
  }

  function closeSheet() {
    setShowAddSheet(false)
    setForm(EMPTY_FORM)
    setEditingItem(null)
  }

  function closeSearch() {
    setShowSearch(false)
    setSearchQuery('')
    setSearchFrom('')
    setSearchTo('')
    setSearchApplied(false)
  }

  const hasFilter = searchQuery.trim() || searchApplied
  const filteredItems = hasFilter ? items.filter(item => {
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (searchApplied) {
      const d = item.created_at.slice(0, 10)
      if (searchFrom && d < searchFrom) return false
      if (searchTo && d > searchTo) return false
    }
    return true
  }) : items

  const displayItems = hasFilter ? filteredItems : items
  const grouped = CATEGORIES
    .map(cat => ({ cat, catItems: displayItems.filter(i => i.category === cat) }))
    .filter(g => g.catItems.length > 0)

  if (loading) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <div style={{ height: 36, background: 'var(--color-border)', borderRadius: 8, width: '25%', marginLeft: 'auto', marginBottom: 20 }} />
        {[1, 2, 3].map(i => <div key={i} style={{ height: 56, background: 'var(--color-border)', borderRadius: 12, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px 0' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: showSearch ? 12 : 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', lineHeight: 1.15, margin: '0 0 2px' }}>
            Wellness
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Your care guidance</p>
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
              placeholder="Search wellness items..."
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
        </div>
      )}

      {/* Empty state */}
      {displayItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>{hasFilter ? 'No items match your search' : 'No wellness guidance yet'}</p>
          {!hasFilter && <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Tap + to add your first item</p>}
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
              const confirming = deleteConfirmId === item.id
              const noteIsLong = (item.note?.length ?? 0) > 100

              return (
                <div key={item.id} style={{ background: 'var(--color-surface-raised)', borderRadius: 12, marginBottom: 8, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div onClick={() => { setExpandedId(open ? null : item.id); setDeleteConfirmId(null) }} style={{ cursor: 'pointer', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.name}</span>
                      {item.note && (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                          {item.note}
                        </p>
                      )}
                      {item.cadence && (
                        <div style={{ marginTop: 5 }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary-mid)', borderRadius: '100px', fontSize: '11px', lineHeight: '18px' }}>
                            {item.cadence}
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '16px', color: 'var(--color-text-hint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, lineHeight: 1 }}>›</span>
                  </div>

                  {open && !confirming && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '12px 16px 16px' }}>
                      {item.note && noteIsLong && (
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: 12 }}>
                          {item.note}
                        </p>
                      )}
                      {item.link_url && (
                        <a href={item.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: meta.bg, color: meta.color, borderRadius: 8, fontSize: '12px', fontWeight: 500, textDecoration: 'none', marginBottom: 12 }}>
                          Open link →
                        </a>
                      )}
                      {!item.note && !item.link_url && (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginBottom: 12 }}>No additional details.</p>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => openEditSheet(item)}
                          style={{ padding: '7px 12px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          style={{ padding: '7px 12px', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {open && confirming && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '12px 16px 16px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-danger)', marginBottom: 12 }}>Remove {item.name}?</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                          Cancel
                        </button>
                        <button onClick={() => handleDelete(item)} style={{ flex: 1, padding: '8px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
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

      {/* Add / Edit wellness item sheet */}
      <BottomSheet open={showAddSheet} onClose={closeSheet} title={editingItem ? 'Edit wellness item' : 'Add wellness item'}>
        <label style={lbl}>Category *</label>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))} style={input}>
          <option value="nutrition">Nutrition</option>
          <option value="testing">Testing</option>
          <option value="care">Ongoing Care & Treatment</option>
          <option value="approved_products">Approved Products</option>
        </select>

        <label style={lbl}>Name *</label>
        <SmartSearch
          placeholder="e.g. Reduce high-histamine foods, Urinalysis, Pelvic floor PT"
          databases={
            form.category === 'nutrition' ? ['nutrition'] :
            form.category === 'testing' ? ['testing'] :
            form.category === 'care' ? ['treatments'] :
            ['approved']
          }
          value={form.name}
          onChange={v => setForm(f => ({ ...f, name: v }))}
          onSelect={entry => setForm(f => ({
            ...f,
            name: entry.name,
            cadence: entry.cadence || '',
            note: entry.note || '',
          }))}
        />

        <label style={lbl}>Note</label>
        <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Details or instructions" rows={3} style={{ ...input, resize: 'vertical' as const }} />

        <label style={lbl}>Cadence</label>
        <input type="text" value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))} placeholder="e.g. Weekly, Every 2 weeks, Daily" style={input} />

        <label style={lbl}>Link (optional)</label>
        <input type="url" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="https://" style={input} />

        <button
          onClick={editingItem ? handleEditSave : handleSave}
          disabled={!form.name.trim() || saving}
          style={{ display: 'block', width: '100%', padding: '11px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: !form.name.trim() || saving ? 'not-allowed' : 'pointer', opacity: !form.name.trim() || saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : editingItem ? 'Save changes' : 'Add item'}
        </button>
      </BottomSheet>
    </div>
  )
}

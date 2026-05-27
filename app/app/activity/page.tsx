'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type ActivityItem = {
  id: string
  date: string
  type: 'supplement' | 'journal' | 'wellness'
  title: string
  subtitle: string
  note?: string | null
  dotColor?: string
}

const supabase = createClient()

const EVENT_LABELS: Record<string, string> = {
  started: 'Started',
  paused: 'Paused',
  resumed: 'Resumed',
  discontinued: 'Discontinued',
  added: 'Added to tracker',
  purchased: 'Marked as purchased',
  removed: 'Removed',
}

function eventDotColor(event: string): string {
  if (['started', 'resumed', 'added', 'purchased'].includes(event)) return '#1D9E75'
  if (event === 'paused') return '#EF9F27'
  if (['discontinued', 'removed'].includes(event)) return '#E24B4A'
  return '#D3D1C7'
}

function formatDate(dateStr: string): string {
  const d = dateStr.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (d === today) return 'Today'
  if (d === yest) return 'Yesterday'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SupplementIcon({ color }: { color: string }) {
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
}

function JournalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function WellnessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

const SOURCE_OPTIONS = [
  { value: '', label: 'All activity' },
  { value: 'supplement', label: 'Supplements' },
  { value: 'journal', label: 'Journal' },
  { value: 'wellness', label: 'Wellness' },
]

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

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [searchApplied, setSearchApplied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: events }, { data: entries }, { data: wellness }] = await Promise.all([
        supabase.from('regimen_events').select('*').eq('patient_id', user.id).order('date', { ascending: false }),
        supabase.from('journal_entries').select('*').eq('patient_id', user.id),
        supabase.from('wellness_items').select('*').eq('patient_id', user.id),
      ])

      const supplementItems: ActivityItem[] = (events ?? []).map(ev => ({
        id: `s-${ev.id}`,
        date: ev.date,
        type: 'supplement' as const,
        title: ev.supplement_name,
        subtitle: EVENT_LABELS[ev.event] ?? ev.event,
        note: ev.note,
        dotColor: eventDotColor(ev.event),
      }))

      const journalItems: ActivityItem[] = (entries ?? []).map(entry => {
        const symptoms = entry.symptoms ? Object.entries(entry.symptoms as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(', ') : null
        const preview = entry.text ? (entry.text.length > 60 ? entry.text.slice(0, 60) + '…' : entry.text) : symptoms ?? ''
        return {
          id: `j-${entry.id}`,
          date: entry.entry_date,
          type: 'journal' as const,
          title: entry.entry_type === 'checkin' ? 'Check-in' : 'Note',
          subtitle: preview,
        }
      })

      const wellnessItems: ActivityItem[] = (wellness ?? []).map(item => ({
        id: `w-${item.id}`,
        date: item.created_at,
        type: 'wellness' as const,
        title: item.name,
        subtitle: 'Added to wellness',
      }))

      const all = [...supplementItems, ...journalItems, ...wellnessItems]
        .sort((a, b) => b.date.localeCompare(a.date))

      setItems(all)
      setLoading(false)
    }
    load()
  }, [])

  function closeFilter() {
    setShowFilter(false)
    setSearchQuery('')
    setSourceFilter('')
    setSearchFrom('')
    setSearchTo('')
    setSearchApplied(false)
  }

  const hasFilter = searchQuery.trim() || sourceFilter || searchApplied
  const filteredItems = hasFilter ? items.filter(item => {
    if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && !item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (sourceFilter && item.type !== sourceFilter) return false
    if (searchApplied) {
      const d = item.date.slice(0, 10)
      if (searchFrom && d < searchFrom) return false
      if (searchTo && d > searchTo) return false
    }
    return true
  }) : items

  if (loading) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <div style={{ height: 36, background: 'var(--color-border)', borderRadius: 8, width: '25%', marginLeft: 'auto', marginBottom: 20 }} />
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-border)', marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, background: 'var(--color-border)', borderRadius: 6, width: '60%', marginBottom: 5 }} />
              <div style={{ height: 12, background: 'var(--color-border)', borderRadius: 6, width: '35%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px 32px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: showFilter ? 12 : 20 }}>
        <button
          onClick={() => showFilter ? closeFilter() : setShowFilter(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: showFilter ? 'var(--color-primary)' : 'var(--color-text-hint)', display: 'flex', alignItems: 'center' }}
        >
          {showFilter ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search activity..."
            autoFocus
            style={{ ...input, marginBottom: 8 }}
          />
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ ...input, marginBottom: 8 }}
          >
            {SOURCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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

      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>{hasFilter ? 'No activity matches your filter' : 'No activity yet'}</p>
          {!hasFilter && <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Add your first supplement to get started</p>}
        </div>
      ) : (
        <div>
          {filteredItems.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                {item.type === 'supplement' && <SupplementIcon color={item.dotColor ?? '#D3D1C7'} />}
                {item.type === 'journal' && <JournalIcon />}
                {item.type === 'wellness' && <WellnessIcon />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', flexShrink: 0 }}>
                    {formatDate(item.date)}
                  </span>
                </div>
                {item.subtitle && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {item.subtitle}
                  </span>
                )}
                {item.note && (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginTop: 3, lineHeight: 1.45 }}>
                    {item.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

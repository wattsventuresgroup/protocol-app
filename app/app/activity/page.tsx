'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

const EVENT_LABELS: Record<string, string> = {
  started: 'Started',
  paused: 'Paused',
  resumed: 'Resumed',
  discontinued: 'Discontinued',
  added: 'Added to tracker',
  purchased: 'Marked as purchased',
  removed: 'Removed',
}

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All events' },
  { value: 'started', label: 'Started' },
  { value: 'paused', label: 'Paused' },
  { value: 'resumed', label: 'Resumed' },
  { value: 'discontinued', label: 'Discontinued' },
  { value: 'added', label: 'Added' },
  { value: 'purchased', label: 'Purchased' },
]

function eventColor(event: string): string {
  if (['started', 'resumed', 'added', 'purchased'].includes(event)) return '#1D9E75'
  if (event === 'paused') return '#EF9F27'
  if (['discontinued', 'removed'].includes(event)) return '#E24B4A'
  return '#D3D1C7'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yest.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

export default function ActivityPage() {
  const [events, setEvents] = useState<RegimenEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [searchApplied, setSearchApplied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('regimen_events')
        .select('*')
        .eq('patient_id', user.id)
        .order('date', { ascending: false })
      setEvents(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const hasFilter = searchQuery.trim() || eventTypeFilter || searchApplied
  const filteredEvents = hasFilter ? events.filter(ev => {
    if (searchQuery.trim() && !ev.supplement_name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (eventTypeFilter && ev.event !== eventTypeFilter) return false
    if (searchApplied) {
      const d = ev.date.slice(0, 10)
      if (searchFrom && d < searchFrom) return false
      if (searchTo && d > searchTo) return false
    }
    return true
  }) : events

  if (loading) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <div style={{ height: 28, background: 'var(--color-border)', borderRadius: 8, width: '30%', marginBottom: 28 }} />
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
    <div style={{ padding: '24px 20px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFilter ? 12 : 24 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', margin: 0 }}>
          Activity
        </h1>
        <button
          onClick={() => { setShowFilter(v => !v); setSearchQuery(''); setEventTypeFilter(''); setSearchFrom(''); setSearchTo(''); setSearchApplied(false) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: showFilter ? 'var(--color-primary)' : 'var(--color-text-hint)', display: 'flex', alignItems: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by supplement name..."
            autoFocus
            style={{ ...input, marginBottom: 8 }}
          />
          <select
            value={eventTypeFilter}
            onChange={e => setEventTypeFilter(e.target.value)}
            style={{ ...input, marginBottom: 8 }}
          >
            {EVENT_TYPE_OPTIONS.map(opt => (
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

      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>{hasFilter ? 'No activity matches your filter' : 'No activity yet'}</p>
          {!hasFilter && <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Add your first supplement to get started</p>}
        </div>
      ) : (
        <div>
          {filteredEvents.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: eventColor(ev.event), flexShrink: 0, marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {ev.supplement_name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-hint)', flexShrink: 0 }}>
                    {formatDate(ev.date)}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {EVENT_LABELS[ev.event] ?? ev.event}
                </span>
                {ev.note && (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-hint)', marginTop: 3, lineHeight: 1.45 }}>
                    {ev.note}
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

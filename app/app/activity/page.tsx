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

export default function ActivityPage() {
  const [events, setEvents] = useState<RegimenEvent[]>([])
  const [loading, setLoading] = useState(true)

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
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--color-primary)', margin: 0, marginBottom: 24 }}>
        Activity
      </h1>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '14px', marginBottom: 6 }}>No activity yet</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>Add your first supplement to get started</p>
        </div>
      ) : (
        <div>
          {events.map(ev => (
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

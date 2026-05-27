'use client'

import { useState, useEffect, useRef } from 'react'
import Fuse from 'fuse.js'

type DatabaseEntry = {
  name: string
  aliases: string[]
  type?: string
  category?: string
  brand?: string | null
  dose?: string
  timing?: string
  cadence?: string
  intakeConditions?: string | null
  notes?: string
  note?: string
  linkUrl?: string | null
}

type Props = {
  placeholder?: string
  onSelect: (entry: DatabaseEntry) => void
  databases: ('supplements' | 'medications' | 'treatments' | 'testing' | 'nutrition' | 'approved')[]
  value: string
  onChange: (value: string) => void
}

export default function SmartSearch({ placeholder = 'Search...', onSelect, databases, value, onChange }: Props) {
  const [results, setResults] = useState<DatabaseEntry[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const fuseRef = useRef<Fuse<DatabaseEntry> | null>(null)
  const dbKey = databases.join(',')

  useEffect(() => {
    async function loadDbs() {
      const loaded: DatabaseEntry[] = []
      for (const db of databases) {
        try {
          let data: DatabaseEntry[]
          if (db === 'supplements') data = ((await import('@/lib/database/supplements.json')) as { default: DatabaseEntry[] }).default
          else if (db === 'medications') data = ((await import('@/lib/database/medications.json')) as { default: DatabaseEntry[] }).default
          else if (db === 'treatments') data = ((await import('@/lib/database/wellness-treatments.json')) as { default: DatabaseEntry[] }).default
          else if (db === 'testing') data = ((await import('@/lib/database/wellness-testing.json')) as { default: DatabaseEntry[] }).default
          else if (db === 'nutrition') data = ((await import('@/lib/database/wellness-nutrition.json')) as { default: DatabaseEntry[] }).default
          else data = ((await import('@/lib/database/wellness-approved.json')) as { default: DatabaseEntry[] }).default
          loaded.push(...data)
        } catch {
          // database not yet available
        }
      }
      fuseRef.current = new Fuse(loaded, {
        keys: ['name', 'aliases'],
        threshold: 0.35,
        ignoreLocation: true,
      })
    }
    loadDbs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbKey])

  useEffect(() => {
    if (!fuseRef.current || value.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const hits = fuseRef.current.search(value, { limit: 8 }).map(r => r.item)
    setResults(hits)
    setOpen(hits.length > 0)
    setHighlighted(-1)
  }, [value])

  function handleSelect(entry: DatabaseEntry) {
    onChange(entry.name)
    onSelect(entry)
    setOpen(false)
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, -1))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div style={{ position: 'relative', marginBottom: '14px' }}>
      <input
        type="text"
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: '13px',
          border: '1px solid var(--color-border)',
          borderRadius: open ? '8px 8px 0 0' : '8px',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          outline: 'none',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box' as const,
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {results.map((entry, i) => (
            <div
              key={`${entry.name}-${i}`}
              onMouseDown={() => handleSelect(entry)}
              style={{
                padding: '9px 12px',
                cursor: 'pointer',
                background: highlighted === i ? 'var(--color-primary-light)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{entry.name}</div>
              {entry.aliases && entry.aliases.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-hint)', marginTop: 1 }}>{entry.aliases[0]}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

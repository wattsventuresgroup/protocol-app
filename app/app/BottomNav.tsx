'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/app/plan',
    label: 'My Plan',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-primary)' : 'var(--color-text-hint)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/app/journal',
    label: 'Journal',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-primary)' : 'var(--color-text-hint)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 10h16M4 14h10" />
        <rect x="2" y="3" width="20" height="18" rx="2" />
      </svg>
    ),
  },
  {
    href: '/app/activity',
    label: 'Activity',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-primary)' : 'var(--color-text-hint)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/app/wellness',
    label: 'Wellness',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-primary)' : 'var(--color-text-hint)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.968 3.701 2 6.5 2c1.972 0 3.936 1.007 5.5 2.857C13.564 3.007 15.528 2 17.5 2 20.299 2 23 3.968 23 7.191c0 4.105-5.37 8.863-11 14.402z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 'var(--app-max-width)',
      background: 'var(--color-surface-raised)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      {tabs.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--nav-item-py) 4px var(--nav-item-pb)',
              gap: '3px',
              textDecoration: 'none',
              color: active ? 'var(--color-primary)' : 'var(--color-text-hint)',
            }}
          >
            {tab.icon(active)}
            <span style={{
              fontSize: '10px',
              fontWeight: active ? 500 : 400,
              lineHeight: 1,
            }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from './BottomSheet'

const supabase = createClient()

const TAB_NAMES: Record<string, string> = {
  '/app/plan': 'My Plan',
  '/app/journal': 'Journal',
  '/app/activity': 'Activity',
  '/app/wellness': 'Wellness',
  '/app/import': 'Import',
}

function getTabName(pathname: string): string {
  for (const [key, label] of Object.entries(TAB_NAMES)) {
    if (pathname === key || pathname.startsWith(key + '/')) return label
  }
  return ''
}

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? null)
      // Try users table first
      try {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
        if (data?.name) {
          setUserName(data.name)
          return
        }
      } catch {}
      // Fallback to email prefix
      setUserName(user.email?.split('@')[0] ?? null)
    }
    loadUser()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleSettings() {
    setMenuOpen(false)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }

  const tabName = getTabName(pathname)

  return (
    <>
      <header style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 'var(--app-max-width)',
        height: '56px',
        background: 'var(--color-surface-raised)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 'calc(var(--app-h-padding) + 16px)',
        paddingRight: 'calc(var(--app-h-padding) + 16px)',
        zIndex: 200,
        boxSizing: 'border-box',
      }}>
        {/* Left: wordmark + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            fontWeight: 400,
            color: 'var(--color-primary)',
            lineHeight: 1.1,
          }}>
            Protocol
          </span>
          {tabName && (
            <span style={{
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1,
            }}>
              {tabName}
            </span>
          )}
        </div>

        {/* Right: hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Menu sheet */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div style={{ padding: '8px 20px 32px' }}>
          {/* User info */}
          <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
              {userName ?? '—'}
            </div>
            {userEmail && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>
                {userEmail}
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={handleSettings}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '14px 0',
              textAlign: 'left',
              fontSize: '14px',
              color: 'var(--color-text-primary)',
              borderBottom: '1px solid var(--color-border)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Settings
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '14px 0',
              textAlign: 'left',
              fontSize: '14px',
              color: 'var(--color-danger)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Sign out
          </button>

          {/* Version */}
          <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-hint)' }}>
            Protocol v0.1
          </div>
        </div>
      </BottomSheet>

      {/* Settings toast */}
      {toastVisible && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-text-primary)',
          color: '#fff',
          fontSize: '13px',
          padding: '10px 18px',
          borderRadius: '20px',
          zIndex: 500,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          Coming soon
        </div>
      )}
    </>
  )
}

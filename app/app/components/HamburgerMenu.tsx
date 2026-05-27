'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from './BottomSheet'

const supabase = createClient()

export default function HamburgerMenu() {
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
      try {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
        if (data?.name) { setUserName(data.name); return }
      } catch {}
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

  return (
    <>
      <button
        onClick={() => setMenuOpen(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}
        aria-label="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div style={{ padding: '8px 20px 32px' }}>
          <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
              {userName ?? '—'}
            </div>
            {userEmail && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-hint)' }}>{userEmail}</div>
            )}
          </div>
          <button
            onClick={handleSettings}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', textAlign: 'left', fontSize: '14px', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-sans)' }}
          >
            Settings
          </button>
          <button
            onClick={handleSignOut}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', textAlign: 'left', fontSize: '14px', color: 'var(--color-danger)', fontFamily: 'var(--font-sans)' }}
          >
            Sign out
          </button>
          <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-hint)' }}>Protocol v0.1</div>
        </div>
      </BottomSheet>

      {toastVisible && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', background: 'var(--color-text-primary)', color: '#fff', fontSize: '13px', padding: '10px 18px', borderRadius: '20px', zIndex: 500, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          Coming soon
        </div>
      )}
    </>
  )
}

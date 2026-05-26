'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMagicSent(true)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      window.location.href = '/app/plan'
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    background: 'var(--color-surface)',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--color-surface-raised)',
    borderRadius: '16px',
    padding: '32px 28px',
    border: '1px solid var(--color-border)',
  }

  const logoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-serif)',
    fontSize: '28px',
    fontWeight: 400,
    color: 'var(--color-primary)',
    textAlign: 'center',
    marginBottom: '8px',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    marginBottom: '28px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    marginBottom: '16px',
  }

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 16px',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    marginBottom: '20px',
  }

  const dividerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  }

  const dividerLineStyle: React.CSSProperties = {
    flex: 1,
    height: '1px',
    background: 'var(--color-border)',
  }

  const dividerTextStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-hint)',
  }

  const toggleStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--color-primary-mid)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  }

  const footerStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    marginTop: '20px',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-danger)',
    marginBottom: '16px',
    padding: '10px 12px',
    background: 'var(--color-danger-light)',
    borderRadius: '8px',
  }

  const successStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--color-success)',
    textAlign: 'center',
    padding: '16px',
    background: 'var(--color-success-light)',
    borderRadius: '8px',
    lineHeight: 1.6,
  }

  if (magicSent) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={logoStyle}>Protocol</p>
          <div style={successStyle}>
            Check your email for a login link.<br />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              The link will sign you in automatically.
            </span>
          </div>
          <p style={{ ...footerStyle, marginTop: '16px' }}>
            Wrong address?{' '}
            <button style={toggleStyle} onClick={() => { setMagicSent(false); setEmail('') }}>
              Try again
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={logoStyle}>Protocol</p>
        <p style={subtitleStyle}>Sign in to your account</p>

        {error && <div style={errorStyle}>{error}</div>}

        {mode === 'magic' ? (
          <form onSubmit={handleMagicLink}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              autoComplete="email"
            />
            <button type="submit" style={primaryBtnStyle} disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              autoComplete="email"
            />
            <label style={labelStyle} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="current-password"
            />
            <button type="submit" style={primaryBtnStyle} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <div style={dividerStyle}>
          <div style={dividerLineStyle} />
          <span style={dividerTextStyle}>or</span>
          <div style={dividerLineStyle} />
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {mode === 'magic' ? (
            <>
              Prefer a password?{' '}
              <button style={toggleStyle} onClick={() => { setMode('password'); setError('') }}>
                Sign in with password
              </button>
            </>
          ) : (
            <>
              Use magic link instead?{' '}
              <button style={toggleStyle} onClick={() => { setMode('magic'); setError('') }}>
                Send magic link
              </button>
            </>
          )}
        </p>

        <p style={footerStyle}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--color-primary-mid)', textDecoration: 'underline' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

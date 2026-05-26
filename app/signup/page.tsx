'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      window.location.href = '/login?message=confirm'
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
    marginTop: '4px',
    marginBottom: '20px',
  }

  const footerStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-danger)',
    marginBottom: '16px',
    padding: '10px 12px',
    background: 'var(--color-danger-light)',
    borderRadius: '8px',
  }

  const hintStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-hint)',
    marginTop: '-12px',
    marginBottom: '16px',
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={logoStyle}>Protocol</p>
        <p style={subtitleStyle}>Create your account</p>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSignup}>
          <label style={labelStyle} htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Smith"
            style={inputStyle}
            autoComplete="name"
          />

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
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
            autoComplete="new-password"
          />
          <p style={hintStyle}>Minimum 8 characters</p>

          <button type="submit" style={primaryBtnStyle} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={footerStyle}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-primary-mid)', textDecoration: 'underline' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

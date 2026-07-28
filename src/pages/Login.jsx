import React, { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handlePasswordReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="Future Focus" className="login-logo" />
        </div>
        
        {isForgotPassword ? (
          <>
            <h2>Reset Password</h2>
            <p className="login-sub">Enter your email to receive a password reset link</p>
            <form onSubmit={handlePasswordReset} className="login-form">
              <label>Email address
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@futurefocus.co.nz" required autoFocus disabled={resetSent} />
              </label>
              {error && <div className="login-error">{error}</div>}
              {resetSent && <div style={{ color: '#0e9a8a', padding: '12px', background: '#ecf9f8', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>✓ Check your email for the reset link!</div>}
              <button type="submit" className="login-btn" disabled={loading || resetSent}>
                {loading ? 'Sending…' : resetSent ? 'Email Sent' : 'Send Reset Link'}
              </button>
            </form>
            <button onClick={() => { setIsForgotPassword(false); setError(''); setResetSent(false); }} className="forgot-password-link">
              ← Back to Sign In
            </button>
          </>
        ) : (
          <>
            <h2>Welcome back</h2>
            <p className="login-sub">Sign in with your Future Focus account</p>
            <form onSubmit={handleSubmit} className="login-form">
              <label>Email address
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@futurefocus.co.nz" required autoFocus />
              </label>
              <label>Password
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </label>
              {error && <div className="login-error">{error}</div>}
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
            <button onClick={() => setIsForgotPassword(true)} className="forgot-password-link">
              Forgot password?
            </button>
          </>
        )}
        
        <p className="login-footer">Having trouble? Contact your Centre Leader or Head Office.</p>
      </div>
    </div>
  )
}

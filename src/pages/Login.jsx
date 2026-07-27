import React, { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="ff-mark">FF</div>
          <div className="brand-copy">
            <strong>FUTURE<br />FOCUS</strong>
            <span>STAFF PORTAL</span>
          </div>
        </div>
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
        <p className="login-footer">Having trouble? Contact your Centre Leader or Head Office.</p>
      </div>
    </div>
  )
}

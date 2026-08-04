import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function PasswordResetPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preparingSession, setPreparingSession] = useState(true)

  useEffect(() => {
    let active = true

    async function prepareResetSession() {
      try {
        const hash = window.location.hash || ''
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
        const searchParams = new URLSearchParams(window.location.search || '')

        const authType = (searchParams.get('type') || hashParams.get('type') || '').toLowerCase()
        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (tokenHash && (authType === 'invite' || authType === 'recovery' || authType === 'signup')) {
          const verifyType = authType === 'invite' ? 'invite' : authType === 'signup' ? 'signup' : 'recovery'
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: verifyType,
          })
          if (verifyError) throw verifyError
        }

        let { data: { session } } = await supabase.auth.getSession()

        // Give hash-fragment based auth links a moment to hydrate session in browser clients.
        if (!session) {
          for (let i = 0; i < 6 && !session; i += 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
            const latest = await supabase.auth.getSession()
            session = latest.data.session
          }
        }

        if (!session) {
          throw new Error('This invite/reset link is invalid or has expired. Please request a new one from Future Focus.')
        }
      } catch (err) {
        if (!active) return
        setError(err.message || 'Could not verify your invite/reset link. Please request a new one.')
      } finally {
        if (active) setPreparingSession(false)
      }
    }

    prepareResetSession()
    return () => { active = false }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()

    if (preparingSession) {
      setError('Still preparing your secure reset session. Please wait a moment.')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password })
    
    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
      // Redirect to home after 2 seconds
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    }
    
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="Future Focus" className="login-logo" />
        </div>
        <h2>Set Your Password</h2>
        <p className="login-sub">Create a password to access Future Focus</p>
        {preparingSession && <div style={{ color: '#1a6eb5', padding: '12px', background: '#e6eff9', borderRadius: '6px', fontSize: '14px', marginBottom: '12px' }}>Preparing secure link...</div>}
        
        <form onSubmit={handleSubmit} className="login-form">
          <label>New Password
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              disabled={success || preparingSession}
            />
          </label>
          
          <label>Confirm Password
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              disabled={success || preparingSession}
            />
          </label>
          
          {error && <div className="login-error">{error}</div>}
          {success && <div style={{ color: '#0e9a8a', padding: '12px', background: '#ecf9f8', borderRadius: '6px', fontSize: '14px' }}>✓ Password set successfully! Redirecting...</div>}
          
          <button type="submit" className="login-btn" disabled={loading || success || preparingSession}>
            {loading ? 'Setting password…' : success ? 'Done!' : 'Set Password'}
          </button>
        </form>
        
        <p className="login-footer">Having trouble? Contact your Centre Leader or Head Office.</p>
      </div>
    </div>
  )
}

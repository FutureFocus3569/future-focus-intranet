import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function PasswordResetPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    
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
        
        <form onSubmit={handleSubmit} className="login-form">
          <label>New Password
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              disabled={success}
            />
          </label>
          
          <label>Confirm Password
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              disabled={success}
            />
          </label>
          
          {error && <div className="login-error">{error}</div>}
          {success && <div style={{ color: '#0e9a8a', padding: '12px', background: '#ecf9f8', borderRadius: '6px', fontSize: '14px' }}>✓ Password set successfully! Redirecting...</div>}
          
          <button type="submit" className="login-btn" disabled={loading || success}>
            {loading ? 'Setting password…' : success ? 'Done!' : 'Set Password'}
          </button>
        </form>
        
        <p className="login-footer">Having trouble? Contact your Centre Leader or Head Office.</p>
      </div>
    </div>
  )
}

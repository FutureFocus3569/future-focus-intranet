import React, { useState, useEffect } from 'react'
import { supabase, CENTRES, PERMISSIONS } from '../lib/supabase.js'
import { Users, Plus, Trash2, X, Search, Edit2 } from 'lucide-react'
import { showToast } from '../lib/toast.js'

const PERMISSION_LABELS = { super_admin: 'Super Admin', centre_leader: 'Centre Leader', staff: 'Staff' }
const PERMISSION_COLOURS = { super_admin: '#005866', centre_leader: '#7c3aed', staff: '#374151' }

function getApiErrorMessage(payload, fallback) {
  if (!payload) return fallback
  if (typeof payload === 'string') {
    const normalized = payload.trim()
    if (!normalized || normalized === '{}' || normalized === '[]' || normalized === '[object Object]') return fallback
    return normalized
  }
  if (typeof payload.error === 'string') return payload.error
  if (payload.error && typeof payload.error.message === 'string') return payload.error.message
  if (payload.error && typeof payload.error.error_description === 'string') return payload.error.error_description
  if (payload.error && typeof payload.error.details === 'string') return payload.error.details
  if (typeof payload.message === 'string') return payload.message
  try {
    const serialized = JSON.stringify(payload)
    if (serialized && serialized !== '{}' && serialized !== '[]') return serialized
  } catch {}
  return fallback
}

function AddStaffModal({ onClose, onSuccess, callerProfile }) {
  const isAdmin = callerProfile?.permission === 'super_admin'
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', mobile: '',
    centre: isAdmin ? '' : callerProfile?.centre ?? '',
    role_title: '',
    permission: 'staff',
    date_of_birth: '',
    start_date: '',
    invite_message: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteFallback, setInviteFallback] = useState(null)
  const [copyState, setCopyState] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInviteFallback(null)
    setCopyState('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-staff`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(form),
        }
      )
      const raw = await res.text().catch(() => '')
      let data = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
      if (!res.ok) throw new Error(getApiErrorMessage(data, `Could not add staff member (HTTP ${res.status}).`))

      if (data?.invite_delivery === 'manual_link' && data?.invite_link) {
        onSuccess()
        setInviteFallback({
          link: data.invite_link,
          message: data.message || 'Automatic invite email could not be delivered. Send this invite link manually.',
        })
        return
      }

      showToast('Staff member added')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add staff member.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Staff Member</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <div className="form-row">
            <label>First Name <input value={form.first_name} onChange={e => set('first_name', e.target.value)} required placeholder="Jane" /></label>
            <label>Last Name <input value={form.last_name} onChange={e => set('last_name', e.target.value)} required placeholder="Smith" /></label>
          </div>
          <div className="form-row">
            <label>Email Address <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="jane@gmail.com" /></label>
            <label>Mobile <input type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+64 21 123 4567" /></label>
          </div>
          <div className="form-row">
            <label>Centre / Location
              <select value={form.centre} onChange={e => set('centre', e.target.value)} required disabled={!isAdmin}>
                <option value="">Select centre…</option>
                {CENTRES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Role Title <input value={form.role_title} onChange={e => set('role_title', e.target.value)} placeholder="e.g. Lead Teacher" /></label>
          </div>
          <div className="form-row">
            <label>Date of Birth <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></label>
            <label>Start Date <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></label>
          </div>
          <label>Permission Level
            <select value={form.permission} onChange={e => set('permission', e.target.value)} disabled={!isAdmin}>
              {PERMISSIONS
                .filter(p => isAdmin || p.value === 'staff')
                .map(p => (
                  <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
                ))}
            </select>
          </label>
          <label>Invite Message (optional)
            <textarea
              value={form.invite_message}
              onChange={e => set('invite_message', e.target.value)}
              rows={3}
              placeholder="Optional personal message for the invite email"
            />
          </label>
          {inviteFallback && (
            <div className="form-error" style={{ background: '#eff6ff', color: '#1e3a8a', border: '1px solid #bfdbfe' }}>
              <strong>Staff added. Manual send required:</strong> {inviteFallback.message}
              <br />
              <a href={inviteFallback.link} target="_blank" rel="noreferrer">Open invite link</a>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginLeft: 8 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteFallback.link)
                    setCopyState('copied')
                  } catch {
                    setCopyState('failed')
                  }
                }}
              >
                {copyState === 'copied' ? 'Copied' : 'Copy Link'}
              </button>
              {copyState === 'failed' && <span style={{ marginLeft: 8 }}>Could not copy automatically. Please copy manually.</span>}
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding…' : inviteFallback ? 'Create Another Staff Invite' : 'Add & Send Invite Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditStaffModal({ staff, onClose, onSuccess, callerProfile }) {
  const isAdmin = callerProfile?.permission === 'super_admin'
  const [form, setForm] = useState({
    centre: staff?.centre || '',
    role_title: staff?.role_title || '',
    permission: staff?.permission || 'staff',
    mobile: staff?.mobile || '',
    date_of_birth: staff?.date_of_birth || '',
    start_date: staff?.start_date || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-staff`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            userId: staff.id,
            centre: form.centre,
            role_title: form.role_title,
            permission: form.permission,
            mobile: form.mobile,
            date_of_birth: form.date_of_birth,
            start_date: form.start_date,
          }),
        }
      )
      const raw = await res.text().catch(() => '')
      let data = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
      if (!res.ok) throw new Error(getApiErrorMessage(data, `Could not update staff member (HTTP ${res.status}).`))
      showToast('Changes saved')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not update staff member.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Staff Member</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <label>Name
            <input value={`${staff.first_name} ${staff.last_name}`} disabled />
          </label>
          <div className="form-row">
            <label>Centre / Location
              <select value={form.centre} onChange={e => set('centre', e.target.value)} disabled={!isAdmin}>
                <option value="">Select centre…</option>
                {CENTRES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Role Title
              <input value={form.role_title} onChange={e => set('role_title', e.target.value)} placeholder="e.g. Lead Teacher" />
            </label>
          </div>
          <div className="form-row">
            <label>Mobile
              <input type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+64 21 123 4567" />
            </label>
            <label>Start Date
              <input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            </label>
          </div>
          <label>Date of Birth
            <input
              type="date"
              value={form.date_of_birth || ''}
              onChange={e => set('date_of_birth', e.target.value)}
              disabled={!isAdmin}
            />
          </label>
          <label>Permission Level
            <select value={form.permission} onChange={e => set('permission', e.target.value)} disabled={!isAdmin}>
              {PERMISSIONS
                .filter(p => isAdmin || p.value === 'staff')
                .map(p => (
                  <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
                ))}
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RemoveConfirm({ staff, onClose, onConfirm, loading }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Remove Staff Member</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <p>Are you sure you want to remove <strong>{staff.first_name} {staff.last_name}</strong>? This will permanently delete their account and they will lose all access.</p>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>{loading ? 'Removing…' : 'Yes, Remove'}</button>
        </div>
      </div>
    </div>
  )
}

export function StaffManagementPage({ currentProfile }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [centreFilter, setCentreFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'

  function canEditStaff(person) {
    if (person.id === currentProfile?.id) return false
    if (isAdmin) return true
    if (isCentreLeader) return person.centre === currentProfile.centre && person.permission === 'staff'
    return false
  }

  useEffect(() => { loadStaff() }, [])

  async function loadStaff() {
    setLoading(true)
    let query = supabase.from('profiles').select('*').order('first_name')
    if (isCentreLeader) query = query.eq('centre', currentProfile.centre)
    const { data } = await query
    setStaff(data || [])
    setLoading(false)
  }

  async function handleRemove() {
    if (!removing?.id) return
    setRemoveLoading(true)
    setRemoveError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-staff`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId: removing.id }),
        }
      )
      const raw = await res.text().catch(() => '')
      let data = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = raw }

      if (!res.ok) throw new Error(getApiErrorMessage(data, `Could not remove staff member (HTTP ${res.status}).`))

      setRemoving(null)
      showToast('Staff member removed')
      await loadStaff()
    } catch (err) {
      console.error(err)
      setRemoveError(err.message || 'Could not remove staff member.')
    }
    setRemoveLoading(false)
  }

  const filtered = staff.filter(s => {
    const matchSearch = search === '' ||
      `${s.first_name} ${s.last_name} ${s.email} ${s.role_title}`.toLowerCase().includes(search.toLowerCase())
    const matchCentre = centreFilter === 'all' || s.centre === centreFilter
    return matchSearch && matchCentre
  })

  return (
    <div className="staff-page">
      <div className="staff-page-header">
        <div>
          <h1>Staff Management</h1>
          <p>{staff.length} {staff.length === 1 ? 'member' : 'members'}{isCentreLeader ? ` at ${currentProfile.centre}` : ' across all centres'}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Staff Member
        </button>
      </div>

      <div className="staff-filters">
        <div className="staff-search">
          <Search size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or role…" />
        </div>
        {isAdmin && (
          <select value={centreFilter} onChange={e => setCentreFilter(e.target.value)}>
            <option value="all">All Centres</option>
            {CENTRES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="staff-loading">Loading staff…</div>
      ) : filtered.length === 0 ? (
        <div className="staff-empty">No staff members found.</div>
      ) : (
        <div className="staff-table">
          <div className="staff-table-head">
            <span>Name</span>
            <span>Centre</span>
            <span>Role</span>
            <span>Started</span>
            <span>Access</span>
            <span></span>
          </div>
          {filtered.map(s => (
            <div className="staff-row" key={s.id}>
              <div className="staff-name">
                <div className="staff-avatar">{s.first_name[0]}{s.last_name[0]}</div>
                <div>
                  <strong>{s.first_name} {s.last_name}</strong>
                  <span>{s.email}</span>
                  {s.mobile && <span>{s.mobile}</span>}
                </div>
              </div>
              <div className="staff-meta-grid">
                <span className="staff-centre" data-label="Centre">{s.centre || '—'}</span>
                <span className="staff-role" data-label="Role">{s.role_title || '—'}</span>
                <span className="staff-started" data-label="Started">{s.start_date ? new Date(s.start_date).toLocaleDateString('en-NZ', {day:'numeric',month:'short',year:'numeric'}) : '—'}</span>
                <span className="staff-permission" data-label="Access" style={{ color: PERMISSION_COLOURS[s.permission] }}>
                  {PERMISSION_LABELS[s.permission] || s.permission}
                </span>
              </div>
              <div className="staff-actions">
                {canEditStaff(s) && (
                  <button className="btn-icon-primary" onClick={() => setEditing(s)} title="Edit staff member">
                    <Edit2 size={15} />
                  </button>
                )}
                {s.id !== currentProfile?.id && (
                  <button className="btn-icon-danger" onClick={() => setRemoving(s)} title="Remove staff member">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onSuccess={loadStaff} callerProfile={currentProfile} />}
  {editing && <EditStaffModal staff={editing} onClose={() => setEditing(null)} onSuccess={loadStaff} callerProfile={currentProfile} />}
      {removing && (
        <div className="modal-overlay" onClick={() => setRemoving(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Remove Staff Member</h2>
              <button className="modal-close" onClick={() => setRemoving(null)}><X size={20} /></button>
            </div>
            <p>Are you sure you want to remove <strong>{removing.first_name} {removing.last_name}</strong>? This will permanently delete their account and they will lose all access.</p>
            {removeError && <div className="form-error" style={{ marginTop: 8 }}>{removeError}</div>}
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleRemove} disabled={removeLoading}>{removeLoading ? 'Removing…' : 'Yes, Remove'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

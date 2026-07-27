import React, { useState, useEffect } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, Edit2, User } from 'lucide-react'

function AddEditStaffModal({ staff, centre, onClose, onSaved, isAdmin }) {
  const isEdit = !!staff
  const [form, setForm] = useState({
    first_name: staff?.first_name || '',
    last_name: staff?.last_name || '',
    photo_url: staff?.photo_url || '',
    bio: staff?.bio || '',
    role_title: staff?.role_title || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')

    if (isEdit) {
      const { error } = await supabase.from('profiles').update({
        first_name: form.first_name,
        last_name: form.last_name,
        photo_url: form.photo_url,
        bio: form.bio,
        role_title: form.role_title,
      }).eq('id', staff.id)
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('profiles').insert({
        first_name: form.first_name,
        last_name: form.last_name,
        photo_url: form.photo_url,
        bio: form.bio,
        role_title: form.role_title,
        centre: centre,
        permission: 'staff',
        created_by: session?.user.id,
      })
      if (error) { setError(error.message); setLoading(false); return }
    }
    
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Person' : 'Add Staff Member'}</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <div className="form-row">
            <label>First Name <input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></label>
            <label>Last Name <input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></label>
          </div>
          <label>Role Title <input value={form.role_title} onChange={e => set('role_title', e.target.value)} placeholder="e.g. Teacher, Educator" /></label>
          <label>Photo URL <input value={form.photo_url} onChange={e => set('photo_url', e.target.value)} placeholder="https://example.com/photo.jpg" /></label>
          <label>Bio <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} placeholder="Brief bio about this person…" /></label>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Person'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function OurPeoplePage({ currentProfile }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addCentre, setAddCentre] = useState('')
  const [editingStaff, setEditingStaff] = useState(null)
  const [editCentre, setEditCentre] = useState('')
  const [deleting, setDeleting] = useState(null)

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'

  useEffect(() => { loadStaff() }, [])

  async function loadStaff() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('centre').order('permission').order('first_name')
    setStaff(data || [])
    setLoading(false)
  }

  async function handleDelete(person) {
    setDeleting(person.id)
    await supabase.from('profiles').delete().eq('id', person.id)
    setStaff(s => s.filter(p => p.id !== person.id))
    setDeleting(null)
  }

  function canEditPerson(person) {
    if (isAdmin) return true
    if (isCentreLeader && person.centre === currentProfile.centre) return true
    return false
  }

  function canDeletePerson(person) {
    if (isAdmin) return true
    if (isCentreLeader && person.centre === currentProfile.centre) return true
    return false
  }

  const canAddStaff = isAdmin || isCentreLeader
  const centreList = isAdmin ? CENTRES : [currentProfile?.centre]

  // Group staff by centre
  const groupedBycentre = {}
  centreList.forEach(c => { groupedBycentre[c] = [] })
  staff.forEach(p => {
    if (!centreList.includes(p.centre)) return
    if (!groupedBycentre[p.centre]) groupedBycentre[p.centre] = []
    groupedBycentre[p.centre].push(p)
  })

  // Separate relievers
  const relievers = staff.filter(p => p.permission === 'staff' && !p.centre)
  const centreStaff = centreList.map(c => ({
    centre: c,
    people: groupedBycentre[c] || [],
  }))

  return (
    <div className="our-people-page">
      <div className="staff-page-header">
        <div>
          <h1>Our People</h1>
          <p>Meet the team at Future Focus</p>
        </div>
        {canAddStaff && (
          <button className="btn-primary" onClick={() => { setShowAdd(true); setAddCentre('') }}>
            <Plus size={16}/> Add Person
          </button>
        )}
      </div>

      {loading ? (
        <div className="staff-loading">Loading staff…</div>
      ) : (
        <>
          {centreStaff.map(({ centre, people }) => (
            <div key={centre} className="centre-section">
              <h2 className="centre-title">{centre}</h2>
              
              {people.length === 0 ? (
                <div className="people-empty">No staff members at this centre yet.</div>
              ) : (
                <div className="people-grid">
                  {people.map(person => (
                    <div key={person.id} className="person-card">
                      <div className="person-photo">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={`${person.first_name} ${person.last_name}`} />
                        ) : (
                          <div className="photo-placeholder"><User size={40}/></div>
                        )}
                      </div>
                      <div className="person-info">
                        <h3>{person.first_name} {person.last_name}</h3>
                        {person.role_title && <p className="person-role">{person.role_title}</p>}
                        {person.permission === 'centre_leader' && <span className="leader-badge">Centre Leader</span>}
                        {person.bio && <p className="person-bio">{person.bio}</p>}
                      </div>
                      {(canEditPerson(person) || canDeletePerson(person)) && (
                        <div className="person-actions">
                          {canEditPerson(person) && (
                            <button className="btn-icon-primary" onClick={() => {
                              setEditingStaff(person)
                              setEditCentre(person.centre)
                            }} title="Edit person">
                              <Edit2 size={15}/>
                            </button>
                          )}
                          {canDeletePerson(person) && (
                            <button className="btn-icon-danger" onClick={() => handleDelete(person)} disabled={deleting === person.id} title="Remove person">
                              <Trash2 size={15}/>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isAdmin && relievers.length > 0 && (
            <div className="centre-section relievers-section">
              <h2 className="centre-title">🔄 Relievers</h2>
              <div className="people-grid">
                {relievers.map(person => (
                  <div key={person.id} className="person-card">
                    <div className="person-photo">
                      {person.photo_url ? (
                        <img src={person.photo_url} alt={`${person.first_name} ${person.last_name}`} />
                      ) : (
                        <div className="photo-placeholder"><User size={40}/></div>
                      )}
                    </div>
                    <div className="person-info">
                      <h3>{person.first_name} {person.last_name}</h3>
                      {person.role_title && <p className="person-role">{person.role_title}</p>}
                      {person.bio && <p className="person-bio">{person.bio}</p>}
                    </div>
                    <div className="person-actions">
                      {canEditPerson(person) && (
                        <button className="btn-icon-primary" onClick={() => {
                          setEditingStaff(person)
                          setEditCentre(null)
                        }} title="Edit person">
                          <Edit2 size={15}/>
                        </button>
                      )}
                      {canDeletePerson(person) && (
                        <button className="btn-icon-danger" onClick={() => handleDelete(person)} disabled={deleting === person.id} title="Remove person">
                          <Trash2 size={15}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && relievers.length === 0 && (
            <div className="centre-section relievers-section">
              <h2 className="centre-title">🔄 Relievers</h2>
              <div className="people-empty">No relievers added yet.</div>
              <button className="btn-primary" onClick={() => { setShowAdd(true); setAddCentre(null) }} style={{marginTop: '16px'}}>
                <Plus size={16}/> Add Reliever
              </button>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Person</h2>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={20}/></button>
            </div>
            <div className="staff-form">
              <label>Select Centre
                <select value={addCentre} onChange={e => setAddCentre(e.target.value)} required>
                  <option value="">Choose centre…</option>
                  {isAdmin ? (
                    CENTRES.map(c => <option key={c} value={c}>{c}</option>)
                  ) : (
                    <option value={currentProfile.centre}>{currentProfile.centre}</option>
                  )}
                  {isAdmin && <option value="">Relievers (No Centre)</option>}
                </select>
              </label>
              <div style={{textAlign: 'center', marginTop: '16px'}}>
                <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addCentre && showAdd && <AddEditStaffModal staff={null} centre={addCentre || null} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadStaff() }} isAdmin={isAdmin} />}
      {editingStaff && <AddEditStaffModal staff={editingStaff} centre={editCentre} onClose={() => setEditingStaff(null)} onSaved={loadStaff} isAdmin={isAdmin} />}
    </div>
  )
}

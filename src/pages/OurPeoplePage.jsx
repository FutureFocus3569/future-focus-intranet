import React, { useState, useEffect } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, Edit2, User, Search } from 'lucide-react'

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function formatDateLabel(value) {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not set'
  return parsed.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PersonDetailModal({ person, appraisalCycles = [], onClose, onOpenAppraisal }) {
  if (!person) return null

  const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Staff member'
  const permissionLabel = person.permission === 'super_admin'
    ? 'Super Admin'
    : person.permission === 'centre_leader'
      ? 'Centre Leader'
      : 'Staff'

  const personCycles = appraisalCycles
    .filter((cycle) => cycle.staff_id === person.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const latestCycle = personCycles[0] || null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card person-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Staff Profile</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>

        <div className="person-detail-body">
          <div className="person-detail-head">
            <div className="person-detail-photo">
              {person.photo_url ? (
                <img src={person.photo_url} alt={fullName} loading="lazy" decoding="async" />
              ) : (
                <div className="photo-placeholder"><User size={48}/></div>
              )}
            </div>
            <div className="person-detail-title">
              <h3>{fullName}</h3>
              <p>{person.role_title || 'Role not set'}</p>
            </div>
          </div>

          <div className="person-detail-grid">
            <div className="person-detail-item"><strong>Centre</strong><span>{person.centre || 'Reliever / No centre'}</span></div>
            <div className="person-detail-item"><strong>Access</strong><span>{permissionLabel}</span></div>
            <div className="person-detail-item"><strong>Email</strong><span>{person.email || 'Not set'}</span></div>
            <div className="person-detail-item"><strong>Mobile</strong><span>{person.mobile || 'Not set'}</span></div>
            <div className="person-detail-item"><strong>Start Date</strong><span>{formatDateLabel(person.start_date)}</span></div>
            <div className="person-detail-item"><strong>Date of Birth</strong><span>{formatDateLabel(person.date_of_birth)}</span></div>
          </div>

          <div className="person-detail-bio">
            <strong>Bio</strong>
            <p>{person.bio?.trim() ? person.bio : 'No bio added yet.'}</p>
          </div>

          <div className="person-detail-bio">
            <strong>Appraisal</strong>
            {latestCycle ? (
              <div className="person-appraisal-summary">
                <p><b>Template:</b> {latestCycle.template?.title || 'Template not set'}</p>
                <p><b>Status:</b> {latestCycle.status}</p>
                <p><b>Reviewer:</b> {latestCycle.reviewer_name || 'Not set'}</p>
                <p><b>Period:</b> {latestCycle.period_start} to {latestCycle.period_end}</p>
                {onOpenAppraisal && (
                  <button className="btn-primary" type="button" onClick={() => onOpenAppraisal(person.id)} style={{ marginTop: 8 }}>
                    Open Appraisal
                  </button>
                )}
              </div>
            ) : (
              <p>No appraisal assigned yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

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

export function OurPeoplePage({ currentProfile, onOpenAppraisal }) {
  const [staff, setStaff] = useState([])
  const [appraisalCycles, setAppraisalCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addCentre, setAddCentre] = useState('')
  const [editingStaff, setEditingStaff] = useState(null)
  const [editCentre, setEditCentre] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [search, setSearch] = useState('')

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'

  function isRelieverProfile(person) {
    const centreValue = typeof person?.centre === 'string' ? person.centre.trim().toLowerCase() : ''
    const roleValue = typeof person?.role_title === 'string' ? person.role_title.trim().toLowerCase() : ''
    const permissionValue = typeof person?.permission === 'string' ? person.permission.trim().toLowerCase() : ''

    if (!centreValue) return true
    if (centreValue === 'reliever' || centreValue === 'relievers') return true
    if (permissionValue === 'reliever') return true
    if (roleValue.includes('reliever')) return true
    return false
  }

  function calculateTenure(startDate) {
    if (!startDate) return ''
    const start = new Date(startDate)
    const now = new Date()
    const years = now.getFullYear() - start.getFullYear()
    const months = now.getMonth() - start.getMonth()
    
    if (years === 0 && months === 0) return 'Just started'
    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
    if (months < 0) return `${years - 1} year${years - 1 !== 1 ? 's' : ''}`
    return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`
  }

  const CENTRE_COLORS = {
    'Papamoa Beach': '#1a6eb5',
    'The Boulevard': '#0e9a8a',
    'Terrace Views': '#0084b3',
    'Livingstone': '#12956d',
    'West Dune': '#3b82c4',
    'Head Office': '#2eb89f',
  }

  function getCentreColor(centre) {
    return CENTRE_COLORS[centre] || '#9dcc2b'
  }

  function matchesSearch(person) {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const haystack = `${person.first_name || ''} ${person.last_name || ''} ${person.role_title || ''}`.toLowerCase()
    return haystack.includes(q)
  }

  function jumpToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => { loadStaff() }, [])

  useEffect(() => {
    if (staff.length === 0) {
      setAppraisalCycles([])
      return
    }
    loadAppraisals()
  }, [staff.length, currentProfile?.permission])

  async function loadStaff() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setStaff([])
        setLoading(false)
        return
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-staff`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      })

      if (!response.ok) {
        setStaff([])
        setLoading(false)
        return
      }

      const payload = await response.json().catch(() => ({}))
      setStaff(Array.isArray(payload?.staff) ? payload.staff : [])
    } catch {
      setStaff([])
    }
    setLoading(false)
  }

  async function loadAppraisals() {
    try {
      const staffIds = staff.map((p) => p.id).filter(Boolean)
      if (!staffIds.length) return

      const { data, error } = await supabase
        .from('appraisal_cycles')
        .select('id, staff_id, reviewer_id, template_id, period_start, period_end, status, created_at, template:appraisal_templates(title), reviewer:profiles!appraisal_cycles_reviewer_id_fkey(first_name,last_name)')
        .in('staff_id', staffIds)

      if (error) {
        console.error('Failed to load appraisal cycles for staff page:', error)
        return
      }

      const nextCycles = (data || []).map((cycle) => ({
        ...cycle,
        template: Array.isArray(cycle.template) ? cycle.template[0] : cycle.template,
        reviewer_name: cycle.reviewer
          ? `${cycle.reviewer.first_name || ''} ${cycle.reviewer.last_name || ''}`.trim()
          : '',
      }))
      setAppraisalCycles(nextCycles)
    } catch (err) {
      console.error('Appraisal cycle load error:', err)
    }
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
  const dynamicCentres = [...new Set(staff.map(p => p?.centre).filter(Boolean))]
  const centreList = [...new Set([...CENTRES, ...dynamicCentres])]

  // Group staff by centre
  const groupedBycentre = {}
  centreList.forEach(c => { groupedBycentre[c] = [] })
  staff.forEach(p => {
    if (isRelieverProfile(p)) return
    if (!centreList.includes(p.centre)) return
    if (!groupedBycentre[p.centre]) groupedBycentre[p.centre] = []
    groupedBycentre[p.centre].push(p)
  })

  // Sort each centre's staff so Centre Leaders appear first
  centreList.forEach(c => {
    groupedBycentre[c].sort((a, b) => {
      if (a.permission === 'centre_leader' && b.permission !== 'centre_leader') return -1
      if (a.permission !== 'centre_leader' && b.permission === 'centre_leader') return 1
      return a.first_name.localeCompare(b.first_name)
    })
  })

  // Separate relievers
  const relievers = staff.filter(isRelieverProfile)
  const centreStaff = centreList.map(c => ({
    centre: c,
    people: groupedBycentre[c] || [],
  }))

  const isSearching = search.trim().length > 0
  const visibleCentreStaff = centreStaff
    .map(cs => ({ ...cs, people: cs.people.filter(matchesSearch) }))
    .filter(cs => !isSearching || cs.people.length > 0)
  const visibleRelievers = relievers.filter(matchesSearch)
  const totalResults = visibleCentreStaff.reduce((sum, cs) => sum + cs.people.length, 0) + visibleRelievers.length

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
          <div className="people-toolbar">
            <div className="people-search">
              <Search size={15} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or role…"
                aria-label="Search staff"
              />
              {search && (
                <button className="people-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            {isSearching ? (
              <div className="people-results-count">{totalResults} result{totalResults !== 1 ? 's' : ''} for "{search.trim()}"</div>
            ) : (
              <div className="people-jump">
                {centreList.map(c => (
                  <button key={c} className="people-jump-chip" onClick={() => jumpToSection(`centre-${slugify(c)}`)}>{c}</button>
                ))}
                {(relievers.length > 0 || isAdmin) && (
                  <button className="people-jump-chip" onClick={() => jumpToSection('centre-relievers')}>🔄 Relievers</button>
                )}
              </div>
            )}
          </div>

          {isSearching && totalResults === 0 ? (
            <div className="people-empty">No staff match "{search.trim()}".</div>
          ) : (
            <>
              {visibleCentreStaff.map(({ centre, people }) => (
                <div key={centre} id={`centre-${slugify(centre)}`} className="centre-section">
                  <h2 className="centre-title" style={{ borderBottomColor: getCentreColor(centre) }}>
                    {centre}
                    <span className="centre-title-count">{people.length}</span>
                  </h2>

                  {people.length === 0 ? (
                    <div className="people-empty">No staff members at this centre yet.</div>
                  ) : (
                    <div className="people-grid">
                      {people.map(person => (
                        <div
                          key={person.id}
                          className="person-card person-card-clickable"
                          style={{ '--accent': getCentreColor(centre) }}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedPerson(person)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedPerson(person)
                            }
                          }}
                          aria-label={`View details for ${person.first_name} ${person.last_name}`}
                        >
                          <div className="person-photo">
                            {person.photo_url ? (
                              <img src={person.photo_url} alt={`${person.first_name} ${person.last_name}`} loading="lazy" decoding="async" />
                            ) : (
                              <div className="photo-placeholder"><User size={40}/></div>
                            )}
                          </div>
                          <div className="person-info">
                            <h3>{person.first_name} {person.last_name}</h3>
                            {person.role_title && <p className="person-role">{person.role_title}</p>}
                            {person.permission === 'centre_leader' && <span className="leader-badge">Centre Leader</span>}
                            <div className="person-dates">
                              {person.start_date && <span>{calculateTenure(person.start_date)}</span>}
                            </div>
                          </div>
                          {(canEditPerson(person) || canDeletePerson(person)) && (
                            <div className="person-actions">
                              {canEditPerson(person) && (
                                <button className="btn-icon-primary" onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingStaff(person)
                                  setEditCentre(person.centre)
                                }} title="Edit person">
                                  <Edit2 size={15}/>
                                </button>
                              )}
                              {canDeletePerson(person) && (
                                <button className="btn-icon-danger" onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(person)
                                }} disabled={deleting === person.id} title="Remove person">
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

              {visibleRelievers.length > 0 && (
                <div id="centre-relievers" className="centre-section relievers-section">
                  <h2 className="centre-title">Relievers<span className="centre-title-count">{visibleRelievers.length}</span></h2>
                  <div className="people-grid">
                    {visibleRelievers.map(person => (
                      <div
                        key={person.id}
                        className="person-card person-card-clickable"
                        style={{ '--accent': '#7c3aed' }}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedPerson(person)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedPerson(person)
                          }
                        }}
                        aria-label={`View details for ${person.first_name} ${person.last_name}`}
                      >
                        <div className="person-photo">
                          {person.photo_url ? (
                            <img src={person.photo_url} alt={`${person.first_name} ${person.last_name}`} loading="lazy" decoding="async" />
                          ) : (
                            <div className="photo-placeholder"><User size={40}/></div>
                          )}
                        </div>
                        <div className="person-info">
                          <h3>{person.first_name} {person.last_name}</h3>
                          {person.role_title && <p className="person-role">{person.role_title}</p>}
                        </div>
                        <div className="person-actions">
                          {canEditPerson(person) && (
                            <button className="btn-icon-primary" onClick={(e) => {
                              e.stopPropagation()
                              setEditingStaff(person)
                              setEditCentre(null)
                            }} title="Edit person">
                              <Edit2 size={15}/>
                            </button>
                          )}
                          {canDeletePerson(person) && (
                            <button className="btn-icon-danger" onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(person)
                            }} disabled={deleting === person.id} title="Remove person">
                              <Trash2 size={15}/>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && relievers.length === 0 && !isSearching && (
                <div id="centre-relievers" className="centre-section relievers-section">
                  <h2 className="centre-title">Relievers</h2>
                  <div className="people-empty">No relievers added yet.</div>
                  <button className="btn-primary" onClick={() => { setShowAdd(true); setAddCentre(null) }} style={{marginTop: '16px'}}>
                    <Plus size={16}/> Add Reliever
                  </button>
                </div>
              )}
            </>
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
      {selectedPerson && <PersonDetailModal person={selectedPerson} appraisalCycles={appraisalCycles} onClose={() => setSelectedPerson(null)} onOpenAppraisal={onOpenAppraisal} />}
    </div>
  )
}

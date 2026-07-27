import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Plus, Trash2, X, Upload, Edit2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'handbook', label: 'Staff Handbook' },
  { value: 'health_safety', label: 'Health & Safety' },
  { value: 'ece_regulations', label: 'ECE Regulations' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'leave', label: 'Leave Policy' },
  { value: 'other', label: 'Other' },
]

function AddPolicyModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    category: 'handbook',
    content: '',
    tags: '',
  })
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleDrag(e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      const file = files[0]
      const reader = new FileReader()
      reader.onload = (event) => {
        set('content', event.target.result)
      }
      reader.readAsText(file)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required')
      return
    }

    setLoading(true); setError('')
    const tagsArray = form.tags.split(',').map(t => t.trim()).filter(t => t)
    
    const { error } = await supabase.from('policies').insert({
      title: form.title,
      category: form.category,
      content: form.content,
      tags: tagsArray,
    })
    
    if (error) { setError(error.message); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Policy</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <label>Policy Title
            <input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. Health & Illness Policy" />
          </label>

          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Tags (comma-separated)
              <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. fever, illness, return" />
            </label>
          </div>

          <label>Policy Content</label>
          <div
            className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload size={32}/>
            <p><strong>Drag & drop</strong> a .txt file here or <label style={{cursor: 'pointer', color: '#005866'}}><u>click to browse</u>
              <input type="file" accept=".txt" style={{display: 'none'}} onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (event) => set('content', event.target.result)
                  reader.readAsText(file)
                }
              }} />
            </label></p>
            <small>PDFs? Copy-paste the text below instead, or convert to .txt first</small>
          </div>

          <textarea
            value={form.content}
            onChange={e => set('content', e.target.value)}
            placeholder="Policy text will appear here..."
            rows={10}
            style={{marginTop: 12}}
          />

          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Add Policy'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditPolicyModal({ policy, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: policy.title,
    category: policy.category,
    content: policy.content,
    tags: (policy.tags || []).join(', '),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const tagsArray = form.tags.split(',').map(t => t.trim()).filter(t => t)
    
    const { error } = await supabase.from('policies').update({
      title: form.title,
      category: form.category,
      content: form.content,
      tags: tagsArray,
      updated_at: new Date().toISOString(),
    }).eq('id', policy.id)
    
    if (error) { setError(error.message); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Policy</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <label>Policy Title
            <input value={form.title} onChange={e => set('title', e.target.value)} required />
          </label>

          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Tags (comma-separated)
              <input value={form.tags} onChange={e => set('tags', e.target.value)} />
            </label>
          </div>

          <label>Policy Content
            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={10} />
          </label>

          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function PoliciesAdminPage() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadPolicies() }, [])

  async function loadPolicies() {
    setLoading(true)
    const { data } = await supabase.from('policies').select('*').order('created_at', { ascending: false })
    setPolicies(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('policies').delete().eq('id', id)
    setPolicies(p => p.filter(policy => policy.id !== id))
    setDeleting(null)
  }

  const filtered = filter === 'all' 
    ? policies 
    : policies.filter(p => p.category === filter)

  return (
    <div className="policies-admin-page">
      <div className="staff-page-header">
        <div>
          <h1>Manage Policies</h1>
          <p>Upload and manage staff handbook, regulations, and procedures</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16}/> Add Policy
        </button>
      </div>

      <div className="filter-bar">
        <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {CATEGORIES.map(c => (
          <button key={c.value} className={`filter-tab ${filter === c.value ? 'active' : ''}`} onClick={() => setFilter(c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="staff-loading">Loading policies…</div>
      ) : filtered.length === 0 ? (
        <div className="staff-empty">No policies yet. Start by adding one!</div>
      ) : (
        <div className="policies-grid">
          {filtered.map(policy => {
            const cat = CATEGORIES.find(c => c.value === policy.category)
            return (
              <article className="policy-card" key={policy.id}>
                <div className="policy-header">
                  <h3>{policy.title}</h3>
                  <span className="policy-category">{cat?.label}</span>
                </div>
                <p className="policy-preview">{policy.content.substring(0, 150)}…</p>
                {policy.tags && policy.tags.length > 0 && (
                  <div className="policy-tags">
                    {policy.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="policy-actions">
                  <button className="btn-icon-primary" onClick={() => setEditingPolicy(policy)} title="Edit policy">
                    <Edit2 size={15}/>
                  </button>
                  <button className="btn-icon-danger" onClick={() => handleDelete(policy.id)} disabled={deleting === policy.id} title="Delete policy">
                    <Trash2 size={15}/>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showAdd && <AddPolicyModal onClose={() => setShowAdd(false)} onSaved={loadPolicies} />}
      {editingPolicy && <EditPolicyModal policy={editingPolicy} onClose={() => setEditingPolicy(null)} onSaved={loadPolicies} />}
    </div>
  )
}

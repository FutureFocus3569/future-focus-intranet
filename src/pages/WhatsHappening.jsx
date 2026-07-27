import React, { useState, useEffect } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, Megaphone, PartyPopper, BookOpen, Bell } from 'lucide-react'

const CATEGORIES = [
  { value: 'update',      label: 'Leadership Update', colour: '#005866', bg: '#eaf7f7', Icon: Megaphone },
  { value: 'celebration', label: 'Celebration',        colour: '#7c3aed', bg: '#f5f0ff', Icon: PartyPopper },
  { value: 'news',        label: 'Company News',       colour: '#0e7490', bg: '#ecfeff', Icon: BookOpen },
  { value: 'reminder',    label: 'Reminder',           colour: '#b45309', bg: '#fef3c7', Icon: Bell },
]

function getCat(value) { return CATEGORIES.find(c => c.value === value) || CATEGORIES[2] }

function AddPostModal({ onClose, onSaved, callerProfile }) {
  const isAdmin = callerProfile?.permission === 'super_admin'
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'news',
    centre: isAdmin ? '' : callerProfile?.centre ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session:', session?.user?.id)
      console.log('Posting:', form)
      const { data, error } = await supabase.from('posts').insert({
        ...form,
        centre: form.centre || null,
        created_by: session.user.id,
      })
      console.log('Response:', { data, error })
      if (error) { setError(error.message); setLoading(false); return }
      onSaved(); onClose()
    } catch (err) {
      console.error('Submit error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Post an Update</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <label>Title <input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="e.g. Team of the Month — West Dune!" /></label>
          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Centre
              <select value={form.centre} onChange={e => set('centre', e.target.value)} disabled={!isAdmin}>
                {isAdmin && <option value="">All Centres</option>}
                {CENTRES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label>Content
            <textarea value={form.body} onChange={e => set('body', e.target.value)} required rows={5} placeholder="Write your update here…" />
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Posting…' : 'Post Update'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function WhatsHappeningPage({ currentProfile }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'
  const canManage = isAdmin || isCentreLeader

  useEffect(() => { loadPosts() }, [])

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*, author:profiles(first_name,last_name)').order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    await supabase.from('posts').delete().eq('id', id)
    setPosts(p => p.filter(post => post.id !== id))
    setDeleting(null)
  }

  function canDelete(post) {
    if (isAdmin) return true
    if (isCentreLeader && post.centre === currentProfile.centre) return true
    return false
  }

  const filtered = posts.filter(p => {
    if (filter === 'all') return true
    return p.centre === filter || p.centre === null
  })

  return (
    <div className="whats-happening-page">
      <div className="staff-page-header">
        <div>
          <h1>What's Happening</h1>
          <p>Leadership updates, celebrations and company news</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16}/> Post Update
          </button>
        )}
      </div>

      <div className="events-filter-bar">
        <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Centres</button>
        {CENTRES.map(c => (
          <button key={c} className={`filter-tab ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="staff-loading">Loading updates…</div>
      ) : filtered.length === 0 ? (
        <div className="staff-empty">No updates yet{filter !== 'all' ? ` for ${filter}` : ''}.</div>
      ) : (
        <div className="posts-feed">
          {filtered.map(post => {
            const cat = getCat(post.category)
            const CatIcon = cat.Icon
            return (
              <article className="post-card" key={post.id}>
                <div className="post-card-header">
                  <span className="post-category-badge" style={{ background: cat.bg, color: cat.colour }}>
                    <CatIcon size={12}/> {cat.label}
                  </span>
                  <span className="post-centre-badge">{post.centre || 'All Centres'}</span>
                  <span className="post-time">{timeAgo(post.created_at)}</span>
                  {canDelete(post) && (
                    <button className="btn-icon-danger" onClick={() => handleDelete(post.id)} disabled={deleting === post.id} title="Delete post">
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
                <h2 className="post-title">{post.title}</h2>
                <p className="post-body">{post.body}</p>
                {post.author && (
                  <div className="post-author">
                    <div className="post-avatar">{post.author.first_name?.[0]}{post.author.last_name?.[0]}</div>
                    <span>{post.author.first_name} {post.author.last_name}</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {showAdd && <AddPostModal onClose={() => setShowAdd(false)} onSaved={loadPosts} callerProfile={currentProfile} />}
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, Megaphone, PartyPopper, BookOpen, Bell, Edit2, Image, Paperclip, FileText, ThumbsUp } from 'lucide-react'

const CATEGORIES = [
  { value: 'update',      label: 'Leadership Update', colour: '#005866', bg: '#eaf7f7', Icon: Megaphone },
  { value: 'celebration', label: 'Celebration',        colour: '#7c3aed', bg: '#f5f0ff', Icon: PartyPopper },
  { value: 'news',        label: 'Company News',       colour: '#0e7490', bg: '#ecfeff', Icon: BookOpen },
  { value: 'reminder',    label: 'Reminder',           colour: '#b45309', bg: '#fef3c7', Icon: Bell },
]

const TAGS = [
  { value: 'celebration', label: 'Celebration',  colour: '#1a6eb5', bg: '#e6eff9' },
  { value: 'news',        label: 'News',          colour: '#1a6eb5', bg: '#e6eff9' },
  { value: 'events',      label: 'Events',        colour: '#1a6eb5', bg: '#e6eff9' },
  { value: 'reminder',    label: 'Reminder',      colour: '#0e9a8a', bg: '#e6f5f2' },
  { value: 'learning',    label: 'Learning',      colour: '#0e9a8a', bg: '#e6f5f2' },
  { value: 'wellbeing',   label: 'Wellbeing',     colour: '#0e9a8a', bg: '#e6f5f2' },
]

function getTag(value) { return TAGS.find(t => t.value === value) }
function getCat(value) { return CATEGORIES.find(c => c.value === value) || CATEGORIES[2] }

function PostModal({ onClose, onSaved, callerProfile, editing }) {
  const isAdmin = callerProfile?.permission === 'super_admin'
  const isCentreLeader = callerProfile?.permission === 'centre_leader'
  const canChooseCentre = isAdmin || isCentreLeader
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    body: editing?.body ?? '',
    category: editing?.category ?? 'news',
    centre: editing?.centre ?? (isAdmin ? '' : callerProfile?.centre ?? ''),    tags: editing?.tags ?? [],
    images: editing?.images ?? [],
    attachment_url: editing?.attachment_url ?? null,
    attachment_name: editing?.attachment_name ?? null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const imageInputRef = useRef()
  const docInputRef = useRef()

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function toggleTag(tag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }))
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 3 - form.images.length
    const toUpload = files.slice(0, remaining)
    setUploadingImages(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const urls = []
      for (const file of toUpload) {
        const ext = file.name.split('.').pop()
        const filename = `images/${session.user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('post-media').upload(filename, file, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('post-media').getPublicUrl(filename)
        urls.push(data.publicUrl)
      }
      setForm(f => ({ ...f, images: [...f.images, ...urls] }))
    } catch (err) {
      setError('Image upload failed: ' + err.message)
    }
    setUploadingImages(false)
    e.target.value = ''
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const ext = file.name.split('.').pop()
      const filename = `docs/${session.user.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('post-media').upload(filename, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('post-media').getPublicUrl(filename)
      setForm(f => ({ ...f, attachment_url: data.publicUrl, attachment_name: file.name }))
    } catch (err) {
      setError('File upload failed: ' + err.message)
    }
    setUploadingDoc(false)
    e.target.value = ''
  }

  function removeImage(url) {
    setForm(f => ({ ...f, images: f.images.filter(i => i !== url) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const payload = {
        title: form.title,
        body: form.body,
        category: form.category,
        centre: form.centre || null,
        tags: form.tags || [],
        images: form.images || [],
        attachment_url: form.attachment_url || null,
        attachment_name: form.attachment_name || null,
      }
      if (editing) {
        const { error } = await supabase.from('posts').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        const { error } = await supabase.from('posts').insert({ ...payload, created_by: session.user.id })
        if (error) throw error
      }
      onSaved(); onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Post' : 'Post an Update'}</h2>
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
              <select value={form.centre} onChange={e => set('centre', e.target.value)} disabled={!canChooseCentre}>
                {canChooseCentre && <option value="">All Centres (Company-wide)</option>}
                {CENTRES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div>
            <label style={{marginBottom: 8, display: 'block'}}>Tags <span style={{fontWeight: 400, color: '#6b7e8a', fontSize: 12}}>(select all that apply)</span></label>
            <div className="tag-checkbox-group">
              {TAGS.map(tag => (
                <button
                  key={tag.value}
                  type="button"
                  className={`tag-checkbox-btn ${form.tags.includes(tag.value) ? 'selected' : ''}`}
                  style={form.tags.includes(tag.value) ? { background: tag.bg, color: tag.colour, borderColor: tag.colour } : {}}
                  onClick={() => toggleTag(tag.value)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
          <label>Content
            <textarea value={form.body} onChange={e => set('body', e.target.value)} required rows={4} placeholder="Write your update here…" />
          </label>

          {/* Image upload */}
          <div className="post-upload-section">
            <div className="post-upload-label"><Image size={15}/> Photos <span style={{color:'#8fa3ad',fontSize:12}}>(up to 3)</span></div>
            <div className="post-image-previews">
              {form.images.map(url => (
                <div key={url} className="post-image-thumb">
                  <img src={url} alt=""/>
                  <button type="button" className="post-image-remove" onClick={() => removeImage(url)}><X size={12}/></button>
                </div>
              ))}
              {form.images.length < 3 && (
                <>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleImageUpload} />
                  <button type="button" className="post-image-add" onClick={() => imageInputRef.current?.click()} disabled={uploadingImages}>
                    {uploadingImages ? '…' : <><Plus size={18}/><span>Add</span></>}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Document upload */}
          <div className="post-upload-section">
            <div className="post-upload-label"><Paperclip size={15}/> Attachment <span style={{color:'#8fa3ad',fontSize:12}}>(PDF or Word)</span></div>
            <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{display:'none'}} onChange={handleDocUpload} />
            {form.attachment_url ? (
              <div className="post-attachment-preview">
                <FileText size={16} style={{color:'#1a6eb5'}}/>
                <span>{form.attachment_name}</span>
                <button type="button" className="btn-icon-danger" style={{padding:'2px 4px'}} onClick={() => setForm(f => ({...f, attachment_url: null, attachment_name: null}))}><X size={12}/></button>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => docInputRef.current?.click()} disabled={uploadingDoc}>
                {uploadingDoc ? 'Uploading…' : 'Upload File'}
              </button>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : editing ? 'Save Changes' : 'Post Update'}</button>
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
  const [centreFilter, setCentreFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expandedYears, setExpandedYears] = useState({})
  const [userLikes, setUserLikes] = useState(new Set())
  const [liking, setLiking] = useState(null)

  const isAdmin = currentProfile?.permission === 'super_admin'
  const isCentreLeader = currentProfile?.permission === 'centre_leader'

  useEffect(() => { 
    loadPosts()
    if (currentProfile?.id) loadUserLikes()
  }, [currentProfile?.id])

  async function loadPosts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('loadPosts error:', error)
    const postsData = data || []
    if (postsData.length > 0) {
      const authorIds = [...new Set(postsData.map(p => p.created_by).filter(Boolean))]
      const { data: profiles } = await supabase.from('profiles').select('id,first_name,last_name').in('id', authorIds)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      postsData.forEach(p => { p.author = profileMap[p.created_by] || null })
    }
    setPosts(postsData)
    setLoading(false)
  }

  async function loadUserLikes() {
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentProfile.id)
    if (data) setUserLikes(new Set(data.map(l => l.post_id)))
  }

  async function handleLike(postId, currentLikes) {
    setLiking(postId)
    try {
      if (userLikes.has(postId)) {
        // Unlike
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentProfile.id)
        setUserLikes(s => { const n = new Set(s); n.delete(postId); return n })
        setPosts(p => p.map(post => post.id === postId ? { ...post, likes: Math.max(0, (post.likes || 0) - 1) } : post))
      } else {
        // Like
        await supabase.from('post_likes').insert({ post_id: postId, user_id: currentProfile.id })
        setUserLikes(s => new Set([...s, postId]))
        setPosts(p => p.map(post => post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post))
      }
    } catch (err) {
      console.error('Like error:', err)
    }
    setLiking(null)
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

  function canEdit(post) {
    return post.created_by === currentProfile?.id
  }

  const filtered = posts.filter(p => {
    const centreOk = centreFilter === 'all' || p.centre === centreFilter || p.centre === null
    const tagOk = tagFilter === 'all' || (p.tags && p.tags.includes(tagFilter))
    return centreOk && tagOk
  })

  // Group posts by year → month
  const currentYear = new Date().getFullYear()
  const byYear = {}
  filtered.forEach(post => {
    const d = new Date(post.created_at)
    const yr = d.getFullYear()
    const monthLabel = d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
    if (!byYear[yr]) byYear[yr] = {}
    if (!byYear[yr][monthLabel]) byYear[yr][monthLabel] = []
    byYear[yr][monthLabel].push(post)
  })
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  // Get trending posts
  const trendingMostLiked = [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5)
  const trendingMostViewed = [...filtered].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)

  function toggleYear(yr) {
    setExpandedYears(prev => ({ ...prev, [yr]: !prev[yr] }))
  }

  function renderPostCard(post) {
    const cat = getCat(post.category)
    const CatIcon = cat.Icon
    return (
      <article className="post-card" key={post.id} id={`post-${post.id}`}>
        <div className="post-card-header">
          <div className="post-header-info">
            <span className="post-category-badge" style={{ background: cat.bg, color: cat.colour }}>
              <CatIcon size={12}/> {cat.label}
            </span>
            <span className="post-centre-badge">{post.centre || 'All Centres'}</span>
            <span className="post-time">{timeAgo(post.created_at)}</span>
          </div>
          <div className="post-card-actions">
            {canEdit(post) && (
              <button className="btn-icon-edit" onClick={() => setEditing(post)} title="Edit post"><Edit2 size={14}/></button>
            )}
            {canDelete(post) && (
              <button className="btn-icon-danger" onClick={() => handleDelete(post.id)} disabled={deleting === post.id} title="Delete post"><Trash2 size={14}/></button>
            )}
          </div>
        </div>
        <div className="post-card-content">
          <h2 className="post-title">{post.title}</h2>
          <p className="post-body">{post.body}</p>
          {post.images && post.images.length > 0 && (
            <div className={`post-images post-images-${post.images.length}`}>
              {post.images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Image ${i + 1}`} />
                </a>
              ))}
            </div>
          )}
          {post.tags && post.tags.length > 0 && (
            <div className="post-tags">
              {post.tags.map(t => {
                const tag = getTag(t)
                return tag ? <span key={t} className="post-tag-badge" style={{ background: tag.bg, color: tag.colour }}>{tag.label}</span> : null
              })}
            </div>
          )}
          {post.attachment_url && (
            <a className="post-attachment-link" href={post.attachment_url} target="_blank" rel="noopener noreferrer">
              <FileText size={15}/> {post.attachment_name || 'Download attachment'}
            </a>
          )}
        </div>
        {post.author && (
          <div className="post-author">
            <div className="post-avatar">{post.author.first_name?.[0]}{post.author.last_name?.[0]}</div>
            <span>{post.author.first_name} {post.author.last_name}</span>
            <button className={`post-like-btn ${userLikes.has(post.id) ? 'liked' : ''}`} onClick={() => handleLike(post.id)} disabled={liking === post.id} title="Like this post">
              <ThumbsUp size={14}/> {post.likes || 0}
            </button>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="whats-happening-page">
      <div className="staff-page-header">
        <div>
          <h1>What's Happening</h1>
          <p>Leadership updates, celebrations and company news</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16}/> Post Update
        </button>
      </div>

      <div className="whats-happening-container">
        <div className="whats-happening-main">
          <div className="events-filter-bar">
            <button className={`filter-tab ${centreFilter === 'all' ? 'active' : ''}`} onClick={() => setCentreFilter('all')}>All Centres + Company-wide</button>
            {isAdmin ? (
              CENTRES.map(c => (
                <button key={c} className={`filter-tab ${centreFilter === c ? 'active' : ''}`} onClick={() => setCentreFilter(c)}>{c}</button>
              ))
            ) : (
              <button className={`filter-tab ${centreFilter === currentProfile?.centre ? 'active' : ''}`} onClick={() => setCentreFilter(currentProfile?.centre)}>
                {currentProfile?.centre}
              </button>
            )}
          </div>

          <div className="tag-filter-bar">
            <button className={`tag-filter-btn ${tagFilter === 'all' ? 'active' : ''}`} onClick={() => setTagFilter('all')}>All Tags</button>
            {TAGS.map(tag => (
              <button
                key={tag.value}
                className={`tag-filter-btn ${tagFilter === tag.value ? 'active' : ''}`}
                style={tagFilter === tag.value ? { background: tag.bg, color: tag.colour, borderColor: tag.colour } : {}}
                onClick={() => setTagFilter(tagFilter === tag.value ? 'all' : tag.value)}
              >
                {tag.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="staff-loading">Loading updates…</div>
          ) : filtered.length === 0 ? (
            <div className="staff-empty">No updates found for the selected filters.</div>
          ) : (
            years.map(yr => {
              const isPastYear = yr < currentYear
              const isExpanded = expandedYears[yr] ?? false
              const months = Object.keys(byYear[yr])

              if (isPastYear) {
                return (
                  <div key={yr} className="posts-year-section">
                    <button className="posts-year-toggle" onClick={() => toggleYear(yr)}>
                      {isExpanded ? '▾' : '▸'} {yr} — {Object.values(byYear[yr]).flat().length} posts
                    </button>
                    {isExpanded && months.map(month => (
                      <div key={month} className="posts-month-section">
                        <h3 className="posts-month-heading">{month}</h3>
                        <div className="posts-feed">{byYear[yr][month].map(renderPostCard)}</div>
                      </div>
                    ))}
                  </div>
                )
              }

              return (
                <div key={yr} className="posts-year-section">
                  {months.map(month => (
                    <div key={month} className="posts-month-section">
                      <h3 className="posts-month-heading">{month}</h3>
                      <div className="posts-feed">{byYear[yr][month].map(renderPostCard)}</div>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* Trends Sidebar */}
        <aside className="whats-happening-sidebar">
          <div className="trends-panel">
            <h3 className="trends-title">Trending</h3>
            
            <div className="trends-section trends-section-liked">
              <h4 className="trends-subtitle">Most Liked</h4>
              {trendingMostLiked.length === 0 ? (
                <p className="trends-empty">No posts yet</p>
              ) : (
                <div className="trends-list">
                  {trendingMostLiked.map(post => (
                    <div key={post.id} className="trend-item" onClick={() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      <p className="trend-title">{post.title}</p>
                      <p className="trend-author">{post.author?.first_name} {post.author?.last_name}</p>
                      <span className="trend-badge"><span className="trend-badge-icon">👍</span> {post.likes || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="trends-section trends-section-viewed">
              <h4 className="trends-subtitle">Most Viewed</h4>
              {trendingMostViewed.length === 0 ? (
                <p className="trends-empty">No posts yet</p>
              ) : (
                <div className="trends-list">
                  {trendingMostViewed.map(post => (
                    <div key={post.id} className="trend-item" onClick={() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      <p className="trend-title">{post.title}</p>
                      <p className="trend-author">{post.author?.first_name} {post.author?.last_name}</p>
                      <span className="trend-badge"><span className="trend-badge-icon">👁️</span> {post.views || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {(showAdd || editing) && (
        <PostModal
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={loadPosts}
          callerProfile={currentProfile}
          editing={editing}
        />
      )}
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { supabase, CENTRES } from '../lib/supabase.js'
import { Plus, Trash2, X, Megaphone, PartyPopper, BookOpen, Bell, Edit2, Image, Paperclip, FileText, ThumbsUp, MessageCircle, Flame } from 'lucide-react'
import { showToast } from '../lib/toast.js'

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

const CENTRE_COLORS = {
  'All Centres': { text: '#fff', bg: '#0e9a8a' },
  'Papamoa Beach': { text: '#fff', bg: '#1a6eb5' },
  'The Boulevard': { text: '#fff', bg: '#0e9a8a' },
  'Terrace Views': { text: '#fff', bg: '#0084b3' },
  'Livingstone': { text: '#fff', bg: '#12956d' },
  'West Dune': { text: '#fff', bg: '#3b82c4' },
  'Head Office': { text: '#fff', bg: '#2eb89f' },
}

function getTag(value) { return TAGS.find(t => t.value === value) }
function getCat(value) { return CATEGORIES.find(c => c.value === value) || CATEGORIES[2] }
function getCentreColor(centre) { return CENTRE_COLORS[centre] || { text: '#fff', bg: '#6b7e8a' } }

function parseStoredArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [value]
  } catch {
    return [value]
  }
}

function getAttachmentsFromPost(post) {
  const urls = parseStoredArray(post?.attachment_url)
  const names = parseStoredArray(post?.attachment_name)
  return urls.map((url, index) => ({
    url,
    name: names[index] || names[0] || `Attachment ${index + 1}`,
  }))
}

function PostModal({ onClose, onSaved, callerProfile, editing }) {
  const MAX_ATTACHMENTS = 5
  const isAdmin = callerProfile?.permission === 'super_admin'
  const isCentreLeader = callerProfile?.permission === 'centre_leader'
  const canChooseCentre = isAdmin || isCentreLeader
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    body: editing?.body ?? '',
    category: editing?.category ?? 'news',
    centre: editing?.centre ?? (isAdmin ? '' : callerProfile?.centre ?? ''),    tags: editing?.tags ?? [],
    images: editing?.images ?? [],
    attachments: getAttachmentsFromPost(editing),
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
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = MAX_ATTACHMENTS - form.attachments.length
    const toUpload = files.slice(0, remaining)
    if (!toUpload.length) {
      e.target.value = ''
      return
    }
    setUploadingDoc(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const uploaded = []
      for (const file of toUpload) {
        const ext = file.name.split('.').pop()
        const filename = `docs/${session.user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('post-media').upload(filename, file, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('post-media').getPublicUrl(filename)
        uploaded.push({ url: data.publicUrl, name: file.name })
      }
      setForm(f => ({ ...f, attachments: [...f.attachments, ...uploaded] }))
    } catch (err) {
      setError('File upload failed: ' + err.message)
    }
    setUploadingDoc(false)
    e.target.value = ''
  }

  function removeImage(url) {
    setForm(f => ({ ...f, images: f.images.filter(i => i !== url) }))
  }

  function removeAttachment(indexToRemove) {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, index) => index !== indexToRemove) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const attachmentUrls = form.attachments.map(a => a.url).filter(Boolean)
      const attachmentNames = form.attachments.map(a => a.name).filter(Boolean)
      const serializedAttachmentUrls = attachmentUrls.length === 0
        ? null
        : attachmentUrls.length === 1
          ? attachmentUrls[0]
          : JSON.stringify(attachmentUrls)
      const serializedAttachmentNames = attachmentNames.length === 0
        ? null
        : attachmentNames.length === 1
          ? attachmentNames[0]
          : JSON.stringify(attachmentNames)

      const payload = {
        title: form.title,
        body: form.body,
        category: form.category,
        centre: form.centre || null,
        tags: form.tags || [],
        images: form.images || [],
        attachment_url: serializedAttachmentUrls,
        attachment_name: serializedAttachmentNames,
      }
      if (editing) {
        const { error } = await supabase.from('posts').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        const { error } = await supabase.from('posts').insert({ ...payload, created_by: session.user.id })
        if (error) throw error
      }
      showToast(editing ? 'Post updated' : 'Post published')
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
                  <img src={url} alt="" loading="lazy" decoding="async"/>
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
            <div className="post-upload-label"><Paperclip size={15}/> Attachments <span style={{color:'#8fa3ad',fontSize:12}}>(PDF or Word, up to {MAX_ATTACHMENTS})</span></div>
            <input ref={docInputRef} type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{display:'none'}} onChange={handleDocUpload} />
            {form.attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {form.attachments.map((attachment, index) => (
                  <div key={`${attachment.url}-${index}`} className="post-attachment-preview">
                    <FileText size={16} style={{color:'#1a6eb5'}}/>
                    <span>{attachment.name}</span>
                    <button type="button" className="btn-icon-danger" style={{padding:'2px 4px'}} onClick={() => removeAttachment(index)}><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
            {form.attachments.length < MAX_ATTACHMENTS && (
              <button type="button" className="btn-secondary" onClick={() => docInputRef.current?.click()} disabled={uploadingDoc}>
                {uploadingDoc ? 'Uploading…' : 'Upload Files'}
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

function PostReadModal({ post, onClose, comments = [], commentDraft = '', onCommentDraftChange, onSubmitComment, commentSubmitting = false, commentError = '' }) {
  if (!post) return null
  const centreName = post.centre || 'All Centres'
  const attachments = getAttachmentsFromPost(post)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{post.title}</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="post-read-content">
          <div className="post-read-meta">{centreName} • {timeAgo(post.created_at)}</div>
          <p className="post-read-body">{post.body}</p>
          {post.images && post.images.length > 0 && (
            <div className="post-read-images">
              {post.images.map((url, index) => (
                <img key={`${post.id}-read-image-${index}`} src={url} alt={`Image ${index + 1}`} loading="lazy" decoding="async" />
              ))}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="post-read-attachments">
              <h4>Attachments</h4>
              {attachments.map((attachment, index) => (
                <a
                  key={`${post.id}-read-attachment-${index}`}
                  className="post-attachment-link"
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={15}/> {attachment.name || `Download attachment ${index + 1}`}
                </a>
              ))}
            </div>
          )}

          <div className="post-comments-section">
            <h4 className="post-comments-title"><MessageCircle size={15}/> Comments ({comments.length})</h4>
            <form className="post-comment-form" onSubmit={(e) => { e.preventDefault(); onSubmitComment?.() }}>
              <textarea
                value={commentDraft}
                onChange={(e) => onCommentDraftChange?.(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                maxLength={1000}
              />
              {commentError && <div className="post-comment-error">{commentError}</div>}
              <button type="submit" className="btn-primary" disabled={commentSubmitting || !commentDraft.trim()}>
                {commentSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </form>

            {comments.length === 0 ? (
              <p className="post-comments-empty">No comments yet. Be the first to comment.</p>
            ) : (
              <div className="post-comments-list">
                {comments.map(comment => {
                  const authorName = `${comment?.author?.first_name || ''} ${comment?.author?.last_name || ''}`.trim() || 'Team Member'
                  return (
                    <article key={comment.id} className="post-comment-item">
                      <div className="post-comment-meta">
                        <strong>{authorName}</strong>
                        <span>{timeAgo(comment.created_at)}</span>
                      </div>
                      <p>{comment.comment}</p>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
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
  const [commentsByPost, setCommentsByPost] = useState({})
  const [commentDraftByPost, setCommentDraftByPost] = useState({})
  const [commentErrorByPost, setCommentErrorByPost] = useState({})
  const [commentingPostId, setCommentingPostId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [centreFilter, setCentreFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [readingPost, setReadingPost] = useState(null)
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

  function getAuthorDisplay(author) {
    if (!author) return 'Future Focus Team'
    const fullName = `${author.first_name || ''} ${author.last_name || ''}`.trim()
    return fullName || 'Future Focus Team'
  }

  function getInitials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (!words.length) return 'FF'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
  }

  function getCommentCount(postId) {
    return commentsByPost[postId]?.length || 0
  }

  async function loadPosts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('loadPosts error:', error)
    const postsData = data || []
    let commentsMap = {}

    if (postsData.length > 0) {
      try {
        const postIds = postsData.map(p => p.id)
        const { data: likeRows, error: likesError } = await supabase
          .from('post_likes')
          .select('post_id')
          .in('post_id', postIds)

        if (likesError) {
          console.error('loadPosts likes error:', likesError)
        } else {
          const likeCounts = (likeRows || []).reduce((acc, row) => {
            acc[row.post_id] = (acc[row.post_id] || 0) + 1
            return acc
          }, {})

          postsData.forEach(post => {
            post.likes = likeCounts[post.id] || 0
          })
        }
      } catch (likesErr) {
        console.error('loadPosts likes fetch exception:', likesErr)
      }

      try {
        const postIds = postsData.map(p => p.id)
        const { data: commentRows, error: commentsError } = await supabase
          .from('post_comments')
          .select('id, post_id, user_id, comment, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true })

        if (commentsError) {
          console.error('loadPosts comments error:', commentsError)
        } else {
          commentsMap = (commentRows || []).reduce((acc, row) => {
            if (!acc[row.post_id]) acc[row.post_id] = []
            acc[row.post_id].push(row)
            return acc
          }, {})

          postsData.forEach(post => {
            post.comments_count = commentsMap[post.id]?.length || 0
          })
        }
      } catch (commentsErr) {
        console.error('loadPosts comments fetch exception:', commentsErr)
      }
    }

    if (postsData.length > 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        if (token) {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-staff`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          })

          if (response.ok) {
            const payload = await response.json().catch(() => ({}))
            const profiles = Array.isArray(payload?.staff) ? payload.staff : []
            const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
            postsData.forEach(p => { p.author = profileMap[p.created_by] || null })
            commentsMap = Object.fromEntries(
              Object.entries(commentsMap).map(([postId, comments]) => [
                postId,
                comments.map(comment => ({ ...comment, author: profileMap[comment.user_id] || null })),
              ])
            )
          } else {
            postsData.forEach(p => { p.author = null })
          }
        } else {
          postsData.forEach(p => { p.author = null })
        }
      } catch {
        postsData.forEach(p => { p.author = null })
      }
    }

    setPosts(postsData)
    setCommentsByPost(commentsMap)
    setLoading(false)
  }

  async function handleAddComment(postId) {
    const text = (commentDraftByPost[postId] || '').trim()
    if (!text || !currentProfile?.id) return

    setCommentingPostId(postId)
    setCommentErrorByPost(prev => ({ ...prev, [postId]: '' }))

    try {
      const { data: inserted, error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: currentProfile.id, comment: text })
        .select('id, post_id, user_id, comment, created_at')
        .single()

      if (error) throw error

      const commentWithAuthor = {
        ...inserted,
        author: {
          id: currentProfile.id,
          first_name: currentProfile.first_name,
          last_name: currentProfile.last_name,
        },
      }

      setCommentsByPost(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), commentWithAuthor],
      }))
      setCommentDraftByPost(prev => ({ ...prev, [postId]: '' }))
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, comments_count: (post.comments_count || 0) + 1 } : post))
    } catch (err) {
      setCommentErrorByPost(prev => ({ ...prev, [postId]: err.message || 'Could not post comment.' }))
    }

    setCommentingPostId(null)
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
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentProfile.id)
        if (error) throw error
        setUserLikes(s => { const n = new Set(s); n.delete(postId); return n })
        setPosts(p => p.map(post => post.id === postId ? { ...post, likes: Math.max(0, (post.likes || 0) - 1) } : post))
      } else {
        // Like
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: currentProfile.id })
        if (error) throw error
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
    showToast('Post deleted')
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
  const trendingMostLiked = [...filtered].filter(p => (p.likes || 0) > 0).sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3)
  const trendingMostCommented = [...filtered].filter(p => (p.comments_count || 0) > 0).sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0)).slice(0, 3)

  function toggleYear(yr) {
    setExpandedYears(prev => ({ ...prev, [yr]: !prev[yr] }))
  }

  function openPost(post) {
    setReadingPost(post)
  }

  function renderPostCard(post) {
    const cat = getCat(post.category)
    const CatIcon = cat.Icon
    const centreName = post.centre || 'All Centres'
    const centreColor = getCentreColor(centreName)
    const attachments = getAttachmentsFromPost(post)
    const authorName = getAuthorDisplay(post.author)
    return (
      <article className="post-card" key={post.id} id={`post-${post.id}`}>
        <div className="post-card-header">
          <div className="post-header-info">
            <span className="post-category-badge" style={{ background: cat.bg, color: cat.colour }}>
              <CatIcon size={12}/> {cat.label}
            </span>
            <span className="post-centre-badge" style={{ background: centreColor.bg, color: centreColor.text }}>{centreName}</span>
            {post.tags && post.tags.map(t => {
              const tag = getTag(t)
              return tag ? <span key={t} className="post-tag-badge" style={{ background: tag.bg, color: tag.colour }}>{tag.label}</span> : null
            })}
            {attachments.length > 0 && (
              <span className="post-attachment-badge" title={`${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`}>
                <Paperclip size={11}/> {attachments.length}
              </span>
            )}
          </div>
          <div className="post-card-actions">
            {canEdit(post) && (
              <button className="btn-icon-edit" onClick={(e) => { e.stopPropagation(); setEditing(post) }} title="Edit post"><Edit2 size={14}/></button>
            )}
            {canDelete(post) && (
              <button className="btn-icon-danger" onClick={(e) => { e.stopPropagation(); handleDelete(post.id) }} disabled={deleting === post.id} title="Delete post"><Trash2 size={14}/></button>
            )}
          </div>
        </div>
        <div className="post-card-content post-card-content-clickable" onClick={() => openPost(post)}>
          <h2 className="post-title" title={post.title}>{post.title}</h2>
          <p className="post-body">{post.body}</p>
          {post.images && post.images.length > 0 && (
            <div className={`post-images post-images-${post.images.length}`}>
              {post.images.map((url, i) => (
                <div key={i}>
                  <img src={url} alt={`Image ${i + 1}`} loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="post-author">
          <div className="post-avatar">{getInitials(authorName)}</div>
          <div className="post-author-info">
            <span>{authorName}</span>
            <span className="post-time">{timeAgo(post.created_at)}</span>
          </div>
          <button className={`post-like-btn ${userLikes.has(post.id) ? 'liked' : ''}`} onClick={(e) => { e.stopPropagation(); handleLike(post.id) }} disabled={liking === post.id} title="Like this post">
            <ThumbsUp size={14}/> {post.likes || 0}
          </button>
          <button className="post-comment-btn" onClick={(e) => { e.stopPropagation(); openPost(post) }} title="Open comments">
            <MessageCircle size={14}/> {getCommentCount(post.id)}
          </button>
        </div>
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
            <select
              className="centre-filter-select"
              value={centreFilter}
              onChange={(e) => setCentreFilter(e.target.value)}
            >
              <option value="all">All Centres</option>
              {isAdmin ? (
                CENTRES.map(c => <option key={c} value={c}>{c}</option>)
              ) : (
                <option value={currentProfile?.centre}>{currentProfile?.centre}</option>
              )}
            </select>
            <select
              className="centre-filter-select"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="all">All Tags</option>
              {TAGS.map(tag => (
                <option key={tag.value} value={tag.value}>{tag.label}</option>
              ))}
            </select>
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
            <h3 className="trends-title"><Flame size={16}/> Trending</h3>

            <div className="trends-section trends-section-liked">
              <h4 className="trends-subtitle"><ThumbsUp size={13}/> Most Liked</h4>
              {trendingMostLiked.length === 0 ? (
                <p className="trends-empty">No likes yet</p>
              ) : (
                <div className="trends-list">
                  {trendingMostLiked.map((post, index) => (
                    <button key={post.id} type="button" className="trend-item" onClick={() => openPost(post)}>
                      <span className="trend-rank">{index + 1}</span>
                      <span className="trend-item-body">
                        <span className="trend-title">{post.title}</span>
                        <span className="trend-author">{getAuthorDisplay(post.author)}</span>
                      </span>
                      <span className="trend-badge"><ThumbsUp size={12}/> {post.likes || 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="trends-section trends-section-commented">
              <h4 className="trends-subtitle"><MessageCircle size={13}/> Most Commented</h4>
              {trendingMostCommented.length === 0 ? (
                <p className="trends-empty">No comments yet</p>
              ) : (
                <div className="trends-list">
                  {trendingMostCommented.map((post, index) => (
                    <button key={post.id} type="button" className="trend-item" onClick={() => openPost(post)}>
                      <span className="trend-rank">{index + 1}</span>
                      <span className="trend-item-body">
                        <span className="trend-title">{post.title}</span>
                        <span className="trend-author">{getAuthorDisplay(post.author)}</span>
                      </span>
                      <span className="trend-badge"><MessageCircle size={12}/> {post.comments_count || 0}</span>
                    </button>
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

      {readingPost && (
        <PostReadModal
          post={readingPost}
          comments={commentsByPost[readingPost.id] || []}
          commentDraft={commentDraftByPost[readingPost.id] || ''}
          onCommentDraftChange={(value) => setCommentDraftByPost(prev => ({ ...prev, [readingPost.id]: value }))}
          onSubmitComment={() => handleAddComment(readingPost.id)}
          commentSubmitting={commentingPostId === readingPost.id}
          commentError={commentErrorByPost[readingPost.id] || ''}
          onClose={() => setReadingPost(null)}
        />
      )}
    </div>
  )
}

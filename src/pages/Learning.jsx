import React, { useState, useEffect, useMemo } from 'react'
import {
  GraduationCap, BookOpen, PlayCircle, FileText, Image as ImageIcon, Download,
  CheckCircle2, Circle, Clock, Award, Flame, Trophy, Search, ChevronRight,
  ChevronLeft, X, Plus, Edit2, Trash2, Upload, ArrowLeft, Star, Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import * as learningService from '../lib/learningService.js'
import { showToast } from '../lib/toast.js'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'health-safety', label: 'Health & Safety' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'leadership', label: 'Leadership' },
]

const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const CONTENT_TYPES = [
  { value: 'video', label: 'Video', Icon: PlayCircle },
  { value: 'pdf', label: 'PDF', Icon: FileText },
  { value: 'slides', label: 'Slides', Icon: FileText },
  { value: 'image', label: 'Image', Icon: ImageIcon },
  { value: 'interactive_page', label: 'Interactive page', Icon: Sparkles },
  { value: 'resource', label: 'Downloadable resource', Icon: Download },
]

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multiple_select', label: 'Multiple Select' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'reflection_text', label: 'Reflection' },
]

function categoryLabel(value) {
  return CATEGORIES.find(c => c.value === value)?.label || value
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

function ProgressRing({ percent, size = 44 }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width={size} height={size} className="lp-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5edf3" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0e9a8a" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="lp-ring-label">{percent}%</text>
    </svg>
  )
}

function CourseCard({ course, enrollment, assignment, onOpen, onToggleFavourite }) {
  const moduleCount = course.module_count ?? null
  const isRequired = assignment ? true : course.is_required
  const dueDate = assignment?.due_date || enrollment?.due_date
  const dd = daysUntil(dueDate)
  const status = enrollment?.status || 'not_started'
  const progress = enrollment?.progress_percent || 0
  const isNew = !enrollment && (Date.now() - new Date(course.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14

  return (
    <article className="lp-card" onClick={() => onOpen(course)}>
      <div className="lp-card-thumb" style={course.thumbnail_url ? { backgroundImage: `url(${course.thumbnail_url})` } : {}}>
        {!course.thumbnail_url && <BookOpen size={26} />}
        {status === 'completed' && <span className="lp-card-check"><CheckCircle2 size={16} /></span>}
        <button
          className={`lp-card-fav ${enrollment?.is_favourite ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); enrollment && onToggleFavourite(enrollment, !enrollment.is_favourite) }}
          disabled={!enrollment}
          title={enrollment ? 'Favourite' : 'Start the course to favourite it'}
        >
          <Star size={14} />
        </button>
      </div>
      <div className="lp-card-body">
        <div className="lp-card-badges">
          <span className="lp-card-badge lp-card-badge-cat">{categoryLabel(course.category)}</span>
          {isRequired ? <span className="lp-card-badge lp-card-badge-required">Required</span> : <span className="lp-card-badge lp-card-badge-optional">Optional</span>}
          {isNew && <span className="lp-card-badge lp-card-badge-new">New</span>}
          {dd !== null && dd < 0 && status !== 'completed' && <span className="lp-card-badge lp-card-badge-overdue">Overdue</span>}
          {dd !== null && dd >= 0 && dd <= 7 && status !== 'completed' && <span className="lp-card-badge lp-card-badge-duesoon">Due soon</span>}
        </div>
        <h3>{course.title}</h3>
        {course.short_description && <p>{course.short_description}</p>}
        <div className="lp-card-meta">
          {course.duration_minutes && <span><Clock size={12} /> {formatDuration(course.duration_minutes)}</span>}
          {moduleCount !== null && <span>{moduleCount} module{moduleCount === 1 ? '' : 's'}</span>}
          <span className="lp-card-difficulty">{DIFFICULTIES.find(d => d.value === course.difficulty)?.label}</span>
        </div>
        {dueDate && <div className="lp-card-due">Due {formatDate(dueDate)}</div>}
        {enrollment && status !== 'not_started' && (
          <div className="lp-card-progress">
            <div className="lp-card-progress-track"><div className="lp-card-progress-fill" style={{ width: `${progress}%` }} /></div>
            <span>{status === 'completed' ? 'Completed' : `${progress}%`}</span>
          </div>
        )}
      </div>
    </article>
  )
}

function ModuleContent({ module }) {
  switch (module.content_type) {
    case 'video':
      return <video key={module.id} controls className="lm-media lm-video" src={module.content_url} />
    case 'image':
      return <img key={module.id} className="lm-media lm-image" src={module.content_url} alt={module.title} />
    case 'pdf':
    case 'slides':
      return (
        <div className="lm-embed-wrap">
          <iframe key={module.id} className="lm-media lm-embed" src={module.content_url} title={module.title} />
          <a className="btn-secondary" href={module.content_url} target="_blank" rel="noreferrer"><Download size={14} /> Open in new tab</a>
        </div>
      )
    case 'resource':
      return (
        <a className="lm-resource-link" href={module.content_url} target="_blank" rel="noreferrer">
          <Download size={18} /> Download {module.title}
        </a>
      )
    default:
      return <div className="lm-body-text">{module.content_body}</div>
  }
}

function QuestionRunner({ questions, initialAnswers, onSubmit, submitting }) {
  const [answers, setAnswers] = useState(initialAnswers || {})

  function setAnswer(qId, value) {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const allAnswered = questions.every(q => {
    const a = answers[q.id]
    if (q.question_type === 'multiple_select') return Array.isArray(a) && a.length > 0
    return a !== undefined && a !== null && a !== ''
  })

  return (
    <div className="lm-quiz">
      {questions.map((q, i) => (
        <div key={q.id} className="lm-question">
          <div className="lm-question-prompt"><span className="lm-question-num">{i + 1}</span>{q.prompt}</div>
          {q.question_type === 'multiple_choice' && (
            <div className="lm-options">
              {(q.options || []).map(opt => (
                <button key={opt.id} type="button" className={`lm-option ${answers[q.id] === opt.id ? 'selected' : ''}`} onClick={() => setAnswer(q.id, opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {q.question_type === 'multiple_select' && (
            <div className="lm-options">
              {(q.options || []).map(opt => {
                const selected = Array.isArray(answers[q.id]) && answers[q.id].includes(opt.id)
                return (
                  <button key={opt.id} type="button" className={`lm-option ${selected ? 'selected' : ''}`} onClick={() => {
                    const current = Array.isArray(answers[q.id]) ? answers[q.id] : []
                    setAnswer(q.id, selected ? current.filter(id => id !== opt.id) : [...current, opt.id])
                  }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}
          {q.question_type === 'true_false' && (
            <div className="lm-options lm-options-row">
              <button type="button" className={`lm-option ${answers[q.id] === true ? 'selected' : ''}`} onClick={() => setAnswer(q.id, true)}>True</button>
              <button type="button" className={`lm-option ${answers[q.id] === false ? 'selected' : ''}`} onClick={() => setAnswer(q.id, false)}>False</button>
            </div>
          )}
          {q.question_type === 'short_answer' && (
            <input className="lm-text-input" value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder="Your answer…" />
          )}
          {q.question_type === 'reflection_text' && (
            <textarea className="lm-text-input" rows={3} value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)} placeholder="Share your thoughts…" />
          )}
        </div>
      ))}
      <button className="btn-primary" disabled={!allAnswered || submitting} onClick={() => onSubmit(answers)}>
        {submitting ? 'Submitting…' : 'Submit answers'}
      </button>
    </div>
  )
}

function CoursePlayer({ course, modules, currentProfile, onExit, onProgressUpdate }) {
  const [enrollment, setEnrollment] = useState(null)
  const [progressByModule, setProgressByModule] = useState({})
  const [activeModuleIndex, setActiveModuleIndex] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => { init() }, [course.id])

  async function init() {
    setLoading(true)
    const en = await learningService.getOrCreateEnrollment(course.id, currentProfile.id, { isRequired: course.is_required })
    setEnrollment(en)
    const { data } = await supabase.from('learning_module_progress').select('*').eq('enrollment_id', en.id)
    const map = {}
    ;(data || []).forEach(row => { map[row.module_id] = row })
    setProgressByModule(map)
    const firstIncomplete = modules.findIndex(m => map[m.id]?.status !== 'completed')
    setActiveModuleIndex(firstIncomplete === -1 ? 0 : firstIncomplete)
    setLoading(false)
  }

  const activeModule = modules[activeModuleIndex]
  const activeProgress = activeModule ? progressByModule[activeModule.id] : null

  async function markModuleComplete(answers, score) {
    setSubmitting(true)
    try {
      await learningService.saveModuleProgress(enrollment.id, activeModule.id, currentProfile.id, {
        status: 'completed', answers: answers || {}, score,
      })
      const { percent, justCompleted } = await learningService.recalculateEnrollmentProgress(enrollment.id, modules.length)
      setProgressByModule(prev => ({ ...prev, [activeModule.id]: { status: 'completed', answers, score } }))
      setEnrollment(prev => ({ ...prev, progress_percent: percent }))
      onProgressUpdate?.()
      setShowQuiz(false)
      if (justCompleted) {
        setCelebrate(true)
        showToast(`Course complete! +${course.points_awarded || 0} points`)
      } else if (activeModuleIndex < modules.length - 1) {
        setActiveModuleIndex(i => i + 1)
      }
    } catch (err) {
      showToast(err.message || 'Could not save progress', 'error')
    }
    setSubmitting(false)
  }

  function handleContinue() {
    if (activeModule.questions?.length) {
      setShowQuiz(true)
    } else {
      markModuleComplete({}, null)
    }
  }

  if (loading) return <div className="modal-overlay"><div className="lm-loading">Loading course…</div></div>

  if (!modules.length) {
    return (
      <div className="modal-overlay">
        <div className="lm-loading">
          <p style={{ margin: '0 0 14px' }}>This course doesn't have any content yet — check back soon.</p>
          <button className="btn-primary" onClick={onExit}>Back to Learning Hub</button>
        </div>
      </div>
    )
  }

  if (celebrate) {
    return (
      <div className="modal-overlay">
        <div className="lm-celebrate">
          <div className="lm-celebrate-icon"><Trophy size={40} /></div>
          <h2>Course complete!</h2>
          <p>{course.title}</p>
          <div className="lm-celebrate-stats">
            <span><Star size={14} /> +{course.points_awarded || 0} points</span>
            {course.pd_hours > 0 && <span><Clock size={14} /> +{course.pd_hours} PD hours</span>}
            {course.certificate_enabled && <span><Award size={14} /> Certificate earned</span>}
          </div>
          <button className="btn-primary" onClick={onExit}>Back to Learning Hub</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lm-player-overlay">
      <div className="lm-player">
        <div className="lm-player-header">
          <button className="lm-player-back" onClick={onExit}><ArrowLeft size={18} /> Exit</button>
          <div className="lm-player-title">{course.title}</div>
          <div className="lm-player-progress">{enrollment?.progress_percent || 0}%</div>
        </div>
        <div className="lm-player-body">
          <aside className="lm-module-list">
            {modules.map((m, i) => {
              const status = progressByModule[m.id]?.status || 'not_started'
              return (
                <button key={m.id} className={`lm-module-list-item ${i === activeModuleIndex ? 'active' : ''}`} onClick={() => { setActiveModuleIndex(i); setShowQuiz(false) }}>
                  {status === 'completed' ? <CheckCircle2 size={16} className="done" /> : <Circle size={16} />}
                  <span>{m.title}</span>
                </button>
              )
            })}
          </aside>
          <div className="lm-module-content">
            {activeModule && !showQuiz && (
              <>
                <h3>{activeModule.title}</h3>
                {activeModule.description && <p className="lm-module-desc">{activeModule.description}</p>}
                <ModuleContent module={activeModule} />
                <div className="lm-module-actions">
                  {progressByModule[activeModule.id]?.status === 'completed' ? (
                    <button className="btn-secondary" disabled><CheckCircle2 size={14} /> Completed</button>
                  ) : (
                    <button className="btn-primary" onClick={handleContinue}>
                      {activeModule.questions?.length ? 'Continue to questions' : 'Mark complete'}
                    </button>
                  )}
                </div>
              </>
            )}
            {activeModule && showQuiz && (
              <>
                <h3>{activeModule.title} — Quick check</h3>
                <QuestionRunner
                  questions={activeModule.questions}
                  initialAnswers={progressByModule[activeModule.id]?.answers}
                  submitting={submitting}
                  onSubmit={(answers) => markModuleComplete(answers, learningService.scoreModuleAnswers(activeModule.questions, answers))}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LearningHome({ courses, enrollments, assignments, stats, currentProfile, onOpenCourse, onGoBrowse }) {
  const inProgress = enrollments.filter(e => e.status === 'in_progress').sort((a, b) => new Date(b.last_accessed_at || b.created_at) - new Date(a.last_accessed_at || a.created_at))
  const requiredOutstanding = courses.filter(c => {
    const en = enrollments.find(e => e.course_id === c.id)
    const a = learningService.pickAssignment(assignments, c.id, currentProfile)
    const required = a ? true : c.is_required
    return required && en?.status !== 'completed'
  })
  const newCourses = courses.filter(c => (Date.now() - new Date(c.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14).slice(0, 6)
  const recentlyCompleted = enrollments.filter(e => e.status === 'completed').sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 6)
  const overallProgress = enrollments.length ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percent || 0), 0) / enrollments.length) : 0

  function findCourse(courseId) { return courses.find(c => c.id === courseId) }

  return (
    <div className="lp-home">
      <div className="lp-welcome">
        <h1>Kia ora, {currentProfile?.first_name || 'there'} 👋</h1>
        <p>Pick up where you left off, or explore something new.</p>
      </div>

      <div className="lp-stats-grid">
        <div className="lp-stat-card"><ProgressRing percent={overallProgress} /><span>Overall progress</span></div>
        <div className="lp-stat-card"><div className="lp-stat-icon streak"><Flame size={20} /></div><strong>{stats.streak}</strong><span>Day streak</span></div>
        <div className="lp-stat-card"><div className="lp-stat-icon points"><Star size={20} /></div><strong>{stats.totalPoints}</strong><span>Points</span></div>
        <div className="lp-stat-card"><div className="lp-stat-icon hours"><Clock size={20} /></div><strong>{stats.totalPdHours}</strong><span>PD hours</span></div>
      </div>

      {inProgress.length > 0 && (
        <section className="lp-section">
          <div className="lp-section-header"><h2>Continue Learning</h2></div>
          <div className="lp-card-row">
            {inProgress.map(e => {
              const course = findCourse(e.course_id)
              return course ? <CourseCard key={e.id} course={course} enrollment={e} assignment={learningService.pickAssignment(assignments, course.id, currentProfile)} onOpen={onOpenCourse} onToggleFavourite={() => {}} /> : null
            })}
          </div>
        </section>
      )}

      {requiredOutstanding.length > 0 && (
        <section className="lp-section">
          <div className="lp-section-header"><h2>Required Learning</h2><span className="lp-section-count">{requiredOutstanding.length} outstanding</span></div>
          <div className="lp-card-row">
            {requiredOutstanding.map(c => (
              <CourseCard key={c.id} course={c} enrollment={enrollments.find(e => e.course_id === c.id)} assignment={learningService.pickAssignment(assignments, c.id, currentProfile)} onOpen={onOpenCourse} onToggleFavourite={() => {}} />
            ))}
          </div>
        </section>
      )}

      {newCourses.length > 0 && (
        <section className="lp-section">
          <div className="lp-section-header"><h2>New Courses</h2></div>
          <div className="lp-card-row">
            {newCourses.map(c => (
              <CourseCard key={c.id} course={c} enrollment={enrollments.find(e => e.course_id === c.id)} assignment={learningService.pickAssignment(assignments, c.id, currentProfile)} onOpen={onOpenCourse} onToggleFavourite={() => {}} />
            ))}
          </div>
        </section>
      )}

      {recentlyCompleted.length > 0 && (
        <section className="lp-section">
          <div className="lp-section-header"><h2>Recently Completed</h2></div>
          <div className="lp-card-row">
            {recentlyCompleted.map(e => {
              const course = findCourse(e.course_id)
              return course ? <CourseCard key={e.id} course={course} enrollment={e} assignment={null} onOpen={onOpenCourse} onToggleFavourite={() => {}} /> : null
            })}
          </div>
        </section>
      )}

      {courses.length === 0 && (
        <div className="lp-empty">
          <BookOpen size={36} />
          <strong>No courses yet</strong>
          <small>Once courses are published they'll show up here.</small>
        </div>
      )}

      {courses.length > 0 && enrollments.length === 0 && (
        <div className="lp-empty">
          <GraduationCap size={36} />
          <strong>Ready when you are</strong>
          <small>Browse the course library to get started.</small>
          <button className="btn-primary" onClick={onGoBrowse}>Browse courses</button>
        </div>
      )}
    </div>
  )
}

function LearningBrowse({ courses, enrollments, assignments, currentProfile, onOpenCourse }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const enriched = useMemo(() => courses.map(c => {
    const enrollment = enrollments.find(e => e.course_id === c.id)
    const assignment = learningService.pickAssignment(assignments, c.id, currentProfile)
    const isRequired = assignment ? true : c.is_required
    const dueDate = assignment?.due_date || enrollment?.due_date
    const dd = daysUntil(dueDate)
    const isNew = (Date.now() - new Date(c.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14
    return { course: c, enrollment, assignment, isRequired, dueDate, dd, isNew }
  }), [courses, enrollments, assignments, currentProfile])

  const filtered = enriched.filter(({ course, enrollment, isRequired, dd, isNew }) => {
    if (search && !`${course.title} ${course.short_description || ''} ${course.tags?.join(' ') || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    if (category !== 'all' && course.category !== category) return false
    if (statusFilter === 'required' && !isRequired) return false
    if (statusFilter === 'completed' && enrollment?.status !== 'completed') return false
    if (statusFilter === 'incomplete' && (!enrollment || enrollment.status === 'completed')) return false
    if (statusFilter === 'new' && !isNew) return false
    if (statusFilter === 'due_soon' && !(dd !== null && dd >= 0 && dd <= 7 && enrollment?.status !== 'completed')) return false
    if (statusFilter === 'overdue' && !(dd !== null && dd < 0 && enrollment?.status !== 'completed')) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'alphabetical') return a.course.title.localeCompare(b.course.title)
    if (sortBy === 'duration') return (a.course.duration_minutes || 0) - (b.course.duration_minutes || 0)
    return new Date(b.course.created_at) - new Date(a.course.created_at)
  })

  return (
    <div className="lp-browse">
      <div className="lp-browse-toolbar">
        <div className="lp-browse-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="centre-filter-select">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="centre-filter-select">
          <option value="all">All courses</option>
          <option value="required">Required</option>
          <option value="incomplete">Incomplete</option>
          <option value="completed">Completed</option>
          <option value="new">New</option>
          <option value="due_soon">Due soon</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="centre-filter-select">
          <option value="newest">Newest</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="duration">Duration</option>
        </select>
      </div>
      {sorted.length === 0 ? (
        <div className="lp-empty"><Search size={32} /><strong>No courses match</strong><small>Try a different search or filter.</small></div>
      ) : (
        <div className="lp-card-grid">
          {sorted.map(({ course, enrollment, assignment }) => (
            <CourseCard key={course.id} course={course} enrollment={enrollment} assignment={assignment} onOpen={onOpenCourse} onToggleFavourite={(e, val) => learningService.toggleFavourite(e.id, val)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AdminModuleEditor({ courseId, modules, onChange }) {
  const [uploading, setUploading] = useState(null)

  async function addModule() {
    const created = await learningService.createModule({
      course_id: courseId, title: 'New module', content_type: 'video', sort_order: modules.length,
    })
    onChange([...modules, { ...created, questions: [] }])
  }

  async function updateModuleField(moduleId, field, value) {
    const updated = await learningService.updateModule(moduleId, { [field]: value })
    onChange(modules.map(m => m.id === moduleId ? { ...m, ...updated } : m))
  }

  async function removeModule(moduleId) {
    await learningService.deleteModule(moduleId)
    onChange(modules.filter(m => m.id !== moduleId))
  }

  async function handleFileUpload(moduleId, file) {
    setUploading(moduleId)
    try {
      const url = await learningService.uploadLearningMedia(file, `courses/${courseId}`)
      await updateModuleField(moduleId, 'content_url', url)
      showToast('File uploaded')
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error')
    }
    setUploading(null)
  }

  async function addQuestion(moduleId) {
    const created = await learningService.createQuestion({
      module_id: moduleId, question_type: 'multiple_choice', prompt: 'New question',
      options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }], correct_answer: 'a', sort_order: 0,
    })
    onChange(modules.map(m => m.id === moduleId ? { ...m, questions: [...(m.questions || []), created], has_quiz: true } : m))
    await learningService.updateModule(moduleId, { has_quiz: true })
  }

  async function removeQuestion(moduleId, questionId) {
    await learningService.deleteQuestion(questionId)
    onChange(modules.map(m => m.id === moduleId ? { ...m, questions: m.questions.filter(q => q.id !== questionId) } : m))
  }

  return (
    <div className="lm-admin-modules">
      {modules.map((m, i) => (
        <div key={m.id} className="lm-admin-module">
          <div className="lm-admin-module-head">
            <span className="lm-admin-module-num">{i + 1}</span>
            <input value={m.title} onChange={(e) => updateModuleField(m.id, 'title', e.target.value)} placeholder="Module title" />
            <select value={m.content_type} onChange={(e) => updateModuleField(m.id, 'content_type', e.target.value)}>
              {CONTENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
            <button className="btn-icon-danger" onClick={() => removeModule(m.id)}><Trash2 size={15} /></button>
          </div>
          <textarea className="lm-admin-module-desc" rows={2} value={m.description || ''} onChange={(e) => updateModuleField(m.id, 'description', e.target.value)} placeholder="Short description shown to staff…" />
          {m.content_type === 'interactive_page' || m.content_type === 'mixed' ? (
            <textarea rows={4} value={m.content_body || ''} onChange={(e) => updateModuleField(m.id, 'content_body', e.target.value)} placeholder="Page content…" />
          ) : (
            <div className="lm-admin-upload-row">
              <label className="btn-secondary">
                <Upload size={14} /> {uploading === m.id ? 'Uploading…' : 'Upload file'}
                <input type="file" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && handleFileUpload(m.id, e.target.files[0])} />
              </label>
              <input value={m.content_url || ''} onChange={(e) => updateModuleField(m.id, 'content_url', e.target.value)} placeholder="or paste a URL…" />
            </div>
          )}
          <div className="lm-admin-questions">
            {(m.questions || []).map(q => (
              <div key={q.id} className="lm-admin-question-row">
                <span className="lm-admin-question-type">{QUESTION_TYPES.find(t => t.value === q.question_type)?.label}</span>
                <span className="lm-admin-question-prompt">{q.prompt}</span>
                <button className="btn-icon-danger" onClick={() => removeQuestion(m.id, q.id)}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn-secondary" onClick={() => addQuestion(m.id)}><Plus size={13} /> Add question</button>
          </div>
        </div>
      ))}
      <button className="btn-primary" onClick={addModule}><Plus size={14} /> Add module</button>
    </div>
  )
}

function AdminCourseForm({ course, onClose, onSaved, currentProfile }) {
  const isEdit = Boolean(course)
  const [form, setForm] = useState({
    title: course?.title || '', description: course?.description || '', short_description: course?.short_description || '',
    thumbnail_url: course?.thumbnail_url || '', category: course?.category || 'general', difficulty: course?.difficulty || 'beginner',
    duration_minutes: course?.duration_minutes || '', is_required: course?.is_required || false, points_awarded: course?.points_awarded ?? 10,
    pd_hours: course?.pd_hours ?? 0, passing_score: course?.passing_score ?? 80, certificate_enabled: course?.certificate_enabled || false,
    status: course?.status || 'draft',
  })
  const [dueDate, setDueDate] = useState('')
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [savedCourseId, setSavedCourseId] = useState(course?.id || null)

  useEffect(() => {
    if (course?.id) {
      learningService.loadCourseWithContent(course.id).then(({ modules }) => setModules(modules))
    }
  }, [course?.id])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleThumbUpload(file) {
    setUploadingThumb(true)
    try {
      const url = await learningService.uploadLearningMedia(file, 'thumbnails')
      set('thumbnail_url', url)
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error')
    }
    setUploadingThumb(false)
  }

  async function handleSaveDetails(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null }
      let saved
      if (savedCourseId) {
        saved = await learningService.updateCourse(savedCourseId, payload, currentProfile.id)
      } else {
        saved = await learningService.createCourse(payload, currentProfile.id)
        setSavedCourseId(saved.id)
      }
      if (form.is_required) {
        await learningService.setOrganisationRequirement(saved.id, dueDate || null, currentProfile.id)
      } else {
        await learningService.clearOrganisationRequirement(saved.id)
      }
      showToast(isEdit ? 'Course updated' : 'Course created — now add modules below')
      onSaved()
    } catch (err) {
      showToast(err.message || 'Could not save course', 'error')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card lm-admin-form" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Course' : 'New Course'}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSaveDetails} className="staff-form">
          <label>Title <input value={form.title} onChange={(e) => set('title', e.target.value)} required /></label>
          <label>Short description <input value={form.short_description} onChange={(e) => set('short_description', e.target.value)} placeholder="Shown on the course card…" /></label>
          <label>Full description <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
          <div className="form-row">
            <label>Category
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Difficulty
              <select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Duration (minutes) <input type="number" min="0" value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} /></label>
            <label>Points awarded <input type="number" min="0" value={form.points_awarded} onChange={(e) => set('points_awarded', Number(e.target.value))} /></label>
          </div>
          <div className="form-row">
            <label>PD hours <input type="number" step="0.25" min="0" value={form.pd_hours} onChange={(e) => set('pd_hours', Number(e.target.value))} /></label>
            <label>Passing score % <input type="number" min="0" max="100" value={form.passing_score} onChange={(e) => set('passing_score', Number(e.target.value))} /></label>
          </div>
          <label className="lm-checkbox-label"><input type="checkbox" checked={form.certificate_enabled} onChange={(e) => set('certificate_enabled', e.target.checked)} /> Award a certificate on completion</label>
          <label className="lm-checkbox-label"><input type="checkbox" checked={form.is_required} onChange={(e) => set('is_required', e.target.checked)} /> Required for everyone</label>
          {form.is_required && (
            <label>Due date <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          )}
          <label>Thumbnail
            <div className="lm-admin-upload-row">
              <label className="btn-secondary"><Upload size={14} /> {uploadingThumb ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && handleThumbUpload(e.target.files[0])} />
              </label>
              {form.thumbnail_url && <img src={form.thumbnail_url} alt="" className="lm-thumb-preview" />}
            </div>
          </label>
          <label>Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save course details'}</button>
          </div>
        </form>
        {savedCourseId && (
          <div className="lm-admin-modules-section">
            <h3>Modules</h3>
            <AdminModuleEditor courseId={savedCourseId} modules={modules} onChange={setModules} />
          </div>
        )}
      </div>
    </div>
  )
}

function LearningAdmin({ allCourses, onRefresh, currentProfile }) {
  const [editingCourse, setEditingCourse] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function handleDelete(course) {
    if (!confirm(`Delete "${course.title}"? This removes all its modules and questions.`)) return
    await learningService.deleteCourse(course.id)
    showToast('Course deleted')
    onRefresh({ silent: true })
  }

  return (
    <div className="lp-admin">
      <div className="lp-section-header">
        <h2>Manage Courses</h2>
        <button className="btn-primary" onClick={() => { setEditingCourse(null); setShowForm(true) }}><Plus size={15} /> New Course</button>
      </div>
      <div className="lm-admin-list">
        {allCourses.map(c => (
          <div key={c.id} className="lm-admin-list-item">
            <div className="lm-admin-list-thumb" style={c.thumbnail_url ? { backgroundImage: `url(${c.thumbnail_url})` } : {}}>{!c.thumbnail_url && <BookOpen size={18} />}</div>
            <div className="lm-admin-list-info">
              <strong>{c.title}</strong>
              <span>{categoryLabel(c.category)} · {c.status}</span>
            </div>
            <button className="btn-icon-edit" onClick={() => { setEditingCourse(c); setShowForm(true) }}><Edit2 size={15} /></button>
            <button className="btn-icon-danger" onClick={() => handleDelete(c)}><Trash2 size={15} /></button>
          </div>
        ))}
        {allCourses.length === 0 && <div className="lp-empty"><BookOpen size={32} /><strong>No courses yet</strong><small>Create your first course to get started.</small></div>}
      </div>
      {showForm && (
        <AdminCourseForm
          course={editingCourse}
          currentProfile={currentProfile}
          onClose={() => setShowForm(false)}
          onSaved={() => onRefresh({ silent: true })}
        />
      )}
    </div>
  )
}

export function LearningPage({ currentProfile }) {
  const [activeTab, setActiveTab] = useState('home')
  const [courses, setCourses] = useState([])
  const [allCourses, setAllCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [assignments, setAssignments] = useState([])
  const [stats, setStats] = useState({ totalPoints: 0, totalPdHours: 0, streak: 0 })
  const [openCourse, setOpenCourse] = useState(null)
  const [openCourseModules, setOpenCourseModules] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = currentProfile?.permission === 'super_admin' || currentProfile?.permission === 'policy_admin'

  useEffect(() => { loadAll() }, [currentProfile?.id])

  async function loadAll({ silent = false } = {}) {
    if (!silent) setLoading(true)
    try {
      const published = await learningService.loadPublishedCourses()
      setCourses(published)
      if (currentProfile?.id) {
        const [en, s] = await Promise.all([
          learningService.loadMyEnrollments(currentProfile.id),
          learningService.loadLearningStats(currentProfile.id),
        ])
        setEnrollments(en)
        setStats(s)
        const a = await learningService.loadAssignmentsForCourses(published.map(c => c.id))
        setAssignments(a)
      }
      if (isAdmin) {
        const { data } = await supabase.from('learning_courses').select('*').order('created_at', { ascending: false })
        setAllCourses(data || [])
      }
    } catch (err) {
      console.error('Failed to load Learning Hub:', err)
    }
    if (!silent) setLoading(false)
  }

  async function handleOpenCourse(course) {
    const { modules } = await learningService.loadCourseWithContent(course.id)
    setOpenCourseModules(modules)
    setOpenCourse(course)
  }

  function handleExitPlayer() {
    setOpenCourse(null)
    loadAll({ silent: true })
  }

  return (
    <div className="learning-page">
      <div className="staff-page-header">
        <div>
          <h1>Pātaka Mātauranga</h1>
          <p>Learning, resources, PD and professional development</p>
        </div>
      </div>

      <div className="lp-tabs">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>Home</button>
        <button className={activeTab === 'browse' ? 'active' : ''} onClick={() => setActiveTab('browse')}>Browse Courses</button>
        {isAdmin && <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>Manage Courses</button>}
      </div>

      {loading ? (
        <div className="staff-loading">Loading Learning Hub…</div>
      ) : activeTab === 'home' ? (
        <LearningHome courses={courses} enrollments={enrollments} assignments={assignments} stats={stats} currentProfile={currentProfile} onOpenCourse={handleOpenCourse} onGoBrowse={() => setActiveTab('browse')} />
      ) : activeTab === 'browse' ? (
        <LearningBrowse courses={courses} enrollments={enrollments} assignments={assignments} currentProfile={currentProfile} onOpenCourse={handleOpenCourse} />
      ) : (
        <LearningAdmin allCourses={allCourses} onRefresh={loadAll} currentProfile={currentProfile} />
      )}

      {openCourse && (
        <CoursePlayer
          course={openCourse}
          modules={openCourseModules}
          currentProfile={currentProfile}
          onExit={handleExitPlayer}
          onProgressUpdate={() => loadAll({ silent: true })}
        />
      )}
    </div>
  )
}

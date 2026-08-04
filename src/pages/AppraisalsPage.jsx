import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Send, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const STATUS_OPTIONS = [
  'draft',
  'assigned',
  'self_submitted',
  'manager_in_progress',
  'review_360_open',
  'review_360_closed',
  'meeting_completed',
  'signed_off',
  'archived',
]

function fullName(person) {
  return `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Unknown staff'
}

function createBlankQuestion(index = 1) {
  return {
    id: `q${index}`,
    prompt: '',
  }
}

function createBlankSection(index = 1) {
  return {
    id: `section-${index}`,
    title: `Section ${index}`,
    questions: [createBlankQuestion(1)],
  }
}

function normalizeTemplateSections(sections) {
  const nextSections = Array.isArray(sections) ? sections : []
  if (!nextSections.length) return [createBlankSection(1)]

  return nextSections.map((section, index) => ({
    id: section?.id || `section-${index + 1}`,
    title: section?.title || `Section ${index + 1}`,
    questions: Array.isArray(section?.questions) && section.questions.length
      ? section.questions.map((question, questionIndex) => ({
          id: question?.id || `q${questionIndex + 1}`,
          prompt: question?.prompt || '',
        }))
      : [createBlankQuestion(1)],
  }))
}

function toTemplateSchema(sections) {
  return {
    sections: normalizeTemplateSections(sections).map((section, sectionIndex) => ({
      id: section.id || `section-${sectionIndex + 1}`,
      title: section.title.trim() || `Section ${sectionIndex + 1}`,
      questions: section.questions.map((question, questionIndex) => ({
        id: question.id || `q${questionIndex + 1}`,
        prompt: question.prompt.trim(),
      })).filter((question) => question.prompt),
    })),
  }
}

function questionsFromTemplate(template) {
  const sections = normalizeTemplateSections(template?.template_schema?.sections)
  return sections.flatMap((section) =>
    (section?.questions || []).map((question) => ({
      sectionTitle: section?.title || 'Section',
      id: question?.id || `${section?.title || 's'}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: question?.prompt || '',
    }))
  )
}

function toQuestionText(template) {
  const questions = questionsFromTemplate(template)
  return questions.map((q) => q.prompt).join('\n')
}

function getCycleStatusLabel(status) {
  return String(status || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function is360WindowOpen(cycle) {
  const today = new Date().toISOString().slice(0, 10)
  if (!cycle?.review_360_opens_at || !cycle?.review_360_closes_at) return false
  return today >= cycle.review_360_opens_at && today <= cycle.review_360_closes_at
}

export function AppraisalsPage({ currentProfile, focusStaffId = null, onClearFocus }) {
  const isSuperAdmin = currentProfile?.permission === 'super_admin'
  const userId = currentProfile?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [templates, setTemplates] = useState([])
  const [profiles, setProfiles] = useState([])
  const [cycles, setCycles] = useState([])

  const [responses, setResponses] = useState([])
  const [notes, setNotes] = useState([])
  const [feedback360, setFeedback360] = useState([])

  const [selectedCycleId, setSelectedCycleId] = useState(null)

  const [templateForm, setTemplateForm] = useState({
    id: null,
    title: '',
    role_scope: 'staff',
    description: '',
    sections: [createBlankSection(1)],
  })

  const [assignmentForm, setAssignmentForm] = useState({
    template_id: '',
    staff_id: '',
    reviewer_id: '',
    period_start: '',
    period_end: '',
    self_due_at: '',
    manager_due_at: '',
    review_360_opens_at: '',
    review_360_closes_at: '',
  })

  const [selfAnswers, setSelfAnswers] = useState({})
  const [managerAnswers, setManagerAnswers] = useState({})

  const [noteText, setNoteText] = useState('')
  const [noteVisibility, setNoteVisibility] = useState('manager_only')

  const [feedbackForm, setFeedbackForm] = useState({
    overall: '',
    strengths: '',
    growth: '',
  })

  const templateById = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates])
  const profileById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles])

  const selectedCycle = useMemo(() => cycles.find((c) => c.id === selectedCycleId) || null, [cycles, selectedCycleId])
  const selectedTemplate = selectedCycle ? templateById[selectedCycle.template_id] : null
  const selectedQuestions = useMemo(() => questionsFromTemplate(selectedTemplate), [selectedTemplate])
  const selectedSections = useMemo(() => normalizeTemplateSections(selectedTemplate?.template_schema?.sections), [selectedTemplate])

  const selfResponse = responses.find((row) => row.response_type === 'self') || null
  const managerResponse = responses.find((row) => row.response_type === 'manager') || null

  const canFillSelf = Boolean(selectedCycle && userId && selectedCycle.staff_id === userId)
  const canFillManager = Boolean(selectedCycle && userId && (selectedCycle.reviewer_id === userId || isSuperAdmin))
  const canManageCycle = canFillManager

  const canSubmit360 = Boolean(
    selectedCycle &&
    userId &&
    currentProfile?.permission !== 'super_admin' &&
    selectedCycle.staff_id !== userId &&
    is360WindowOpen(selectedCycle)
  )

  const my360Feedback = feedback360.find((item) => item.reviewer_id === userId) || null

  useEffect(() => {
    if (!userId) return
    loadBaseData()
  }, [userId])

  useEffect(() => {
    if (!isSuperAdmin) return
    if (!templateForm.sections.length) {
      setTemplateForm((state) => ({ ...state, sections: [createBlankSection(1)] }))
    }
  }, [isSuperAdmin, templateForm.sections.length])

  useEffect(() => {
    if (!focusStaffId || cycles.length === 0) return

    const staffCycles = cycles.filter((cycle) => cycle.staff_id === focusStaffId)
    if (!staffCycles.length) return

    const unfinished = staffCycles.find((cycle) => cycle.status !== 'signed_off' && cycle.status !== 'archived') || staffCycles[0]
    if (unfinished && unfinished.id !== selectedCycleId) {
      setSelectedCycleId(unfinished.id)
    }
  }, [focusStaffId, cycles.length])

  useEffect(() => {
    if (!selectedCycleId) {
      setResponses([])
      setNotes([])
      setFeedback360([])
      return
    }
    loadCycleDetails(selectedCycleId)
  }, [selectedCycleId])

  useEffect(() => {
    if (!selectedQuestions.length) return

    const nextSelf = {}
    const nextManager = {}
    selectedQuestions.forEach((question) => {
      nextSelf[question.id] = selfResponse?.responses?.[question.id] || ''
      nextManager[question.id] = managerResponse?.responses?.[question.id] || ''
    })
    setSelfAnswers(nextSelf)
    setManagerAnswers(nextManager)
  }, [selectedQuestions, selfResponse?.id, managerResponse?.id])

  async function loadBaseData() {
    setLoading(true)
    setError('')

    try {
      const templateQuery = supabase
        .from('appraisal_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isSuperAdmin) templateQuery.eq('is_active', true)

      let cycleQuery = supabase
        .from('appraisal_cycles')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isSuperAdmin) {
        cycleQuery = cycleQuery.or(`staff_id.eq.${userId},reviewer_id.eq.${userId}`)
      }

      const [{ data: templatesData, error: templatesError }, { data: cyclesData, error: cyclesError }] = await Promise.all([
        templateQuery,
        cycleQuery,
      ])

      if (templatesError) throw templatesError
      if (cyclesError) throw cyclesError

      const nextTemplates = templatesData || []
      const nextCycles = cyclesData || []

      // Keep templates/cycles visible even if profile lookup fails.
      setTemplates(nextTemplates)
      setCycles(nextCycles)

      const idsNeeded = new Set()
      nextCycles.forEach((cycle) => {
        if (cycle.staff_id) idsNeeded.add(cycle.staff_id)
        if (cycle.reviewer_id) idsNeeded.add(cycle.reviewer_id)
      })
      if (userId) idsNeeded.add(userId)

      let nextProfiles = []
      if (isSuperAdmin) {
        const { data: allProfiles, error: allProfilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, permission, centre')
          .order('first_name', { ascending: true })

        if (allProfilesError) {
          console.error('Appraisals profile load failed (all profiles):', allProfilesError)
          setError(allProfilesError.message || 'Could not load staff list for assignments')
        }
        nextProfiles = allProfiles || []
      } else if (idsNeeded.size > 0) {
        const { data: cycleProfiles, error: cycleProfilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, permission, centre')
          .in('id', [...idsNeeded])

        if (cycleProfilesError) {
          console.error('Appraisals profile load failed (cycle participants):', cycleProfilesError)
          setError(cycleProfilesError.message || 'Could not load appraisal participants')
        }
        nextProfiles = cycleProfiles || []
      }

      setProfiles(nextProfiles)

      if (!selectedCycleId && nextCycles.length) {
        setSelectedCycleId(nextCycles[0].id)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not load appraisals')
    }

    setLoading(false)
  }

  async function loadCycleDetails(cycleId) {
    try {
      const [{ data: responseRows, error: responseError }, { data: noteRows, error: noteError }, { data: feedbackRows, error: feedbackError }] = await Promise.all([
        supabase
          .from('appraisal_responses')
          .select('*')
          .eq('cycle_id', cycleId),
        supabase
          .from('appraisal_notes')
          .select('*')
          .eq('cycle_id', cycleId)
          .order('created_at', { ascending: false }),
        supabase
          .from('appraisal_feedback_360')
          .select('*')
          .eq('cycle_id', cycleId)
          .order('created_at', { ascending: false }),
      ])

      if (responseError) throw responseError
      if (noteError) throw noteError
      if (feedbackError) throw feedbackError

      setResponses(responseRows || [])
      setNotes(noteRows || [])
      setFeedback360(feedbackRows || [])

      const mine = (feedbackRows || []).find((item) => item.reviewer_id === userId)
      setFeedbackForm({
        overall: mine?.feedback?.overall || '',
        strengths: mine?.feedback?.strengths || '',
        growth: mine?.feedback?.growth || '',
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not load cycle details')
    }
  }

  async function saveTemplate(e) {
    e.preventDefault()
    if (!templateForm.title.trim()) return

    const payload = {
      title: templateForm.title.trim(),
      role_scope: templateForm.role_scope,
      description: templateForm.description.trim() || null,
      template_schema: toTemplateSchema(templateForm.sections),
      updated_by: userId,
      updated_at: new Date().toISOString(),
      is_active: true,
    }

    const operation = templateForm.id
      ? supabase.from('appraisal_templates').update(payload).eq('id', templateForm.id)
      : supabase.from('appraisal_templates').insert({ ...payload, created_by: userId })

    const { error: saveError } = await operation
    if (saveError) {
      setError(saveError.message || 'Could not save template')
      return
    }

    setTemplateForm({
      id: null,
      title: '',
      role_scope: 'staff',
      description: '',
      sections: [createBlankSection(1)],
    })
    await loadBaseData()
  }

  function updateTemplateSection(sectionIndex, field, value) {
    setTemplateForm((state) => ({
      ...state,
      sections: state.sections.map((section, index) => (
        index === sectionIndex ? { ...section, [field]: value } : section
      )),
    }))
  }

  function updateTemplateQuestion(sectionIndex, questionIndex, value) {
    setTemplateForm((state) => ({
      ...state,
      sections: state.sections.map((section, index) => {
        if (index !== sectionIndex) return section
        return {
          ...section,
          questions: section.questions.map((question, qIndex) => (
            qIndex === questionIndex ? { ...question, prompt: value } : question
          )),
        }
      }),
    }))
  }

  function addTemplateSection() {
    setTemplateForm((state) => ({
      ...state,
      sections: [...state.sections, createBlankSection(state.sections.length + 1)],
    }))
  }

  function removeTemplateSection(sectionIndex) {
    setTemplateForm((state) => {
      const nextSections = state.sections.filter((_, index) => index !== sectionIndex)
      return {
        ...state,
        sections: nextSections.length ? nextSections : [createBlankSection(1)],
      }
    })
  }

  function addTemplateQuestion(sectionIndex) {
    setTemplateForm((state) => ({
      ...state,
      sections: state.sections.map((section, index) => {
        if (index !== sectionIndex) return section
        return {
          ...section,
          questions: [...section.questions, createBlankQuestion(section.questions.length + 1)],
        }
      }),
    }))
  }

  function removeTemplateQuestion(sectionIndex, questionIndex) {
    setTemplateForm((state) => ({
      ...state,
      sections: state.sections.map((section, index) => {
        if (index !== sectionIndex) return section
        const nextQuestions = section.questions.filter((_, qIndex) => qIndex !== questionIndex)
        return {
          ...section,
          questions: nextQuestions.length ? nextQuestions : [createBlankQuestion(1)],
        }
      }),
    }))
  }

  async function assignTemplate(e) {
    e.preventDefault()
    if (!assignmentForm.template_id || !assignmentForm.staff_id || !assignmentForm.reviewer_id || !assignmentForm.period_start || !assignmentForm.period_end) return

    const { error: createError } = await supabase
      .from('appraisal_cycles')
      .insert({
        template_id: assignmentForm.template_id,
        staff_id: assignmentForm.staff_id,
        reviewer_id: assignmentForm.reviewer_id,
        period_start: assignmentForm.period_start,
        period_end: assignmentForm.period_end,
        self_due_at: assignmentForm.self_due_at || null,
        manager_due_at: assignmentForm.manager_due_at || null,
        review_360_opens_at: assignmentForm.review_360_opens_at || null,
        review_360_closes_at: assignmentForm.review_360_closes_at || null,
        status: 'assigned',
        created_by: userId,
      })

    if (createError) {
      setError(createError.message || 'Could not assign template')
      return
    }

    setAssignmentForm({
      template_id: '',
      staff_id: '',
      reviewer_id: '',
      period_start: '',
      period_end: '',
      self_due_at: '',
      manager_due_at: '',
      review_360_opens_at: '',
      review_360_closes_at: '',
    })

    await loadBaseData()
  }

  async function submitResponse(type) {
    if (!selectedCycle) return
    const answers = type === 'self' ? selfAnswers : managerAnswers
    const existing = responses.find((item) => item.response_type === type)

    if (existing) {
      const { error: updateError } = await supabase
        .from('appraisal_responses')
        .update({
          responder_id: userId,
          responses: answers,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        setError(updateError.message || 'Could not update response')
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('appraisal_responses')
        .insert({
          cycle_id: selectedCycle.id,
          responder_id: userId,
          response_type: type,
          responses: answers,
          submitted_at: new Date().toISOString(),
        })

      if (insertError) {
        setError(insertError.message || 'Could not save response')
        return
      }
    }

    if (isSuperAdmin && canManageCycle && type === 'manager') {
      await supabase.from('appraisal_cycles').update({ status: 'manager_in_progress', updated_at: new Date().toISOString() }).eq('id', selectedCycle.id)
    }

    await loadCycleDetails(selectedCycle.id)
  }

  async function addNote(e) {
    e.preventDefault()
    if (!selectedCycle || !noteText.trim()) return

    const visibility = canManageCycle ? noteVisibility : 'shared_with_staff'

    const { error: insertError } = await supabase
      .from('appraisal_notes')
      .insert({
        cycle_id: selectedCycle.id,
        author_id: userId,
        note_text: noteText.trim(),
        visibility,
      })

    if (insertError) {
      setError(insertError.message || 'Could not save note')
      return
    }

    setNoteText('')
    setNoteVisibility('manager_only')
    await loadCycleDetails(selectedCycle.id)
  }

  async function submit360(e) {
    e.preventDefault()
    if (!selectedCycle) return

    const payload = {
      cycle_id: selectedCycle.id,
      reviewer_id: userId,
      feedback: {
        overall: feedbackForm.overall || '',
        strengths: feedbackForm.strengths || '',
        growth: feedbackForm.growth || '',
      },
      submitted_at: new Date().toISOString(),
    }

    if (my360Feedback) {
      const { error: updateError } = await supabase
        .from('appraisal_feedback_360')
        .update(payload)
        .eq('id', my360Feedback.id)

      if (updateError) {
        setError(updateError.message || 'Could not update 360 feedback')
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('appraisal_feedback_360')
        .insert(payload)

      if (insertError) {
        setError(insertError.message || 'Could not submit 360 feedback')
        return
      }
    }

    await loadCycleDetails(selectedCycle.id)
  }

  async function updateCycleStatus(status) {
    if (!selectedCycle || !canManageCycle) return

    const { error: updateError } = await supabase
      .from('appraisal_cycles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selectedCycle.id)

    if (updateError) {
      setError(updateError.message || 'Could not update status')
      return
    }

    await loadBaseData()
    await loadCycleDetails(selectedCycle.id)
  }

  if (loading) return <div className="staff-loading">Loading appraisals…</div>

  return (
    <div className="appraisals-page">
      <div className="staff-page-header">
        <div>
          <h1>Appraisals</h1>
          <p>Templates, assignments, self and manager reviews, 360 feedback, and ongoing notes</p>
          {focusStaffId && (
            <button className="btn-secondary" type="button" onClick={() => { setSelectedCycleId(null); onClearFocus?.() }} style={{ marginTop: 10 }}>
              Clear staff focus
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

      {isSuperAdmin && (
        <section className="appraisals-admin-grid">
            <div className="appraisals-card">
              <h3>Template Builder</h3>
              <form className="staff-form" onSubmit={saveTemplate}>
                <label>Template Title
                  <input value={templateForm.title} onChange={(e) => setTemplateForm((s) => ({ ...s, title: e.target.value }))} required />
                </label>
                <div className="form-row">
                  <label>Role Scope
                    <select value={templateForm.role_scope} onChange={(e) => setTemplateForm((s) => ({ ...s, role_scope: e.target.value }))}>
                      <option value="staff">Staff</option>
                      <option value="centre_leader">Centre Leader</option>
                      <option value="all_roles">All Roles</option>
                    </select>
                  </label>
                  <label>Description
                    <input value={templateForm.description} onChange={(e) => setTemplateForm((s) => ({ ...s, description: e.target.value }))} />
                  </label>
                </div>
                <div className="template-section-header">
                  <h4>Sections</h4>
                  <button type="button" className="btn-secondary" onClick={addTemplateSection}>Add Section</button>
                </div>
                <div className="template-section-list">
                  {templateForm.sections.map((section, sectionIndex) => (
                    <article key={section.id || sectionIndex} className="template-section-card">
                      <div className="template-section-card-header">
                        <label>
                          Section Title
                          <input
                            value={section.title}
                            onChange={(e) => updateTemplateSection(sectionIndex, 'title', e.target.value)}
                            placeholder={`Section ${sectionIndex + 1}`}
                          />
                        </label>
                        <button type="button" className="btn-secondary" onClick={() => removeTemplateSection(sectionIndex)} disabled={templateForm.sections.length === 1}>
                          Remove Section
                        </button>
                      </div>
                      <div className="template-question-list">
                        {section.questions.map((question, questionIndex) => (
                          <div key={question.id || questionIndex} className="template-question-row">
                            <label>
                              Question {questionIndex + 1}
                              <textarea
                                rows={3}
                                value={question.prompt}
                                onChange={(e) => updateTemplateQuestion(sectionIndex, questionIndex, e.target.value)}
                                placeholder="Write a prompt for this question…"
                              />
                            </label>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => removeTemplateQuestion(sectionIndex, questionIndex)}
                              disabled={section.questions.length === 1}
                            >
                              Remove Question
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={() => addTemplateQuestion(sectionIndex)}>Add Question</button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="form-actions">
                  {templateForm.id && (
                    <button type="button" className="btn-secondary" onClick={() => setTemplateForm({ id: null, title: '', role_scope: 'staff', description: '', sections: [createBlankSection(1)] })}>Cancel Edit</button>
                  )}
                  <button type="submit" className="btn-primary"><Save size={14} /> {templateForm.id ? 'Update Template' : 'Create Template'}</button>
                </div>
              </form>
            </div>

          <div className="appraisals-card">
            <h3>Assign Appraisal</h3>
            <form className="staff-form" onSubmit={assignTemplate}>
              <label>Template
                <select value={assignmentForm.template_id} onChange={(e) => setAssignmentForm((s) => ({ ...s, template_id: e.target.value }))} required>
                  <option value="">Choose template…</option>
                  {templates.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </label>
              <div className="form-row">
                <label>Staff Member
                  <select value={assignmentForm.staff_id} onChange={(e) => setAssignmentForm((s) => ({ ...s, staff_id: e.target.value }))} required>
                    <option value="">Choose staff…</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{fullName(p)} ({p.permission || 'staff'})</option>)}
                  </select>
                </label>
                <label>Reviewer
                  <select value={assignmentForm.reviewer_id} onChange={(e) => setAssignmentForm((s) => ({ ...s, reviewer_id: e.target.value }))} required>
                    <option value="">Choose reviewer…</option>
                    {profiles
                      .filter((p) => p.permission === 'centre_leader' || p.permission === 'super_admin')
                      .map((p) => <option key={p.id} value={p.id}>{fullName(p)} ({p.permission})</option>)}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Period Start <input type="date" value={assignmentForm.period_start} onChange={(e) => setAssignmentForm((s) => ({ ...s, period_start: e.target.value }))} required /></label>
                <label>Period End <input type="date" value={assignmentForm.period_end} onChange={(e) => setAssignmentForm((s) => ({ ...s, period_end: e.target.value }))} required /></label>
              </div>
              <div className="form-row">
                <label>Self Due <input type="date" value={assignmentForm.self_due_at} onChange={(e) => setAssignmentForm((s) => ({ ...s, self_due_at: e.target.value }))} /></label>
                <label>Manager Due <input type="date" value={assignmentForm.manager_due_at} onChange={(e) => setAssignmentForm((s) => ({ ...s, manager_due_at: e.target.value }))} /></label>
              </div>
              <div className="form-row">
                <label>360 Opens <input type="date" value={assignmentForm.review_360_opens_at} onChange={(e) => setAssignmentForm((s) => ({ ...s, review_360_opens_at: e.target.value }))} /></label>
                <label>360 Closes <input type="date" value={assignmentForm.review_360_closes_at} onChange={(e) => setAssignmentForm((s) => ({ ...s, review_360_closes_at: e.target.value }))} /></label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary"><Plus size={14} /> Assign</button>
              </div>
            </form>
          </div>
        </section>
      )}

      <section className="appraisals-workspace">
        <aside className="appraisals-list">
          <h3>Active Cycles</h3>
          {cycles.length === 0 ? (
            <p className="staff-empty">No appraisal cycles yet.</p>
          ) : cycles.map((cycle) => {
            const staff = profileById[cycle.staff_id]
            const reviewer = profileById[cycle.reviewer_id]
            const template = templateById[cycle.template_id]
            return (
              <button
                key={cycle.id}
                className={`appraisal-item ${selectedCycleId === cycle.id ? 'active' : ''}`}
                onClick={() => setSelectedCycleId(cycle.id)}
              >
                <strong>{fullName(staff)}</strong>
                <span>{template?.title || 'Template removed'}</span>
                <small>Reviewer: {fullName(reviewer)}</small>
                <small>Status: {getCycleStatusLabel(cycle.status)}</small>
              </button>
            )
          })}
        </aside>

        <div className="appraisals-detail">
          {!selectedCycle ? (
            <div className="staff-empty">Select a cycle to view details.</div>
          ) : (
            <>
              <div className="appraisal-detail-header">
                <div>
                  <h3>{fullName(profileById[selectedCycle.staff_id])}</h3>
                  <p>{templateById[selectedCycle.template_id]?.title || 'Template not found'} • {selectedCycle.period_start} to {selectedCycle.period_end}</p>
                </div>
                {canManageCycle && (
                  <label>Status
                    <select value={selectedCycle.status} onChange={(e) => updateCycleStatus(e.target.value)}>
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{getCycleStatusLabel(status)}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="appraisal-forms-grid">
                <section className="appraisals-card">
                  <h4><ClipboardList size={16} /> Self Appraisal</h4>
                  <div className="appraisal-section-list">
                    {selectedSections.map((section, sectionIndex) => (
                      <div key={`self-section-${section.id || sectionIndex}`} className="appraisal-section-block">
                        <div className="appraisal-section-heading">
                          <strong>{section.title || `Section ${sectionIndex + 1}`}</strong>
                        </div>
                        <div className="appraisal-question-list">
                          {(section.questions || []).map((question, questionIndex) => (
                            <div key={`self-${question.id}`} className="appraisal-question-item">
                              <p className="appraisal-question-prompt">
                                <span className="appraisal-question-number">{questionIndex + 1}.</span> {question.prompt}
                              </p>
                              <textarea
                                className="appraisal-question-input"
                                rows={3}
                                value={selfAnswers[question.id] || ''}
                                disabled={!canFillSelf}
                                placeholder={canFillSelf ? 'Write your response…' : 'Self responses are completed by the appraisee.'}
                                onChange={(e) => setSelfAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                                aria-label={`Self appraisal question ${questionIndex + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {canFillSelf && (
                    <div className="form-actions">
                      <button className="btn-primary" type="button" onClick={() => submitResponse('self')}><Send size={14} /> Submit Self Appraisal</button>
                    </div>
                  )}
                </section>

                <section className="appraisals-card">
                  <h4><ClipboardList size={16} /> Manager Appraisal</h4>
                  <div className="appraisal-section-list">
                    {selectedSections.map((section, sectionIndex) => (
                      <div key={`manager-section-${section.id || sectionIndex}`} className="appraisal-section-block">
                        <div className="appraisal-section-heading">
                          <strong>{section.title || `Section ${sectionIndex + 1}`}</strong>
                        </div>
                        <div className="appraisal-question-list">
                          {(section.questions || []).map((question, questionIndex) => (
                            <div key={`manager-${question.id}`} className="appraisal-question-item">
                              <p className="appraisal-question-prompt">
                                <span className="appraisal-question-number">{questionIndex + 1}.</span> {question.prompt}
                              </p>
                              <textarea
                                className="appraisal-question-input"
                                rows={3}
                                value={managerAnswers[question.id] || ''}
                                disabled={!canFillManager}
                                placeholder={canFillManager ? 'Write your response…' : 'Manager responses are completed by the assigned reviewer.'}
                                onChange={(e) => setManagerAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                                aria-label={`Manager appraisal question ${questionIndex + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {canFillManager && (
                    <div className="form-actions">
                      <button className="btn-primary" type="button" onClick={() => submitResponse('manager')}><Send size={14} /> Submit Manager Appraisal</button>
                    </div>
                  )}
                </section>
              </div>

              <div className="appraisal-forms-grid">
                <section className="appraisals-card">
                  <h4>Ongoing Notes</h4>
                  <form className="staff-form" onSubmit={addNote}>
                    <label>Note
                      <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add context from coaching conversations, observations, or milestones…" />
                    </label>
                    {canManageCycle ? (
                      <label>Visibility
                        <select value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value)}>
                          <option value="manager_only">Manager only</option>
                          <option value="shared_with_staff">Shared with staff member</option>
                        </select>
                      </label>
                    ) : (
                      <p style={{ margin: 0, color: '#6b7e8a', fontSize: 12 }}>Your notes are shared with your reviewer.</p>
                    )}
                    <div className="form-actions">
                      <button type="submit" className="btn-primary"><Plus size={14} /> Add Note</button>
                    </div>
                  </form>
                  <div className="appraisal-stream">
                    {notes.length === 0 ? <p className="staff-empty">No notes yet.</p> : notes.map((note) => (
                      <article key={note.id} className="appraisal-stream-item">
                        <strong>{fullName(profileById[note.author_id])}</strong>
                        <small>{new Date(note.created_at).toLocaleString('en-NZ')}</small>
                        <p>{note.note_text}</p>
                        <span>{note.visibility === 'manager_only' ? 'Manager only' : 'Shared with staff'}</span>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="appraisals-card">
                  <h4>360 Feedback</h4>
                  <p className="appraisal-helper">Window: {selectedCycle.review_360_opens_at || 'Not set'} to {selectedCycle.review_360_closes_at || 'Not set'}</p>
                  {canSubmit360 ? (
                    <form className="staff-form" onSubmit={submit360}>
                      <label>Overall rating (1-5)
                        <input type="number" min="1" max="5" value={feedbackForm.overall} onChange={(e) => setFeedbackForm((s) => ({ ...s, overall: e.target.value }))} />
                      </label>
                      <label>Strengths observed
                        <textarea rows={2} value={feedbackForm.strengths} onChange={(e) => setFeedbackForm((s) => ({ ...s, strengths: e.target.value }))} />
                      </label>
                      <label>Growth suggestions
                        <textarea rows={2} value={feedbackForm.growth} onChange={(e) => setFeedbackForm((s) => ({ ...s, growth: e.target.value }))} />
                      </label>
                      <div className="form-actions">
                        <button type="submit" className="btn-primary"><Send size={14} /> {my360Feedback ? 'Update 360 Feedback' : 'Submit 360 Feedback'}</button>
                      </div>
                    </form>
                  ) : (
                    <p className="staff-empty">360 feedback is available to staff during the configured window only.</p>
                  )}

                  {(canManageCycle || isSuperAdmin) && (
                    <div className="appraisal-stream">
                      <h5 style={{ margin: '4px 0 8px', color: '#0d2b36' }}>Received 360 Feedback ({feedback360.length})</h5>
                      {feedback360.length === 0 ? <p className="staff-empty">No 360 feedback submitted yet.</p> : feedback360.map((item) => (
                        <article key={item.id} className="appraisal-stream-item">
                          <strong>Anonymous reviewer</strong>
                          <small>{item.submitted_at ? new Date(item.submitted_at).toLocaleString('en-NZ') : 'Draft'}</small>
                          <p><b>Overall:</b> {item.feedback?.overall || '—'}</p>
                          <p><b>Strengths:</b> {item.feedback?.strengths || '—'}</p>
                          <p><b>Growth:</b> {item.feedback?.growth || '—'}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </section>

      {isSuperAdmin && (
        <section className="appraisals-card" style={{ marginTop: 18 }}>
          <h3>Templates</h3>
          <div className="appraisal-template-list">
            {templates.map((template) => (
              <article key={template.id} className="appraisal-template-item">
                <div>
                  <strong>{template.title}</strong>
                  <p>{template.description || 'No description'}</p>
                  <small>{template.role_scope} • {template.is_active ? 'Active' : 'Inactive'}</small>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => setTemplateForm({
                    id: template.id,
                    title: template.title,
                    role_scope: template.role_scope,
                    description: template.description || '',
                    sections: normalizeTemplateSections(template?.template_schema?.sections),
                  })}
                >
                  Edit
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

import { supabase } from './supabase'

export const AUTO_GRADED_TYPES = ['multiple_choice', 'multiple_select', 'true_false']

export function isAnswerCorrect(question, answer) {
  if (!AUTO_GRADED_TYPES.includes(question.question_type)) return null
  const correct = question.correct_answer
  if (question.question_type === 'multiple_select') {
    const a = Array.isArray(answer) ? [...answer].sort() : []
    const c = Array.isArray(correct) ? [...correct].sort() : []
    return a.length === c.length && a.every((v, i) => v === c[i])
  }
  return answer === correct
}

export function scoreModuleAnswers(questions, answers) {
  const graded = questions.filter(q => AUTO_GRADED_TYPES.includes(q.question_type))
  if (!graded.length) return null
  const correctCount = graded.filter(q => isAnswerCorrect(q, answers[q.id])).length
  return Math.round((correctCount / graded.length) * 100)
}

export async function loadPublishedCourses() {
  const { data, error } = await supabase
    .from('learning_courses')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadCourseWithContent(courseId) {
  const { data: course, error: courseError } = await supabase
    .from('learning_courses')
    .select('*')
    .eq('id', courseId)
    .single()
  if (courseError) throw courseError

  const { data: modules, error: modulesError } = await supabase
    .from('learning_modules')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
  if (modulesError) throw modulesError

  const moduleIds = (modules || []).map(m => m.id)
  let questions = []
  if (moduleIds.length) {
    const { data: qData, error: qError } = await supabase
      .from('learning_questions')
      .select('*')
      .in('module_id', moduleIds)
      .order('sort_order', { ascending: true })
    if (qError) throw qError
    questions = qData || []
  }

  const modulesWithQuestions = (modules || []).map(m => ({
    ...m,
    questions: questions.filter(q => q.module_id === m.id),
  }))

  return { course, modules: modulesWithQuestions }
}

export async function loadMyEnrollments(userId) {
  const { data, error } = await supabase
    .from('learning_enrollments')
    .select('*, course:learning_courses(*)')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map(row => ({ ...row, course: Array.isArray(row.course) ? row.course[0] : row.course }))
}

export async function getOrCreateEnrollment(courseId, userId, { isRequired = false, dueDate = null } = {}) {
  const { data: existing, error: findError } = await supabase
    .from('learning_enrollments')
    .select('*')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (findError) throw findError
  if (existing) return existing

  const { data, error } = await supabase
    .from('learning_enrollments')
    .insert({
      course_id: courseId,
      user_id: userId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      is_required: isRequired,
      due_date: dueDate,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function touchEnrollment(enrollmentId) {
  await supabase
    .from('learning_enrollments')
    .update({ last_accessed_at: new Date().toISOString(), status: 'in_progress' })
    .eq('id', enrollmentId)
    .eq('status', 'not_started')
}

export async function saveModuleProgress(enrollmentId, moduleId, userId, { status, answers, score }) {
  const { data, error } = await supabase
    .from('learning_module_progress')
    .upsert(
      {
        enrollment_id: enrollmentId,
        module_id: moduleId,
        user_id: userId,
        status,
        answers: answers || {},
        score: score ?? null,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      },
      { onConflict: 'enrollment_id,module_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

function generateCertificateNumber() {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `FF-${stamp}-${rand}`
}

export async function recalculateEnrollmentProgress(enrollmentId, totalModules) {
  const { data: progressRows, error } = await supabase
    .from('learning_module_progress')
    .select('module_id, status, score')
    .eq('enrollment_id', enrollmentId)
  if (error) throw error

  const completed = (progressRows || []).filter(r => r.status === 'completed')
  const percent = totalModules > 0 ? Math.round((completed.length / totalModules) * 100) : 0
  const scored = completed.filter(r => r.score !== null)
  const avgScore = scored.length ? Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length) : null

  const { data: enrollment, error: enrollError } = await supabase
    .from('learning_enrollments')
    .select('*, course:learning_courses(*)')
    .eq('id', enrollmentId)
    .single()
  if (enrollError) throw enrollError
  const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course

  const isComplete = percent >= 100
  const wasAlreadyComplete = enrollment.status === 'completed'

  const updatePayload = {
    progress_percent: percent,
    score: avgScore,
    status: isComplete ? 'completed' : 'in_progress',
    completed_at: isComplete ? (enrollment.completed_at || new Date().toISOString()) : null,
    attempts: isComplete && !wasAlreadyComplete ? enrollment.attempts + 1 : enrollment.attempts,
  }

  const { error: updateError } = await supabase
    .from('learning_enrollments')
    .update(updatePayload)
    .eq('id', enrollmentId)
  if (updateError) throw updateError

  if (isComplete && !wasAlreadyComplete) {
    await awardCourseCompletion(enrollment.user_id, course, enrollmentId)
  }

  return { percent, avgScore, isComplete, justCompleted: isComplete && !wasAlreadyComplete }
}

async function awardCourseCompletion(userId, course, enrollmentId) {
  const today = new Date()
  const activityDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  await supabase.from('learning_activity_log').insert({
    user_id: userId,
    activity_type: 'course_completed',
    points: course.points_awarded || 0,
    pd_hours: course.pd_hours || 0,
    course_id: course.id,
    activity_date: activityDate,
  })

  const { data: existingStreak } = await supabase
    .from('learning_activity_log')
    .select('id')
    .eq('user_id', userId)
    .eq('activity_type', 'streak_day')
    .eq('activity_date', activityDate)
    .maybeSingle()

  if (!existingStreak) {
    await supabase.from('learning_activity_log').insert({
      user_id: userId,
      activity_type: 'streak_day',
      activity_date: activityDate,
    })
  }

  if (course.certificate_enabled) {
    await supabase.from('learning_certificates').insert({
      enrollment_id: enrollmentId,
      course_id: course.id,
      user_id: userId,
      certificate_number: generateCertificateNumber(),
      pd_hours: course.pd_hours || 0,
    })
  }
}

export async function toggleFavourite(enrollmentId, isFavourite) {
  const { error } = await supabase
    .from('learning_enrollments')
    .update({ is_favourite: isFavourite })
    .eq('id', enrollmentId)
  if (error) throw error
}

export async function loadLearningStats(userId) {
  const { data: activity, error } = await supabase
    .from('learning_activity_log')
    .select('activity_type, points, pd_hours, activity_date')
    .eq('user_id', userId)
  if (error) throw error

  const rows = activity || []
  const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0)
  const totalPdHours = rows.reduce((sum, r) => sum + Number(r.pd_hours || 0), 0)

  const streakDays = [...new Set(rows.filter(r => r.activity_type === 'streak_day').map(r => r.activity_date))].sort().reverse()
  let streak = 0
  if (streakDays.length) {
    const cursor = new Date()
    for (let i = 0; i < streakDays.length; i++) {
      const expected = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (streakDays[i] === expected) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
  }

  return { totalPoints, totalPdHours, streak }
}

export async function loadMyCertificates(userId) {
  const { data, error } = await supabase
    .from('learning_certificates')
    .select('*, course:learning_courses(title, category)')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({ ...row, course: Array.isArray(row.course) ? row.course[0] : row.course }))
}

export async function loadAssignmentsForCourses(courseIds) {
  if (!courseIds.length) return []
  const { data, error } = await supabase
    .from('learning_assignments')
    .select('*')
    .in('course_id', courseIds)
  if (error) throw error
  return data || []
}

// Most specific match wins: staff > centre > organisation.
export function pickAssignment(assignments, courseId, profile) {
  const forCourse = assignments.filter(a => a.course_id === courseId)
  const staffMatch = forCourse.find(a => a.scope === 'staff' && a.staff_id === profile?.id)
  if (staffMatch) return staffMatch
  const centreMatch = forCourse.find(a => a.scope === 'centre' && a.centre === profile?.centre)
  if (centreMatch) return centreMatch
  const orgMatch = forCourse.find(a => a.scope === 'organisation')
  if (orgMatch) return orgMatch
  return null
}

export async function setOrganisationRequirement(courseId, dueDate, userId) {
  const { data: existing, error: findError } = await supabase
    .from('learning_assignments')
    .select('id')
    .eq('course_id', courseId)
    .eq('scope', 'organisation')
    .maybeSingle()
  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('learning_assignments')
      .update({ due_date: dueDate })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('learning_assignments')
      .insert({ course_id: courseId, scope: 'organisation', due_date: dueDate, created_by: userId })
    if (error) throw error
  }
}

export async function clearOrganisationRequirement(courseId) {
  const { error } = await supabase
    .from('learning_assignments')
    .delete()
    .eq('course_id', courseId)
    .eq('scope', 'organisation')
  if (error) throw error
}

// ---- Admin authoring ----

export async function createCourse(payload, userId) {
  const { data, error } = await supabase
    .from('learning_courses')
    .insert({ ...payload, created_by: userId, author_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(courseId, payload, userId) {
  const { data, error } = await supabase
    .from('learning_courses')
    .update({ ...payload, updated_by: userId })
    .eq('id', courseId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCourse(courseId) {
  const { error } = await supabase.from('learning_courses').delete().eq('id', courseId)
  if (error) throw error
}

export async function createModule(payload) {
  const { data, error } = await supabase.from('learning_modules').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateModule(moduleId, payload) {
  const { data, error } = await supabase.from('learning_modules').update(payload).eq('id', moduleId).select().single()
  if (error) throw error
  return data
}

export async function deleteModule(moduleId) {
  const { error } = await supabase.from('learning_modules').delete().eq('id', moduleId)
  if (error) throw error
}

export async function createQuestion(payload) {
  const { data, error } = await supabase.from('learning_questions').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteQuestion(questionId) {
  const { error } = await supabase.from('learning_questions').delete().eq('id', questionId)
  if (error) throw error
}

export async function uploadLearningMedia(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('learning-media').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('learning-media').getPublicUrl(path)
  return data.publicUrl
}

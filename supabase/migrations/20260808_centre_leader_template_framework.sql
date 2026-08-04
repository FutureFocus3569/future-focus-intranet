INSERT INTO appraisal_templates (
  title,
  role_scope,
  description,
  template_schema,
  is_active,
  created_by,
  updated_by
)
SELECT
  'Centre Leader Appraisal Framework',
  'centre_leader',
  'Ready-to-use framework template for centre leader appraisal cycles. Editable by super admin.',
  $$
  {
    "sections": [
      {
        "title": "Role Context and Reflection",
        "questions": [
          {"id":"q1","prompt":"Summarise the last appraisal period and your key focus areas."},
          {"id":"q2","prompt":"What were your top three achievements this cycle?"},
          {"id":"q3","prompt":"What were the biggest challenges and how did you respond?"}
        ]
      },
      {
        "title": "Leadership and Team Culture",
        "questions": [
          {"id":"q4","prompt":"How have you modelled Future Focus values in day-to-day leadership?"},
          {"id":"q5","prompt":"How have you built trust, collaboration, and accountability in your team?"},
          {"id":"q6","prompt":"How effectively did you coach and grow team capability?"},
          {"id":"q7","prompt":"What actions did you take to support staff wellbeing and retention?"},
          {"id":"q8","prompt":"How did you manage difficult conversations or performance concerns?"}
        ]
      },
      {
        "title": "Teaching, Learning, and Outcomes",
        "questions": [
          {"id":"q9","prompt":"How did you strengthen teaching quality and pedagogy across the centre?"},
          {"id":"q10","prompt":"What evidence shows improved outcomes for tamariki?"},
          {"id":"q11","prompt":"How did you support planning, assessment, and curriculum consistency?"},
          {"id":"q12","prompt":"How did you partner with whanau and the wider community?"}
        ]
      },
      {
        "title": "Operations, Compliance, and Safety",
        "questions": [
          {"id":"q13","prompt":"How effectively were operational standards maintained this cycle?"},
          {"id":"q14","prompt":"How did you ensure licensing, policy, and compliance expectations were met?"},
          {"id":"q15","prompt":"What were the key health and safety priorities and outcomes?"},
          {"id":"q16","prompt":"How did you use data to make timely operational decisions?"},
          {"id":"q17","prompt":"What risks were identified and how were they mitigated?"}
        ]
      },
      {
        "title": "Centre Performance and Stakeholder Confidence",
        "questions": [
          {"id":"q18","prompt":"How did you influence occupancy, enrolment, and centre stability?"},
          {"id":"q19","prompt":"How have you represented the centre professionally with families and stakeholders?"},
          {"id":"q20","prompt":"What feedback trends (staff, whanau, community) did you act on?"},
          {"id":"q21","prompt":"Where did performance exceed expectations and why?"},
          {"id":"q22","prompt":"Where did performance fall short and what corrective actions are in place?"}
        ]
      },
      {
        "title": "Development Plan and Next Cycle",
        "questions": [
          {"id":"q23","prompt":"What are your top development goals for the next cycle?"},
          {"id":"q24","prompt":"What measurable outcomes will define success by period end?"},
          {"id":"q25","prompt":"What support, resources, or coaching do you need from your reviewer?"},
          {"id":"q26","prompt":"What centre priorities will you lead next and how will you deliver them?"},
          {"id":"q27","prompt":"Any final comments or context to support fair appraisal decisions?"}
        ]
      }
    ]
  }
  $$::jsonb,
  true,
  null,
  null
WHERE NOT EXISTS (
  SELECT 1
  FROM appraisal_templates t
  WHERE t.title = 'Centre Leader Appraisal Framework'
);

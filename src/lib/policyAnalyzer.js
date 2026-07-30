/**
 * Policy Review AI Analyzer
 * Analyzes staff feedback using OpenAI API
 * Generates suggestions for policy updates
 */

/**
 * Analyze policy feedback using OpenAI
 * @param {Array} feedbackArray - Array of feedback objects
 * @param {string} policyTitle - Title of the policy being reviewed
 * @param {string} policyContent - Original policy text/content
 * @returns {Promise<Object>} Analysis results with themes, suggestions, etc.
 */
export async function analyzePolicyFeedback(feedbackArray, policyTitle, policyContent) {
  try {
    console.log('🔍 Starting analysis...', { feedbackArray, policyTitle })
    
    if (!feedbackArray || feedbackArray.length === 0) {
      console.warn('⚠️ No feedback to analyze')
      return {
        themes: [],
        suggestedChanges: [],
        contradictions: [],
        leadershipSummary: 'No feedback received yet.',
      }
    }

    // Check API key
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('VITE_OPENAI_API_KEY is not set in .env.local')
    }
    console.log('✅ API key found')

    // Format feedback for the prompt
    const feedbackText = feedbackArray
      .map((fb, i) => {
        let text = `Feedback ${i + 1}:\n`
        if (fb.section_reference) text += `  Section: ${fb.section_reference}\n`
        text += `  Comment: ${fb.feedback}\n`
        if (fb.suggested_wording) text += `  Suggested wording: ${fb.suggested_wording}\n`
        if (fb.works_in_practice !== null) text += `  Works in practice: ${fb.works_in_practice ? 'Yes' : 'No'}\n`
        return text
      })
      .join('\n')

    const prompt = `You are an expert policy reviewer for an early learning centre. Analyze the following staff feedback on a policy and provide structured analysis.

POLICY TITLE: ${policyTitle}

ORIGINAL POLICY CONTENT:
${policyContent || '(Content not available)'}

STAFF FEEDBACK RECEIVED:
${feedbackText}

Please analyze this feedback and provide:

1. KEY THEMES - Major themes or patterns in the feedback (list 2-5 key points)
2. SUGGESTED WORDING CHANGES - Specific phrases or sections that should be changed (provide exact suggested replacements)
3. CONTRADICTIONS - Any conflicting feedback or areas where staff disagree (if any)
4. LEADERSHIP SUMMARY - A concise executive summary for management/board review (2-3 sentences)

Format your response as JSON with these exact keys:
{
  "themes": ["theme 1", "theme 2", ...],
  "suggestedChanges": [
    {"section": "section reference", "original": "original text", "suggested": "new suggested text", "reason": "why this change"},
    ...
  ],
  "contradictions": ["contradiction 1", "contradiction 2", ...],
  "leadershipSummary": "summary text here"
}

Only return valid JSON, no additional text.`

    console.log('📤 Calling OpenAI API...')
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert policy analyst for early learning centres. Provide structured analysis in valid JSON format only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    console.log('📥 OpenAI response status:', response.status)

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ OpenAI error:', error)
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || '{}'
    console.log('📝 AI response content:', content)

    // Parse JSON response
    let analysis
    try {
      analysis = JSON.parse(content)
      console.log('✅ Parsed analysis:', analysis)
    } catch (e) {
      // If JSON parsing fails, return structured empty response
      console.error('❌ Failed to parse OpenAI response:', content, e)
      analysis = {
        themes: ['Unable to parse AI response'],
        suggestedChanges: [],
        contradictions: [],
        leadershipSummary: 'Analysis incomplete - please review feedback manually.',
      }
    }

    return {
      themes: analysis.themes || [],
      suggestedChanges: analysis.suggestedChanges || [],
      contradictions: analysis.contradictions || [],
      leadershipSummary: analysis.leadershipSummary || 'No summary available.',
    }
  } catch (error) {
    console.error('❌ Error analyzing policy feedback:', error)
    throw new Error(error.message || 'Failed to analyze feedback')
  }
}

/**
 * Apply suggested changes to policy text
 * @param {string} originalText - Original policy content
 * @param {Array} approvedChanges - Array of approved change objects
 * @returns {string} Updated policy text
 */
export function applyApprovedChanges(originalText, approvedChanges) {
  let updatedText = originalText

  if (approvedChanges && Array.isArray(approvedChanges)) {
    // Apply changes in reverse order to maintain string indices
    const sortedChanges = [...approvedChanges].reverse()
    for (const change of sortedChanges) {
      if (change.original && change.suggested) {
        updatedText = updatedText.replace(change.original, change.suggested)
      }
    }
  }

  return updatedText
}

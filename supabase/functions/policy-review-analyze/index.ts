import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { feedbackArray, policyTitle, policyContent } = await req.json()

    if (!Array.isArray(feedbackArray) || feedbackArray.length === 0) {
      return new Response(
        JSON.stringify({
          themes: [],
          suggestedChanges: [],
          contradictions: [],
          leadershipSummary: 'No feedback received yet.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured on server' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const feedbackText = feedbackArray
      .map((fb: any, i: number) => {
        let text = `Feedback ${i + 1}:\n`
        if (fb.section_reference) text += `  Section: ${fb.section_reference}\n`
        if (fb.status === 'reviewed') {
          text += '  Comment: Reviewed, no feedback to provide.\n'
          return text
        }
        text += `  Comment: ${fb.feedback || ''}\n`
        if (fb.suggested_wording) text += `  Suggested wording: ${fb.suggested_wording}\n`
        if (fb.works_in_practice !== null && fb.works_in_practice !== undefined) {
          text += `  Works in practice: ${fb.works_in_practice ? 'Yes' : 'No'}\n`
        }
        return text
      })
      .join('\n')

    const prompt = `You are an expert policy reviewer for an early learning centre. Analyze the following staff feedback on a policy and provide structured analysis.

POLICY TITLE: ${policyTitle || 'Untitled policy'}

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

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
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
        temperature: 0.5,
        max_tokens: 2000,
      }),
    })

    if (!openaiResponse.ok) {
      const body = await openaiResponse.text()
      return new Response(
        JSON.stringify({ error: `OpenAI API error (${openaiResponse.status}): ${body}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await openaiResponse.json()
    const content = data?.choices?.[0]?.message?.content || '{}'

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = {
        themes: ['Unable to parse AI response'],
        suggestedChanges: [],
        contradictions: [],
        leadershipSummary: 'Analysis incomplete - please review feedback manually.',
      }
    }

    return new Response(
      JSON.stringify({
        themes: parsed.themes || [],
        suggestedChanges: parsed.suggestedChanges || [],
        contradictions: parsed.contradictions || [],
        leadershipSummary: parsed.leadershipSummary || 'No summary available.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

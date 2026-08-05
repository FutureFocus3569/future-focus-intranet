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
    const { text, title } = await req.json()

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ blocks: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `You are reformatting a childcare centre policy document. The text below was extracted from a PDF and lost all its original line breaks and headings — everything runs together, with only "•" marks surviving as remnants of bullet lists.

Your ONLY job is to split this text into structural blocks. Do NOT rewrite, summarize, paraphrase, correct grammar, or change any wording whatsoever. Every word from the input must appear in your output, unchanged, in the same order. You are adding structure, not editing content.

POLICY TITLE: ${title || 'Untitled policy'}

TEXT:
${text}

Do NOT include the policy title itself as a block — it's already displayed separately above this content, so repeating it here would duplicate it. Start directly with the first real section/point.

Split the rest into an array of blocks using these types:
- "heading": a short section title (only if the text clearly contains one — most policies won't)
- "paragraph": a block of plain prose
- "bullet": one list item. If the bullet starts with a short bolded label followed by a dash before the main sentence (e.g. "Information concerning your child – Please feel free to..."), put the label part in "lead" and the rest in "text" WITHOUT the dash (the dash is added automatically when displayed, so "text" must not start with "-" or "–"). If there's no such label, leave "lead" empty and put everything in "text".

Return ONLY valid JSON in this exact shape, no other text:
{
  "blocks": [
    {"type": "heading", "text": "..."},
    {"type": "paragraph", "text": "..."},
    {"type": "bullet", "lead": "...", "text": "..."}
  ]
}`

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
            content: 'You reformat policy text into structural blocks without ever changing the wording. Output valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 4000,
      }),
    })

    if (!openaiResponse.ok) {
      const body = await openaiResponse.text()
      return new Response(
        JSON.stringify({ error: `OpenAI API error (${openaiResponse.status}): ${body}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await openaiResponse.json()
    const content = data?.choices?.[0]?.message?.content || '{}'

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return new Response(JSON.stringify({ blocks: [], error: 'Could not parse AI response' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const blocks = Array.isArray(parsed.blocks)
      ? parsed.blocks
          .map((b: any) => {
            const type = ['heading', 'paragraph', 'bullet'].includes(b?.type) ? b.type : 'paragraph'
            const lead = typeof b?.lead === 'string' ? b.lead.trim() : ''
            let text = typeof b?.text === 'string' ? b.text.trim() : ''
            // Defensive: strip a leading dash left over from the source bullet,
            // since the UI/print view already inserts "lead – text" itself.
            if (lead && text) text = text.replace(/^[-–—]\s*/, '')
            return { type, lead, text }
          })
          .filter((b: any) => b.text || b.lead)
      : []

    return new Response(JSON.stringify({ blocks }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

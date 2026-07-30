import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, history = [], userId } = await req.json()

    if (!question || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Search for relevant policies (old system) - ignore errors
    let policies: any[] = []
    try {
      const { data } = await supabase
        .from('policies')
        .select('title, content, category')
        .limit(5)
      policies = data || []
    } catch (_) {}

    // Search for published Knowledge Centre documents (new system) - ignore errors
    let documents: any[] = []
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, title, extracted_text, category, document_type, licensing_criteria, storage_path')
        .eq('status', 'published')
        .limit(20)
      documents = (data || []).filter((d: any) => d.extracted_text && d.extracted_text.trim().length > 0)
    } catch (_) {}

    const hasContent = policies.length > 0 || documents.length > 0

    if (!hasContent) {
      return new Response(
        JSON.stringify({ answer: 'No policies or documents found yet. Please contact your administrator.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Build context from old policies
    const policyContext = policies.length > 0
      ? policies.map((p: any) => `[${(p.category || 'POLICY').toUpperCase()}] ${p.title}\n${p.content || ''}`).join('\n\n---\n\n')
      : ''

    // Build context from new Knowledge Centre documents — tag each with DOC_ID for citation tracking
    // Truncate each document to 3000 chars to avoid token overflow
    const MAX_DOC_CHARS = 3000
    const documentContext = documents.length > 0
      ? documents.map((d: any) => {
          const code = d.licensing_criteria ? ` (${d.licensing_criteria})` : ''
          const text = (d.extracted_text || '').slice(0, MAX_DOC_CHARS)
          return `[DOC_ID:${d.id}] [${(d.category || 'DOCUMENT').toUpperCase()} - ${(d.document_type || 'POLICY').toUpperCase()}${code}] ${d.title}\n${text}`
        }).join('\n\n---\n\n')
      : ''

    const allContext = [policyContext, documentContext].filter(s => s.length > 0).join('\n\n===\n\n')

    // Call OpenAI API
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for Future Focus ECE centre staff. Answer questions based only on the provided policies and documents. Be concise and accurate. If you cannot find the answer, say so clearly.\n\nIMPORTANT: At the very end of your response, on a new line, write exactly: SOURCES_USED:[comma-separated list of DOC_ID values you actually referenced to answer the question. Only include IDs you genuinely used.]`,
          },
          // Include conversation history for follow-up questions
          ...history.map((m: any) => ({ role: m.role, content: m.content })),
          {
            role: 'user',
            content: `Based on these policies and documents:\n\n${allContext}\n\nQuestion: ${question}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      return new Response(
        JSON.stringify({ error: `OpenAI API error (${openaiResponse.status}): ${error}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const openaiData = await openaiResponse.json()
    const rawAnswer = openaiData.choices[0]?.message?.content || 'No answer generated'

    // Parse SOURCES_USED from the AI response
    const sourcesMatch = rawAnswer.match(/SOURCES_USED:\s*([^\n]+)/i)
    const citedIds = sourcesMatch
      ? sourcesMatch[1].split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : []

    // Clean the answer by removing the SOURCES_USED line
    const answer = rawAnswer.replace(/\nSOURCES_USED:[^\n]*/i, '').trim()

    // Return only the documents the AI actually cited
    const sources = documents
      .filter((d: any) => citedIds.includes(d.id))
      .map((d: any) => ({
        id: d.id,
        title: d.title,
        licensing_criteria: d.licensing_criteria || null,
        storage_path: d.storage_path,
        category: d.category,
      }))

    // Log the query if userId provided
    if (userId) {
      try {
        await supabase.from('ai_query_log').insert([{
          user_id: userId,
          question,
          source_document_ids: sources.map((s: any) => s.id),
        }])
      } catch (_) {}
    }

    return new Response(JSON.stringify({ answer, sources }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

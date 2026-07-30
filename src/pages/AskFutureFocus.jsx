import React, { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, FileText, Plus, User, ExternalLink, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getSignedUrl } from '../lib/documentService.js'
import { DOCUMENT_CATEGORIES } from '../lib/documentTypes.js'

export function AskFutureFocusPage({ currentProfile }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [publishedDocs, setPublishedDocs] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const userId = currentProfile?.id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    supabase
      .from('documents')
      .select('id, title, category, licensing_criteria, storage_path, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPublishedDocs(data || []))
  }, [])

  async function sendMessage(questionText) {
    const text = (questionText || input).trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ask-future-focus', {
        body: {
          question: text,
          history: messages.slice(-6),
          userId: userId || null,
        },
      })

      if (fnError || data?.error) {
        setMessages(m => [...m, { role: 'assistant', content: fnError?.message || data?.error || 'Something went wrong.', error: true }])
      } else {
        setMessages(m => [...m, { role: 'assistant', content: data?.answer || 'No answer generated.', sources: data?.sources || [] }])
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: err.message, error: true }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  async function handleViewSource(source) {
    try {
      const { signedUrl } = await getSignedUrl(source.storage_path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      alert('Could not open document. Please try again.')
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage()
  }

  function startNewChat() {
    setMessages([])
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-icon"><Sparkles size={18} /></div>
          <div>
            <div className="chat-header-title">Ask Future Focus</div>
            <div className="chat-header-sub">Ask anything about policies and procedures</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="chat-new-btn" onClick={startNewChat}>
            <Plus size={15} /> New chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon"><Sparkles size={36} /></div>
            <h2>How can I help you today?</h2>
            <p>Ask me anything about Future Focus policies and procedures.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
              <div className="chat-msg-avatar">
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>
              <div className="chat-msg-wrap">
                <div className={`chat-msg-bubble${msg.error ? ' chat-msg-error' : ''}`}>
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="chat-sources">
                    <div className="chat-sources-label">Sources</div>
                    {msg.sources.map((src, si) => (
                      <button key={si} className="chat-source-item" onClick={() => handleViewSource(src)}>
                        <FileText size={13} />
                        <span>{src.title}{src.licensing_criteria ? ` — ${src.licensing_criteria}` : ''}</span>
                        <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-avatar"><Sparkles size={16} /></div>
            <div className="chat-msg-bubble chat-msg-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-area">
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about policies or procedures…"
            disabled={loading}
            autoFocus
          />
          <button type="submit" className="chat-send-btn" disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
        <div className="chat-input-hint">FF AI answers from published Knowledge Centre documents only.</div>
      </div>
    </div>
  )
}

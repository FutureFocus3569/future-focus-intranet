import React, { useState } from 'react'
import { Search, Send, Sparkles, Lightbulb, HelpCircle, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export function AskFutureFocusPage() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    
    setLoading(true)
    setSearched(true)
    setError('')
    setAnswer('')

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ask-future-focus', {
        body: { question: query },
      })

      if (fnError) {
        setError(fnError.message)
        return
      }

      if (data?.error) {
        setError(data.error)
        return
      }

      setAnswer(data?.answer || 'No answer generated')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const suggestedTopics = [
    { icon: HelpCircle, title: 'Staff Handbook', query: 'staff handbook policies' },
    { icon: BookOpen, title: 'Leave Entitlements', query: 'annual leave sick leave' },
    { icon: Lightbulb, title: 'Health & Safety', query: 'health and safety procedures' },
    { icon: Search, title: 'Learning & Development', query: 'professional development PD' },
  ]

  function handleQuickTopic(topicQuery) {
    setQuery(topicQuery)
    setTimeout(() => handleSearch({ preventDefault: () => {} }), 0)
  }

  return (
    <div className="ask-page">
      <div className="ask-hero">
        <div className="ask-hero-content">
          <div className="ask-icon"><Sparkles size={48}/></div>
          <h1>Ask Future Focus</h1>
          <p>Search policies and get answers instantly.</p>
          
          <form onSubmit={handleSearch} className="ask-search-form">
            <div className="ask-search-input">
              <Search size={20}/>
              <input
                type="text"
                placeholder="Search policies, procedures, handbooks..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-send" disabled={loading} title="Search">
                <Send size={18}/>
              </button>
            </div>
          </form>
        </div>
      </div>

      {!searched ? (
        <div className="ask-suggestions">
          <h2>Quick Topics</h2>
          <div className="suggestion-grid">
            {suggestedTopics.map(topic => {
              const Icon = topic.icon
              return (
                <button
                  key={topic.title}
                  className="suggestion-card"
                  onClick={() => handleQuickTopic(topic.query)}
                >
                  <div className="suggestion-icon"><Icon size={24}/></div>
                  <span>{topic.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : loading ? (
        <div className="ask-results">
          <div className="ask-loading">
            <div className="spinner"></div>
            <p>Searching policies…</p>
          </div>
        </div>
      ) : error ? (
        <div className="ask-results">
          <div className="ask-empty">
            <Lightbulb size={40}/>
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : answer ? (
        <div className="ask-results">
          <article className="result-card">
            <h3>Answer</h3>
            <p style={{whiteSpace: 'pre-wrap', color: '#0d2b36', fontSize: 15, lineHeight: 1.6}}>{answer}</p>
          </article>
        </div>
      ) : searched ? (
        <div className="ask-results">
          <div className="ask-empty">
            <Lightbulb size={40}/>
            <h3>No Answer</h3>
            <p>Couldn't find an answer in the available policies.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

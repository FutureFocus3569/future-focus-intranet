import React from 'react'
import { createPortal } from 'react-dom'
import { X, Printer } from 'lucide-react'
import { parseFlatTextToBlocks } from '../lib/policyReview.js'

function formatPrintDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Groups consecutive bullet blocks into a single list, so the print output
// reads as proper heading/paragraph/list sections instead of one item per
// block regardless of type.
function groupBlocks(blocks) {
  const groups = []
  for (const block of blocks) {
    const type = block.type || 'bullet'
    const last = groups[groups.length - 1]
    if (type === 'bullet') {
      if (last?.type === 'bullet-list') {
        last.items.push(block)
      } else {
        groups.push({ type: 'bullet-list', items: [block] })
      }
    } else {
      groups.push({ type, text: block.text })
    }
  }
  return groups
}

export function PolicyPrintView({ doc, onClose }) {
  if (!doc) return null

  const blocks = Array.isArray(doc.content_blocks) && doc.content_blocks.length > 0
    ? doc.content_blocks
    : parseFlatTextToBlocks(doc.extracted_text)
  const groups = groupBlocks(blocks)

  return createPortal(
    <div className="policy-print-overlay" onClick={onClose}>
      <div className="policy-print-toolbar">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </div>
      <div className="policy-print-page" onClick={e => e.stopPropagation()}>
        <div className="policy-print-header">
          <h1>{doc.title}</h1>
          <img src="/logo-policy.png" alt="Future Focus" />
        </div>

        {groups.length === 0 ? (
          <p className="policy-print-empty">No content has been added to this policy yet.</p>
        ) : (
          <div className="policy-print-body">
            {groups.map((group, index) => {
              if (group.type === 'heading') {
                return <h2 key={index} className="policy-print-heading">{group.text}</h2>
              }
              if (group.type === 'paragraph') {
                return <p key={index} className="policy-print-paragraph">{group.text}</p>
              }
              return (
                <ul key={index} className="policy-print-bullets">
                  {group.items.map((block, itemIndex) => (
                    <li key={itemIndex}>
                      {block.lead ? <strong>{block.lead}{block.text ? ' – ' : ''}</strong> : null}
                      {block.text}
                    </li>
                  ))}
                </ul>
              )
            })}
          </div>
        )}

        <table className="policy-print-meta">
          <tbody>
            <tr>
              <th>Policy Category</th>
              <td>{doc.category || '—'}</td>
            </tr>
            <tr className="policy-print-meta-accent">
              <th>Licensing Criteria</th>
              <td>{doc.licensing_criteria || '—'}</td>
            </tr>
            <tr>
              <th>Date adapted</th>
              <td>{formatPrintDate(doc.effective_date)}</td>
            </tr>
            <tr>
              <th>Next review date</th>
              <td>{formatPrintDate(doc.next_review_date)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>,
    document.body
  )
}

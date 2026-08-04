import React from 'react'
import { X, Printer } from 'lucide-react'
import { parseFlatTextToBlocks } from '../lib/policyReview.js'

function formatPrintDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PolicyPrintView({ doc, onClose }) {
  if (!doc) return null

  const blocks = Array.isArray(doc.content_blocks) && doc.content_blocks.length > 0
    ? doc.content_blocks
    : parseFlatTextToBlocks(doc.extracted_text)

  return (
    <div className="policy-print-overlay" onClick={onClose}>
      <div className="policy-print-toolbar">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </div>
      <div className="policy-print-page" onClick={e => e.stopPropagation()}>
        <div className="policy-print-header">
          <h1>{doc.title}</h1>
          <img src="/logo.png" alt="Future Focus" />
        </div>

        {blocks.length === 0 ? (
          <p className="policy-print-empty">No content has been added to this policy yet.</p>
        ) : (
          <ul className="policy-print-bullets">
            {blocks.map((block, index) => (
              <li key={index}>
                {block.lead ? <strong>{block.lead}{block.text ? ' – ' : ''}</strong> : null}
                {block.text}
              </li>
            ))}
          </ul>
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
    </div>
  )
}

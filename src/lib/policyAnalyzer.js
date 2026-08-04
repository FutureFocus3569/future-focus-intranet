/**
 * Policy Review AI Analyzer
 * Analyzes staff feedback using the secure Supabase edge function.
 * Generates suggestions for policy updates
 */

import { supabase } from './supabase.js'

/**
 * Analyze policy feedback using OpenAI
 * @param {Array} feedbackArray - Array of feedback objects
 * @param {string} policyTitle - Title of the policy being reviewed
 * @param {string} policyContent - Original policy text/content
 * @returns {Promise<Object>} Analysis results with themes, suggestions, etc.
 */
export async function analyzePolicyFeedback(feedbackArray, policyTitle, policyContent) {
  try {
    if (!feedbackArray || feedbackArray.length === 0) {
      return {
        themes: [],
        suggestedChanges: [],
        contradictions: [],
        leadershipSummary: 'No feedback received yet.',
      }
    }

    const { data, error } = await supabase.functions.invoke('policy-review-analyze', {
      body: {
        feedbackArray,
        policyTitle,
        policyContent: policyContent || '',
      },
    })

    if (error) throw new Error(error.message || 'Could not analyze feedback')
    if (data?.error) throw new Error(data.error)

    return {
      themes: data?.themes || [],
      suggestedChanges: data?.suggestedChanges || [],
      contradictions: data?.contradictions || [],
      leadershipSummary: data?.leadershipSummary || 'No summary available.',
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

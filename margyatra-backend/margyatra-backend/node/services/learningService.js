/**
 * services/learningService.js
 * Adaptive learning — updates user preference weights based on behaviour signals
 *
 * ── ADAPTIVE LEARNING ALGORITHM ──────────────────────────────────────────────
 *
 * PSEUDO-CODE:
 *
 * function updateWeights(userId, action, metadata):
 *   profile   = load(userId)
 *   delta     = ACTION_DELTA_MAP[action]          // e.g. click=+0.1, skip=-0.15
 *   dimension = infer_dimension(metadata)         // e.g. 'adventure', 'budget_high'
 *
 *   // Apply delta with exponential decay to avoid runaway weights
 *   profile.weights[dimension] += delta
 *   profile.weights[dimension]  = clamp(profile.weights[dimension], 0.1, 3.0)
 *
 *   // Normalise: other vibes gently pulled toward mean
 *   for each dim in profile.weights:
 *     if dim != dimension:
 *       profile.weights[dim] += (1.0 - profile.weights[dim]) * DECAY_RATE
 *
 *   save(userId, profile)
 *   return profile
 *
 * HOW THE SYSTEM IMPROVES OVER TIME:
 *   • Each user interaction is a signal (click, save, skip, time_spent).
 *   • Weights drift toward the user's revealed preferences session by session.
 *   • The itinerary generator uses weights as multipliers in the scoring formula.
 *   • As weights diverge, personalisation strengthens — the system never repeats
 *     items the user has skipped and ranks saved-style places higher.
 *   • A global popularity signal (aggregate clicks across all users) is blended
 *     in at 15% to avoid cold-start issues for new users.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const db = require('../db/database');

// Weight delta per action type
const ACTION_DELTA = {
  click:      +0.10,
  save:       +0.25,
  skip:       -0.15,
  time_spent: +0.05,   // per second normalised to 0–1 range
  rate:       null,     // handled separately
};

const WEIGHT_MIN  = 0.10;
const WEIGHT_MAX  = 3.00;
const DECAY_RATE  = 0.05;  // pull non-targeted dims toward 1.0

// Map item metadata → dimension key
function inferDimension(metadata = {}) {
  const { vibe, budget, cost_category, item_type } = metadata;
  if (vibe)          return vibe;
  if (budget)        return `budget_${budget}`;
  if (cost_category) return `budget_${cost_category}`;
  return null;
}

async function updateUserProfile(userId, actionType, metadata = {}) {
  const profile   = await db.getUserProfile(userId);
  const weights   = { ...profile.weights };
  const dimension = inferDimension(metadata);

  if (dimension && dimension in weights) {
    let delta = ACTION_DELTA[actionType] ?? 0;

    // Scale time_spent signal: metadata.seconds / 120 (max 2 min = full signal)
    if (actionType === 'time_spent') {
      const secs = Math.min(metadata.seconds ?? 0, 120);
      delta = (secs / 120) * 0.15;
    }

    // Scale rating signal: (rating - 3) * 0.1  →  -0.2 to +0.2
    if (actionType === 'rate') {
      const rating = metadata.rating ?? 3;
      delta = (rating - 3) * 0.10;
    }

    weights[dimension] = clamp(weights[dimension] + delta, WEIGHT_MIN, WEIGHT_MAX);

    // Soft normalisation: pull other dims gently toward 1.0
    for (const dim in weights) {
      if (dim !== dimension) {
        weights[dim] += (1.0 - weights[dim]) * DECAY_RATE;
        weights[dim]  = clamp(weights[dim], WEIGHT_MIN, WEIGHT_MAX);
      }
    }
  }

  await db.updatePreferences(userId, weights);
  return { ...profile, weights };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

module.exports = { updateUserProfile };

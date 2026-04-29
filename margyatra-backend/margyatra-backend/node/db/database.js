/**
 * db/database.js
 * In-memory store (swap out for SQLite / PostgreSQL with same interface)
 *
 * Tables:
 *   users           – id, username, created_at
 *   preferences     – user_id, weights (JSON)
 *   activity_log    – id, user_id, action_type, metadata, ts
 *   leaderboard     – user_id, username, score
 */

'use strict';

// ── In-memory store ───────────────────────────────────────────────────────────
const users       = new Map();   // user_id → { id, username, created_at }
const preferences = new Map();   // user_id → weights object
const activityLog = [];          // [{ id, user_id, action_type, metadata, ts }]
const leaderboardMap = new Map();// user_id → { username, score }

// Default preference weights
const DEFAULT_WEIGHTS = {
  adventure: 1.0,
  chill:     1.0,
  luxury:    1.0,
  cultural:  1.0,
  budget_low:    1.0,
  budget_medium: 1.0,
  budget_high:   1.0,
};

// ── User & Profile ────────────────────────────────────────────────────────────
async function getUserProfile(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      id: userId,
      username: `traveller_${userId.slice(0, 6)}`,
      created_at: new Date().toISOString(),
    });
    preferences.set(userId, { ...DEFAULT_WEIGHTS });
    leaderboardMap.set(userId, {
      username: users.get(userId).username,
      score: 0,
    });
  }

  const user    = users.get(userId);
  const weights = preferences.get(userId);
  const lb      = leaderboardMap.get(userId);

  return {
    user_id:    user.id,
    username:   user.username,
    created_at: user.created_at,
    score:      lb.score,
    weights,
  };
}

async function updatePreferences(userId, newWeights) {
  const current = preferences.get(userId) || { ...DEFAULT_WEIGHTS };
  preferences.set(userId, { ...current, ...newWeights });
  return preferences.get(userId);
}

// ── Activity Log ──────────────────────────────────────────────────────────────
async function logActivity(userId, actionType, metadata = {}) {
  activityLog.push({
    id:          activityLog.length + 1,
    user_id:     userId,
    action_type: actionType,
    metadata:    JSON.stringify(metadata),
    ts:          new Date().toISOString(),
  });
}

async function getUserActivity(userId, limit = 50) {
  return activityLog
    .filter(e => e.user_id === userId)
    .slice(-limit)
    .map(e => ({ ...e, metadata: JSON.parse(e.metadata) }));
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
async function updateLeaderboard(userId, pointsDelta) {
  const entry = leaderboardMap.get(userId) || {
    username: users.get(userId)?.username || `user_${userId.slice(0, 6)}`,
    score: 0,
  };
  entry.score += pointsDelta;
  leaderboardMap.set(userId, entry);
}

async function getLeaderboard(limit = 10) {
  return [...leaderboardMap.entries()]
    .map(([user_id, v], i) => ({ rank: 0, user_id, username: v.username, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

module.exports = {
  getUserProfile,
  updatePreferences,
  logActivity,
  getUserActivity,
  updateLeaderboard,
  getLeaderboard,
};

/* ════════════════════════════════════════════════════════════
   SQL SCHEMA (PostgreSQL / SQLite)
   ════════════════════════════════════════════════════════════

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE preferences (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  adventure_w     REAL DEFAULT 1.0,
  chill_w         REAL DEFAULT 1.0,
  luxury_w        REAL DEFAULT 1.0,
  cultural_w      REAL DEFAULT 1.0,
  budget_low_w    REAL DEFAULT 1.0,
  budget_medium_w REAL DEFAULT 1.0,
  budget_high_w   REAL DEFAULT 1.0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  action_type TEXT NOT NULL,
  item_id     TEXT,
  metadata    JSONB,
  ts          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activity_user ON activity_log(user_id, ts DESC);

CREATE TABLE leaderboard (
  user_id   TEXT PRIMARY KEY REFERENCES users(id),
  username  TEXT NOT NULL,
  score     INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lb_score ON leaderboard(score DESC);
*/

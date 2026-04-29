# MargYatra — AI Tourism Backend

Production-grade backend for an AI-powered personalised travel recommendation app.
Available in **Node.js (Express)** and **Python (Flask)** — identical API surface.

---

## Architecture Overview

```
margyatra-backend/
├── node/                       # Express implementation
│   ├── server.js               # Entry point + all routes
│   ├── package.json
│   ├── db/
│   │   └── database.js         # In-memory store + SQL schema
│   └── services/
│       ├── itineraryService.js   # Core itinerary generator
│       ├── learningService.js    # Adaptive weight updater
│       ├── safetyService.js      # Safety scoring
│       └── gamificationService.js# Quests + points
│
├── flask/                      # Python implementation
│   ├── app.py                  # Entry point + all routes
│   ├── requirements.txt
│   ├── db/
│   │   └── database.py         # In-memory store + SQLAlchemy models
│   └── services/
│       ├── itinerary_service.py
│       ├── learning_service.py
│       ├── safety_service.py
│       └── gamification_service.py
│
└── shared/
    └── example_response.json   # Strict JSON output reference
```

---

## Quickstart

### Node.js
```bash
cd node
npm install
npm start          # http://localhost:3000
npm run dev        # with nodemon hot-reload
```

### Flask
```bash
cd flask
pip install -r requirements.txt
python app.py      # http://localhost:5000
```

---

## API Reference

### `POST /generate-itinerary`

**Request**
```json
{
  "user_id":  "optional-uuid",
  "location": "Kyoto",
  "country":  "JP",
  "budget":   "medium",
  "vibe":     "adventure",
  "duration": 5
}
```

| Field      | Type    | Values                                    |
|------------|---------|-------------------------------------------|
| `location` | string  | City / region name                        |
| `country`  | string  | ISO-2 country code                        |
| `budget`   | string  | `low` · `medium` · `high`                 |
| `vibe`     | string  | `adventure` · `chill` · `luxury` · `cultural` |
| `duration` | integer | Number of days (1–30)                     |

**Response** — `200 OK`
```json
{
  "user_id":     "uuid",
  "itinerary":   [ ...day objects... ],
  "user_profile": { ...weights... },
  "quests":      [ ...quest objects... ],
  "leaderboard": [ ...ranked users... ]
}
```

---

### `POST /track-user-action`

**Request**
```json
{
  "user_id":     "uuid",
  "action_type": "save",
  "item_id":     "Kyoto Night Bazaar",
  "metadata": {
    "vibe":    "adventure",
    "budget":  "low",
    "seconds": 45,
    "rating":  5
  }
}
```

| `action_type` | Effect on weights     | Points |
|---------------|-----------------------|--------|
| `click`       | +0.10 on dimension    | 5      |
| `save`        | +0.25 on dimension    | 20     |
| `skip`        | −0.15 on dimension    | 0      |
| `time_spent`  | +0–0.15 (time-scaled) | 2      |
| `rate`        | ±0.20 (rating-scaled) | 15     |

**Response** — `200 OK`
```json
{
  "success":                true,
  "user_profile":           { ...updated profile... },
  "points_earned":          20,
  "recommendation_weights": { "adventure": 1.25, "chill": 0.98, ... }
}
```

---

### `GET /leaderboard?limit=10`

**Response** — `200 OK`
```json
{
  "leaderboard": [
    { "rank": 1, "user_id": "...", "username": "traveller_a1b2c3", "score": 420 },
    { "rank": 2, "user_id": "...", "username": "traveller_d4e5f6", "score": 310 }
  ]
}
```

---

## Core Systems

### 1 · Itinerary Generation

Every day is split into three time slots: **morning → afternoon → evening**.
Activities are picked from a vibe-specific pool, scored, de-duplicated across all days,
and enriched with a safety assessment before being returned.

**Recommendation Scoring Formula**

```
score(place) = (vibe_weight × vibe_match)
             + (budget_weight × budget_match)
             + freshness_bonus

vibe_match    = 1.0  if place.type in vibe pool
                0.4  otherwise

budget_match  = 1.0  if cost tier == budget tier
                0.6  if one tier apart
                0.2  if two tiers apart

freshness_bonus = 0.2 (constant; prevents repetition across sessions)
```

---

### 2 · Adaptive Learning System

```
┌─────────────────────────────────────────────────────────────┐
│  User Action  →  Infer Dimension  →  Delta  →  Clamp + Save │
└─────────────────────────────────────────────────────────────┘

PSEUDO-CODE:

function updateWeights(userId, action, metadata):
  profile   = load(userId)
  dimension = infer_dimension(metadata)   # 'adventure', 'budget_high', …
  delta     = compute_delta(action, meta) # ±0.10 to ±0.25

  profile.weights[dimension] = clamp(
    profile.weights[dimension] + delta,
    min=0.10, max=3.00
  )

  # Soft normalisation — pull other dims gently toward 1.0
  for each dim ≠ dimension:
    profile.weights[dim] += (1.0 - profile.weights[dim]) × DECAY_RATE (0.05)
    profile.weights[dim]  = clamp(profile.weights[dim], 0.10, 3.00)

  save(userId, profile.weights)
```

**How it improves over time**

- Each user interaction is a behavioural signal that shifts dimension weights.
- After ~10 sessions, weights diverge enough to produce noticeably different
  recommendations vs. a fresh user — adventure-heavy clickers see more trails;
  luxury-savers see fewer budget hostels.
- A `DECAY_RATE` of 5% prevents runaway specialisation and keeps all dims alive.
- The itinerary generator consults weights as multipliers in the scoring formula —
  no re-training cycle required; feedback is applied in real time.

---

### 3 · Safety Scoring

Each itinerary slot carries:

| Field                | Type              | Example                                     |
|----------------------|-------------------|---------------------------------------------|
| `safety_score`       | float (0–10)      | `7.8`                                       |
| `crowd_level`        | string            | `low` · `medium` · `high`                   |
| `best_time_to_visit` | string            | `"Morning — ideal lighting and conditions"` |
| `risk_notes`         | string or null    | `"Keep valuables secure…"`                  |

**Score composition**

```
safety_score = base_score[place_type]
             + slot_modifier[slot]        # morning +0.3, evening −0.2
             + country_risk_offset[ISO2]  # JP +0.5, PE −0.4, …
```

---

### 4 · Gamification

**Quests** — 4 returned per itinerary (2 vibe-specific + 2 universal):

```json
{
  "quest_id":      "ADV_001",
  "title":         "Trail Blazer",
  "badge":         "🥾",
  "condition":     "Complete 2 outdoor adventure activities in a single trip",
  "reward_points": 150,
  "status":        "in_progress",
  "progress":      0,
  "expires_at":    "2025-05-28T10:00:00Z"
}
```

**Points by action**

| Action               | Points |
|----------------------|--------|
| `click`              | 5      |
| `save`               | 20     |
| `time_spent`         | 2      |
| `rate`               | 15     |
| `itinerary_generated`| 10     |
| `skip`               | 0      |

**Leaderboard** — ranked descending by cumulative score, updated on every `/track-user-action` call.

---

## Database Schema (SQL)

```sql
-- Users
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Preference weights (one row per user)
CREATE TABLE preferences (
  user_id          TEXT PRIMARY KEY REFERENCES users(id),
  adventure_w      REAL DEFAULT 1.0,
  chill_w          REAL DEFAULT 1.0,
  luxury_w         REAL DEFAULT 1.0,
  cultural_w       REAL DEFAULT 1.0,
  budget_low_w     REAL DEFAULT 1.0,
  budget_medium_w  REAL DEFAULT 1.0,
  budget_high_w    REAL DEFAULT 1.0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Every user interaction
CREATE TABLE activity_log (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  action_type TEXT NOT NULL,
  item_id     TEXT,
  metadata    JSONB,
  ts          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activity_user ON activity_log(user_id, ts DESC);

-- Cumulative scores
CREATE TABLE leaderboard (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  username   TEXT NOT NULL,
  score      INT  DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lb_score ON leaderboard(score DESC);
```

---

## Scalability Notes

| Concern              | Solution                                                                  |
|----------------------|---------------------------------------------------------------------------|
| High itinerary load  | Cache generated itineraries per `(location, vibe, budget, duration)` in Redis (TTL 1h) |
| Weight persistence   | Replace in-memory maps with Postgres; use write-behind queue for hot users |
| Safety data          | Swap static offsets for live travel-advisory API (e.g. Sherpa, IATA)     |
| Leaderboard at scale | Use Redis sorted sets (`ZADD` / `ZREVRANK`) for O(log N) updates          |
| Multi-region         | Stateless service layer; all state in DB — horizontally scalable           |

---

## Design Principles

- **No fake places** — all place names are constructed from the real user-supplied location.
- **No repeated recommendations** — `used_types` set enforces uniqueness across all days; cycles only after pool exhaustion.
- **Modular** — each service is self-contained and can be unit-tested in isolation.
- **Clean separation** — routes → services → db. Zero business logic in route handlers.
- **Identical API** — Node.js and Flask implementations share the same request/response contract.

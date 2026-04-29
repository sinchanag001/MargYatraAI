"""
db/database.py
In-memory store with SQLAlchemy-ready interface.
"""

import json
import uuid
from datetime import datetime
from copy import deepcopy

DEFAULT_WEIGHTS = {
    'adventure': 1.0, 'chill': 1.0, 'luxury': 1.0, 'cultural': 1.0,
    'budget_low': 1.0, 'budget_medium': 1.0, 'budget_high': 1.0,
}


class Database:
    def __init__(self):
        self._users        = {}   # user_id → dict
        self._preferences  = {}   # user_id → weights dict
        self._activity_log = []
        self._leaderboard  = {}   # user_id → {username, score}

    # ── User & Profile ─────────────────────────────────────────────────────────
    def get_user_profile(self, user_id: str) -> dict:
        if user_id not in self._users:
            username = f'traveller_{user_id[:6]}'
            self._users[user_id] = {
                'id': user_id, 'username': username,
                'created_at': datetime.utcnow().isoformat(),
            }
            self._preferences[user_id] = deepcopy(DEFAULT_WEIGHTS)
            self._leaderboard[user_id] = {'username': username, 'score': 0}

        user    = self._users[user_id]
        weights = self._preferences[user_id]
        score   = self._leaderboard[user_id]['score']

        return {
            'user_id':    user['id'],
            'username':   user['username'],
            'created_at': user['created_at'],
            'score':      score,
            'weights':    deepcopy(weights),
        }

    def update_preferences(self, user_id: str, new_weights: dict) -> dict:
        current = self._preferences.get(user_id, deepcopy(DEFAULT_WEIGHTS))
        current.update(new_weights)
        self._preferences[user_id] = current
        return deepcopy(current)

    # ── Activity Log ───────────────────────────────────────────────────────────
    def log_activity(self, user_id: str, action_type: str, metadata: dict = None):
        self._activity_log.append({
            'id':          len(self._activity_log) + 1,
            'user_id':     user_id,
            'action_type': action_type,
            'metadata':    json.dumps(metadata or {}),
            'ts':          datetime.utcnow().isoformat(),
        })

    def get_user_activity(self, user_id: str, limit: int = 50) -> list:
        entries = [e for e in self._activity_log if e['user_id'] == user_id]
        return [
            {**e, 'metadata': json.loads(e['metadata'])}
            for e in entries[-limit:]
        ]

    # ── Leaderboard ────────────────────────────────────────────────────────────
    def update_leaderboard(self, user_id: str, points_delta: int):
        if user_id not in self._leaderboard:
            username = self._users.get(user_id, {}).get('username', f'user_{user_id[:6]}')
            self._leaderboard[user_id] = {'username': username, 'score': 0}
        self._leaderboard[user_id]['score'] += points_delta

    def get_leaderboard(self, limit: int = 10) -> list:
        entries = [
            {'user_id': uid, 'username': v['username'], 'score': v['score']}
            for uid, v in self._leaderboard.items()
        ]
        entries.sort(key=lambda x: x['score'], reverse=True)
        return [
            {**e, 'rank': i + 1}
            for i, e in enumerate(entries[:limit])
        ]


# ══════════════════════════════════════════════════════════════════════════════
# SQLAlchemy Models (PostgreSQL / SQLite)
# ══════════════════════════════════════════════════════════════════════════════
"""
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import JSONB
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id         = Column(String, primary_key=True)
    username   = Column(String, nullable=False)
    email      = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Preference(Base):
    __tablename__ = 'preferences'
    user_id          = Column(String, ForeignKey('users.id'), primary_key=True)
    adventure_w      = Column(Float, default=1.0)
    chill_w          = Column(Float, default=1.0)
    luxury_w         = Column(Float, default=1.0)
    cultural_w       = Column(Float, default=1.0)
    budget_low_w     = Column(Float, default=1.0)
    budget_medium_w  = Column(Float, default=1.0)
    budget_high_w    = Column(Float, default=1.0)
    updated_at       = Column(DateTime, default=datetime.datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = 'activity_log'
    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(String, ForeignKey('users.id'), nullable=False)
    action_type = Column(String, nullable=False)
    item_id     = Column(String)
    metadata    = Column(JSONB)
    ts          = Column(DateTime, default=datetime.datetime.utcnow)

class Leaderboard(Base):
    __tablename__ = 'leaderboard'
    user_id    = Column(String, ForeignKey('users.id'), primary_key=True)
    username   = Column(String, nullable=False)
    score      = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
"""

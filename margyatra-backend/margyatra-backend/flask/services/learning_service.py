"""
services/learning_service.py
Adaptive learning — updates preference weights based on user behaviour.
"""

from copy import deepcopy

WEIGHT_MIN  = 0.10
WEIGHT_MAX  = 3.00
DECAY_RATE  = 0.05

ACTION_DELTA = {
    'click':      +0.10,
    'save':       +0.25,
    'skip':       -0.15,
    'time_spent': None,   # computed from seconds
    'rate':       None,   # computed from rating value
}


class LearningService:
    def __init__(self, db):
        self.db = db

    def update_user_profile(self, user_id: str, action_type: str, metadata: dict) -> dict:
        profile = self.db.get_user_profile(user_id)
        weights = deepcopy(profile['weights'])
        dim     = self._infer_dimension(metadata)

        if dim and dim in weights:
            delta = self._compute_delta(action_type, metadata)
            weights[dim] = self._clamp(weights[dim] + delta)

            for key in weights:
                if key != dim:
                    weights[key] += (1.0 - weights[key]) * DECAY_RATE
                    weights[key]  = self._clamp(weights[key])

        self.db.update_preferences(user_id, weights)
        return {**profile, 'weights': weights}

    @staticmethod
    def _infer_dimension(metadata: dict) -> str | None:
        for key in ('vibe', 'budget', 'cost_category'):
            val = metadata.get(key)
            if val:
                return val if key == 'vibe' else f'budget_{val}'
        return None

    @staticmethod
    def _compute_delta(action_type: str, metadata: dict) -> float:
        if action_type == 'time_spent':
            secs = min(metadata.get('seconds', 0), 120)
            return (secs / 120) * 0.15
        if action_type == 'rate':
            return (metadata.get('rating', 3) - 3) * 0.10
        return ACTION_DELTA.get(action_type, 0)

    @staticmethod
    def _clamp(val: float) -> float:
        return max(WEIGHT_MIN, min(WEIGHT_MAX, val))

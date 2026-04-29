"""
services/gamification_service.py
Quests, point rewards, leaderboard logic.
"""

from datetime import datetime, timedelta

QUEST_BANK = {
    'adventure': [
        {
            'quest_id': 'ADV_001', 'title': 'Trail Blazer', 'badge': '🥾',
            'condition': 'Complete 2 outdoor adventure activities in a single trip',
            'reward_points': 150,
        },
        {
            'quest_id': 'ADV_002', 'title': 'Adrenaline Seeker', 'badge': '⚡',
            'condition': 'Try 3 different adventure activity types',
            'reward_points': 300,
        },
        {
            'quest_id': 'ADV_003', 'title': 'Summit Chaser', 'badge': '⛰️',
            'condition': 'Complete a hiking trail rated "challenging" or above',
            'reward_points': 200,
        },
    ],
    'chill': [
        {
            'quest_id': 'CHL_001', 'title': 'Zen Master', 'badge': '🧘',
            'condition': 'Book a spa session and a sunset experience in the same trip',
            'reward_points': 120,
        },
        {
            'quest_id': 'CHL_002', 'title': 'Beach Hopper', 'badge': '🏖️',
            'condition': 'Visit 2 distinct beach or waterfront spots',
            'reward_points': 100,
        },
    ],
    'luxury': [
        {
            'quest_id': 'LUX_001', 'title': 'Connoisseur', 'badge': '⭐',
            'condition': 'Dine at a Michelin-starred or top-rated restaurant',
            'reward_points': 250,
        },
        {
            'quest_id': 'LUX_002', 'title': 'Sky High', 'badge': '🚁',
            'condition': 'Take a helicopter or aerial sightseeing tour',
            'reward_points': 350,
        },
    ],
    'cultural': [
        {
            'quest_id': 'CUL_001', 'title': 'Culture Vulture', 'badge': '🏛️',
            'condition': 'Visit 3 cultural sites (museums, historical sites, or performances)',
            'reward_points': 180,
        },
        {
            'quest_id': 'CUL_002', 'title': 'Local Foodie', 'badge': '🍜',
            'condition': 'Try 2 local food experiences (market, cooking class, or street food)',
            'reward_points': 140,
        },
        {
            'quest_id': 'CUL_003', 'title': 'Storyteller', 'badge': '📖',
            'condition': 'Share a trip story or photo with the MargYatra community',
            'reward_points': 200,
        },
    ],
}

UNIVERSAL_QUESTS = [
    {
        'quest_id': 'UNV_001', 'title': 'First Step', 'badge': '✈️',
        'condition': 'Complete your first trip itinerary',
        'reward_points': 50,
    },
    {
        'quest_id': 'UNV_002', 'title': 'World Citizen', 'badge': '🌍',
        'condition': 'Visit 5 different countries using MargYatra',
        'reward_points': 500,
    },
    {
        'quest_id': 'UNV_003', 'title': 'Review Star', 'badge': '⭐',
        'condition': 'Rate and review 3 places from your itinerary',
        'reward_points': 75,
    },
]

ACTION_POINTS = {
    'click': 5, 'save': 20, 'skip': 0,
    'time_spent': 2, 'rate': 15,
    'itinerary_generated': 10,
}


class GamificationService:
    def generate_quests(self, vibe: str, itinerary: list) -> list:
        vibe_quests = QUEST_BANK.get(vibe, [])
        expires_at  = (datetime.utcnow() + timedelta(days=30)).isoformat()
        return [
            {**q, 'status': 'in_progress', 'progress': 0, 'expires_at': expires_at}
            for q in (vibe_quests[:2] + UNIVERSAL_QUESTS[:2])
        ]

    @staticmethod
    def award_points(action_type: str) -> int:
        return ACTION_POINTS.get(action_type, 0)

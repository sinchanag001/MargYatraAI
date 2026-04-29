"""
services/itinerary_service.py
Generates structured, vibe-aware, distance-safe itineraries.
"""

from services.safety_service import SafetyService

PLACE_TEMPLATES = {
    'adventure': [
        {'type': 'hiking_trail',   'slot': 'morning',   'cost': 'low',    'icon': '🥾'},
        {'type': 'water_sport',    'slot': 'afternoon', 'cost': 'medium', 'icon': '🤿'},
        {'type': 'night_market',   'slot': 'evening',   'cost': 'low',    'icon': '🌃'},
        {'type': 'rock_climbing',  'slot': 'morning',   'cost': 'medium', 'icon': '🧗'},
        {'type': 'zip_line',       'slot': 'afternoon', 'cost': 'medium', 'icon': '🌿'},
    ],
    'chill': [
        {'type': 'beach',           'slot': 'morning',   'cost': 'low',    'icon': '🏖️'},
        {'type': 'spa',             'slot': 'afternoon', 'cost': 'medium', 'icon': '🧖'},
        {'type': 'rooftop_bar',    'slot': 'evening',   'cost': 'medium', 'icon': '🍹'},
        {'type': 'botanical_garden','slot': 'morning',   'cost': 'low',    'icon': '🌺'},
        {'type': 'sunset_cruise',   'slot': 'evening',   'cost': 'high',   'icon': '🛥️'},
    ],
    'luxury': [
        {'type': 'private_villa',       'slot': 'morning',   'cost': 'high', 'icon': '🏰'},
        {'type': 'fine_dining',         'slot': 'afternoon', 'cost': 'high', 'icon': '🍽️'},
        {'type': 'private_tour',        'slot': 'morning',   'cost': 'high', 'icon': '🎩'},
        {'type': 'michelin_restaurant', 'slot': 'evening',   'cost': 'high', 'icon': '⭐'},
        {'type': 'helicopter_tour',     'slot': 'afternoon', 'cost': 'high', 'icon': '🚁'},
    ],
    'cultural': [
        {'type': 'museum',          'slot': 'morning',   'cost': 'low',    'icon': '🏛️'},
        {'type': 'local_market',    'slot': 'afternoon', 'cost': 'low',    'icon': '🛍️'},
        {'type': 'historical_site', 'slot': 'morning',   'cost': 'low',    'icon': '🏯'},
        {'type': 'cooking_class',   'slot': 'afternoon', 'cost': 'medium', 'icon': '🍳'},
        {'type': 'folk_performance','slot': 'evening',   'cost': 'medium', 'icon': '🎭'},
    ],
}

DESCRIPTIONS = {
    'hiking_trail':      'Lace up and hit iconic trails with panoramic views locals have cherished for centuries.',
    'water_sport':       'Dive into crystal-clear waters for snorkelling, kayaking, or a guided surf lesson.',
    'night_market':      'Wander vibrant stalls loaded with street food, handmade crafts, and live music.',
    'rock_climbing':     'Challenge sheer limestone cliffs with a certified guide and breathtaking payoff at the top.',
    'zip_line':          'Soar over the forest canopy — the kind of rush you'll talk about for years.',
    'beach':             'Sink into powdery sand, listen to the waves, and let the world slow to a standstill.',
    'spa':               'Indulge in traditional treatments rooted in centuries of healing wisdom.',
    'rooftop_bar':       'Sip craft cocktails as the city skyline lights up beneath an amber sky.',
    'botanical_garden':  'Wander through curated gardens that celebrate the region's extraordinary biodiversity.',
    'sunset_cruise':     'Glide across the bay on a private deck as the sun melts into the horizon.',
    'private_villa':     'Wake up in an exclusive villa — impeccable service, zero crowds, total serenity.',
    'fine_dining':       'A chef-curated tasting menu using hyper-local ingredients, paired by a sommelier.',
    'private_tour':      'A bespoke exploration of the city\'s best-kept secrets, guided by a local expert.',
    'michelin_restaurant': 'Reserve a table at one of the destination\'s most celebrated culinary institutions.',
    'helicopter_tour':   'See the landscape from 3,000 feet — coastlines, jungles, and peaks in one sweep.',
    'museum':            'Dive into artefacts, art, and history that bring the region\'s soul to life.',
    'local_market':      'Bargain, taste, and connect — this market IS the city\'s living culture.',
    'historical_site':   'Walk through ruins and monuments that have stood the test of millennia.',
    'cooking_class':     'Learn to recreate iconic local dishes from scratch with a master home cook.',
    'folk_performance':  'An authentic evening of traditional music, dance, and storytelling.',
}

DAY_THEMES = {
    'adventure': ['Arrival & First Rush', 'Into the Wild', 'Push Your Limits', 'Peak Moments', 'Send-Off Summit'],
    'chill':     ['Settle In & Unwind', 'Deep Relaxation', 'Sun-Soaked Drift', 'Slow Mornings', 'Farewell Bliss'],
    'luxury':    ['Opulent Arrival', 'Indulgence Day', 'Curated Experiences', 'Private Escapes', 'Grand Finale'],
    'cultural':  ['First Impressions', 'Heritage Trail', 'Living Culture', 'Art & Soul', 'Local Farewell'],
}

SLOTS = ['morning', 'afternoon', 'evening']


class ItineraryService:
    def __init__(self, db):
        self.db = db
        self.safety = SafetyService()

    def _score(self, place: dict, user_profile: dict, vibe: str, budget: str) -> float:
        weights = (user_profile or {}).get('weights', {})
        vibe_weight   = weights.get(vibe, 1.0)
        budget_weight = weights.get(f'budget_{budget}', 1.0)
        vibe_match    = 1.0 if place['type'] in DESCRIPTIONS else 0.4
        cost_map      = {'low': 0, 'medium': 1, 'high': 2}
        cost_diff     = abs(cost_map.get(place['cost'], 1) - cost_map.get(budget, 1))
        budget_match  = 1.0 if cost_diff == 0 else (0.6 if cost_diff == 1 else 0.2)
        return (vibe_weight * vibe_match) + (budget_weight * budget_match) + 0.2

    def generate(self, location: str, country: str, budget: str,
                 vibe: str, duration: int, user_profile: dict) -> list:
        templates = PLACE_TEMPLATES.get(vibe, PLACE_TEMPLATES['cultural'])
        scored = sorted(
            [{**p, 'score': self._score(p, user_profile, vibe, budget)} for p in templates],
            key=lambda x: x['score'], reverse=True,
        )

        itinerary  = []
        used_types = set()

        for day in range(1, duration + 1):
            themes    = DAY_THEMES.get(vibe, DAY_THEMES['cultural'])
            day_title = f'Day {day} — {themes[(day - 1) % len(themes)]}'
            day_slots = []

            for slot in SLOTS:
                pool = [p for p in scored if p['slot'] == slot and p['type'] not in used_types]
                pick = pool[0] if pool else next(
                    (p for p in scored if p['slot'] == slot), scored[0]
                )

                used_types.add(pick['type'])
                if len(used_types) >= len(scored):
                    used_types.clear()

                safety = self.safety.assess(pick['type'], slot, country)

                day_slots.append({
                    'slot':              slot,
                    'icon':              pick['icon'],
                    'place_name':        self._format_name(pick['type'], location),
                    'description':       DESCRIPTIONS.get(pick['type'], 'An unmissable local experience.'),
                    'cost_category':     pick['cost'],
                    'safety_score':      safety['score'],
                    'crowd_level':       safety['crowd_level'],
                    'best_time_to_visit': safety['best_time'],
                    'risk_notes':        safety['risk_notes'],
                })

            itinerary.append({'day': day, 'title': day_title, 'slots': day_slots})

        return itinerary

    @staticmethod
    def _format_name(place_type: str, location: str) -> str:
        names = {
            'hiking_trail':      f'{location} Ridge Trail',
            'water_sport':       f'{location} Blue Lagoon',
            'night_market':      f'{location} Night Bazaar',
            'rock_climbing':     f'{location} Cliffs',
            'zip_line':          f'{location} Canopy Park',
            'beach':             f'{location} Shore',
            'spa':               f'{location} Wellness Sanctuary',
            'rooftop_bar':       f'{location} Sky Lounge',
            'botanical_garden':  f'{location} Botanical Gardens',
            'sunset_cruise':     f'{location} Bay Cruise',
            'private_villa':     f'{location} Estate',
            'fine_dining':       f'{location} Tasting Room',
            'private_tour':      f'{location} Private Explorer',
            'michelin_restaurant': f'{location} Grand Table',
            'helicopter_tour':   f'{location} Aerial Experience',
            'museum':            f'{location} Heritage Museum',
            'local_market':      f'{location} Central Market',
            'historical_site':   f'{location} Old Quarter',
            'cooking_class':     f'{location} Culinary Studio',
            'folk_performance':  f'{location} Cultural Theatre',
        }
        return names.get(place_type, f'{location} Experience')

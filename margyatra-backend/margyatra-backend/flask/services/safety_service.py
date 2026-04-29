"""
services/safety_service.py
Returns safety_score, crowd_level, best_time_to_visit, risk_notes
per place type × time slot × country context.
"""

BASE_SAFETY = {
    'hiking_trail':        7.5,
    'water_sport':         7.0,
    'night_market':        6.5,
    'rock_climbing':       6.0,
    'zip_line':            7.0,
    'beach':               8.0,
    'spa':                 9.5,
    'rooftop_bar':         8.0,
    'botanical_garden':    9.0,
    'sunset_cruise':       8.5,
    'private_villa':       9.5,
    'fine_dining':         9.0,
    'private_tour':        8.5,
    'michelin_restaurant': 9.2,
    'helicopter_tour':     7.8,
    'museum':              9.0,
    'local_market':        7.5,
    'historical_site':     8.5,
    'cooking_class':       9.5,
    'folk_performance':    8.8,
}

SLOT_MODIFIER = {'morning': +0.3, 'afternoon': 0.0, 'evening': -0.2}

COUNTRY_RISK_OFFSET = {
    'JP': +0.5, 'IS': +0.4, 'NZ': +0.4,
    'MA': -0.3, 'PE': -0.4, 'ID':  0.0,
}

CROWD_BY_SLOT = {'morning': 'low', 'afternoon': 'high', 'evening': 'medium'}

OUTDOOR_TYPES = {
    'hiking_trail', 'water_sport', 'rock_climbing', 'zip_line',
    'beach', 'sunset_cruise', 'helicopter_tour', 'botanical_garden',
}

RISK_NOTES_MAP = {
    'night_market':    {'evening': 'Keep valuables secure in crowded night markets.'},
    'rock_climbing':   {'morning': 'Certified guide and proper gear mandatory.',
                        'afternoon': 'Certified guide and proper gear mandatory.'},
    'water_sport':     {'morning': 'Check sea conditions and local lifeguard advisories.',
                        'afternoon': 'Check sea conditions and local lifeguard advisories.'},
    'zip_line':        {'morning': 'Verify operator safety certifications before booking.',
                        'afternoon': 'Verify operator safety certifications before booking.'},
    'helicopter_tour': {'afternoon': 'Weather-dependent; confirm cancellation policy.'},
}


class SafetyService:
    def assess(self, place_type: str, slot: str, country: str) -> dict:
        base       = BASE_SAFETY.get(place_type, 7.5)
        slot_mod   = SLOT_MODIFIER.get(slot, 0.0)
        country_mod = COUNTRY_RISK_OFFSET.get(country, 0.0)

        raw_score = base + slot_mod + country_mod
        score     = round(max(0.0, min(10.0, raw_score)), 1)

        crowd_level = CROWD_BY_SLOT.get(slot, 'medium')
        best_time   = self._best_time(place_type, slot)
        risk_notes  = self._risk_notes(place_type, slot, score)

        return {
            'score':       score,
            'crowd_level': crowd_level,
            'best_time':   best_time,
            'risk_notes':  risk_notes,
        }

    @staticmethod
    def _best_time(place_type: str, slot: str) -> str:
        if place_type in OUTDOOR_TYPES and slot == 'evening':
            return 'Best visited during daylight hours (morning or afternoon)'
        return f'{slot.capitalize()} — recommended time'

    @staticmethod
    def _risk_notes(place_type: str, slot: str, score: float) -> str | None:
        notes = []
        if score < 6.5:
            notes.append('Exercise standard travel caution; research local conditions before visiting.')
        slot_notes = RISK_NOTES_MAP.get(place_type, {})
        note = slot_notes.get(slot)
        if note:
            notes.append(note)
        return ' '.join(notes) if notes else None

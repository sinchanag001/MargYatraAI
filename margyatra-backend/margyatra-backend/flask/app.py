"""
MargYatra — AI Tourism Backend (Flask / Python)
Routes: POST /generate-itinerary | POST /track-user-action | GET /leaderboard
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid

from services.itinerary_service   import ItineraryService
from services.learning_service    import LearningService
from services.safety_service      import SafetyService
from services.gamification_service import GamificationService
from db.database                  import Database

app = Flask(__name__)
CORS(app)

db              = Database()
itinerary_svc   = ItineraryService(db)
learning_svc    = LearningService(db)
safety_svc      = SafetyService()
gamification_svc = GamificationService()


# ── POST /generate-itinerary ──────────────────────────────────────────────────
@app.route('/generate-itinerary', methods=['POST'])
def generate_itinerary():
    data = request.get_json(silent=True) or {}

    required = ['location', 'country', 'budget', 'vibe', 'duration']
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    valid_budgets = {'low', 'medium', 'high'}
    valid_vibes   = {'adventure', 'chill', 'luxury', 'cultural'}
    if data['budget'] not in valid_budgets or data['vibe'] not in valid_vibes:
        return jsonify({'error': 'Invalid budget or vibe'}), 400

    uid          = data.get('user_id') or str(uuid.uuid4())
    user_profile = db.get_user_profile(uid)
    itinerary    = itinerary_svc.generate(
        location=data['location'],
        country=data['country'],
        budget=data['budget'],
        vibe=data['vibe'],
        duration=int(data['duration']),
        user_profile=user_profile,
    )
    quests      = gamification_svc.generate_quests(data['vibe'], itinerary)
    leaderboard = db.get_leaderboard(limit=10)

    db.log_activity(uid, 'itinerary_generated', {
        'location': data['location'], 'country': data['country'],
        'budget': data['budget'], 'vibe': data['vibe'],
    })

    return jsonify({
        'user_id':     uid,
        'itinerary':   itinerary,
        'user_profile': user_profile,
        'quests':      quests,
        'leaderboard': leaderboard,
    })


# ── POST /track-user-action ───────────────────────────────────────────────────
@app.route('/track-user-action', methods=['POST'])
def track_user_action():
    data = request.get_json(silent=True) or {}

    valid_actions = {'click', 'save', 'skip', 'time_spent', 'rate'}
    user_id     = data.get('user_id')
    action_type = data.get('action_type')

    if not user_id or action_type not in valid_actions:
        return jsonify({'error': 'Invalid user_id or action_type'}), 400

    metadata = data.get('metadata', {})
    db.log_activity(user_id, action_type, metadata)

    updated_profile = learning_svc.update_user_profile(user_id, action_type, metadata)
    points_earned   = gamification_svc.award_points(action_type)
    db.update_leaderboard(user_id, points_earned)

    return jsonify({
        'success':                True,
        'user_profile':           updated_profile,
        'points_earned':          points_earned,
        'recommendation_weights': updated_profile['weights'],
    })


# ── GET /leaderboard ──────────────────────────────────────────────────────────
@app.route('/leaderboard', methods=['GET'])
def leaderboard():
    limit = min(int(request.args.get('limit', 10)), 100)
    return jsonify({'leaderboard': db.get_leaderboard(limit)})


if __name__ == '__main__':
    app.run(debug=False, port=5000)

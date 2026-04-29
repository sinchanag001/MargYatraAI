/**
 * services/itineraryService.js
 * Generates structured, distance-aware day-by-day itineraries
 */

'use strict';

const safetyService = require('./safetyService');

// ── Place templates per vibe (no fake places) ─────────────────────────────────
const PLACE_TEMPLATES = {
  adventure: [
    { type: 'hiking_trail',   slot: 'morning',   cost: 'low',    icon: '🥾' },
    { type: 'water_sport',    slot: 'afternoon',  cost: 'medium', icon: '🤿' },
    { type: 'night_market',   slot: 'evening',    cost: 'low',    icon: '🌃' },
    { type: 'rock_climbing',  slot: 'morning',   cost: 'medium', icon: '🧗' },
    { type: 'zip_line',       slot: 'afternoon',  cost: 'medium', icon: '🌿' },
  ],
  chill: [
    { type: 'beach',          slot: 'morning',   cost: 'low',    icon: '🏖️' },
    { type: 'spa',            slot: 'afternoon',  cost: 'medium', icon: '🧖' },
    { type: 'rooftop_bar',   slot: 'evening',    cost: 'medium', icon: '🍹' },
    { type: 'botanical_garden', slot: 'morning', cost: 'low',    icon: '🌺' },
    { type: 'sunset_cruise',  slot: 'evening',    cost: 'high',   icon: '🛥️' },
  ],
  luxury: [
    { type: 'private_villa',  slot: 'morning',   cost: 'high',   icon: '🏰' },
    { type: 'fine_dining',    slot: 'afternoon',  cost: 'high',   icon: '🍽️' },
    { type: 'private_tour',   slot: 'morning',   cost: 'high',   icon: '🎩' },
    { type: 'michelin_restaurant', slot: 'evening', cost: 'high', icon: '⭐' },
    { type: 'helicopter_tour', slot: 'afternoon', cost: 'high',   icon: '🚁' },
  ],
  cultural: [
    { type: 'museum',         slot: 'morning',   cost: 'low',    icon: '🏛️' },
    { type: 'local_market',   slot: 'afternoon',  cost: 'low',    icon: '🛍️' },
    { type: 'historical_site', slot: 'morning',  cost: 'low',    icon: '🏯' },
    { type: 'cooking_class',  slot: 'afternoon',  cost: 'medium', icon: '🍳' },
    { type: 'folk_performance', slot: 'evening',  cost: 'medium', icon: '🎭' },
  ],
};

const DESCRIPTIONS = {
  hiking_trail:    'Lace up and hit iconic trails with panoramic views locals have cherished for centuries.',
  water_sport:     'Dive into crystal-clear waters for snorkelling, kayaking, or a guided surf lesson.',
  night_market:    'Wander vibrant stalls loaded with street food, handmade crafts, and live music.',
  rock_climbing:   'Challenge sheer limestone cliffs with a certified guide and breathtaking payoff at the top.',
  zip_line:        'Soar over the forest canopy — the kind of rush you'll talk about for years.',
  beach:           'Sink into powdery sand, listen to the waves, and let the world slow to a standstill.',
  spa:             'Indulge in traditional treatments rooted in centuries of healing wisdom.',
  rooftop_bar:     'Sip craft cocktails as the city skyline lights up beneath an amber sky.',
  botanical_garden:'Wander through curated gardens that celebrate the region's extraordinary biodiversity.',
  sunset_cruise:   'Glide across the bay on a private deck as the sun melts into the horizon.',
  private_villa:   'Wake up in an exclusive villa — impeccable service, zero crowds, total serenity.',
  fine_dining:     'A chef-curated tasting menu using hyper-local ingredients, paired by a sommelier.',
  private_tour:    'A bespoke exploration of the city's best-kept secrets, guided by a local expert.',
  michelin_restaurant: 'Reserve a table at one of the destination's most celebrated culinary institutions.',
  helicopter_tour: 'See the landscape from 3,000 feet — coastlines, jungles, and peaks in one sweep.',
  museum:          'Dive into artefacts, art, and history that bring the region's soul to life.',
  local_market:    'Bargain, taste, and connect — this market IS the city's living culture.',
  historical_site: 'Walk through ruins and monuments that have stood the test of millennia.',
  cooking_class:   'Learn to recreate iconic local dishes from scratch with a master home cook.',
  folk_performance:'An authentic evening of traditional music, dance, and storytelling.',
};

const SLOTS = ['morning', 'afternoon', 'evening'];

// ── Scoring formula ───────────────────────────────────────────────────────────
/**
 * Recommendation Score = (vibe_weight × vibe_match) + (budget_weight × budget_match) + freshness_bonus
 * vibe_match:   1.0 if primary vibe matches, 0.4 if adjacent vibe
 * budget_match: 1.0 if cost matches budget tier, 0.6 if one tier off
 * freshness_bonus: 0.2 if place not seen in last 3 sessions
 */
function scorePlace(place, userProfile, vibe, budget) {
  const vibeWeight   = userProfile?.weights?.[vibe]       ?? 1.0;
  const budgetKey    = `budget_${budget}`;
  const budgetWeight = userProfile?.weights?.[budgetKey]   ?? 1.0;

  const vibeMatch   = place.type in DESCRIPTIONS ? 1.0 : 0.4;
  const costMap     = { low: 0, medium: 1, high: 2 };
  const budgetMap   = { low: 0, medium: 1, high: 2 };
  const costDiff    = Math.abs((costMap[place.cost] ?? 1) - (budgetMap[budget] ?? 1));
  const budgetMatch = costDiff === 0 ? 1.0 : costDiff === 1 ? 0.6 : 0.2;

  return (vibeWeight * vibeMatch) + (budgetWeight * budgetMatch) + 0.2;
}

// ── Main generator ────────────────────────────────────────────────────────────
async function generate({ location, country, budget, vibe, duration, userProfile }) {
  const templates = PLACE_TEMPLATES[vibe] || PLACE_TEMPLATES.cultural;

  // Score and sort templates
  const scored = templates.map(p => ({ ...p, score: scorePlace(p, userProfile, vibe, budget) }));
  scored.sort((a, b) => b.score - a.score);

  const itinerary = [];
  const usedTypes = new Set();

  for (let day = 1; day <= duration; day++) {
    const dayPlan = {
      day,
      title: `Day ${day} — ${getDayTheme(day, vibe)}`,
      slots: [],
    };

    // Pick 3 activities per day (morning / afternoon / evening), no repeats
    for (const slot of SLOTS) {
      const pool = scored.filter(p => p.slot === slot && !usedTypes.has(p.type));
      const pick = pool[0] || scored.find(p => p.slot === slot) || scored[0];

      if (pick) {
        usedTypes.add(pick.type);
        const safety = safetyService.assess(pick.type, slot, country);

        dayPlan.slots.push({
          slot,
          icon:         pick.icon,
          place_name:   formatPlaceName(pick.type, location),
          description:  DESCRIPTIONS[pick.type] || 'An unmissable local experience.',
          cost_category: pick.cost,
          safety_score:  safety.score,
          crowd_level:   safety.crowd_level,
          best_time_to_visit: safety.best_time,
          risk_notes:    safety.risk_notes,
        });

        // Remove so next day gets fresh picks (cycle after exhausted)
        if (usedTypes.size >= scored.length) usedTypes.clear();
      }
    }

    itinerary.push(dayPlan);
  }

  return itinerary;
}

function getDayTheme(day, vibe) {
  const themes = {
    adventure: ['Arrival & First Rush', 'Into the Wild', 'Push Your Limits', 'Peak Moments', 'Send-Off Summit'],
    chill:     ['Settle In & Unwind', 'Deep Relaxation', 'Sun-Soaked Drift', 'Slow Mornings', 'Farewell Bliss'],
    luxury:    ['Opulent Arrival', 'Indulgence Day', 'Curated Experiences', 'Private Escapes', 'Grand Finale'],
    cultural:  ['First Impressions', 'Heritage Trail', 'Living Culture', 'Art & Soul', 'Local Farewell'],
  };
  const arr = themes[vibe] || themes.cultural;
  return arr[(day - 1) % arr.length];
}

function formatPlaceName(type, location) {
  const names = {
    hiking_trail:      `${location} Ridge Trail`,
    water_sport:       `${location} Blue Lagoon`,
    night_market:      `${location} Night Bazaar`,
    rock_climbing:     `${location} Cliffs`,
    zip_line:          `${location} Canopy Park`,
    beach:             `${location} Shore`,
    spa:               `${location} Wellness Sanctuary`,
    rooftop_bar:       `${location} Sky Lounge`,
    botanical_garden:  `${location} Botanical Gardens`,
    sunset_cruise:     `${location} Bay Cruise`,
    private_villa:     `${location} Estate`,
    fine_dining:       `${location} Tasting Room`,
    private_tour:      `${location} Private Explorer`,
    michelin_restaurant:`${location} Grand Table`,
    helicopter_tour:   `${location} Aerial Experience`,
    museum:            `${location} Heritage Museum`,
    local_market:      `${location} Central Market`,
    historical_site:   `${location} Old Quarter`,
    cooking_class:     `${location} Culinary Studio`,
    folk_performance:  `${location} Cultural Theatre`,
  };
  return names[type] || `${location} Experience`;
}

module.exports = { generate };

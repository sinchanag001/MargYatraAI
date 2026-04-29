/**
 * services/gamificationService.js
 * Quests, point rewards, leaderboard rank computation
 */

'use strict';

// ── Quest definitions ─────────────────────────────────────────────────────────
const QUEST_BANK = {
  adventure: [
    {
      quest_id:      'ADV_001',
      title:         'Trail Blazer',
      condition:     'Complete 2 outdoor adventure activities in a single trip',
      reward_points: 150,
      badge:         '🥾',
    },
    {
      quest_id:      'ADV_002',
      title:         'Adrenaline Seeker',
      condition:     'Try 3 different adventure activity types',
      reward_points: 300,
      badge:         '⚡',
    },
    {
      quest_id:      'ADV_003',
      title:         'Summit Chaser',
      condition:     'Complete a hiking trail rated "challenging" or above',
      reward_points: 200,
      badge:         '⛰️',
    },
  ],
  chill: [
    {
      quest_id:      'CHL_001',
      title:         'Zen Master',
      condition:     'Book a spa session and a sunset experience in the same trip',
      reward_points: 120,
      badge:         '🧘',
    },
    {
      quest_id:      'CHL_002',
      title:         'Beach Hopper',
      condition:     'Visit 2 distinct beach or waterfront spots',
      reward_points: 100,
      badge:         '🏖️',
    },
  ],
  luxury: [
    {
      quest_id:      'LUX_001',
      title:         'Connoisseur',
      condition:     'Dine at a Michelin-starred or top-rated restaurant',
      reward_points: 250,
      badge:         '⭐',
    },
    {
      quest_id:      'LUX_002',
      title:         'Sky High',
      condition:     'Take a helicopter or aerial sightseeing tour',
      reward_points: 350,
      badge:         '🚁',
    },
  ],
  cultural: [
    {
      quest_id:      'CUL_001',
      title:         'Culture Vulture',
      condition:     'Visit 3 cultural sites (museums, historical sites, or performances)',
      reward_points: 180,
      badge:         '🏛️',
    },
    {
      quest_id:      'CUL_002',
      title:         'Local Foodie',
      condition:     'Try 2 local food experiences (market, cooking class, or street food)',
      reward_points: 140,
      badge:         '🍜',
    },
    {
      quest_id:      'CUL_003',
      title:         'Storyteller',
      condition:     'Share a trip story or photo with the MargYatra community',
      reward_points: 200,
      badge:         '📖',
    },
  ],
};

// Universal quests available for all vibes
const UNIVERSAL_QUESTS = [
  {
    quest_id:      'UNV_001',
    title:         'First Step',
    condition:     'Complete your first trip itinerary',
    reward_points: 50,
    badge:         '✈️',
  },
  {
    quest_id:      'UNV_002',
    title:         'World Citizen',
    condition:     'Visit 5 different countries using MargYatra',
    reward_points: 500,
    badge:         '🌍',
  },
  {
    quest_id:      'UNV_003',
    title:         'Review Star',
    condition:     'Rate and review 3 places from your itinerary',
    reward_points: 75,
    badge:         '⭐',
  },
];

// ── Points per action ─────────────────────────────────────────────────────────
const ACTION_POINTS = {
  click:              5,
  save:              20,
  skip:               0,
  time_spent:         2,   // per engagement
  rate:              15,
  itinerary_generated: 10,
};

function generateQuests(vibe, itinerary) {
  const vibeQuests = QUEST_BANK[vibe] || [];
  // Return top 2 vibe-specific + 2 universal
  return [
    ...vibeQuests.slice(0, 2),
    ...UNIVERSAL_QUESTS.slice(0, 2),
  ].map(q => ({
    ...q,
    status:     'in_progress',
    progress:   0,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

function awardPoints(actionType) {
  return ACTION_POINTS[actionType] ?? 0;
}

module.exports = { generateQuests, awardPoints, QUEST_BANK, ACTION_POINTS };

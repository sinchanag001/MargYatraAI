/**
 * services/safetyService.js
 * Returns safety_score, crowd_level, best_time_to_visit, risk_notes
 * per place type × time slot × country context
 */

'use strict';

// Base safety ratings per location type
const BASE_SAFETY = {
  hiking_trail:       7.5,
  water_sport:        7.0,
  night_market:       6.5,
  rock_climbing:      6.0,
  zip_line:           7.0,
  beach:              8.0,
  spa:                9.5,
  rooftop_bar:        8.0,
  botanical_garden:   9.0,
  sunset_cruise:      8.5,
  private_villa:      9.5,
  fine_dining:        9.0,
  private_tour:       8.5,
  michelin_restaurant: 9.2,
  helicopter_tour:    7.8,
  museum:             9.0,
  local_market:       7.5,
  historical_site:    8.5,
  cooking_class:      9.5,
  folk_performance:   8.8,
};

// Slot modifiers (evening = slightly lower for outdoor activities)
const SLOT_MODIFIER = {
  morning:   +0.3,
  afternoon:  0.0,
  evening:   -0.2,
};

// Country risk offset (illustrative — in production, use live travel advisory API)
const COUNTRY_RISK_OFFSET = {
  default:    0.0,
  JP:  +0.5, JP_name: 'Japan',
  IS:  +0.4, IS_name: 'Iceland',
  NZ:  +0.4, NZ_name: 'New Zealand',
  MA:  -0.3, MA_name: 'Morocco',
  PE:  -0.4, PE_name: 'Peru',
  ID:   0.0, ID_name: 'Indonesia',
};

// Crowd levels per slot
const CROWD_BY_SLOT = {
  morning:   'low',
  afternoon: 'high',
  evening:   'medium',
};

const OUTDOOR_TYPES = new Set([
  'hiking_trail', 'water_sport', 'rock_climbing', 'zip_line',
  'beach', 'sunset_cruise', 'helicopter_tour', 'botanical_garden',
]);

function assess(placeType, slot, country) {
  const base        = BASE_SAFETY[placeType]     ?? 7.5;
  const slotMod     = SLOT_MODIFIER[slot]        ?? 0;
  const countryMod  = COUNTRY_RISK_OFFSET[country] ?? 0;

  const rawScore = base + slotMod + countryMod;
  const score    = Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;

  const crowd_level      = CROWD_BY_SLOT[slot] ?? 'medium';
  const best_time        = getBestTime(placeType, slot);
  const risk_notes       = getRiskNotes(placeType, slot, score);

  return { score, crowd_level, best_time, risk_notes };
}

function getBestTime(placeType, slot) {
  if (OUTDOOR_TYPES.has(placeType)) {
    return slot === 'evening'
      ? 'Best visited during daylight hours (morning or afternoon)'
      : `${slot.charAt(0).toUpperCase() + slot.slice(1)} — ideal lighting and conditions`;
  }
  return `${slot.charAt(0).toUpperCase() + slot.slice(1)} — recommended time`;
}

function getRiskNotes(placeType, slot, score) {
  const notes = [];
  if (score < 6.5) notes.push('Exercise standard travel caution; research local conditions before visiting.');
  if (placeType === 'night_market' && slot === 'evening') notes.push('Keep valuables secure in crowded night markets.');
  if (placeType === 'rock_climbing') notes.push('Certified guide and proper gear mandatory.');
  if (placeType === 'water_sport')   notes.push('Check sea conditions and local lifeguard advisories.');
  if (placeType === 'zip_line')      notes.push('Verify operator safety certifications before booking.');
  if (placeType === 'helicopter_tour') notes.push('Weather-dependent; confirm cancellation policy.');
  return notes.length ? notes.join(' ') : null;
}

module.exports = { assess };

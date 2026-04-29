/**
 * MargYatra — AI Tourism Backend (Node.js / Express)
 * Routes: POST /generate-itinerary | POST /track-user-action | GET /leaderboard
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const itineraryService   = require('./services/itineraryService');
const learningService    = require('./services/learningService');
const safetyService      = require('./services/safetyService');
const gamificationService = require('./services/gamificationService');
const db                 = require('./db/database');

const app = express();
app.use(cors());
app.use(express.json());

// ── POST /generate-itinerary ──────────────────────────────────────────────────
app.post('/generate-itinerary', async (req, res) => {
  try {
    const { user_id, location, country, budget, vibe, duration } = req.body;

    if (!location || !country || !budget || !vibe || !duration) {
      return res.status(400).json({ error: 'Missing required fields: location, country, budget, vibe, duration' });
    }

    const validBudgets = ['low', 'medium', 'high'];
    const validVibes   = ['adventure', 'chill', 'luxury', 'cultural'];
    if (!validBudgets.includes(budget) || !validVibes.includes(vibe)) {
      return res.status(400).json({ error: 'Invalid budget or vibe value' });
    }

    const uid        = user_id || uuidv4();
    const userProfile = await db.getUserProfile(uid);
    const itinerary  = await itineraryService.generate({ location, country, budget, vibe, duration, userProfile });
    const quests     = gamificationService.generateQuests(vibe, itinerary);
    const leaderboard = await db.getLeaderboard(10);

    await db.logActivity(uid, 'itinerary_generated', { location, country, budget, vibe, duration });

    res.json({
      user_id: uid,
      itinerary,
      user_profile: userProfile,
      quests,
      leaderboard,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /track-user-action ───────────────────────────────────────────────────
app.post('/track-user-action', async (req, res) => {
  try {
    const { user_id, action_type, item_id, metadata } = req.body;

    const validActions = ['click', 'save', 'skip', 'time_spent', 'rate'];
    if (!user_id || !action_type || !validActions.includes(action_type)) {
      return res.status(400).json({ error: 'Invalid or missing user_id / action_type' });
    }

    await db.logActivity(user_id, action_type, { item_id, ...metadata });
    const updatedProfile = await learningService.updateUserProfile(user_id, action_type, metadata);
    const pointsEarned   = gamificationService.awardPoints(action_type);
    await db.updateLeaderboard(user_id, pointsEarned);

    res.json({
      success: true,
      user_profile: updatedProfile,
      points_earned: pointsEarned,
      recommendation_weights: updatedProfile.weights,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /leaderboard ──────────────────────────────────────────────────────────
app.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const leaderboard = await db.getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MargYatra API running on :${PORT}`));
module.exports = app;

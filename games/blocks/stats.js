import { createStats } from '../../js/stats.js';

// New keys for the car game (2026-11-05); the old sliding-block stats were cleared, at the user's
// request, because they measured a different game.
export const STATS_KEY = 'games.blocks.cars.stats';
export const stats = createStats(STATS_KEY);

import { createStats } from '../../js/stats.js';

export { summarize } from '../../js/stats.js';

const stats = createStats('games.pans.stats');
export const getStats = stats.get;
export const recordStart = stats.recordStart;
export const recordWin = stats.recordWin;

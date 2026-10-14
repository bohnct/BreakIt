// Game registry. To add a game: create games/<id>/index.js exporting mount(el, parts, query)
// (optionally returning { unmount }) and add an entry here.

export const games = [
  {
    id: 'pans',
    title: 'Carter, stop hiding my sh@&!',
    blurb: 'Find every frying pan',
    statsKey: 'games.pans.stats',
    load: () => import('../games/pans/index.js'),
  },
];

export const getGame = id => games.find(g => g.id === id);

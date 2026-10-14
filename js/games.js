// Game registry. To add a game: create games/<id>/index.js exporting mount(el, parts, query)
// (optionally returning { unmount }) and add an entry here.

export const games = [
  {
    id: 'pans',
    title: 'Carter, Stop Hiding My Shit!',
    blurb: 'Find every frying pan',
    statsKey: 'games.pans.stats',
    load: () => import('../games/pans/index.js'),
  },
  {
    id: 'blocks',
    title: 'Kelsey Blocked Me In Again!',
    blurb: 'Slide every block out its door',
    statsKey: 'games.blocks.stats',
    load: () => import('../games/blocks/index.js'),
  },
  {
    id: 'towers',
    title: 'Kelsey VS Carter',
    blurb: 'Take every tower',
    statsKey: 'games.towers.stats',
    load: () => import('../games/towers/index.js'),
  },
  {
    id: 'garlic',
    title: 'Protect My Garlic!',
    blurb: 'Hold off the blocks',
    statsKey: 'games.garlic.stats',
    load: () => import('../games/garlic/index.js'),
  },
  {
    id: 'solitaire',
    title: 'Babas Game',
    blurb: 'Classic solitaire',
    statsKey: 'games.solitaire.stats',
    load: () => import('../games/solitaire/index.js'),
  },
  {
    id: 'hola',
    title: 'Gedos Game',
    blurb: 'Hola, with sevens wild',
    statsKey: 'games.hola.stats',
    load: () => import('../games/hola/index.js'),
  },
];

export const getGame = id => games.find(g => g.id === id);

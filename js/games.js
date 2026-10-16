// Game registry. To add a game: create games/<id>/index.js exporting mount(el, parts, query)
// (optionally returning { unmount }) and add an entry here.

export const games = [
  {
    id: 'pans',
    title: 'Carter, Stop Hiding My Stuff!',
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
    id: 'mahjong',
    title: 'Block Game',
    blurb: 'Match the tiles, clear the board',
    statsKey: 'games.mahjong.stats',
    load: () => import('../games/mahjong/index.js'),
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
  {
    id: 'loop',
    title: 'Circle Track',
    blurb: 'Sort the cubes before the track jams',
    statsKey: 'games.loop.stats',
    load: () => import('../games/loop/index.js'),
  },
];

export const getGame = id => games.find(g => g.id === id);

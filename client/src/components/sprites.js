// Pixel art data (16×16, one string per row, '.' = transparent), rendered
// by PixelArt.jsx. Pure data so tests and the icon/preview scripts can read it.

// Shared palette. Monsters add their own B (body), D (shade), L (light).
export const PALETTE = {
  K: '#0F0E0D', W: '#F4F1EA', E: '#1C1B19', R: '#D94F4F', Y: '#F2B24C',
  N: '#7A5230', M: '#8A8F98', S: '#C9CED6', C: '#B23A48', U: '#7FB4E8',
  P: '#F08DAE', V: '#8E6CC9', O: '#E8875A',
};

// The adventurer (same as the PWA icon). G = tunic, coloured by level tier.
export const HERO = {
  rows: [
    '................',
    '.....KKKKKK.....',
    '....KHHHHHHK....',
    '....KHHHHHHK....',
    '....KSSSSSSK....',
    '....KSESSESK....',
    '....KSSSSSSK....',
    '.....KSSSSK.....',
    '....KGGGGGGK....',
    '...KGGGYYGGGK...',
    '..KSKGGGGGGKSK..',
    '..KSKGGGGGGKSK..',
    '...K.KBBBBK.K...',
    '.....KBBBBK.....',
    '.....KB..BK.....',
    '.....KK..KK.....',
  ],
  colors: { H: '#5C7A3A', S: '#E8B98A', B: '#4A4842' },
};

export const MONSTER_SPRITES = {
  tech: {
    colors: { B: '#7FB4E8', D: '#4F7FAF', Y: '#F2B24C' },
    rows: [
      '................',
      '....KKKKKKKK....',
      '...KBBBBBBBBK...',
      '...KBYYBBYYBK...',
      '...KBBBBBBBBK...',
      '...KDBKKKKBDK...',
      '.KKKDDDDDDDDKKK.',
      'KBBKBBBBBBBBKBBK',
      'KBBKBBBYYBBBKBBK',
      'KBDKBBBYYBBBKDBK',
      'KKKKBBBBBBBBKKKK',
      '...KDDDDDDDDK...',
      '...KBBK..KBBK...',
      '...KBBK..KBBK...',
      '..KKKKK..KKKKK..',
      '................',
    ],
  },
  langues: {
    colors: { B: '#F08DAE', D: '#C9668A', L: '#F8C3D6' },
    rows: [
      '................',
      '.....KKKKKK.....',
      '....KLLBBBBK....',
      '...KLBBBBBBBK...',
      '...KBWEBBWEBK...',
      '...KBEEBBEEBK...',
      '...KBBBBBBBBK...',
      '...KBKKKKKKBK...',
      '...KBKRRRRKBK...',
      '...KBBKKKKBBK...',
      '..KKBBBBBBBBKK..',
      '.KBKBBBBBBBBKBK.',
      '...KBBBBBBBBK...',
      '...KDBDBBDBDK...',
      '...KK.KKKK.KK...',
      '................',
    ],
  },
  sport: {
    colors: { B: '#9BD15A', D: '#6E9B3A' },
    rows: [
      '............NN..',
      '....KKKKKK.NNNN.',
      '...KBBBBBBKNNNN.',
      '...KBEBBEBK.NN..',
      '...KBBBBBBK.NN..',
      '...KBWKKWBK.NN..',
      '..KKBBBBBBKKNN..',
      '.KBBKBBBBKBBKN..',
      '.KBBKBBBBKBBBK..',
      '.KBKDDDDDDKKBK..',
      '.KBKBBBBBBK.KK..',
      '..KKDDDDDDK.....',
      '...KBBKKBBK.....',
      '...KBBK.KBBK....',
      '..KKKKK.KKKKK...',
      '................',
    ],
  },
  carriere: {
    colors: { B: '#F2B24C', D: '#C98A2A' },
    rows: [
      '................',
      '...KK......KK...',
      '...KBK....KBK...',
      '...KBBKKKKBBK...',
      '..KBBBBBBBBBBK..',
      '..KBWEBBBBWEBK..',
      '..KBBBBBBBBBBK..',
      'KK.KBBKKKKBBK.KK',
      'KDK.KBBBBBBK.KDK',
      'KDDKKBBRRBBKKDDK',
      'KDDDKBBRRBBKDDDK',
      '.KDDKBBRRBBKDDK.',
      '..KKKBBBBBBKKK..',
      '....KBBKKBBK....',
      '....KKK..KKK....',
      '................',
    ],
  },
  creatif: {
    colors: { B: '#8E6CC9', D: '#5E4392' },
    rows: [
      '................',
      '......KKKK......',
      '....KKBBBBKK....',
      '...KBBBBBBBBK...',
      '..KBBWEBBWEBBK..',
      '..KBBEEBBEEBBK..',
      '..KBBBBBBBBBBK..',
      '..KBBBKKKKBBBK..',
      '..KBBBBBBBBBBK..',
      '.KBBBBBBBBBBBBK.',
      'KBDBKBDBBDBKBDBK',
      'KBDK.KDBBDK.KDBK',
      'KDK..KDKKDK..KDK',
      '.K...KDK.KDK..K.',
      '......K...K.....',
      '..O.........O...',
    ],
  },
  autre: {
    colors: { B: '#B8B3A7', D: '#8A857A', L: '#DDD9CF' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '......KKKK......',
      '....KKBBBBKK....',
      '...KBLLBBBBBK...',
      '..KBLBBBBBBBBK..',
      '..KBBWEBBWEBBK..',
      '.KBBBEEBBEEBBBK.',
      '.KBBBBBBBBBBBBK.',
      '.KBBBBKKKKBBBBK.',
      '.KBBBBBRRBBBBBK.',
      '.KDBBBBBBBBBBDK.',
      '..KKKKKKKKKKKKK.',
      '................',
    ],
  },
};

// Accessories, drawn over the hero on the same 16×16 grid. The back slot is
// drawn behind the hero, the others in front.
export const GEAR_SPRITES = {
  casque: { rows: [
    '.....KKKKKK.....',
    '....KSSSSSSK....',
    '....KSMMMMSK....',
    '....KMMMMMMK....',
  ] },
  couronne: { rows: [
    '.....Y.YY.Y.....',
    '.....YYYYYY.....',
  ] },
  bandeau: { rows: [
    '................',
    '................',
    '................',
    '....KRRRRRRKR...',
    '............RR..',
  ] },
  cape: { rows: [
    '................', '................', '................', '................',
    '................', '................', '................', '....CCCCCCCC....',
    '..CCCCCCCCCCCC..',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '..CCCCCCCCCCCC..',
  ] },
  epee: { rows: [
    '................',
    '..............S.',
    '..............S.',
    '..............S.',
    '..............S.',
    '..............S.',
    '..............S.',
    '..............S.',
    '.............YYY',
    '..............N.',
    '..............N.',
    '..............N.',
  ] },
  baton: { rows: [
    '.............PP.',
    '.............PP.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
    '..............N.',
  ] },
  bouclier: { rows: [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    'YYYY............',
    'YUUY............',
    'YUUY............',
    'YUUY............',
    '.YY.............',
  ] },
  grimoire: { rows: [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '................',
    'VVV.............',
    'VYV.............',
    'VVV.............',
  ] },
};

// Hero + gear as ordered layers: back slot, hero, then the other slots.
export function heroLayers(gear = {}, tunic = '#9BD15A') {
  const layer = (id) => ({ rows: GEAR_SPRITES[id].rows, colors: PALETTE });
  return [
    ...(gear.back ? [layer(gear.back)] : []),
    { rows: HERO.rows, colors: { ...PALETTE, ...HERO.colors, G: tunic } },
    ...['head', 'offhand', 'hand'].filter((s) => gear[s]).map((s) => layer(gear[s])),
  ];
}

export const monsterLayers = (species) => {
  const m = MONSTER_SPRITES[species] ?? MONSTER_SPRITES.autre;
  return [{ rows: m.rows, colors: { ...PALETTE, ...m.colors } }];
};

// Every filled pixel of the layers, last layer on top: [x, y, colour].
export function pixels(layers) {
  const grid = new Map();
  for (const { rows, colors } of layers) {
    rows.forEach((row, y) => [...row.slice(0, 16)].forEach((c, x) => {
      if (c !== '.' && colors[c]) grid.set(`${x},${y}`, [x, y, colors[c]]);
    }));
  }
  return [...grid.values()];
}

// Global balance constants and bar layout. Tweak numbers here to rebalance the game.

export const CONFIG = {
  startMoney: 320,
  startReputation: 12, // 0..100
  minutesPerSecond: 1.4, // in-game minutes per real second at x1
  serviceStart: 18 * 60,
  lastEntry: 25 * 60, // 01:00, no new customers after
  lastCall: 25 * 60 + 30, // 01:30, no new rounds
  closing: 26 * 60, // 02:00
  baseHands: 2,
  baseSpeed: 3.3, // m/s
  pourTime: 1.6,
  takeOrderTime: 0.7,
  serveTime: 0.45,
  collectTime: 0.55,
  clearTime: 1.0,
  dropDirtyTime: 0.4,
  bottleTime: 0.45,
  kegSwapTime: 2.2,
  reserveTime: 1.0,
  fridgeFillTime: 1.8,
  fixTime: 3.0,
  mopTime: 1.8,
  washTime: 9,
  washCapacity: 12,
  startGlasses: 16,
  dirtyCapacity: 8,
  patienceOrder: 36, // seconds before leaving when waiting to order
  patienceServe: 84,
  patienceBill: 42,
  patienceDoor: 18,
  drinkTimeBase: 17,
  rent: 30,
  electricityPerTap: 3,
  electricityBase: 6,
  expressDelay: 22, // seconds for an express delivery during service
  miniGameTimeScale: 0.8, // the bar runs a bit slower while the player focuses on a mini-game
  maxQueue: 8,
};

export const LAYOUT = {
  cell: 0.5,
  wallH: 3.0,
  sizes: [
    { w: 12, d: 9 },
    { w: 15, d: 9 },
    { w: 15, d: 11.5 },
  ],
  door: { x0: 10, x1: 11 },
  counter: { x0: 1.0, x1: 8.0, z0: 1.5, z1: 2.0, top: 1.06 },
  flap: { x0: 8.0, x1: 9.0 },
  flapL: { x0: 0, x1: 1.0 },
  staff: { x0: 0, x1: 9.0, z0: 0.5, z1: 1.5 },
  backBar: { x0: 0, x1: 9.5, z0: 0, z1: 0.5 },
  sideBlock: { x0: 9.0, x1: 9.5, z0: 0.5, z1: 2.0 },
  staffAccessZ: 1.05,
  tapSlots: [2.4, 3.3, 4.2, 5.1, 6.0, 6.9],
  stoolSlots: [1.6, 2.35, 3.1, 3.85, 4.6, 5.35, 6.1, 6.85, 7.6],
  stoolZ: 2.28,
  fridge: { x: 7.4, w: 1.1 },
  board: { x: 1.0 },
  snack: { x: 1.95 },
  dishwasher: { x: 7.4 },
  glassRack: { x: 1.55 },
  reserveDoor: { x0: 8.05, x1: 8.95 },
  wcDoor: { x0: 10.3, x1: 11.1 },
  chalkboard: { x0: 3.0, x1: 5.3, y0: 1.95, y1: 2.85 },
  neon: { x: 1.65, y: 2.45 },
};

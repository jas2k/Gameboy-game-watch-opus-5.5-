/* Super Mario Bros. — level data (World 1-1 and its bonus room, World 1-2) */
(function () {
  'use strict';
  const GW = window.GW;

  // tile ids
  const T = (GW.MT = {
    EMPTY: 0, GROUND: 1, BRICK: 2, Q: 3, USED: 4, HARD: 5, PIPE: 6, HIDDEN: 7, COIN: 8,
  });
  const SOLID = new Uint8Array(16);
  [T.GROUND, T.BRICK, T.Q, T.USED, T.HARD, T.PIPE].forEach((t) => (SOLID[t] = 1));
  GW.MT_SOLID = SOLID;

  function area(w, style) {
    return {
      w, h: 15, style,
      tiles: new Uint8Array(w * 15),
      contents: {},
      pipes: [],
      enemies: [],
      scenery: [],
      decor: [],
    };
  }
  const set = (a, x, y, id) => { if (x >= 0 && x < a.w && y >= 0 && y < 15) a.tiles[y * a.w + x] = id; };
  const ground = (a, x0, x1) => { for (let x = x0; x <= x1; x++) { set(a, x, 13, T.GROUND); set(a, x, 14, T.GROUND); } };
  const brick = (a, x, y, what) => { set(a, x, y, T.BRICK); if (what) a.contents[x + ',' + y] = what; };
  const bricks = (a, x0, x1, y) => { for (let x = x0; x <= x1; x++) brick(a, x, y); };
  const q = (a, x, y, what) => { set(a, x, y, T.Q); a.contents[x + ',' + y] = what || 'coin'; };
  const hidden = (a, x, y, what) => { set(a, x, y, T.HIDDEN); a.contents[x + ',' + y] = what; };
  const column = (a, x, h) => { for (let i = 0; i < h; i++) set(a, x, 12 - i, T.HARD); };
  const pipe = (a, x, h, warp) => {
    const top = 13 - h;
    for (let y = top; y <= 12; y++) { set(a, x, y, T.PIPE); set(a, x + 1, y, T.PIPE); }
    a.pipes.push({ x, y: top, h, warp });
  };
  const goomba = (a, x, row) => a.enemies.push({ type: 'goomba', x: x * 16, y: (row === undefined ? 12 : row) * 16 });
  const koopa = (a, x, row) => a.enemies.push({ type: 'koopa', x: x * 16, y: (row === undefined ? 12 : row) * 16 - 8 });

  function overworldScenery(a, until) {
    for (let base = 0; base < until; base += 48) {
      a.scenery.push({ k: 'hillBig', x: base * 16, y: 13 * 16 - 35 });
      a.scenery.push({ k: 'hillSmall', x: (base + 16) * 16, y: 13 * 16 - 19 });
      a.scenery.push({ k: 'bush3', x: (base + 11) * 16, y: 13 * 16 - 17 });
      a.scenery.push({ k: 'bush1', x: (base + 23) * 16, y: 13 * 16 - 17 });
      a.scenery.push({ k: 'bush2', x: (base + 41) * 16, y: 13 * 16 - 17 });
      a.scenery.push({ k: 'cloud1', x: (base + 8) * 16, y: 3 * 16 });
      a.scenery.push({ k: 'cloud1', x: (base + 19) * 16, y: 2 * 16 });
      a.scenery.push({ k: 'cloud3', x: (base + 27) * 16, y: 3 * 16 });
      a.scenery.push({ k: 'cloud2', x: (base + 36) * 16, y: 2 * 16 });
    }
  }

  const LEVELS = (GW.MarioLevels = {});

  LEVELS['1-1'] = function () {
    const m = area(224, 'overworld');
    ground(m, 0, 68); ground(m, 71, 85); ground(m, 89, 152); ground(m, 155, 223);
    overworldScenery(m, 200);

    q(m, 16, 9, 'coin');
    brick(m, 20, 9); q(m, 21, 9, 'power'); brick(m, 22, 9); q(m, 23, 9, 'coin'); brick(m, 24, 9);
    q(m, 22, 5, 'coin');
    pipe(m, 28, 2); pipe(m, 38, 3); pipe(m, 46, 4);
    pipe(m, 57, 4, { area: 'bonus', mode: 'down' });
    hidden(m, 64, 8, '1up');
    brick(m, 77, 9); q(m, 78, 9, 'power'); brick(m, 79, 9);
    bricks(m, 80, 87, 5);
    bricks(m, 91, 93, 5); q(m, 94, 5, 'coin'); brick(m, 94, 9, 'multicoin');
    brick(m, 100, 9); brick(m, 101, 9, 'star');
    q(m, 106, 9, 'coin'); q(m, 109, 9, 'coin'); q(m, 109, 5, 'power'); q(m, 112, 9, 'coin');
    brick(m, 118, 9);
    bricks(m, 121, 123, 5);
    brick(m, 128, 5); q(m, 129, 5, 'coin'); q(m, 130, 5, 'coin'); brick(m, 131, 5);
    brick(m, 129, 9); brick(m, 130, 9);
    for (let i = 0; i < 4; i++) { column(m, 134 + i, i + 1); column(m, 140 + i, 4 - i); }
    for (let i = 0; i < 4; i++) column(m, 148 + i, i + 1);
    column(m, 152, 4);
    for (let i = 0; i < 4; i++) column(m, 155 + i, 4 - i);
    pipe(m, 163, 2);
    brick(m, 168, 9); brick(m, 169, 9); q(m, 170, 9, 'coin'); brick(m, 171, 9);
    pipe(m, 179, 2);
    for (let i = 0; i < 8; i++) column(m, 181 + i, i + 1);
    column(m, 189, 8);
    set(m, 198, 12, T.HARD);
    m.flag = { x: 198 * 16 + 7, top: 3 * 16 - 8, bottom: 12 * 16 };
    m.castle = { x: 202 * 16, y: 8 * 16 };

    [22, 40, 51, 52.5, 97, 98.5, 114, 115.5, 124, 125.5, 128, 129.5, 174, 175.5].forEach((x) => goomba(m, x));
    goomba(m, 80, 4); goomba(m, 82, 4);
    koopa(m, 107);

    // bonus room under pipe 57
    const b = area(16, 'underground');
    ground(b, 0, 15);
    for (let y = 2; y <= 12; y++) brick(b, 0, y);
    bricks(b, 4, 10, 2);
    for (let y = 10; y <= 12; y++) bricks(b, 4, 10, y);
    for (let x = 4; x <= 10; x++) { set(b, x, 9, T.COIN); set(b, x, 7, T.COIN); }
    for (let x = 5; x <= 9; x++) set(b, x, 5, T.COIN);
    for (let y = 0; y <= 12; y++) { set(b, 14, y, T.PIPE); set(b, 15, y, T.PIPE); }
    set(b, 13, 11, T.PIPE); set(b, 13, 12, T.PIPE);
    b.pipes.push({ x: 14, y: -1, h: 11, noLip: true });
    b.sidePipe = { x: 13, y: 11, warp: { area: 'main', x: 163, mode: 'up' } };
    b.entry = { x: 2 * 16 + 2, y: 16 };

    return {
      world: '1-1', time: 400, start: { area: 'main', x: 40, y: 12 * 16 }, checkpoint: 82 * 16,
      areas: { main: m, bonus: b },
    };
  };

  // A compact underground stage in the spirit of 1-2
  LEVELS['1-2'] = function () {
    const m = area(176, 'underground');
    ground(m, 0, 79); ground(m, 83, 114); ground(m, 118, 175);
    for (let y = 2; y <= 12; y++) brick(m, 0, y);
    bricks(m, 6, 150, 2);
    // opening blocks
    q(m, 10, 9, 'power'); q(m, 11, 9, 'coin'); q(m, 12, 9, 'coin'); q(m, 13, 9, 'coin'); q(m, 14, 9, 'coin');
    for (let i = 0; i < 5; i++) column(m, 17 + i * 2, i + 1);
    column(m, 26, 5); column(m, 27, 3);
    bricks(m, 29, 29, 9); for (let y = 3; y <= 8; y++) brick(m, 29, y);
    bricks(m, 40, 45, 8); brick(m, 40, 7); brick(m, 45, 7);
    for (let x = 41; x <= 44; x++) set(m, x, 7, T.COIN);
    brick(m, 42, 8, 'multicoin');
    bricks(m, 44, 46, 11); bricks(m, 52, 55, 9); brick(m, 53, 9, 'star');
    for (let x = 52; x <= 55; x++) set(m, x, 6, T.COIN);
    bricks(m, 58, 66, 5); bricks(m, 58, 66, 4);
    bricks(m, 62, 66, 9);
    for (let x = 60; x <= 65; x++) set(m, x, 11, T.COIN);
    pipe(m, 70, 3); pipe(m, 76, 4); pipe(m, 86, 2);
    bricks(m, 91, 96, 9); q(m, 93, 9, 'power');
    for (let x = 91; x <= 96; x++) set(m, x, 6, T.COIN);
    for (let i = 0; i < 4; i++) column(m, 100 + i, i + 1);
    column(m, 104, 4); column(m, 105, 4);
    bricks(m, 108, 114, 8);
    bricks(m, 122, 128, 9); brick(m, 125, 9, '1up');
    pipe(m, 132, 3); pipe(m, 138, 2);
    for (let i = 0; i < 6; i++) column(m, 144 + i, i + 1);
    column(m, 150, 6);
    set(m, 160, 12, T.HARD);
    m.flag = { x: 160 * 16 + 7, top: 3 * 16 - 8, bottom: 12 * 16 };
    m.castle = { x: 164 * 16, y: 8 * 16 };

    [13, 31, 33, 47, 49, 61, 64, 73, 88, 90, 97, 110, 112, 124, 126, 136].forEach((x) => goomba(m, x));
    koopa(m, 50); koopa(m, 84); koopa(m, 120); koopa(m, 141);
    return { world: '1-2', time: 400, start: { area: 'main', x: 40, y: 12 * 16 }, checkpoint: 84 * 16, areas: { main: m } };
  };

  GW.MarioLevelOrder = ['1-1', '1-2'];
})();

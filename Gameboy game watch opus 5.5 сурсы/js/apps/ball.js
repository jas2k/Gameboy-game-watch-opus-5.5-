/* BALL — the 1980 Game & Watch juggling game, Mario edition, rendered as LCD segments */
(function () {
  'use strict';
  const GW = window.GW;
  const U = GW.util;
  const A = GW.audio;

  const W = 320, H = 240;
  const CX = 160;
  const LCD_BG = '#C9CCB4';
  const INK = '#1C1F16';
  const LANES = 3;
  const N = [6, 8, 10];            // positions per lane (including both hands)
  const DX = [30, 54, 78];         // hand distance from centre per lane
  const HY = [168, 164, 160];      // hand height per lane
  const RY = [58, 84, 110];        // arc height per lane

  const app = { id: 'ball', res: [W, H] };
  GW.apps.ball = app;
  let os = null;
  let st = null;

  /* ---------- LCD Mario (front view, arms drawn separately) ---------- */
  const MARIO_LCD = [
    '.......######.......',
    '.....##########.....',
    '....############....',
    '...##############...',
    '..################..',
    '..#..............#..',
    '..#..##......##..#..',
    '..#..##......##..#..',
    '..#......##......#..',
    '..#.....####.....#..',
    '...#.##########.#...',
    '...#.##########.#...',
    '....#..........#....',
    '.....##########.....',
    '....###.####.###....',
    '...####.####.####...',
    '...###.#....#.###...',
    '....#.#.#..#.#.#....',
    '....#..######..#....',
    '....#..........#....',
    '.....#####.#####....',
    '.....###.....###....',
    '....####.....####...',
    '...#####.....#####..',
  ];
  const bodySpr = GW.spr(MARIO_LCD, { '#': INK });
  const body2x = GW.canvasSpr(40, 48, (g) => { g.imageSmoothingEnabled = false; g.drawImage(bodySpr.img, 0, 0, 40, 48); });
  const BODY_X = CX - 20, BODY_Y = 164;
  const SHOULDER = [[CX - 14, BODY_Y + 30], [CX + 14, BODY_Y + 30]];

  function ballPos(lane, i) {
    const n = N[lane];
    const th = Math.PI * (1 - i / (n - 1));
    return [CX + DX[lane] * Math.cos(th), HY[lane] - 9 - RY[lane] * Math.sin(th)];
  }
  function dropPos(lane, side, step) {
    const x = CX + side * DX[lane];
    return step === 0 ? [x + side * 6, HY[lane] + 14] : [x + side * 12, 206];
  }
  const handLane = (pose, side) => (side < 0 ? 1 - pose : 1 + pose);

  /* ---------- LCD primitives ---------- */
  function seg(g, on, draw) {
    if (on) {
      g.globalAlpha = 0.16;
      g.save(); g.translate(1.5, 1.5); draw(g); g.restore();
      g.globalAlpha = 1;
      draw(g);
    } else {
      g.globalAlpha = 0.07;
      draw(g);
      g.globalAlpha = 1;
    }
  }
  function ball(g, x, y, on) {
    seg(g, on, (c) => {
      GW.circle(c, Math.round(x), Math.round(y), 6, INK);
      if (on) { c.fillStyle = LCD_BG; c.fillRect(Math.round(x) - 3, Math.round(y) - 4, 2, 2); }
    });
  }
  function thickLine(g, x0, y0, x1, y1, w) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      g.fillRect(Math.round(x0 + (x1 - x0) * t - w / 2), Math.round(y0 + (y1 - y0) * t - w / 2), w, w);
    }
  }
  function arm(g, side, lane, on) {
    const [sx, sy] = SHOULDER[side < 0 ? 0 : 1];
    const hx = CX + side * DX[lane], hy = HY[lane];
    const ex = hx - side * 3, ey = sy + 3 + lane * 2;
    const draw = (c) => {
      c.fillStyle = INK;
      thickLine(c, sx, sy, ex, ey, 5);
      thickLine(c, ex, ey, hx, hy + 6, 5);
      GW.circle(c, hx, hy + 2, 5, INK);
      c.fillStyle = LCD_BG;
      c.fillRect(hx - 2, hy, 4, 3);
    };
    if (on) seg(g, true, draw);
    else { g.globalAlpha = 0.045; draw(g); g.globalAlpha = 1; }
  }

  // seven-segment digits
  const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '' };
  function digit(g, x, y, ch, w, h) {
    w = w || 10; h = h || 18;
    const t = 2, hh = Math.floor(h / 2);
    const segs = {
      a: [x + t, y, w - 2 * t, t], d: [x + t, y + h - t, w - 2 * t, t], g: [x + t, y + hh - 1, w - 2 * t, t],
      f: [x, y + t, t, hh - t - 1], b: [x + w - t, y + t, t, hh - t - 1],
      e: [x, y + hh + 1, t, hh - t - 1], c: [x + w - t, y + hh + 1, t, hh - t - 1],
    };
    const on = SEG7[ch] || '';
    for (const k of 'abcdefg') {
      const r = segs[k];
      seg(g, on.includes(k), (c) => { c.fillStyle = INK; c.fillRect(r[0], r[1], r[2], r[3]); });
    }
  }
  function number(g, x, y, str, w, h) {
    for (let i = 0; i < str.length; i++) digit(g, x + i * ((w || 10) + 4), y, str[i], w, h);
  }

  /* ---------- game ---------- */
  app.init = function (o) { os = o; };
  app.hasState = () => !!(st && st.mode === 'play');
  app.suspend = function () {};
  app.resume = function () {};

  function newRound() {
    const lanes = st.game === 'A' ? [0, 1] : [0, 1, 2];
    const starts = { 0: [1, 1], 1: [5, -1], 2: [2, 1] };
    st.balls = lanes.map((l) => ({ lane: l, i: starts[l][0], dir: starts[l][1] }));
    st.turn = 0;
    st.tick = 40;
    st.drop = null;
  }

  app.launch = function () {
    st = { mode: 'select', game: 'A', t: 0, pose: 0, score: 0, miss: 0, balls: [], turn: 0, tick: 0, drop: null, overT: 0, demo: true };
    st.game = 'A';
    newRound();
  };

  function period() {
    const base = st.game === 'A' ? 26 : 21;
    return Math.max(8, base - Math.floor(st.score / 12));
  }

  function step() {
    const b = st.balls[st.turn % st.balls.length];
    st.turn++;
    const n = N[b.lane];
    const atEnd = (b.i === 0 && b.dir < 0) || (b.i === n - 1 && b.dir > 0);
    if (atEnd) {
      const side = b.i === 0 ? -1 : 1;
      if (handLane(st.pose, side) === b.lane) {
        b.dir = -b.dir;
        b.i += b.dir;
        if (!st.demo) {
          st.score++;
          if (st.score === 200 || st.score === 500) { st.miss = 0; A.sfx('oneup'); }
          if (st.score > 999) st.score = 0;
          A.sfx('catch');
        }
      } else {
        st.drop = { lane: b.lane, side, step: 0, t: 0 };
        if (!st.demo) A.sfx('miss');
      }
    } else {
      b.i += b.dir;
      if (!st.demo) A.sfx('lcdstep');
    }
  }

  function demoAI() {
    // steer toward the ball that will need a hand next
    let best = null, bestT = 99;
    st.balls.forEach((b, idx) => {
      const n = N[b.lane];
      const dist = b.dir > 0 ? n - 1 - b.i : b.i;
      const order = ((idx - st.turn) % st.balls.length + st.balls.length) % st.balls.length;
      const t = dist * st.balls.length + order;
      if (t < bestT) { bestT = t; best = b; }
    });
    if (!best) return;
    const side = best.dir > 0 ? 1 : -1;
    const want = side < 0 ? 1 - best.lane : best.lane - 1;
    if (st.t % 6 === 0 && st.pose !== want) st.pose += Math.sign(want - st.pose);
  }

  app.update = function (I) {
    if (!st) app.launch();
    st.t++;
    if (st.mode === 'select') {
      st.demo = true;
      if (I.pressed.up || I.pressed.down) { st.game = st.game === 'A' ? 'B' : 'A'; A.sfx('beep'); newRound(); }
      if (I.pressed.a || I.pressed.b) {
        st.mode = 'play'; st.demo = false; st.score = 0; st.miss = 0; st.pose = 0;
        newRound();
        A.sfx('select');
        return;
      }
      demoAI();
      runClock();
      return;
    }
    if (st.mode === 'over') {
      st.overT++;
      if (st.overT > 60 && (I.pressed.a || I.pressed.b)) { st.mode = 'select'; A.sfx('back'); newRound(); }
      return;
    }
    // play
    if (I.pressed.left || I.pressed.b) { if (st.pose > -1) { st.pose--; A.sfx('tick'); } }
    if (I.pressed.right || I.pressed.a) { if (st.pose < 1) { st.pose++; A.sfx('tick'); } }
    runClock();
  };
  app.idleUpdate = function () {};

  function runClock() {
    if (st.drop) {
      st.drop.t++;
      if (st.drop.t === 18) st.drop.step = 1;
      if (st.drop.t > 70) {
        st.drop = null;
        if (!st.demo) {
          st.miss++;
          if (st.miss >= 3) {
            st.mode = 'over';
            st.overT = 0;
            GW.submitScore(st.game === 'A' ? 'ballA' : 'ballB', st.score);
            A.sfx('miss');
            return;
          }
        }
        newRound();
      }
      return;
    }
    if (--st.tick <= 0) {
      st.tick = period();
      step();
    }
  }

  /* ---------- drawing ---------- */
  function drawBackdrop(g) {
    // printed backdrop behind the LCD
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#D4D7C0');
    grd.addColorStop(1, '#BEC2A8');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // faint printed scenery (hills, clouds, bricks) in muted tones
    g.globalAlpha = 0.28;
    GW.draw(g, GW.S.hillBig, 6, 176);
    GW.draw(g, GW.S.hillSmall, 262, 192);
    GW.draw(g, GW.S.cloud[1], 16, 52);
    GW.draw(g, GW.S.cloud[0], 250, 70);
    g.globalAlpha = 0.2;
    for (let x = 0; x < W; x += 16) GW.draw(g, GW.S.tiles.o.ground, x, 212);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(28,31,22,0.5)';
    g.fillRect(12, 211, W - 24, 1);
  }

  app.draw = function (g) {
    if (!st) app.launch();
    drawBackdrop(g);

    // header
    const blink = Math.floor(st.t / 30) % 2 === 0;
    seg(g, st.game === 'A' && (st.mode !== 'select' || blink), (c) => GW.text(c, 'GAME A', 14, 12, INK));
    seg(g, st.game === 'B' && (st.mode !== 'select' || blink), (c) => GW.text(c, 'GAME B', 14, 24, INK));
    const shown = st.mode === 'select' ? '' : U.pad(st.score, 3, ' ');
    if (st.mode === 'select') {
      const hs = String(GW.save.scores[st.game === 'A' ? 'ballA' : 'ballB']);
      number(g, 258, 10, U.pad(hs, 3, ' '));
      GW.text(g, 'TOP', 226, 16, INK, { small: true });
    } else number(g, 258, 10, shown);

    // misses
    GW.text(g, 'MISS', 14, 196, INK, { small: true });
    for (let i = 0; i < 3; i++) {
      seg(g, i < st.miss, (c) => {
        GW.circle(c, 20 + i * 14, 188, 4, INK);
      });
    }

    // arc segments
    for (let l = 0; l < LANES; l++) {
      for (let i = 0; i < N[l]; i++) {
        const [x, y] = ballPos(l, i);
        const on = st.balls.some((b) => b.lane === l && b.i === i) && !(st.drop && st.drop.lane === l && ((i === 0 && st.drop.side < 0) || (i === N[l] - 1 && st.drop.side > 0)));
        ball(g, x, y, on);
      }
      for (const side of [-1, 1]) for (let s = 0; s < 2; s++) {
        const [x, y] = dropPos(l, side, s);
        const on = !!(st.drop && st.drop.lane === l && st.drop.side === side && st.drop.step === s && Math.floor(st.drop.t / 6) % 2 === (s ? 0 : 0));
        ball(g, x, y, on);
      }
    }

    // juggler: body + all arm positions as segments
    seg(g, true, (c) => c.drawImage(body2x.img, BODY_X, BODY_Y));
    for (const side of [-1, 1]) for (let l = 0; l < LANES; l++) arm(g, side, l, handLane(st.pose, side) === l);

    if (st.mode === 'select') {
      if (blink) GW.text(g, 'PRESS A', CX, 132, INK, { align: 'center' });
      GW.text(g, '▲▼ GAME A/B', CX, 146, INK, { align: 'center', small: true });
    }
    if (st.mode === 'over' && Math.floor(st.overT / 20) % 2 === 0) {
      GW.text(g, 'GAME OVER', CX, 120, INK, { align: 'center' });
    }
    // subtle LCD sheen
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, 0, W, 60);
  };

  /* ---------- home card ---------- */
  app.drawPreview = function (g, x, y, w, h, t) {
    g.fillStyle = LCD_BG;
    g.fillRect(x, y, w, h);
    g.save();
    g.translate(x + w / 2, y + h - 4);
    g.scale(0.42, 0.42);
    g.translate(-CX, -214);
    const pose = [-1, 0, 1, 0][Math.floor(t / 30) % 4];
    seg(g, true, (c) => c.drawImage(body2x.img, BODY_X, BODY_Y));
    for (const side of [-1, 1]) for (let l = 0; l < LANES; l++) arm(g, side, l, handLane(pose, side) === l);
    for (let l = 0; l < 3; l++) {
      const n = N[l];
      const phase = Math.floor(t / 8 + l * 3) % ((n - 1) * 2);
      const idx = phase < n ? phase : 2 * (n - 1) - phase;
      for (let i = 0; i < n; i++) {
        const [bx, by] = ballPos(l, i);
        ball(g, bx, by, i === idx);
      }
    }
    g.restore();
    GW.text(g, 'BALL', x + 6, y + 6, INK);
    number(g, x + w - 44, y + 5, U.pad(Math.max(GW.save.scores.ballA, GW.save.scores.ballB), 3, ' '), 8, 13);
  };
})();

/* Flappy Bird */
(function () {
  'use strict';
  const GW = window.GW;
  const U = GW.util;
  const A = GW.audio;

  const W = 320, H = 240;
  const GROUND = 200;
  const BIRD_X = 84;
  const GAP = 60;
  const PIPE_W = 26, CAP_W = 30, CAP_H = 12;
  const SPEED = 1.35;
  const SPACING = 104;

  const app = { id: 'flappy', res: [W, H] };
  GW.apps.flappy = app;
  let os = null;
  let st = null;

  /* ---------- art ---------- */
  const OUT = '#543847';
  const birdPal = {
    yellow: { K: OUT, Y: '#F8D820', O: '#F8A838', R: '#F85838', W: '#FCFCFC', V: '#FCF4C8' },
    red: { K: OUT, Y: '#F87858', O: '#E04018', R: '#F8B800', W: '#FCFCFC', V: '#FCD8C8' },
    blue: { K: OUT, Y: '#58B8F8', O: '#3888D8', R: '#F8A838', W: '#FCFCFC', V: '#D8F0FC' },
  };
  const BODY = [
    '.....KKKKKK......',
    '...KKYYYYKWWK....',
    '..KYYYYYKWWWWK...',
    '.KYYYYYYKWWWKWK..',
    'KYYYYYYYKWWWKWK..',
    'KYYYYYYYYKWWWWK..',
    'KYYYYYYYYYKKKKKK.',
    'KYYYYYYYYKRRRRRRK',
    '.KYYYYYYKRKKKKKK.',
    '..KOOOOOOKRRRRRK.',
    '...KKOOOOOKKKKK..',
    '.....KKKKK.......',
  ];
  const WINGS = [
    { dy: 2, rows: ['KKK...', 'KVVKK.', 'KVVVVK', '.KKKK.'] },
    { dy: 4, rows: ['.KKKK.', 'KVVVVK', 'KVVVVK', '.KKKK.'] },
    { dy: 6, rows: ['.KKKK.', 'KVVVVK', 'KVVK..', '.KK...'] },
  ];
  const birds = {};
  for (const [name, pal] of Object.entries(birdPal)) {
    const body = GW.spr(BODY, pal);
    birds[name] = WINGS.map((wg) => GW.canvasSpr(17, 12, (g) => {
      g.drawImage(body.img, 0, 0);
      const ws = GW.spr(wg.rows, pal);
      g.drawImage(ws.img, 0, wg.dy);
    }));
  }

  function pipeColumn(i, w) {
    if (i === 0 || i === w - 1) return OUT;
    const f = i / w;
    if (f < 0.08) return '#74BF2E';
    if (f < 0.25) return '#9CE659';
    if (f < 0.7) return '#74BF2E';
    if (f < 0.75) return '#558022';
    if (f < 0.8) return '#74BF2E';
    return '#558022';
  }
  const pipeBody = GW.canvasSpr(PIPE_W, 1, (g) => {
    for (let i = 0; i < PIPE_W; i++) { g.fillStyle = pipeColumn(i, PIPE_W); g.fillRect(i, 0, 1, 1); }
  });
  const pipeCap = GW.canvasSpr(CAP_W, CAP_H, (g) => {
    for (let i = 0; i < CAP_W; i++) { g.fillStyle = pipeColumn(i, CAP_W); g.fillRect(i, 0, 1, CAP_H); }
    g.fillStyle = OUT;
    g.fillRect(0, 0, CAP_W, 1);
    g.fillRect(0, CAP_H - 1, CAP_W, 1);
  });

  function makeBackground(night) {
    return GW.canvasSpr(W, GROUND, (g) => {
      g.fillStyle = night ? '#0E7A8A' : '#70C5CE';
      g.fillRect(0, 0, W, GROUND);
      if (night) {
        for (let i = 0; i < 40; i++) {
          g.fillStyle = i % 3 ? '#9CE0E8' : '#FCFCFC';
          g.fillRect((i * 83) % W, (i * 37) % 120, 1, 1);
        }
      }
      // clouds
      const cloud = night ? '#2A8F9C' : '#EAFCDB';
      const cloudEdge = night ? '#3AA0AC' : '#FCFCFC';
      for (let x = -10; x < W + 20; x += 26) {
        const r = 14 + ((x * 7) % 9);
        GW.circle(g, x, 150 + ((x * 13) % 10), r, cloudEdge);
        GW.circle(g, x, 152 + ((x * 13) % 10), r - 1, cloud);
      }
      g.fillStyle = cloud;
      g.fillRect(0, 160, W, 40);
      // city skyline
      const bld = night ? '#1F6B6E' : '#A6E0B5';
      const win = night ? '#E8E070' : '#C6F0D2';
      let x = 0, i = 0;
      while (x < W) {
        const bw = 14 + ((i * 17) % 16);
        const bh = 18 + ((i * 29) % 26);
        g.fillStyle = bld;
        g.fillRect(x, 184 - bh, bw, bh);
        g.fillStyle = win;
        for (let wy = 184 - bh + 3; wy < 180; wy += 5)
          for (let wx = x + 2; wx < x + bw - 2; wx += 4) if ((wx + wy + i) % 3) g.fillRect(wx, wy, 2, 2);
        x += bw + 1;
        i++;
      }
      // bushes
      const bush = night ? '#1E8A3C' : '#5EC45A';
      const bushEdge = night ? '#2EA04C' : '#80D870';
      for (let bx = -8; bx < W + 16; bx += 18) {
        const r = 9 + ((bx * 5) % 6);
        GW.circle(g, bx, 190, r, bushEdge);
        GW.circle(g, bx, 191, r - 1, bush);
      }
      g.fillStyle = bush;
      g.fillRect(0, 190, W, 10);
    });
  }
  const BG = { day: makeBackground(false), night: makeBackground(true) };

  function drawGround(g, off) {
    off = Math.floor(off);
    g.fillStyle = OUT;
    g.fillRect(0, GROUND, W, 1);
    g.fillStyle = '#73BF2E';
    g.fillRect(0, GROUND + 1, W, 7);
    // slanted stripes: shift per row
    g.fillStyle = '#9CE659';
    for (let y = 0; y < 7; y++) {
      for (let x = -((off + y) % 12) - 12; x < W; x += 12) g.fillRect(x, GROUND + 1 + y, 6, 1);
    }
    g.fillStyle = '#558022';
    g.fillRect(0, GROUND + 8, W, 2);
    g.fillStyle = '#DED895';
    g.fillRect(0, GROUND + 10, W, H - GROUND - 10);
    g.fillStyle = '#D2CC7E';
    g.fillRect(0, H - 6, W, 6);
  }

  function drawPipe(g, x, gapY) {
    const top = Math.round(gapY - GAP / 2), bot = Math.round(gapY + GAP / 2);
    const px = Math.round(x);
    g.drawImage(pipeBody.img, px + 2, 0, PIPE_W, top - CAP_H);
    g.drawImage(pipeCap.img, px, top - CAP_H);
    g.drawImage(pipeBody.img, px + 2, bot + CAP_H, PIPE_W, GROUND - bot - CAP_H);
    g.drawImage(pipeCap.img, px, bot);
  }

  function drawBird(g, x, y, angle, frame, kind) {
    const spr = birds[kind || 'yellow'][frame];
    g.save();
    g.translate(Math.round(x + 8), Math.round(y + 6));
    g.rotate(angle);
    g.drawImage(spr.img, -8, -6);
    g.restore();
  }

  /* ---------- game ---------- */
  app.init = function (o) { os = o; };
  app.hasState = () => !!(st && st.state === 'play');
  app.suspend = function () {};
  app.resume = function () {};

  function reset(toTitle) {
    const night = Math.random() < 0.35;
    st = {
      state: toTitle ? 'title' : 'ready',
      t: 0, stateT: 0,
      bird: { y: 100, vy: 0, angle: 0, frame: 0 },
      kind: U.pick(['yellow', 'yellow', 'red', 'blue']),
      pipes: [],
      score: 0,
      ground: 0,
      night,
      flash: 0,
      newBest: false,
      panelY: H,
    };
  }

  app.launch = function () { reset(true); };

  function flap() {
    st.bird.vy = -4.05;
    A.sfx('wing');
  }

  app.update = function (I) {
    if (!st) reset(true);
    st.t++;
    st.stateT++;
    const b = st.bird;
    const tap = I.pressed.a || I.pressed.up || I.pressed.b;
    const scroll = st.state === 'title' || st.state === 'ready' || st.state === 'play';
    if (scroll) st.ground = (st.ground + SPEED) % 12;
    if (st.state !== 'dead' && st.state !== 'over') b.frame = Math.floor(st.t / 5) % 3;

    switch (st.state) {
      case 'title':
        b.y = 92 + Math.sin(st.t * 0.12) * 4;
        if (I.pressed.a || I.pressed.b) { A.sfx('swoosh'); st.state = 'ready'; st.stateT = 0; }
        break;
      case 'ready':
        b.y = 108 + Math.sin(st.t * 0.12) * 4;
        b.angle = 0;
        if (tap && st.stateT > 8) { st.state = 'play'; st.stateT = 0; flap(); }
        break;
      case 'play': {
        if (tap) flap();
        b.vy = Math.min(b.vy + 0.24, 6);
        b.y += b.vy;
        b.angle = U.clamp(b.vy < 0 ? -0.4 : (b.vy - 1.5) * 0.25, -0.4, Math.PI / 2);
        if (b.y < -20) b.y = -20;
        // spawn / move pipes
        const last = st.pipes[st.pipes.length - 1];
        if (!last || last.x < W - SPACING) {
          const prevY = last ? last.y : 110;
          const y = Math.round(U.clamp(prevY + U.rand(-62, 62), 44, GROUND - 44));
          st.pipes.push({ x: W + 8, y, scored: false });
        }
        for (const p of st.pipes) {
          p.x -= SPEED;
          if (!p.scored && p.x + CAP_W / 2 < BIRD_X) {
            p.scored = true;
            st.score++;
            A.sfx('point');
          }
        }
        st.pipes = st.pipes.filter((p) => p.x > -CAP_W - 4);
        // collisions
        const box = { x: BIRD_X + 2, y: b.y + 2, w: 13, h: 9 };
        let dead = b.y + 11 >= GROUND;
        for (const p of st.pipes) {
          const top = { x: p.x, y: -100, w: CAP_W, h: p.y - GAP / 2 + 100 };
          const bot = { x: p.x, y: p.y + GAP / 2, w: CAP_W, h: GROUND };
          if (U.overlap(box, top) || U.overlap(box, bot)) dead = true;
        }
        if (dead) die();
        break;
      }
      case 'dead':
        if (st.flash > 0) st.flash--;
        b.vy = Math.min(b.vy + 0.3, 7);
        b.y = Math.min(b.y + b.vy, GROUND - 11);
        b.angle = U.approach(b.angle, Math.PI / 2, 0.12);
        if (b.y >= GROUND - 11 && st.stateT > 40) {
          st.state = 'over';
          st.stateT = 0;
          st.newBest = GW.submitScore('flappy', st.score);
          A.sfx('swoosh');
        }
        break;
      case 'over':
        st.panelY = U.lerp(st.panelY, 84, 0.18);
        if (st.stateT > 40 && (I.pressed.a || I.pressed.up)) { A.sfx('swoosh'); reset(false); }
        else if (st.stateT > 40 && I.pressed.b) { A.sfx('back'); reset(true); }
        break;
    }
  };

  function die() {
    st.state = 'dead';
    st.stateT = 0;
    st.flash = 8;
    A.sfx('hit');
    A.sfx('die', 0.25);
    if (st.bird.vy < 0) st.bird.vy = 0;
  }

  function bigNumber(g, n, x, y, align) {
    GW.text(g, String(n), x, y, '#FCFCFC', { align: align || 'center', scale: 2, outline: OUT, shadow: null });
  }

  function medal(g, x, y, score) {
    let col = null, hi = null;
    if (score >= 40) { col = '#E5E4E2'; hi = '#FCFCFC'; }
    else if (score >= 30) { col = '#F8B800'; hi = '#FCFCB0'; }
    else if (score >= 20) { col = '#BCBCBC'; hi = '#FCFCFC'; }
    else if (score >= 10) { col = '#C87830'; hi = '#F8B878'; }
    GW.circle(g, x, y, 12, '#D2B870');
    GW.circle(g, x, y, 11, '#E4D08C');
    if (!col) return;
    GW.circle(g, x, y, 10, OUT);
    GW.circle(g, x, y, 9, col);
    GW.circle(g, x - 2, y - 2, 4, hi);
    GW.circle(g, x - 1, y - 1, 3, col);
    if (Math.floor(st.t / 10) % 3 === 0) {
      g.fillStyle = '#FCFCFC';
      g.fillRect(x + 4, y - 7, 1, 5); g.fillRect(x + 2, y - 5, 5, 1);
    }
  }

  app.draw = function (g) {
    if (!st) reset(true);
    const bg = st.night ? BG.night : BG.day;
    // parallax background
    const off = Math.floor((st.t * 0.3) % W);
    const moving = st.state !== 'dead' && st.state !== 'over';
    const bx = moving ? off : st.bgFrozen || off;
    if (moving) st.bgFrozen = off;
    g.drawImage(bg.img, -bx, 0);
    g.drawImage(bg.img, W - bx, 0);

    for (const p of st.pipes) drawPipe(g, p.x, p.y);
    drawGround(g, st.ground);

    const b = st.bird;
    drawBird(g, BIRD_X, b.y, b.angle, b.frame, st.kind);

    if (st.state === 'title') {
      GW.text(g, 'FLAPPY', W / 2, 30, '#FCFCFC', { align: 'center', scale: 3, outline: OUT });
      GW.text(g, 'BIRD', W / 2, 58, '#F8D820', { align: 'center', scale: 3, outline: OUT });
      if (Math.floor(st.t / 24) % 2 === 0) GW.text(g, 'PRESS A TO START', W / 2, 140, '#FCFCFC', { align: 'center', outline: OUT });
      GW.text(g, 'BEST ' + GW.save.scores.flappy, W / 2, 158, '#F8D820', { align: 'center', outline: OUT });
    }
    if (st.state === 'ready') {
      bigNumber(g, 0, W / 2, 16);
      GW.text(g, 'GET READY!', W / 2, 52, '#80D010', { align: 'center', scale: 2, outline: OUT });
      // tap hint
      const hx = BIRD_X + 40, hy = 104;
      GW.frame(g, hx, hy, 58, 26, '#FCFCFC', OUT, 2);
      GW.text(g, 'A', hx + 12, hy + 6, '#E04018', { scale: 2 });
      GW.text(g, 'TAP', hx + 30, hy + 10, OUT, { small: true });
      GW.text(g, '▲', hx + 14, hy - 12 - (Math.floor(st.t / 10) % 2) * 2, '#FCFCFC', { outline: OUT });
    }
    if (st.state === 'play' || st.state === 'dead') bigNumber(g, st.score, W / 2, 16);

    if (st.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${st.flash / 8})`;
      g.fillRect(0, 0, W, H);
    }

    if (st.state === 'over') {
      const gy = Math.min(38, -30 + st.stateT * 6);
      GW.text(g, 'GAME OVER', W / 2, gy, '#F8A838', { align: 'center', scale: 2, outline: OUT });
      const px = W / 2 - 90, py = Math.round(st.panelY);
      GW.frame(g, px, py, 180, 70, '#DED895', OUT, 2);
      GW.frame(g, px + 3, py + 3, 174, 64, '#DED895', '#D2B870', 2);
      GW.text(g, 'MEDAL', px + 14, py + 10, '#E07830', { small: true });
      medal(g, px + 34, py + 38, st.score);
      GW.text(g, 'SCORE', px + 166, py + 10, '#E07830', { align: 'right', small: true });
      const shown = Math.min(st.score, Math.floor(st.stateT / 3));
      GW.text(g, String(shown), px + 166, py + 18, '#FCFCFC', { align: 'right', outline: OUT });
      GW.text(g, 'BEST', px + 166, py + 36, '#E07830', { align: 'right', small: true });
      GW.text(g, String(GW.save.scores.flappy), px + 166, py + 44, '#FCFCFC', { align: 'right', outline: OUT });
      if (st.newBest && Math.floor(st.t / 12) % 2 === 0) {
        GW.frame(g, px + 108, py + 34, 24, 10, '#E04018', '#FCFCFC', 1);
        GW.text(g, 'NEW', px + 120, py + 36, '#FCFCFC', { align: 'center', small: true });
      }
      if (st.stateT > 40) GW.text(g, 'A RETRY   B MENU', W / 2, py + 80, '#FCFCFC', { align: 'center', outline: OUT });
    }
  };

  /* ---------- home card ---------- */
  app.drawPreview = function (g, x, y, w, h, t) {
    g.drawImage(BG.day.img, 40, 60, w, h - 14, x, y, w, h - 14);
    const px = x + w - ((t * 0.6) % (w + 40)) ;
    const top = y + 34, bot = y + 70;
    const ppx = Math.round(px);
    g.drawImage(pipeBody.img, ppx + 2, y, PIPE_W, top - 10 - y);
    g.drawImage(pipeCap.img, ppx, top - 10, CAP_W, 10);
    g.drawImage(pipeBody.img, ppx + 2, bot + 10, PIPE_W, y + h - 14 - bot - 10);
    g.drawImage(pipeCap.img, ppx, bot, CAP_W, 10);
    g.fillStyle = '#73BF2E';
    g.fillRect(x, y + h - 14, w, 4);
    g.fillStyle = '#DED895';
    g.fillRect(x, y + h - 10, w, 10);
    g.fillStyle = OUT;
    g.fillRect(x, y + h - 14, w, 1);
    const by = y + 44 + Math.sin(t * 0.1) * 6;
    const spr = birds.yellow[Math.floor(t / 5) % 3];
    g.drawImage(spr.img, x + 30, Math.round(by));
    GW.text(g, 'FLAPPY', x + w / 2, y + 6, '#FCFCFC', { align: 'center', outline: OUT });
  };
  app.birds = birds;
})();

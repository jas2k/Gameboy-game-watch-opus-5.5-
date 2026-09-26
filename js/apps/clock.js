/* Interactive digital clock — Mario bumps brick digits to update the time */
(function () {
  'use strict';
  const GW = window.GW;
  const U = GW.util;
  const A = GW.audio;
  const SMB = GW.SMB;

  const W = 256, H = 240;
  const GROUND = 208;
  const BS = 16;                         // block size
  const DIG_Y = 56;                      // top of digits
  const DIG_X = [16, 72, 136, 192];      // left of each digit
  const DIGITS = [
    '111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111',
  ];
  const THEMES = ['AUTO', 'DAY', 'NIGHT', 'UNDERGROUND', 'CASTLE'];
  const MENU = ['SET TIME', 'SET ALARM', 'ALARM', 'FORMAT', 'THEME', 'EXIT'];

  const app = {
    id: 'clock', res: [W, H], pauseMode: 'custom',
    started: false,
  };
  GW.apps.clock = app;

  let st = null;
  let os = null;

  app.init = function (o) { os = o; };
  app.hasState = () => false;

  function currentDigits() {
    const d = GW.now();
    let h = d.getHours();
    if (!GW.save.settings.hour24) h = h % 12 || 12;
    const s = U.pad(h, 2) + U.pad(d.getMinutes(), 2);
    return s.split('').map(Number);
  }

  function themeName() {
    const t = GW.save.settings.clockTheme;
    if (t === 0) {
      const h = GW.now().getHours();
      return h >= 6 && h < 19 ? 'DAY' : 'NIGHT';
    }
    return THEMES[t];
  }

  app.launch = function () {
    const digs = currentDigits();
    st = {
      t: 0,
      digits: digs.map((v) => ({ v, target: v, anim: 0, pendingT: 0 })),
      mario: { x: 40, y: GROUND - 15, vx: 0, vy: 0, onGround: true, facing: 1, anim: 0, hurt: 0, big: false },
      mode: 'auto', manualT: 0,
      goal: null, idleT: 60, walkTarget: null,
      coins: [], goombas: [], sparks: [], rockets: [], score: [],
      nextGoomba: 60 * 12,
      lastMinute: GW.now().getMinutes(),
      lastHour: GW.now().getHours(),
      fireworks: 0,
      menu: null, menuSel: 0,
      clouds: [[20, 36, 0], [140, 20, 1], [210, 44, 0]],
      bumps: {},
    };
    A.music.stop();
  };
  app.suspend = function () { if (st) st.menu = null; if (os) os.edit = null; };
  app.resume = function () {};

  /* ---------- world geometry ---------- */
  function blockRects() {
    const out = [];
    st.digits.forEach((d, i) => {
      const pat = DIGITS[d.v];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (pat[r * 3 + c] === '1') out.push({ x: DIG_X[i] + c * BS, y: DIG_Y + r * BS, w: BS, h: BS, di: i, r, c });
      }
    });
    return out;
  }

  function solidAt(rects, x, y, w, h) {
    for (const b of rects) if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return b;
    return null;
  }

  /* ---------- update ---------- */
  app.update = function (I) {
    if (!st) app.launch();
    st.t++;
    const s = GW.save.settings;

    if (os.edit) {
      os.updateEditExternal();
      if (!os.edit) st.menu = 'menu';
      return;
    }
    if (st.menu) return updateMenu(I);
    if (I.pressed.pause) { st.menu = 'menu'; st.menuSel = 0; A.sfx('pause'); return; }

    // interactive shortcuts
    if (I.pressed.b) {
      s.clockTheme = (s.clockTheme + 1) % THEMES.length;
      GW.persist();
      A.sfx('pipe');
      os.toast(THEMES[s.clockTheme], 70);
    }
    if (I.pressed.up) {
      s.hour24 = !s.hour24;
      GW.persist();
      A.sfx('select');
      os.toast(s.hour24 ? '24 HOUR' : '12 HOUR', 60);
      const digs = currentDigits();
      st.digits.forEach((d, i) => { d.target = digs[i]; d.v = digs[i]; });
    }

    // time changes -> queue digit updates
    const digs = currentDigits();
    digs.forEach((v, i) => {
      const d = st.digits[i];
      if (d.target !== v) { d.target = v; d.pendingT = 0; }
    });
    const now = GW.now();
    if (now.getHours() !== st.lastHour) {
      st.lastHour = now.getHours();
      if (now.getMinutes() === 0) { st.fireworks = 60 * 4; A.sfx('chime'); }
    }

    updateMario(I);
    updateDigits();
    updateGoombas();
    updateFx();
  };

  app.idleUpdate = function () { if (st) { st.t++; updateFx(); } };

  function updateMenu(I) {
    const s = GW.save.settings;
    if (I.repeat('down')) { st.menuSel = (st.menuSel + 1) % MENU.length; A.sfx('move'); }
    if (I.repeat('up')) { st.menuSel = (st.menuSel + MENU.length - 1) % MENU.length; A.sfx('move'); }
    if (I.pressed.b || I.pressed.pause) { st.menu = null; A.sfx('back'); return; }
    const item = MENU[st.menuSel];
    const dir = I.pressed.right ? 1 : I.pressed.left ? -1 : 0;
    if (item === 'ALARM' && (I.pressed.a || dir)) { s.alarmOn = !s.alarmOn; GW.persist(); A.sfx('select'); }
    if (item === 'FORMAT' && (I.pressed.a || dir)) {
      s.hour24 = !s.hour24; GW.persist(); A.sfx('select');
      const digs = currentDigits();
      st.digits.forEach((d, i) => { d.target = digs[i]; d.v = digs[i]; });
    }
    if (item === 'THEME' && (I.pressed.a || dir)) {
      s.clockTheme = (s.clockTheme + (dir || 1) + THEMES.length) % THEMES.length; GW.persist(); A.sfx('select');
    }
    if (I.pressed.a) {
      if (item === 'SET TIME') { const d = GW.now(); os.edit = { kind: 'time', h: d.getHours(), m: d.getMinutes(), field: 0 }; A.sfx('select'); }
      if (item === 'SET ALARM') { os.edit = { kind: 'alarm', h: s.alarmH, m: s.alarmM, field: 0 }; A.sfx('select'); }
      if (item === 'EXIT') { st.menu = null; A.sfx('back'); }
    }
  }

  function updateMario(I) {
    const m = st.mario;
    const rects = blockRects();
    const manualInput = I.held.left || I.held.right || I.pressed.a || I.held.down;
    if (manualInput) { st.mode = 'manual'; st.manualT = 60 * 6; st.goal = null; }
    if (st.mode === 'manual' && --st.manualT <= 0) st.mode = 'auto';
    if (m.hurt > 0) m.hurt--;

    let move = 0, jump = false, holdJump = false;
    const alarm = os.alarm.ringing;
    if (st.mode === 'manual') {
      move = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
      jump = I.pressed.a;
      holdJump = I.held.a;
    } else {
      // pick a job: update a pending digit
      if (!st.goal) {
        const idx = st.digits.findIndex((d) => d.target !== d.v);
        if (idx >= 0) {
          // choose a bottom-row block of that digit (prefer middle)
          const pat = DIGITS[st.digits[idx].v];
          const cols = [1, 0, 2].filter((c) => pat[12 + c] === '1');
          const c = cols.length ? cols[0] : 1;
          st.goal = { di: idx, x: DIG_X[idx] + c * BS + BS / 2 };
        }
      }
      let target = null;
      if (st.goal) target = st.goal.x;
      else if (st.walkTarget != null) target = st.walkTarget;
      else if (--st.idleT <= 0) {
        st.walkTarget = U.rand(24, 232);
        st.idleT = U.randInt(80, 240);
      }
      if (target != null) {
        const cx = m.x + 6;
        if (Math.abs(target - cx) > 2) move = target > cx ? 1 : -1;
        else {
          move = 0;
          if (st.goal && m.onGround) { jump = true; holdJump = true; }
          if (!st.goal) st.walkTarget = null;
        }
      }
      if (st.goal && !m.onGround) holdJump = true;
      // hop over / onto goombas
      for (const gb of st.goombas) {
        if (gb.dead) continue;
        const dx = gb.x - m.x;
        if (m.onGround && Math.abs(dx) < 34 && Math.sign(dx) === (move || m.facing) ) { jump = true; holdJump = true; }
        if (m.onGround && Math.abs(dx) < 18) { jump = true; holdJump = true; }
      }
      if (alarm && m.onGround && st.t % 40 === 0) { jump = true; holdJump = true; }
      if (st.fireworks > 0 && m.onGround && st.t % 50 === 0) { jump = true; holdJump = true; }
    }

    // horizontal
    const maxV = 1.5;
    if (move) {
      m.vx = U.approach(m.vx, move * maxV, 0.12);
      m.facing = move;
    } else m.vx = U.approach(m.vx, 0, 0.14);
    m.x += m.vx;
    if (m.x < 0) { m.x = 0; m.vx = 0; }
    if (m.x > W - 12) { m.x = W - 12; m.vx = 0; }
    let hit = solidAt(rects, m.x, m.y, 12, 15);
    if (hit) {
      if (m.vx > 0) m.x = hit.x - 12; else if (m.vx < 0) m.x = hit.x + hit.w;
      m.vx = 0;
    }

    // vertical
    if (jump && m.onGround) {
      m.vy = -4.6;
      m.onGround = false;
      A.sfx('jump');
    }
    const g = m.vy < 0 && holdJump ? 0.16 : 0.42;
    m.vy = Math.min(m.vy + g, 4.5);
    m.y += m.vy;
    m.onGround = false;
    if (m.y + 15 >= GROUND) { m.y = GROUND - 15; m.vy = 0; m.onGround = true; }
    hit = solidAt(rects, m.x, m.y, 12, 15);
    if (hit) {
      if (m.vy > 0) { m.y = hit.y - 15; m.vy = 0; m.onGround = true; }
      else if (m.vy < 0) {
        m.y = hit.y + hit.h;
        m.vy = 0.5;
        // head bump: choose the block closest to Mario's center
        const cx = m.x + 6;
        let best = hit, bd = 99;
        for (const b of rects) {
          if (b.y + b.h !== hit.y + hit.h) continue;
          if (cx < b.x - 4 || cx > b.x + b.w + 4) continue;
          const d = Math.abs(b.x + 8 - cx);
          if (d < bd) { bd = d; best = b; }
        }
        bumpBlock(best);
      }
    }
    m.anim += Math.abs(m.vx) * 0.18;
  }

  function bumpBlock(b) {
    const d = st.digits[b.di];
    st.bumps[b.di + ':' + b.r + ':' + b.c] = 12;
    A.sfx('bump');
    // stomp goombas standing on it (none can, but keeps parity with SMB)
    if (d.target !== d.v) {
      d.anim = 18;
      d.next = d.target;
      if (st.goal && st.goal.di === b.di) st.goal = null;
    }
    // coin
    st.coins.push({ x: b.x, y: b.y - 16, vy: -5, t: 0 });
    A.sfx('coin');
    GW.save.stats.clockCoins = (GW.save.stats.clockCoins + 1) % 100;
    GW.persist();
  }

  function updateDigits() {
    for (const [k, v] of Object.entries(st.bumps)) { if (v <= 1) delete st.bumps[k]; else st.bumps[k] = v - 1; }
    st.digits.forEach((d, i) => {
      if (d.anim > 0) {
        d.anim--;
        if (d.anim === 9 && d.next != null) { d.v = d.next; d.next = null; }
      }
      if (d.target !== d.v && d.anim === 0) {
        d.pendingT++;
        // Mario is busy / being driven by the player: flip on its own after a while
        if (d.pendingT > (st.mode === 'manual' ? 60 * 4 : 60 * 8)) {
          d.anim = 18; d.next = d.target; d.pendingT = 0;
          A.sfx('bump');
          if (st.goal && st.goal.di === i) st.goal = null;
        }
      }
    });
    // keep Mario out of freshly grown blocks
    const m = st.mario;
    const rects = blockRects();
    let guard = 0;
    while (solidAt(rects, m.x, m.y, 12, 15) && guard++ < 8) m.y = Math.min(m.y + 16, GROUND - 15);
  }

  function updateGoombas() {
    const m = st.mario;
    if (--st.nextGoomba <= 0) {
      st.nextGoomba = U.randInt(60 * 20, 60 * 40);
      const left = Math.random() < 0.4;
      st.goombas.push({ x: left ? -16 : W, y: GROUND - 16, vx: left ? 0.5 : -0.5, dead: 0, t: 0 });
    }
    for (const gb of st.goombas) {
      gb.t++;
      if (gb.dead) { gb.dead++; continue; }
      gb.x += gb.vx;
      // stomp / hurt
      const mb = { x: m.x, y: m.y, w: 12, h: 15 };
      const gbox = { x: gb.x + 2, y: gb.y + 4, w: 12, h: 12 };
      if (U.overlap(mb, gbox)) {
        if (m.vy > 0 && m.y + 15 - gb.y < 10) {
          gb.dead = 1;
          m.vy = -3.2;
          A.sfx('stomp');
          st.score.push({ x: gb.x, y: gb.y - 8, t: 0, txt: '100' });
        } else if (!m.hurt) {
          m.hurt = 90;
          m.vx = gb.vx > 0 ? 2 : -2;
          m.vy = -2.5;
          A.sfx('damage');
        }
      }
    }
    st.goombas = st.goombas.filter((gb) => gb.x > -20 && gb.x < W + 20 && gb.dead < 40);
  }

  function updateFx() {
    for (const c of st.coins) { c.t++; c.y += c.vy; c.vy += 0.3; }
    st.coins = st.coins.filter((c) => c.t < 30);
    for (const s of st.score) { s.t++; s.y -= 0.6; }
    st.score = st.score.filter((s) => s.t < 45);
    if (st.fireworks > 0) {
      st.fireworks--;
      if (st.fireworks % 28 === 0) {
        const x = U.rand(30, 226), y = U.rand(40, 120);
        const col = U.pick(['#FCFCFC', '#F8B800', '#E04018', '#3CBCFC', '#80D010']);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          st.sparks.push({ x, y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, t: 0, col });
        }
        A.sfx('firework');
      }
    }
    for (const p of st.sparks) { p.t++; p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.vx *= 0.98; }
    st.sparks = st.sparks.filter((p) => p.t < 50);
    for (const c of st.clouds) { c[0] -= 0.08; if (c[0] < -70) c[0] = W + 10; }
  }

  /* ---------- drawing ---------- */
  const stars = [];
  for (let i = 0; i < 40; i++) stars.push([Math.random() * W, Math.random() * 190, Math.random() * 100]);

  function palette(theme) {
    switch (theme) {
      case 'NIGHT': return { bg: '#000000', tiles: GW.S.tiles.o, scenery: true, night: true };
      case 'UNDERGROUND': return { bg: '#000000', tiles: GW.S.tiles.u, scenery: false };
      case 'CASTLE': return { bg: '#000000', tiles: GW.S.tiles.c, scenery: false, castle: true };
      default: return { bg: SMB.sky, tiles: GW.S.tiles.o, scenery: true };
    }
  }

  app.draw = function (g) {
    if (!st) app.launch();
    const theme = themeName();
    const pal = palette(theme);
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, W, H);

    if (pal.night) {
      for (const s of stars) {
        const on = Math.sin(st.t * 0.03 + s[2]) > -0.4;
        if (on) { g.fillStyle = s[2] > 70 ? '#FCFCFC' : '#7C7C7C'; g.fillRect(s[0] | 0, (s[1] | 0) + 30, 1, 1); }
      }
      // moon
      GW.circle(g, 226, 58, 9, '#FCD8A8');
      GW.circle(g, 230, 55, 8, '#000');
    }
    if (pal.scenery) {
      for (const c of st.clouds) GW.draw(g, GW.S.cloud[c[2]], c[0], c[1] + 40);
      GW.draw(g, GW.S.hillBig, -8, GROUND - 35);
      GW.draw(g, GW.S.hillSmall, 168, GROUND - 19);
      GW.draw(g, GW.S.bush[2], 70, GROUND - 17);
      GW.draw(g, GW.S.bush[0], 212, GROUND - 17);
    }
    if (theme === 'UNDERGROUND') {
      // ceiling bricks + pipe
      for (let x = 0; x < W; x += 16) GW.draw(g, pal.tiles.brick, x, 32);
      GW.draw(g, GW.S.pipe.lip, 224, GROUND - 32);
      GW.draw(g, GW.S.pipe.body, 224, GROUND - 16);
    }
    if (pal.castle) {
      for (let x = 0; x < W; x += 16) GW.draw(g, pal.tiles.brick, x, 32);
      // lava glow on the far side
      const flick = Math.floor(st.t / 10) % 2;
      g.fillStyle = '#E04018';
      g.fillRect(0, GROUND - 3 - flick, W, 1);
    }

    // ground
    for (let x = 0; x < W; x += 16) {
      GW.draw(g, pal.castle ? pal.tiles.hard : pal.tiles.ground, x, GROUND);
      GW.draw(g, pal.castle ? pal.tiles.hard : pal.tiles.ground, x, GROUND + 16);
    }

    drawHud(g, pal);

    // digits
    const bump = (i, r, c) => st.bumps[i + ':' + r + ':' + c] || 0;
    st.digits.forEach((d, i) => {
      const pat = DIGITS[d.v];
      const hop = d.anim > 0 ? Math.round(Math.sin((d.anim / 18) * Math.PI) * 5) : 0;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (pat[r * 3 + c] !== '1') continue;
        const b = bump(i, r, c);
        const by = b ? -Math.round(Math.sin((b / 12) * Math.PI) * 6) : 0;
        const pending = d.target !== d.v && Math.floor(st.t / 8) % 2 === 0 && r === 4;
        const tile = pending ? GW.S.q[Math.floor(st.t / 8) % 3] : pal.tiles.brick;
        GW.draw(g, tile, DIG_X[i] + c * BS, DIG_Y + r * BS + by - hop);
      }
    });
    // colon: two spinning coins
    const sec = GW.now().getSeconds();
    if (sec % 2 === 0 || os.alarm.ringing) {
      const f = GW.S.coin[Math.floor(st.t / 8) % 4];
      GW.draw(g, f, 120, DIG_Y + 12);
      GW.draw(g, f, 120, DIG_Y + 44);
    }
    if (!GW.save.settings.hour24) {
      const h = GW.now().getHours();
      GW.text(g, h < 12 ? 'AM' : 'PM', 240, DIG_Y + 84, '#FCFCFC', { align: 'right', small: true });
    }

    // seconds bar on the ground line: 60 notches
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(8, 150, 240, 3);
    g.fillStyle = pal.bg === '#000000' ? '#F8B800' : '#FCFCFC';
    g.fillRect(8, 150, Math.round((sec / 59) * 240), 3);

    // coins popping from blocks
    for (const c of st.coins) GW.draw(g, GW.S.spin[Math.floor(c.t / 3) % 4], c.x, c.y);
    for (const s of st.score) GW.text(g, s.txt, s.x, s.y, '#FCFCFC', { small: true });

    // goombas
    for (const gb of st.goombas) {
      const spr = gb.dead ? (theme === 'UNDERGROUND' ? GW.S.goombaFlatU : GW.S.goombaFlat) : theme === 'UNDERGROUND' ? GW.S.goombaU : GW.S.goomba;
      if (gb.dead) GW.draw(g, spr, gb.x, gb.y + 8);
      else GW.draw(g, spr, gb.x, gb.y, Math.floor(gb.t / 10) % 2 === 0);
    }

    // Mario
    const m = st.mario;
    if (!(m.hurt && Math.floor(m.hurt / 3) % 2)) {
      const set = GW.S.mario[theme === 'CASTLE' ? 'fire' : 'mario'];
      let f = 'm_stand';
      if (!m.onGround) f = 'm_jump';
      else if (Math.abs(m.vx) > 0.1) f = ['m_walk1', 'm_walk2', 'm_walk3'][Math.floor(m.anim) % 3];
      GW.draw(g, set[f], Math.round(m.x) - 2, Math.round(m.y) - 1, m.facing < 0);
    }

    for (const p of st.sparks) {
      g.fillStyle = p.t > 36 && p.t % 4 < 2 ? '#7C7C7C' : p.col;
      g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    if (os.alarm.ringing && Math.floor(st.t / 12) % 2 === 0) {
      GW.frame(g, 78, 170, 100, 18, '#E04018', '#FCFCFC', 2);
      GW.text(g, 'WAKE UP!', 128, 175, '#FCFCFC', { align: 'center' });
    }

    if (st.menu) drawMenu(g);
  };

  function drawHud(g, pal) {
    const d = GW.now();
    const s = GW.save.settings;
    const white = '#FCFCFC';
    GW.text(g, GW.DAYS[d.getDay()], 24, 16, white);
    GW.text(g, U.pad(d.getDate(), 2) + ' ' + GW.MONTHS[d.getMonth()], 24, 24, white);
    GW.draw(g, GW.S.hudcoin[Math.floor(st.t / 10) % 4], 89, 24);
    GW.text(g, '×' + U.pad(GW.save.stats.clockCoins, 2), 96, 24, white);
    if (s.alarmOn) {
      GW.text(g, 'ALARM', 144, 16, white);
      GW.text(g, U.pad(s.alarmH, 2) + ':' + U.pad(s.alarmM, 2), 148, 24, white);
    } else {
      const th = themeName();
      GW.text(g, 'WORLD', 144, 16, white);
      GW.text(g, { DAY: '1-1', NIGHT: '3-1', UNDERGROUND: '1-2', CASTLE: '1-4' }[th] || '1-1', 152, 24, white);
    }
    GW.text(g, 'TIME', 200, 16, white);
    GW.text(g, ' ' + U.pad(d.getSeconds(), 2), 200, 24, white);
  }

  function drawMenu(g) {
    const s = GW.save.settings;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, 0, W, H);
    const bw = 184, bh = 20 + MENU.length * 15 + 8;
    const x = (W - bw) / 2, y = 46;
    GW.frame(g, x, y, bw, bh, '#000', '#FCFCFC', 2);
    GW.frame(g, x + 2, y + 2, bw - 4, bh - 4, '#000', '#C84C0C', 2);
    GW.text(g, 'CLOCK SETUP', W / 2, y + 8, '#F8B800', { align: 'center' });
    MENU.forEach((it, i) => {
      const yy = y + 24 + i * 15;
      const sel = i === st.menuSel;
      if (sel) GW.draw(g, GW.S.cursor, x + 10, yy);
      GW.text(g, it, x + 22, yy, sel ? '#FCFCFC' : '#8c8c8c');
      let val = '';
      if (it === 'SET TIME') {
        const d = GW.now();
        val = U.pad(d.getHours(), 2) + ':' + U.pad(d.getMinutes(), 2);
        if (os.edit && os.edit.kind === 'time') val = editStr(os.edit);
      }
      if (it === 'SET ALARM') {
        val = U.pad(s.alarmH, 2) + ':' + U.pad(s.alarmM, 2);
        if (os.edit && os.edit.kind === 'alarm') val = editStr(os.edit);
      }
      if (it === 'ALARM') val = s.alarmOn ? 'ON' : 'OFF';
      if (it === 'FORMAT') val = s.hour24 ? '24H' : '12H';
      if (it === 'THEME') val = THEMES[s.clockTheme].slice(0, 6);
      if (val) GW.text(g, val, x + bw - 12, yy, sel ? '#F8B800' : '#bcbcbc', { align: 'right' });
    });
    const hint = os.edit ? '▲▼ CHANGE ◀▶ FIELD A SAVE' : '▲▼ MOVE  A SELECT  B CLOSE';
    GW.text(g, hint, W / 2, y + bh + 6, '#bcbcbc', { align: 'center', small: true });
  }

  function editStr(e) {
    const blink = Math.floor(st.t / 10) % 2 === 0;
    return (e.field === 0 && !blink ? '  ' : U.pad(e.h, 2)) + ':' + (e.field === 1 && !blink ? '  ' : U.pad(e.m, 2));
  }

  /* ---------- home-screen card ---------- */
  app.drawPreview = function (g, x, y, w, h, t) {
    const theme = themeName();
    const night = theme !== 'DAY';
    g.fillStyle = night ? '#000' : SMB.sky;
    g.fillRect(x, y, w, h);
    if (night) {
      for (let i = 0; i < 14; i++) {
        g.fillStyle = (t + i * 7) % 60 < 40 ? '#FCFCFC' : '#555';
        g.fillRect(x + ((i * 37) % w), y + ((i * 23) % 50) + 4, 1, 1);
      }
    } else GW.draw(g, GW.S.cloud[0], x + 80 - ((t * 0.15) % 160), y + 4);
    for (let i = 0; i < w; i += 16) GW.draw(g, GW.S.tiles.o.ground, x + i, y + h - 16);
    const digs = currentDigits();
    const bs = 5;
    const dx = [x + 12, x + 34, x + 64, x + 86];
    digs.forEach((v, i) => {
      const pat = DIGITS[v];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (pat[r * 3 + c] !== '1') continue;
        const px = dx[i] + c * bs, py = y + 20 + r * bs;
        g.fillStyle = '#000';
        g.fillRect(px, py, bs, bs);
        g.fillStyle = SMB.brick;
        g.fillRect(px, py, bs - 1, bs - 1);
        g.fillStyle = SMB.pink;
        g.fillRect(px, py, bs - 1, 1);
      }
    });
    if (GW.now().getSeconds() % 2 === 0) {
      g.fillStyle = '#F8B800';
      g.fillRect(x + 57, y + 26, 3, 3);
      g.fillRect(x + 57, y + 36, 3, 3);
    }
    const sec = GW.now().getSeconds();
    g.fillStyle = night ? '#F8B800' : '#FCFCFC';
    g.fillRect(x + 12, y + 50, Math.round((sec / 59) * 100), 2);
    const mx = x + 10 + ((t * 0.5) % (w - 24));
    GW.draw(g, GW.S.mario.mario[['m_walk1', 'm_walk2', 'm_walk3'][Math.floor(t / 5) % 3]], mx, y + h - 32);
  };
})();

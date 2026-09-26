/* Super Mario Bros. — platformer engine for the Game & Watch */
(function () {
  'use strict';
  const GW = window.GW;
  const U = GW.util;
  const A = GW.audio;
  const S = GW.S;
  const SMB = GW.SMB;
  const T = GW.MT;
  const SOLID = GW.MT_SOLID;

  const W = 256, H = 240;
  const STOMP_SCORES = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
  const SHELL_SCORES = [500, 800, 1000, 2000, 4000, 5000, 8000];

  const app = { id: 'mario', res: [W, H] };
  GW.apps.mario = app;
  let os = null;
  let st = null;

  app.init = function (o) { os = o; };
  app.hasState = () => !!(st && (st.mode === 'play' || st.mode === 'intro'));
  app.suspend = function () {};
  app.resume = function () { if (st && st.mode === 'play') playLevelMusic(); };

  /* =====================================================================
     game / player management
     ===================================================================== */
  function newPlayer(name, pal) {
    return { name, pal, lives: 3, score: 0, coins: 0, level: 0, loop: 0, checkpoint: false, big: false, fire: false };
  }

  app.launch = function () {
    st = {
      mode: 'title', t: 0, modeT: 0,
      titleSel: 0,
      players: [newPlayer('MARIO', 'mario')],
      cur: 0,
      twoPlayer: false,
      time: 400, timeT: 0,
      timeUp: false,
    };
  };

  const P = () => st.players[st.cur];

  function setMode(m) { st.mode = m; st.modeT = 0; }

  function startGame(two) {
    st.twoPlayer = two;
    st.players = [newPlayer('MARIO', 'mario')];
    if (two) st.players.push(newPlayer('LUIGI', 'luigi'));
    st.cur = 0;
    st.timeUp = false;
    setMode('intro');
    A.music.stop();
  }

  function levelName(p) { return GW.MarioLevelOrder[p.level % GW.MarioLevelOrder.length]; }

  /* =====================================================================
     level loading
     ===================================================================== */
  function loadLevel() {
    const p = P();
    const def = GW.MarioLevels[levelName(p)]();
    st.def = def;
    st.world = def.world;
    st.areas = def.areas;
    st.time = def.time;
    st.timeT = 0;
    st.hurry = false;
    st.timeUp = false;
    st.multi = {};
    st.seq = null;
    st.freeze = 0;
    st.grow = null;
    const startX = p.checkpoint ? def.checkpoint : def.start.x;
    enterArea(def.start.area, startX, def.start.y);
    const m = st.mario;
    m.big = p.big; m.fire = p.fire;
    setMarioSize(m, m.big);
    m.y = def.start.y + 16 - m.h;
    st.cam = Math.max(0, Math.min(startX - 40, st.area.w * 16 - W));
  }

  function enterArea(name, x, y) {
    const a = st.areas[name];
    st.areaName = name;
    st.area = a;
    st.ents = [];
    st.fireballs = [];
    st.parts = [];
    st.pops = [];
    st.bumps = [];
    st.spawned = new Set();
    const old = st.mario;
    st.mario = {
      x, y, w: 12, h: 14, vx: 0, vy: 0, facing: 1, onGround: false, anim: 0, skid: false,
      big: old ? old.big : false, fire: old ? old.fire : false, crouch: false,
      star: old ? old.star : 0, invuln: 0, dead: false, hidden: false, stompChain: 0, kickT: 0, throwT: 0,
      climb: false, behind: false,
    };
    setMarioSize(st.mario, st.mario.big);
    st.cam = 0;
  }

  function setMarioSize(m, big) {
    const bottom = m.y + m.h;
    m.big = big;
    m.h = big && !m.crouch ? 28 : 14;
    m.y = bottom - m.h;
  }

  function playLevelMusic() {
    const m = st.mario;
    if (m && m.star > 0) { A.music.play('star', { restart: true }); return; }
    const song = st.area.style === 'underground' ? 'underground' : 'overworld';
    A.music.play(song, { restart: true, speed: st.hurry ? 1.45 : 1 });
  }

  /* =====================================================================
     tiles
     ===================================================================== */
  function tileAt(tx, ty) {
    const a = st.area;
    if (tx < 0 || tx >= a.w || ty < 0 || ty >= 15) return 0;
    return a.tiles[ty * a.w + tx];
  }
  function setTile(tx, ty, id) {
    const a = st.area;
    if (tx < 0 || tx >= a.w || ty < 0 || ty >= 15) return;
    a.tiles[ty * a.w + tx] = id;
  }
  function solid(tx, ty) {
    if (tx < 0 || tx >= st.area.w) return true;
    if (ty < 0 || ty >= 15) return false;
    return SOLID[tileAt(tx, ty)] === 1;
  }

  // generic tile collision (used by enemies/items/fireballs)
  function moveX(e) {
    e.x += e.vx;
    const y0 = Math.floor(e.y / 16), y1 = Math.floor((e.y + e.h - 0.01) / 16);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / 16);
      for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { e.x = tx * 16 - e.w; return true; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / 16);
      for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { e.x = (tx + 1) * 16; return true; }
    }
    return false;
  }
  function moveY(e) {
    e.y += e.vy;
    e.onGround = false;
    const x0 = Math.floor(e.x / 16), x1 = Math.floor((e.x + e.w - 0.01) / 16);
    if (e.vy >= 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / 16);
      for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) { e.y = ty * 16 - e.h; e.vy = 0; e.onGround = true; return 'down'; }
    } else {
      const ty = Math.floor(e.y / 16);
      for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) { e.y = (ty + 1) * 16; e.vy = 0; return 'up'; }
    }
    return null;
  }

  /* =====================================================================
     scoring / fx helpers
     ===================================================================== */
  function addScore(n, x, y) {
    P().score += n;
    if (x !== undefined) st.pops.push({ x, y, txt: String(n), t: 0 });
  }
  function oneUp(x, y) {
    P().lives = Math.min(P().lives + 1, 99);
    A.sfx('oneup');
    if (x !== undefined) st.pops.push({ x, y, txt: '1UP', t: 0 });
  }
  function addCoin() {
    const p = P();
    p.coins++;
    if (p.coins >= 100) { p.coins -= 100; oneUp(); }
  }
  function chainScore(list, idx, x, y) {
    if (idx >= list.length) oneUp(x, y);
    else addScore(list[idx], x, y);
  }

  /* =====================================================================
     block bumping
     ===================================================================== */
  function bumpTile(tx, ty) {
    const a = st.area;
    const id = tileAt(tx, ty);
    const key = tx + ',' + ty;
    const content = a.contents[key];
    const m = st.mario;
    let bumped = false;

    if (id === T.Q || id === T.HIDDEN) {
      setTile(tx, ty, T.USED);
      delete a.contents[key];
      spawnContent(content || 'coin', tx, ty);
      bumped = true;
    } else if (id === T.BRICK) {
      if (content === 'multicoin') {
        if (st.multi[key] === undefined) st.multi[key] = 60 * 4;
        spawnContent('coin', tx, ty);
        if (st.multi[key] <= 0) { setTile(tx, ty, T.USED); delete a.contents[key]; }
        bumped = true;
      } else if (content) {
        setTile(tx, ty, T.USED);
        delete a.contents[key];
        spawnContent(content, tx, ty);
        bumped = true;
      } else if (m.big) {
        setTile(tx, ty, T.EMPTY);
        A.sfx('brick');
        addScore(50);
        const x = tx * 16, y = ty * 16;
        st.parts.push({ k: 'debris', x, y, vx: -1, vy: -5.5, t: 0 }, { k: 'debris', x: x + 8, y, vx: 1, vy: -5.5, t: 0 },
          { k: 'debris', x, y: y + 8, vx: -1, vy: -3.5, t: 0 }, { k: 'debris', x: x + 8, y: y + 8, vx: 1, vy: -3.5, t: 0 });
      } else {
        bumped = true;
        A.sfx('bump');
      }
    } else {
      A.sfx('bump');
    }
    if (bumped) st.bumps.push({ tx, ty, t: 0 });
    // things standing on the block get knocked
    const top = ty * 16;
    for (const e of st.ents) {
      if (e.dead || e.emerge > 0) continue;
      if (Math.abs(e.y + e.h - top) <= 3 && e.x + e.w > tx * 16 && e.x < tx * 16 + 16) {
        if (e.enemy) { flipKill(e, 100); }
        else if (e.item) { e.vy = -4; e.vx = Math.abs(e.vx || 1) * (e.x + 8 < m.x + m.w / 2 ? -1 : 1); }
      }
    }
    // coins sitting on top are collected
    if (tileAt(tx, ty - 1) === T.COIN) { setTile(tx, ty - 1, T.EMPTY); coinPop(tx, ty - 1); }
  }

  function coinPop(tx, ty) {
    st.parts.push({ k: 'coin', x: tx * 16, y: ty * 16 - 16, vy: -5.6, t: 0 });
    addCoin();
    A.sfx('coin');
  }

  function spawnContent(c, tx, ty) {
    const m = st.mario;
    if (c === 'coin') { coinPop(tx, ty); return; }
    let type = c;
    if (c === 'power') type = m.big ? 'flower' : 'mushroom';
    if (c === '1up') type = 'oneup';
    A.sfx('powerup_appear');
    st.ents.push({
      item: true, type, x: tx * 16, y: ty * 16, w: 16, h: 16, vx: 0, vy: 0, emerge: 32, t: 0,
      dir: 1,
    });
  }

  /* =====================================================================
     enemies
     ===================================================================== */
  function spawnEnemies() {
    const a = st.area;
    a.enemies.forEach((e, i) => {
      if (st.spawned.has(i)) return;
      if (e.x < st.cam + W + 24 && e.x > st.cam - 32) {
        st.spawned.add(i);
        const loopBoost = 1 + P().loop * 0.25;
        if (e.type === 'goomba') st.ents.push({ enemy: true, type: 'goomba', x: e.x, y: e.y, w: 16, h: 16, vx: -0.5 * loopBoost, vy: 0, state: 'walk', t: 0 });
        else st.ents.push({ enemy: true, type: 'koopa', x: e.x, y: e.y + 8, w: 16, h: 16, vx: -0.5 * loopBoost, vy: 0, state: 'walk', t: 0, shellT: 0, chain: 0 });
      } else if (e.x <= st.cam - 32) st.spawned.add(i);
    });
  }

  function flipKill(e, score) {
    e.dead = true;
    e.state = 'flip';
    e.vy = -3.5;
    e.vx = e.vx >= 0 ? 0.6 : -0.6;
    A.sfx('kick');
    if (score) addScore(score, e.x, e.y - 8);
  }

  function enemyBox(e) {
    return { x: e.x + 2, y: e.y + (e.type === 'koopa' && e.state === 'walk' ? -6 : 3), w: 12, h: e.type === 'koopa' && e.state === 'walk' ? 22 : 13 };
  }

  function updateEnemy(e) {
    e.t++;
    if (e.state === 'flip') {
      e.vy += 0.3;
      e.x += e.vx;
      e.y += e.vy;
      if (e.y > H + 16) e.remove = true;
      return;
    }
    if (e.state === 'flat') {
      if (e.t > 30) e.remove = true;
      return;
    }
    if (e.type === 'koopa' && e.state === 'shell') {
      e.shellT++;
      if (e.shellT > 60 * 10) {
        e.state = 'walk';
        e.vx = st.mario.x < e.x ? -0.5 : 0.5;
        e.shellT = 0;
      }
    }
    e.vy = Math.min(e.vy + 0.3, 4);
    if (moveX(e)) {
      e.vx = -e.vx;
      if (e.state === 'slide' && Math.abs(e.x - st.cam) < W) A.sfx('bump');
    }
    moveY(e);
    if (e.y > H + 16) e.remove = true;
  }

  function enemyInteractions() {
    const list = st.ents.filter((e) => e.enemy && !e.dead && e.state !== 'flat');
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!U.overlap(a, b)) continue;
        const aSlide = a.state === 'slide', bSlide = b.state === 'slide';
        if (aSlide && !bSlide) { chainScore(SHELL_SCORES, a.chain++, b.x, b.y - 8); flipKill(b); }
        else if (bSlide && !aSlide) { chainScore(SHELL_SCORES, b.chain++, a.x, a.y - 8); flipKill(a); }
        else if (aSlide && bSlide) { flipKill(a); flipKill(b); }
        else {
          // bounce off each other
          if (a.x < b.x) { a.vx = -Math.abs(a.vx); b.vx = Math.abs(b.vx); }
          else { a.vx = Math.abs(a.vx); b.vx = -Math.abs(b.vx); }
        }
      }
    }
  }

  function marioVsEnemies() {
    const m = st.mario;
    if (m.dead) return;
    const mb = { x: m.x + 1, y: m.y + 1, w: m.w - 2, h: m.h - 1 };
    for (const e of st.ents) {
      if (!e.enemy || e.dead || e.state === 'flat') continue;
      const eb = enemyBox(e);
      if (!U.overlap(mb, eb)) continue;
      if (m.star > 0) {
        chainScore(STOMP_SCORES, 0, e.x, e.y - 8);
        flipKill(e);
        continue;
      }
      const falling = m.vy > 0 && m.prevBottom <= eb.y + 5;
      if (falling) {
        // stomp
        m.vy = GW.input.held.a ? -5 : -3.6;
        m.y = eb.y - m.h;
        if (e.type === 'goomba') {
          e.state = 'flat'; e.t = 0; e.vx = 0;
          A.sfx('stomp');
          chainScore(STOMP_SCORES, m.stompChain++, e.x, e.y - 8);
        } else if (e.state === 'walk') {
          e.state = 'shell'; e.vx = 0; e.shellT = 0; e.chain = 0;
          A.sfx('stomp');
          chainScore(STOMP_SCORES, m.stompChain++, e.x, e.y - 8);
        } else if (e.state === 'slide') {
          e.state = 'shell'; e.vx = 0; e.shellT = 0;
          A.sfx('stomp');
          chainScore(STOMP_SCORES, m.stompChain++, e.x, e.y - 8);
        } else if (e.state === 'shell') {
          kickShell(e);
        }
        continue;
      }
      if (e.type === 'koopa' && e.state === 'shell') { kickShell(e); m.kickT = 12; continue; }
      if (m.kickT > 0) continue;
      hurtMario();
    }
  }

  function kickShell(e) {
    const m = st.mario;
    const dir = m.x + m.w / 2 < e.x + 8 ? 1 : -1;
    e.state = 'slide';
    e.vx = dir * 3;
    e.chain = 0;
    e.shellT = 0;
    e.x += dir * 4;
    A.sfx('kick');
    addScore(400, e.x, e.y - 8);
  }

  /* =====================================================================
     items
     ===================================================================== */
  function updateItem(e) {
    e.t++;
    if (e.emerge > 0) {
      e.y -= 0.5;
      e.emerge--;
      if (e.emerge === 0) {
        if (e.type === 'mushroom' || e.type === 'oneup') e.vx = 1;
        if (e.type === 'star') { e.vx = 1; e.vy = -4; }
      }
      return;
    }
    if (e.type === 'flower') return;
    e.vy = Math.min(e.vy + (e.type === 'star' ? 0.22 : 0.3), 4);
    if (moveX(e)) e.vx = -e.vx;
    const r = moveY(e);
    if (e.type === 'star' && r === 'down') e.vy = -4.2;
    if (e.y > H + 16) e.remove = true;
  }

  function marioVsItems() {
    const m = st.mario;
    for (const e of st.ents) {
      if (!e.item || e.remove || e.emerge > 20) continue;
      if (!U.overlap({ x: m.x, y: m.y, w: m.w, h: m.h }, { x: e.x + 2, y: e.y + 2, w: 12, h: 14 })) continue;
      e.remove = true;
      if (e.type === 'oneup') { oneUp(e.x, e.y - 8); continue; }
      addScore(1000, e.x, e.y - 8);
      if (e.type === 'mushroom') {
        if (!m.big) startGrow('big'); else A.sfx('powerup');
      } else if (e.type === 'flower') {
        if (!m.big) startGrow('big');
        else if (!m.fire) startGrow('fire');
        else A.sfx('powerup');
      } else if (e.type === 'star') {
        m.star = 60 * 11;
        A.sfx('powerup');
        playLevelMusic();
      }
    }
  }

  function startGrow(kind) {
    st.grow = { kind, t: 0 };
    A.sfx('powerup');
  }

  function hurtMario() {
    const m = st.mario;
    if (m.invuln > 0 || m.dead) return;
    if (m.big) {
      st.grow = { kind: 'shrink', t: 0 };
      A.sfx('pipe');
    } else die(false);
  }

  function die(pit) {
    const m = st.mario;
    if (m.dead) return;
    m.dead = true;
    m.star = 0;
    st.seq = { kind: 'death', t: 0, pit };
    A.music.play('death', { restart: true });
  }

  /* =====================================================================
     Mario
     ===================================================================== */
  function updateMario(I) {
    const m = st.mario;
    const a = st.area;
    if (m.invuln > 0) m.invuln--;
    if (m.kickT > 0) m.kickT--;
    if (m.throwT > 0) m.throwT--;
    if (m.star > 0) {
      m.star--;
      if (m.star === 0) playLevelMusic();
    }

    const left = I.held.left, right = I.held.right, run = I.held.b;
    // crouch
    const wantCrouch = m.big && I.held.down && m.onGround;
    if (wantCrouch !== m.crouch) {
      const bottom = m.y + m.h;
      m.crouch = wantCrouch;
      m.h = m.big && !m.crouch ? 28 : 14;
      m.y = bottom - m.h;
    }

    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (m.crouch && m.onGround) dir = 0;
    const maxSpd = run ? 2.5 : 1.5;
    m.skid = false;
    if (dir) {
      if (m.onGround) m.facing = dir;
      if (m.onGround && m.vx * dir < -0.4) {
        m.vx += dir * 0.18;
        m.skid = true;
      } else if (m.vx * dir < maxSpd) {
        m.vx += dir * (run ? 0.075 : 0.055);
        if (m.vx * dir > maxSpd) m.vx = dir * maxSpd;
      } else if (m.onGround) {
        m.vx = U.approach(m.vx, dir * maxSpd, 0.06);
      }
    } else if (m.onGround) {
      m.vx = U.approach(m.vx, 0, m.crouch ? 0.05 : 0.07);
    }
    m.vx = U.clamp(m.vx, -2.5, 2.5);

    // jump
    if (I.pressed.a && m.onGround) {
      m.vy = -(4.0 + Math.min(Math.abs(m.vx), 2.5) * 0.22);
      m.onGround = false;
      A.sfx(m.big ? 'bigjump' : 'jump');
    }
    // fireball
    if (m.fire && I.pressed.b && st.fireballs.length < 2 && !m.crouch) {
      st.fireballs.push({ x: m.x + (m.facing > 0 ? m.w : -8), y: m.y + 6, w: 8, h: 8, vx: m.facing * 4, vy: 2, t: 0 });
      m.throwT = 8;
      A.sfx('fireball');
    }

    const g = m.vy < 0 && I.held.a ? 0.14 : 0.42;
    m.vy = Math.min(m.vy + g, 4.5);

    // horizontal movement with tile collision
    m.x += m.vx;
    if (m.x < st.cam) { m.x = st.cam; if (m.vx < 0) m.vx = 0; }
    if (m.x > a.w * 16 - m.w) { m.x = a.w * 16 - m.w; m.vx = 0; }
    {
      const y0 = Math.floor(m.y / 16), y1 = Math.floor((m.y + m.h - 0.01) / 16);
      if (m.vx > 0) {
        const tx = Math.floor((m.x + m.w - 0.01) / 16);
        for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { m.x = tx * 16 - m.w; m.vx = 0; break; }
      } else if (m.vx < 0) {
        const tx = Math.floor(m.x / 16);
        for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { m.x = (tx + 1) * 16; m.vx = 0; break; }
      }
    }

    // vertical movement
    m.prevBottom = m.y + m.h;
    const prevTop = m.y;
    m.y += m.vy;
    const wasGround = m.onGround;
    m.onGround = false;
    const x0 = Math.floor(m.x / 16), x1 = Math.floor((m.x + m.w - 0.01) / 16);
    if (m.vy >= 0) {
      const ty = Math.floor((m.y + m.h - 0.01) / 16);
      for (let tx = x0; tx <= x1; tx++) {
        if (solid(tx, ty) && m.prevBottom <= ty * 16 + 1) {
          m.y = ty * 16 - m.h; m.vy = 0; m.onGround = true; break;
        }
      }
    } else {
      const ty = Math.floor(m.y / 16);
      const hits = [];
      for (let tx = x0; tx <= x1; tx++) {
        const id = tileAt(tx, ty);
        if (solid(tx, ty) || (id === T.HIDDEN && prevTop >= (ty + 1) * 16 - 0.5)) hits.push(tx);
      }
      if (hits.length) {
        const cx = m.x + m.w / 2;
        // corner correction: slip past block edges
        if (hits.length === 1 && x0 !== x1) {
          const tx = hits[0];
          const overlap = tx === x0 ? (tx + 1) * 16 - m.x : m.x + m.w - tx * 16;
          if (overlap <= 4) {
            m.x = tx === x0 ? (tx + 1) * 16 : tx * 16 - m.w;
            hits.length = 0;
          }
        }
        if (hits.length) {
          let best = hits[0], bd = 999;
          for (const tx of hits) { const d = Math.abs(tx * 16 + 8 - cx); if (d < bd) { bd = d; best = tx; } }
          m.y = (ty + 1) * 16;
          m.vy = 1;
          bumpTile(best, ty);
        }
      }
    }
    if (m.onGround) m.stompChain = 0;
    if (m.onGround && !wasGround) m.skid = false;

    // coins in the level
    {
      const cx0 = Math.floor(m.x / 16), cx1 = Math.floor((m.x + m.w - 0.01) / 16);
      const cy0 = Math.floor(m.y / 16), cy1 = Math.floor((m.y + m.h - 0.01) / 16);
      for (let ty = cy0; ty <= cy1; ty++) for (let tx = cx0; tx <= cx1; tx++) {
        if (tileAt(tx, ty) === T.COIN) {
          setTile(tx, ty, T.EMPTY);
          addCoin();
          addScore(200);
          A.sfx('coin');
        }
      }
    }

    m.anim += Math.abs(m.vx) * 0.16 + (Math.abs(m.vx) > 0.05 ? 0.04 : 0);

    // checkpoint
    if (st.areaName === 'main' && st.def.checkpoint && m.x > st.def.checkpoint) P().checkpoint = true;

    // pit
    if (m.y > H + 8) die(true);

    // pipes: enter going down
    if (m.onGround && I.held.down) {
      for (const p of a.pipes) {
        if (!p.warp || p.warp.mode !== 'down') continue;
        const cxm = m.x + m.w / 2;
        if (Math.abs(m.y + m.h - p.y * 16) < 1 && cxm > p.x * 16 + 6 && cxm < p.x * 16 + 26) {
          st.seq = { kind: 'pipeDown', t: 0, pipe: p };
          m.vx = 0; m.behind = true;
          m.x = p.x * 16 + 10;
          A.music.stop();
          A.sfx('pipe');
        }
      }
    }
    // side pipe (bonus room exit)
    if (a.sidePipe && m.onGround && I.held.right) {
      const sp = a.sidePipe;
      if (m.x + m.w >= sp.x * 16 - 0.5 && m.y + m.h > sp.y * 16) {
        st.seq = { kind: 'pipeSide', t: 0, warp: sp.warp };
        m.behind = true;
        A.music.stop();
        A.sfx('pipe');
      }
    }
    // flagpole
    if (a.flag && m.x + m.w >= a.flag.x - 1 && !st.seq) grabFlag();
  }

  function updateFireballs() {
    for (const f of st.fireballs) {
      f.t++;
      f.vy = Math.min(f.vy + 0.35, 4);
      if (moveX(f)) { f.remove = true; st.parts.push({ k: 'boom', x: f.x - 4, y: f.y - 4, t: 0 }); A.sfx('bump'); continue; }
      const r = moveY(f);
      if (r === 'down') f.vy = -3;
      if (f.x < st.cam - 16 || f.x > st.cam + W + 16 || f.y > H) f.remove = true;
      for (const e of st.ents) {
        if (!e.enemy || e.dead || e.state === 'flat') continue;
        if (U.overlap(f, enemyBox(e))) {
          flipKill(e, 200);
          f.remove = true;
          st.parts.push({ k: 'boom', x: f.x - 4, y: f.y - 4, t: 0 });
          break;
        }
      }
    }
    st.fireballs = st.fireballs.filter((f) => !f.remove);
  }

  function updateParts() {
    for (const p of st.parts) {
      p.t++;
      if (p.k === 'debris') { p.vy += 0.35; p.x += p.vx; p.y += p.vy; if (p.y > H) p.remove = true; }
      else if (p.k === 'coin') {
        p.y += p.vy; p.vy += 0.36;
        if (p.t > 28) { p.remove = true; st.pops.push({ x: p.x, y: p.y, txt: '200', t: 0 }); P().score += 200; }
      } else if (p.k === 'boom') { if (p.t > 12) p.remove = true; }
      else if (p.k === 'firework') { if (p.t > 30) p.remove = true; }
    }
    st.parts = st.parts.filter((p) => !p.remove);
    for (const p of st.pops) { p.t++; p.y -= 0.8; }
    st.pops = st.pops.filter((p) => p.t < 40);
    for (const b of st.bumps) b.t++;
    st.bumps = st.bumps.filter((b) => b.t < 10);
    for (const k of Object.keys(st.multi)) if (st.multi[k] > 0) st.multi[k]--;
  }

  function updateCamera() {
    const m = st.mario;
    const a = st.area;
    const target = m.x + m.w / 2 - 112;
    if (target > st.cam) st.cam = Math.min(target, a.w * 16 - W);
    if (st.cam < 0) st.cam = 0;
  }

  function updateTimer() {
    if (st.areaName !== 'main' && st.area.style !== 'underground') return;
    if (++st.timeT >= 24) {
      st.timeT = 0;
      if (st.time > 0) st.time--;
      if (st.time === 100 && !st.hurry) {
        st.hurry = true;
        A.music.play('hurry', { restart: true, onEnd: () => { if (st && st.mode === 'play' && !st.seq) playLevelMusic(); } });
      }
      if (st.time === 0) { st.timeUp = true; die(false); }
    }
  }

  /* =====================================================================
     flagpole / castle
     ===================================================================== */
  function grabFlag() {
    const m = st.mario;
    const f = st.area.flag;
    const height = f.bottom - (m.y + m.h);
    const score = height >= 128 ? 5000 : height >= 96 ? 2000 : height >= 64 ? 800 : height >= 32 ? 400 : 100;
    addScore(score, f.x + 6, m.y);
    m.x = f.x - m.w + 1;
    m.vx = 0; m.vy = 0;
    m.climb = true;
    m.star = 0;
    st.seq = { kind: 'flag', t: 0, phase: 'slide', flagY: f.top + 9, digit: st.time % 10, fireworks: 0 };
    A.music.stop();
    A.sfx('flagpole');
  }

  function runFlag() {
    const s = st.seq;
    const m = st.mario;
    const f = st.area.flag;
    s.t++;
    if (s.phase === 'slide') {
      if (m.y + m.h < f.bottom) m.y = Math.min(m.y + 2, f.bottom - m.h);
      if (s.flagY < f.bottom - 16) s.flagY = Math.min(s.flagY + 2, f.bottom - 16);
      m.anim += 0.15;
      if (m.y + m.h >= f.bottom && s.flagY >= f.bottom - 16) { s.phase = 'turn'; s.t = 0; m.x = f.x + 2; m.facing = -1; }
    } else if (s.phase === 'turn') {
      if (s.t > 22) {
        s.phase = 'walk'; s.t = 0; m.climb = false; m.facing = 1;
        m.x = f.x + 8; m.vy = -1;
        A.music.play('clear', { restart: true });
      }
    } else if (s.phase === 'walk') {
      m.vx = 1.2;
      m.vy = Math.min(m.vy + 0.42, 4.5);
      m.x += m.vx;
      m.y += m.vy;
      const ty = Math.floor((m.y + m.h - 0.01) / 16);
      const tx = Math.floor((m.x + m.w / 2) / 16);
      if (solid(tx, ty)) { m.y = ty * 16 - m.h; m.vy = 0; m.onGround = true; } else m.onGround = false;
      m.anim += 0.2;
      const door = st.area.castle ? st.area.castle.x + 34 : f.x + 64;
      if (m.x >= door) { m.hidden = true; s.phase = 'tally'; s.t = 0; }
    } else if (s.phase === 'tally') {
      if (s.t > 30) {
        if (st.time > 0) {
          const d = Math.min(2, st.time);
          st.time -= d;
          P().score += 50 * d;
          if (s.t % 3 === 0) A.sfx('count');
        } else {
          s.phase = 'flag'; s.t = 0;
          s.fireworks = [1, 3, 6].includes(s.digit) ? s.digit : 0;
        }
      }
    } else if (s.phase === 'flag') {
      if (s.t > 40) { s.phase = 'fireworks'; s.t = 0; s.n = 0; }
    } else if (s.phase === 'fireworks') {
      if (s.n < s.fireworks && s.t % 36 === 1) {
        const c = st.area.castle;
        const x = (c ? c.x : f.x) + U.randInt(-24, 96), y = U.randInt(40, 110);
        st.parts.push({ k: 'firework', x, y, t: 0 });
        addScore(500);
        A.sfx('firework');
        s.n++;
      }
      if (s.n >= s.fireworks && s.t > 36 * s.fireworks + 60) nextLevel();
    }
  }

  function nextLevel() {
    const p = P();
    p.big = st.mario.big;
    p.fire = st.mario.fire;
    p.checkpoint = false;
    p.level++;
    if (p.level % GW.MarioLevelOrder.length === 0) {
      p.loop++;
      setMode('congrats');
      A.music.play('castle_clear', { restart: true });
      return;
    }
    setMode('intro');
  }

  /* =====================================================================
     sequences: pipes and death
     ===================================================================== */
  function runSeq() {
    const s = st.seq;
    const m = st.mario;
    if (s.kind === 'flag') return runFlag();
    s.t++;
    if (s.kind === 'pipeDown') {
      m.y += 1;
      if (s.t === 36) {
        const w = s.pipe.warp;
        const entry = st.areas[w.area].entry;
        const keep = { big: m.big, fire: m.fire, star: m.star };
        enterArea(w.area, entry.x, entry.y);
        Object.assign(st.mario, keep);
        setMarioSize(st.mario, keep.big);
        st.seq = null;
        playLevelMusic();
      }
    } else if (s.kind === 'pipeSide') {
      m.x += 0.8;
      m.anim += 0.12;
      if (s.t === 32) {
        const w = s.warp;
        const pipe = st.areas[w.area].pipes.find((p) => p.x === w.x);
        const keep = { big: m.big, fire: m.fire, star: m.star };
        enterArea(w.area, w.x * 16 + 10, pipe.y * 16);
        Object.assign(st.mario, keep);
        setMarioSize(st.mario, keep.big);
        st.mario.y = pipe.y * 16 + 2;
        st.mario.behind = true;
        st.cam = Math.max(0, Math.min(w.x * 16 - 96, st.area.w * 16 - W));
        // enemies left behind the camera stay gone
        st.area.enemies.forEach((e, i) => { if (e.x < st.cam + W) st.spawned.add(i); });
        st.seq = { kind: 'pipeUp', t: 0, top: pipe.y * 16 - st.mario.h };
        A.sfx('pipe');
        playLevelMusic();
      }
    } else if (s.kind === 'pipeUp') {
      m.y -= 1;
      if (m.y <= s.top) { m.y = s.top; m.behind = false; m.onGround = true; st.seq = null; }
    } else if (s.kind === 'death') {
      if (!s.pit) {
        if (s.t === 36) m.vy = -4.4;
        if (s.t > 36) { m.vy += 0.22; m.y += m.vy; }
      }
      if (s.t > 200) endDeath();
    }
  }

  function endDeath() {
    const p = P();
    p.lives--;
    p.big = false; p.fire = false;
    const timeUp = st.timeUp;
    if (p.lives <= 0) {
      GW.submitScore('mario', p.score);
      if (st.twoPlayer && st.players.some((q) => q.lives > 0)) {
        st.gameOverName = p.name;
        setMode('gameover');
        st.continueAfter = true;
      } else {
        st.continueAfter = false;
        setMode('gameover');
      }
      A.music.play('gameover', { restart: true });
      return;
    }
    if (st.twoPlayer) {
      const other = st.players[1 - st.cur];
      if (other.lives > 0) st.cur = 1 - st.cur;
    }
    st.timeUp = timeUp;
    setMode(timeUp ? 'timeup' : 'intro');
    A.music.stop();
  }

  /* =====================================================================
     main update
     ===================================================================== */
  app.update = function (I) {
    if (!st) app.launch();
    st.t++;
    st.modeT++;
    switch (st.mode) {
      case 'title': return updateTitle(I);
      case 'intro':
        if (st.modeT >= 150) { loadLevel(); setMode('play'); playLevelMusic(); }
        return;
      case 'timeup':
        if (st.modeT >= 120) setMode('intro');
        return;
      case 'gameover':
        if (st.modeT >= 240 || (st.modeT > 60 && I.pressed.a)) {
          if (st.continueAfter) {
            st.cur = st.players.findIndex((q) => q.lives > 0);
            setMode('intro');
          } else {
            app.launch();
          }
        }
        return;
      case 'congrats':
        if (st.modeT >= 300 || (st.modeT > 90 && I.pressed.a)) setMode('intro');
        return;
      case 'play': return updatePlay(I);
    }
  };

  function updateTitle(I) {
    if (I.pressed.up || I.pressed.down || (I.pressed.b && !I.pressed.a)) { st.titleSel = 1 - st.titleSel; A.sfx('move'); }
    if (I.pressed.a) { A.sfx('select'); startGame(st.titleSel === 1); }
  }

  function updatePlay(I) {
    if (st.grow) return updateGrow();
    if (st.seq) {
      runSeq();
      updateParts();
      if (st.seq && st.seq.kind === 'flag') updateCamera();
      return;
    }
    updateTimer();
    if (st.seq) return;
    updateMario(I);
    if (st.seq || st.grow) { updateParts(); return; }
    spawnEnemies();
    for (const e of st.ents) {
      if (e.enemy) updateEnemy(e); else updateItem(e);
    }
    enemyInteractions();
    marioVsEnemies();
    marioVsItems();
    updateFireballs();
    updateParts();
    st.ents = st.ents.filter((e) => !e.remove && e.x > st.cam - 64);
    updateCamera();
  }

  function updateGrow() {
    const gr = st.grow;
    const m = st.mario;
    gr.t++;
    if (gr.t >= 48) {
      if (gr.kind === 'big') setMarioSize(m, true);
      else if (gr.kind === 'fire') m.fire = true;
      else if (gr.kind === 'shrink') { m.fire = false; setMarioSize(m, false); m.invuln = 120; }
      st.grow = null;
    }
  }

  /* =====================================================================
     drawing
     ===================================================================== */
  function tileset() { return st.area.style === 'underground' ? S.tiles.u : S.tiles.o; }

  function drawHud(g, opts) {
    opts = opts || {};
    const white = '#FCFCFC';
    const p = st.players ? P() : { name: 'MARIO', score: 0, coins: 0 };
    GW.text(g, p.name, 24, 16, white);
    GW.text(g, U.pad(p.score, 6), 24, 24, white);
    GW.draw(g, S.hudcoin[Math.floor(st.t / 8) % 4], 89, 24);
    GW.text(g, '×' + U.pad(p.coins, 2), 96, 24, white);
    GW.text(g, 'WORLD', 144, 16, white);
    GW.text(g, opts.world || st.world || '1-1', 152, 24, white);
    GW.text(g, 'TIME', 200, 16, white);
    if (opts.time !== false && st.mode === 'play') GW.text(g, U.pad(st.time, 3), 208, 24, white);
  }

  function marioSprite(m, forceSmall, forceBig) {
    const p = P();
    let pal = m.fire ? 'fire' : p.pal;
    if (m.star > 0) {
      const cyc = ['star1', 'star2', 'star3', pal];
      pal = cyc[Math.floor(st.t / (m.star < 120 ? 8 : 3)) % 4];
    }
    const set = S.mario[pal];
    const big = forceBig || (m.big && !forceSmall);
    const pre = big ? 'M_' : 'm_';
    let f = 'stand';
    if (m.dead) return set.m_dead;
    if (m.climb) f = Math.floor(m.anim) % 2 ? 'climb2' : 'climb1';
    else if (m.crouch && big) f = 'crouch';
    else if (!m.onGround) f = 'jump';
    else if (m.skid) f = 'skid';
    else if (Math.abs(m.vx) > 0.05) f = ['walk1', 'walk2', 'walk3'][Math.floor(m.anim) % 3];
    return set[pre + f] || set[pre + 'stand'];
  }

  function drawMario(g, cam) {
    const m = st.mario;
    if (m.hidden) return;
    if (m.invuln > 0 && Math.floor(m.invuln / 2) % 2 === 0 && !st.grow) return;
    let spr;
    if (st.grow) {
      const alt = Math.floor(st.grow.t / 4) % 2 === 0;
      if (st.grow.kind === 'big') spr = marioSprite(m, alt, !alt);
      else if (st.grow.kind === 'shrink') spr = marioSprite(m, !alt, alt);
      else {
        const pals = ['fire', 'star2', 'star1', P().pal];
        spr = S.mario[pals[Math.floor(st.grow.t / 3) % 4]][m.crouch ? 'M_crouch' : 'M_stand'];
      }
    } else spr = marioSprite(m);
    const sx = Math.round(m.x - cam) - 2;
    const sy = Math.round(m.y + m.h) - spr.h;
    GW.draw(g, spr, sx, sy, m.facing < 0 && !m.dead);
  }

  function drawPipes(g, cam) {
    const a = st.area;
    const pipeSpr = S.pipe;
    for (const p of a.pipes) {
      const px = p.x * 16 - cam;
      if (px < -32 || px > W) continue;
      if (!p.noLip) GW.draw(g, pipeSpr.lip, px, p.y * 16);
      for (let y = p.y + (p.noLip ? 0 : 1); y <= p.y + p.h; y++) {
        if (y < 0 || y > 12) continue;
        GW.draw(g, pipeSpr.body, px, y * 16);
      }
    }
    if (a.sidePipe) {
      const sp = a.sidePipe;
      GW.draw(g, pipeSpr.sideLip, sp.x * 16 - cam, sp.y * 16);
      GW.draw(g, pipeSpr.sideBody, (sp.x + 1) * 16 - cam, sp.y * 16);
      GW.draw(g, pipeSpr.sideBody, (sp.x + 2) * 16 - cam, sp.y * 16);
    }
  }

  function drawWorld(g) {
    const a = st.area;
    const cam = Math.floor(st.cam);
    const ts = tileset();
    g.fillStyle = a.style === 'overworld' ? SMB.sky : '#000';
    g.fillRect(0, 0, W, H);

    for (const s of a.scenery) {
      const x = s.x - cam;
      if (x < -90 || x > W) continue;
      const spr = { hillBig: S.hillBig, hillSmall: S.hillSmall, bush1: S.bush[0], bush2: S.bush[1], bush3: S.bush[2], cloud1: S.cloud[0], cloud2: S.cloud[1], cloud3: S.cloud[2] }[s.k];
      GW.draw(g, spr, x, s.y);
    }
    if (a.castle) {
      const cx = a.castle.x - cam;
      if (cx > -90 && cx < W) {
        GW.draw(g, S.castle, cx, a.castle.y);
        const s = st.seq;
        if (s && s.kind === 'flag' && (s.phase === 'flag' || s.phase === 'fireworks')) {
          const rise = Math.min(14, s.phase === 'flag' ? s.t / 2 : 14);
          g.fillStyle = '#FCFCFC';
          g.fillRect(cx + 38, a.castle.y - rise, 1, rise);
          GW.draw(g, S.flag, cx + 39, a.castle.y - rise - 2, true);
        }
      }
    }
    if (a.flag) {
      const fx = a.flag.x - cam;
      if (fx > -20 && fx < W + 20) {
        g.fillStyle = '#80D010';
        g.fillRect(fx, a.flag.top + 8, 2, a.flag.bottom - a.flag.top - 8);
        GW.draw(g, S.poleTop, fx - 3, a.flag.top);
        const fy = st.seq && st.seq.kind === 'flag' ? st.seq.flagY : a.flag.top + 9;
        GW.draw(g, S.flag, fx - 16, fy);
      }
    }

    // emerging items sit behind blocks
    for (const e of st.ents) if (e.item && e.emerge > 0) drawItem(g, e, cam);
    if (st.mario.behind) drawMario(g, cam);

    drawPipes(g, cam);

    // tiles
    const tx0 = Math.floor(cam / 16), tx1 = Math.min(a.w - 1, tx0 + 17);
    const qf = [0, 0, 0, 1, 2, 1][Math.floor(st.t / 8) % 6];
    const coinSet = a.style === 'underground' ? S.coinU : S.coin;
    for (let ty = 0; ty < 15; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = a.tiles[ty * a.w + tx];
        if (!id || id === T.PIPE || id === T.HIDDEN) continue;
        let y = ty * 16;
        const b = st.bumps.find((bb) => bb.tx === tx && bb.ty === ty);
        if (b) y -= Math.round(Math.sin((b.t / 10) * Math.PI) * 6);
        const x = tx * 16 - cam;
        let spr;
        switch (id) {
          case T.GROUND: spr = ts.ground; break;
          case T.BRICK: spr = ts.brick; break;
          case T.Q: spr = S.q[qf]; break;
          case T.USED: spr = ts.used; break;
          case T.HARD: spr = ts.hard; break;
          case T.COIN: spr = coinSet[qf]; break;
        }
        if (spr) GW.draw(g, spr, x, y);
      }
    }

    for (const e of st.ents) {
      if (e.item && e.emerge <= 0) drawItem(g, e, cam);
      else if (e.enemy) drawEnemy(g, e, cam);
    }
    for (const f of st.fireballs) {
      const r = Math.floor(f.t / 3) % 4;
      const fx = Math.round(f.x - cam), fy = Math.round(f.y);
      g.fillStyle = '#E04018';
      g.fillRect(fx + 1, fy + 1, 6, 6);
      g.fillStyle = '#FC9838';
      g.fillRect(fx + 2, fy + 2, 4, 4);
      g.fillStyle = '#FCFCB0';
      const o = [[2, 2], [4, 2], [4, 4], [2, 4]][r];
      g.fillRect(fx + o[0], fy + o[1], 2, 2);
    }
    if (!st.mario.behind) drawMario(g, cam);

    for (const p of st.parts) {
      const x = Math.round(p.x - cam), y = Math.round(p.y);
      if (p.k === 'debris') GW.draw(g, a.style === 'underground' ? S.debrisU : S.debris, x, y, p.t % 8 < 4);
      else if (p.k === 'coin') GW.draw(g, S.spin[Math.floor(p.t / 3) % 4], x, y);
      else if (p.k === 'boom') {
        const r = 1 + p.t * 0.5;
        g.fillStyle = p.t < 6 ? '#FCFCB0' : '#E04018';
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4;
          g.fillRect(Math.round(x + 8 + Math.cos(ang) * r) - 1, Math.round(y + 8 + Math.sin(ang) * r) - 1, 2, 2);
        }
      } else if (p.k === 'firework') {
        const r = 3 + p.t * 0.6;
        const col = p.t < 10 ? '#FCFCFC' : p.t < 20 ? '#F8B800' : '#E04018';
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          g.fillStyle = col;
          g.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r), 2, 2);
        }
      }
    }
    for (const p of st.pops) GW.text(g, p.txt, Math.round(p.x - cam), Math.round(p.y), '#FCFCFC', { small: true });

    drawHud(g);
  }

  function drawItem(g, e, cam) {
    const x = Math.round(e.x - cam), y = Math.round(e.y);
    let spr;
    if (e.type === 'mushroom') spr = S.mushroom;
    else if (e.type === 'oneup') spr = S.oneup;
    else if (e.type === 'flower') spr = S.flower[Math.floor(st.t / 4) % 4];
    else if (e.type === 'star') spr = S.star[Math.floor(st.t / 4) % 4];
    if (spr) GW.draw(g, spr, x, y);
  }

  function drawEnemy(g, e, cam) {
    const x = Math.round(e.x - cam), y = Math.round(e.y);
    if (x < -24 || x > W + 8) return;
    const under = st.area.style === 'underground';
    const flip = e.state === 'flip';
    if (e.type === 'goomba') {
      if (e.state === 'flat') GW.draw(g, under ? S.goombaFlatU : S.goombaFlat, x, y + 8);
      else GW.draw(g, under ? S.goombaU : S.goomba, x, y, Math.floor(e.t / 10) % 2 === 0, flip);
    } else {
      if (e.state === 'walk') GW.draw(g, Math.floor(e.t / 10) % 2 ? S.koopa1 : S.koopa2, x, y - 8, e.vx > 0);
      else if (e.state === 'shell' && e.shellT > 60 * 8) GW.draw(g, S.shellWake, x + (e.shellT % 8 < 4 ? 1 : 0), y);
      else GW.draw(g, S.shell, x, y, false, flip);
    }
  }

  /* ---------- title ---------- */
  const LOGO_CACHE = {};
  function logoLetters(g, text, x, y, sy, adv) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const lx = Math.round(x + i * adv);
      GW.text(g, ch, lx + 2, y + 2, '#000', { sx: 2, sy });
      GW.text(g, ch, lx, y, '#FCBCB0', { sx: 2, sy });
    }
  }
  function drawLogo(g) {
    if (!LOGO_CACHE.img) {
      LOGO_CACHE.img = GW.canvasSpr(176, 88, (c) => {
        c.fillStyle = '#C84C0C';
        c.fillRect(0, 0, 176, 88);
        c.fillStyle = '#000';
        c.fillRect(0, 87, 176, 1);
        c.fillRect(175, 0, 1, 88);
        c.fillStyle = '#FCBCB0';
        for (const [rx, ry] of [[3, 3], [170, 3], [3, 82], [170, 82]]) c.fillRect(rx, ry, 3, 3);
        c.fillStyle = '#000';
        for (const [rx, ry] of [[5, 5], [172, 5], [5, 84], [172, 84]]) c.fillRect(rx, ry, 1, 1);
        logoLetters(c, 'SUPER', 12, 8, 3, 16);
        logoLetters(c, 'MARIO BROS.', 7, 38, 6, 14.6);
      });
    }
    GW.draw(g, LOGO_CACHE.img, 40, 32);
  }

  function drawTitle(g) {
    g.fillStyle = SMB.sky;
    g.fillRect(0, 0, W, H);
    GW.draw(g, S.hillBig, 0, 208 - 35);
    GW.draw(g, S.bush[2], 184, 208 - 17);
    for (let x = 0; x < W; x += 16) { GW.draw(g, S.tiles.o.ground, x, 208); GW.draw(g, S.tiles.o.ground, x, 224); }
    GW.draw(g, S.mario.mario.m_stand, 40, 192);
    drawHud(g, { world: '1-1', time: false });
    drawLogo(g);
    GW.text(g, '©1985-2020 NINTENDO', 65, 121, '#FCBCB0');
    GW.text(g, '1 PLAYER GAME', 88, 144, '#FCFCFC');
    GW.text(g, '2 PLAYER GAME', 88, 160, '#FCFCFC');
    GW.draw(g, S.cursor, 72, st.titleSel ? 160 : 144);
    GW.text(g, 'TOP- ' + U.pad(Math.max(GW.save.scores.mario, P().score), 6), 96, 184, '#FCFCFC');
  }

  function drawIntro(g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const p = P();
    const lvl = levelName(p);
    drawHud(g, { world: lvl, time: false });
    GW.text(g, 'WORLD ' + lvl, 88, 80, '#FCFCFC');
    GW.draw(g, S.mario[p.pal].m_stand, 97, 102);
    GW.text(g, '×  ' + p.lives, 120, 106, '#FCFCFC');
    if (st.twoPlayer) GW.text(g, p.name, 128, 136, '#FCFCFC', { align: 'center' });
  }

  app.draw = function (g) {
    if (!st) app.launch();
    switch (st.mode) {
      case 'title': return drawTitle(g);
      case 'intro': return drawIntro(g);
      case 'timeup':
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        drawHud(g, { time: false });
        GW.text(g, 'TIME UP', 128, 116, '#FCFCFC', { align: 'center' });
        return;
      case 'gameover':
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        drawHud(g, { time: false });
        GW.text(g, (st.twoPlayer ? P().name + ' ' : '') + 'GAME OVER', 128, 116, '#FCFCFC', { align: 'center' });
        return;
      case 'congrats':
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        drawHud(g, { time: false });
        GW.text(g, 'THANK YOU ' + P().name + '!', 128, 84, '#FCFCFC', { align: 'center' });
        GW.text(g, 'YOUR QUEST CONTINUES', 128, 108, '#FCFCFC', { align: 'center' });
        GW.text(g, 'ENEMIES GET FASTER!', 128, 124, '#FCBCB0', { align: 'center' });
        GW.draw(g, S.mario[P().pal].M_jump, 120, 150 - Math.abs(Math.sin(st.t * 0.08)) * 16);
        return;
      case 'play': return drawWorld(g);
    }
  };
})();

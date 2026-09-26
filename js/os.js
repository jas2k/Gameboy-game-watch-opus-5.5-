/* Game & Watch OS — boot, home carousel, settings, pause overlay, alarm, transitions */
(function () {
  'use strict';
  const GW = window.GW;
  const I = GW.input;
  const U = GW.util;
  const A = GW.audio;
  const SMB = GW.SMB;

  const bufs = {};
  function buffer(w, h) {
    const key = w + 'x' + h;
    if (!bufs[key]) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      bufs[key] = { c, g, w, h };
    }
    return bufs[key];
  }

  const OS = (GW.os = {
    state: 'off',
    app: null,
    prevApp: null,
    paused: false,
    pauseSel: 0,
    t: 0,
    stateT: 0,
    sel: 0,
    selPos: 0,
    trans: null,
    toastMsg: '',
    toastT: 0,
    battery: null,
    alarm: { ringing: false, t: 0, lastKey: '' },
    settingsSel: 0,
    edit: null,
    confirm: 0,
    homeIdle: 0,
    bootT: 0,
    offT: 0,
  });

  /* ---------------- registry ---------------- */
  OS.cards = [
    { id: 'mario', name: 'SUPER MARIO BROS.', sub: () => 'TOP- ' + U.pad(GW.save.scores.mario, 6) },
    { id: 'flappy', name: 'FLAPPY BIRD', sub: () => 'BEST ' + GW.save.scores.flappy },
    { id: 'ball', name: 'BALL', sub: () => 'A ' + U.pad(GW.save.scores.ballA, 3) + '   B ' + U.pad(GW.save.scores.ballB, 3) },
    { id: 'clock', name: 'CLOCK', sub: () => {
      const d = GW.now();
      return GW.DAYS[d.getDay()] + ' ' + U.pad(d.getDate(), 2) + ' ' + GW.MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    } },
    { id: 'settings', name: 'SETTINGS', sub: () => 'VOLUME ' + GW.save.settings.volume + '  LIGHT ' + GW.save.settings.brightness },
  ];

  OS.init = function () {
    for (const k of Object.keys(GW.apps)) if (GW.apps[k].init) GW.apps[k].init(OS);
    if (navigator.getBattery) navigator.getBattery().then((b) => (OS.battery = b)).catch(() => {});
    GW.display.applySettings();
    OS.state = 'off';
    OS.offT = 999;
    OS.hint = true;
  };

  OS.toast = function (msg, frames) {
    OS.toastMsg = msg;
    OS.toastT = frames || 150;
  };

  OS.transition = function (kind, mid, opts) {
    OS.trans = { kind, t: 0, dur: (opts && opts.dur) || 14, mid, done: false, cx: opts && opts.cx, cy: opts && opts.cy };
  };

  function setState(s) {
    OS.state = s;
    OS.stateT = 0;
  }

  /* ---------------- app switching ---------------- */
  OS.openApp = function (id, opts) {
    opts = opts || {};
    const app = GW.apps[id];
    if (!app) return;
    const go = () => {
      A.music.stop();
      if (OS.app && OS.app !== app && OS.app.suspend) OS.app.suspend();
      if (OS.app && OS.app !== app) OS.prevApp = OS.app;
      OS.app = app;
      OS.paused = false;
      setState('app');
      if (app.hasState && app.hasState() && !opts.fresh) {
        if (app.resume) app.resume();
        if (app.pauseMode !== 'custom') { OS.paused = true; OS.pauseSel = 0; A.music.pause(); }
      } else {
        app.launch();
      }
    };
    if (opts.instant) go();
    else OS.transition(opts.kind || 'iris', go);
  };

  OS.goHome = function (instant) {
    const go = () => {
      if (OS.app && OS.app.suspend) OS.app.suspend();
      OS.prevApp = OS.app;
      OS.app = null;
      OS.paused = false;
      A.music.stop();
      const idx = OS.prevApp ? OS.cards.findIndex((c) => c.id === OS.prevApp.id) : -1;
      if (idx >= 0) { OS.sel = idx; OS.selPos = idx; }
      setState('home');
      OS.homeIdle = 0;
      if (GW.save.settings.menuMusic) A.music.play('menu');
    };
    if (instant) go(); else OS.transition('fade', go);
  };

  OS.openSettings = function () {
    OS.transition('fade', () => {
      if (OS.app && OS.app.suspend) OS.app.suspend();
      if (OS.app) OS.prevApp = OS.app;
      OS.app = null;
      OS.paused = false;
      A.music.stop();
      OS.settingsSel = 0;
      OS.edit = null;
      OS.confirm = 0;
      setState('settings');
    });
  };

  OS.powerOff = function () {
    A.sfx('power_off');
    A.music.stop();
    if (OS.app && OS.app.suspend) OS.app.suspend();
    OS.app = null;
    OS.paused = false;
    OS.offT = 0;
    setState('off');
  };

  OS.boot = function () {
    OS.hint = false;
    OS.bootT = 0;
    setState('boot');
  };

  /* ---------------- alarm ---------------- */
  function checkAlarm() {
    const s = GW.save.settings;
    if (!s.alarmOn) return;
    const d = GW.now();
    const key = d.toDateString() + ' ' + d.getHours() + ':' + d.getMinutes();
    if (d.getHours() === s.alarmH && d.getMinutes() === s.alarmM && OS.alarm.lastKey !== key) {
      OS.alarm.lastKey = key;
      OS.alarm.ringing = true;
      OS.alarm.t = 0;
      if (OS.state === 'off') OS.boot();
      if (!(OS.app && OS.app.id === 'clock')) OS.toast('ALARM ' + U.pad(s.alarmH, 2) + ':' + U.pad(s.alarmM, 2), 60 * 60);
    }
  }
  OS.stopAlarm = function () {
    if (!OS.alarm.ringing) return;
    OS.alarm.ringing = false;
    OS.toastT = Math.min(OS.toastT, 20);
  };

  /* ---------------- update ---------------- */
  let lastSecond = -1;
  OS.update = function () {
    OS.t++;
    OS.stateT++;
    if (OS.toastT > 0) OS.toastT--;

    const sec = Math.floor(Date.now() / 1000);
    if (sec !== lastSecond) { lastSecond = sec; checkAlarm(); }

    if (OS.alarm.ringing) {
      OS.alarm.t++;
      if (OS.alarm.t % 60 === 1) A.sfx('alarm');
      if (OS.alarm.t > 60 * 60) OS.stopAlarm();
      if (I.anyPressed(['a', 'b', 'pause', 'game', 'time'])) {
        OS.stopAlarm();
        I.eatAll();
        A.sfx('back');
      }
    }

    if (OS.trans) {
      const tr = OS.trans;
      tr.t++;
      if (!tr.done && tr.t >= tr.dur) { tr.done = true; if (tr.mid) tr.mid(); }
      if (tr.t >= tr.dur * 2) OS.trans = null;
      // keep animating the running app underneath, without input
      if (OS.state === 'app' && OS.app && !OS.paused && tr.done && OS.app.idleUpdate) OS.app.idleUpdate();
      return;
    }

    switch (OS.state) {
      case 'off': return updateOff();
      case 'boot': return updateBoot();
      case 'home': return updateHome();
      case 'settings': return updateSettings();
      case 'app': return updateApp();
    }
  };

  function updateOff() {
    OS.offT++;
    if (I.anyPressed()) { I.eatAll(); OS.boot(); }
  }

  function updateBoot() {
    OS.bootT++;
    if (OS.bootT === 1) A.sfx('power_on');
    if (OS.bootT === 70) A.music.play('boot');
    if (OS.bootT > 30 && I.anyPressed(['a', 'b', 'game', 'pause'])) { I.eatAll(); OS.bootT = 200; }
    if (OS.bootT >= 200) {
      OS.goHome();
    }
  }

  function updateHome() {
    const n = OS.cards.length;
    OS.homeIdle++;
    if (I.anyPressed()) OS.homeIdle = 0;
    if (I.repeat('right', 16, 7) || I.pressed.game) { OS.sel = (OS.sel + 1) % n; A.sfx('move'); if (OS.sel === 0) OS.selPos -= n; }
    if (I.repeat('left', 16, 7)) { OS.sel = (OS.sel - 1 + n) % n; A.sfx('move'); if (OS.sel === n - 1) OS.selPos += n; }
    OS.selPos += (OS.sel - OS.selPos) * 0.22;
    if (Math.abs(OS.sel - OS.selPos) < 0.002) OS.selPos = OS.sel;
    if (I.pressed.a) {
      const card = OS.cards[OS.sel];
      A.sfx('select');
      if (card.id === 'settings') OS.openSettings();
      else OS.openApp(card.id);
      return;
    }
    if (I.pressed.time) { A.sfx('select'); OS.openApp('clock'); return; }
    if (I.pressed.pause) { A.sfx('select'); OS.openSettings(); return; }
    // like the real unit: an idle Game & Watch shows the time
    if (OS.homeIdle > 60 * 75) { OS.homeIdle = 0; OS.openApp('clock', { kind: 'fade' }); }
  }

  function updateApp() {
    const app = OS.app;
    if (!app) return;
    if (OS.paused) return updatePauseMenu();
    if (I.pressed.game) { A.sfx('back'); OS.goHome(); return; }
    if (I.pressed.time) {
      if (app.id !== 'clock') { A.sfx('select'); OS.openApp('clock', { kind: 'fade' }); return; }
      A.sfx('back');
      if (OS.prevApp && OS.prevApp.id !== 'clock' && OS.prevApp.hasState && OS.prevApp.hasState()) {
        const back = OS.prevApp.id;
        OS.openApp(back, { kind: 'fade' });
      } else OS.goHome();
      return;
    }
    if (I.pressed.pause && app.pauseMode !== 'custom') {
      OS.paused = true;
      OS.pauseSel = 0;
      A.sfx('pause');
      A.music.pause();
      if (app.onPause) app.onPause();
      return;
    }
    app.update(I);
  }

  const PAUSE_ITEMS = ['CONTINUE', 'RESTART', 'HOME'];
  function updatePauseMenu() {
    if (I.repeat('down')) { OS.pauseSel = (OS.pauseSel + 1) % PAUSE_ITEMS.length; A.sfx('move'); }
    if (I.repeat('up')) { OS.pauseSel = (OS.pauseSel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; A.sfx('move'); }
    const resume = () => {
      OS.paused = false;
      A.music.resume();
      if (OS.app.onResume) OS.app.onResume();
    };
    if (I.pressed.pause || I.pressed.b) { A.sfx('pause'); resume(); return; }
    if (I.pressed.game) { A.sfx('back'); OS.goHome(); return; }
    if (I.pressed.a) {
      const item = PAUSE_ITEMS[OS.pauseSel];
      if (item === 'CONTINUE') { A.sfx('select'); resume(); }
      else if (item === 'RESTART') {
        A.sfx('select');
        OS.transition('iris', () => { OS.paused = false; A.music.stop(); OS.app.launch(); });
      } else { A.sfx('back'); OS.goHome(); }
    }
  }

  /* ---------------- settings ---------------- */
  const SETTINGS = [
    { key: 'volume', label: 'VOLUME', type: 'bar', min: 0, max: 5 },
    { key: 'brightness', label: 'BRIGHTNESS', type: 'bar', min: 1, max: 5 },
    { key: 'menuMusic', label: 'MENU MUSIC', type: 'bool' },
    { key: 'hour24', label: 'CLOCK', type: 'fmt' },
    { key: 'time', label: 'SET TIME', type: 'time' },
    { key: 'alarm', label: 'ALARM', type: 'alarm' },
    { key: 'lcdGrid', label: 'LCD PIXEL GRID', type: 'bool' },
    { key: 'sync', label: 'SYNC SYSTEM TIME', type: 'action' },
    { key: 'reset', label: 'RESET HIGH SCORES', type: 'action' },
    { key: 'off', label: 'POWER OFF', type: 'action' },
  ];
  OS.SETTINGS = SETTINGS;

  function applySetting() {
    GW.persist();
    GW.display.applySettings();
    A.setVolume();
  }

  function updateSettings() {
    const s = GW.save.settings;
    if (OS.edit) return updateEdit();
    if (I.pressed.b || I.pressed.game || I.pressed.pause) { A.sfx('back'); OS.goHome(); return; }
    if (I.pressed.time) { A.sfx('select'); OS.openApp('clock', { kind: 'fade' }); return; }
    const n = SETTINGS.length;
    if (I.repeat('down')) { OS.settingsSel = (OS.settingsSel + 1) % n; OS.confirm = 0; A.sfx('move'); }
    if (I.repeat('up')) { OS.settingsSel = (OS.settingsSel + n - 1) % n; OS.confirm = 0; A.sfx('move'); }
    const item = SETTINGS[OS.settingsSel];
    const dir = I.repeat('right', 16, 6) ? 1 : I.repeat('left', 16, 6) ? -1 : 0;
    if (item.type === 'bar' && dir) {
      const v = U.clamp(s[item.key] + dir, item.min, item.max);
      if (v !== s[item.key]) { s[item.key] = v; applySetting(); A.sfx('move'); } else A.sfx('error');
    }
    if ((item.type === 'bool' && (dir || I.pressed.a))) {
      s[item.key] = !s[item.key];
      applySetting();
      A.sfx('select');
      if (item.key === 'menuMusic') { if (s.menuMusic) A.music.play('menu'); else A.music.stop(); }
    }
    if (item.type === 'fmt' && (dir || I.pressed.a)) { s.hour24 = !s.hour24; applySetting(); A.sfx('select'); }
    if (item.type === 'time' && I.pressed.a) {
      const d = GW.now();
      OS.edit = { kind: 'time', h: d.getHours(), m: d.getMinutes(), field: 0 };
      A.sfx('select');
    }
    if (item.type === 'alarm') {
      if (dir) { s.alarmOn = !s.alarmOn; applySetting(); A.sfx('select'); }
      if (I.pressed.a) { OS.edit = { kind: 'alarm', h: s.alarmH, m: s.alarmM, field: 0 }; A.sfx('select'); }
    }
    if (item.type === 'action' && I.pressed.a) {
      if (item.key === 'sync') { s.timeOffset = 0; applySetting(); A.sfx('coin'); OS.toast('TIME SYNCED', 90); }
      if (item.key === 'reset') {
        if (OS.confirm) { GW.resetSave(); OS.confirm = 0; A.sfx('brick'); OS.toast('SCORES CLEARED', 90); }
        else { OS.confirm = 1; A.sfx('error'); }
      }
      if (item.key === 'off') OS.transition('fade', () => OS.powerOff(), { dur: 20 });
    }
  }

  function updateEdit() {
    const e = OS.edit;
    const s = GW.save.settings;
    if (I.repeat('left') || I.repeat('right')) { e.field = 1 - e.field; A.sfx('move'); }
    const d = I.repeat('up', 14, 4) ? 1 : I.repeat('down', 14, 4) ? -1 : 0;
    if (d) {
      if (e.field === 0) e.h = (e.h + d + 24) % 24;
      else e.m = (e.m + d + 60) % 60;
      A.sfx('tick');
    }
    if (I.pressed.b) { OS.edit = null; A.sfx('back'); return; }
    if (I.pressed.a || I.pressed.pause) {
      if (e.kind === 'time') {
        const real = new Date();
        const target = new Date(real.getTime());
        target.setHours(e.h, e.m, 0, 0);
        s.timeOffset = target.getTime() - real.getTime();
        OS.toast('TIME SET ' + U.pad(e.h, 2) + ':' + U.pad(e.m, 2), 90);
      } else {
        s.alarmH = e.h; s.alarmM = e.m; s.alarmOn = true;
        OS.toast('ALARM ' + U.pad(e.h, 2) + ':' + U.pad(e.m, 2) + ' ON', 90);
      }
      applySetting();
      OS.edit = null;
      A.sfx('coin');
    }
  }
  OS.updateEditExternal = updateEdit;

  /* ---------------- drawing ---------------- */
  OS.render = function () {
    let buf;
    if (OS.state === 'app' && OS.app) {
      const [w, h] = OS.app.res;
      buf = buffer(w, h);
      OS.app.draw(buf.g, OS.t);
      if (OS.paused) drawPause(buf.g, w, h);
    } else {
      buf = buffer(320, 240);
      const g = buf.g;
      switch (OS.state) {
        case 'off': drawOff(g); break;
        case 'boot': drawBoot(g); break;
        case 'home': drawHome(g); break;
        case 'settings': drawSettings(g); break;
      }
    }
    drawToast(buf.g, buf.w);
    if (OS.alarm.ringing && !(OS.app && OS.app.id === 'clock')) drawAlarmBadge(buf.g, buf.w);
    if (OS.trans) drawTransition(buf.g, buf.w, buf.h);
    GW.display.setRes(buf.w, buf.h);
    GW.display.present(buf.c);
  };

  function drawOff(g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 240);
    // CRT-like collapse right after power off
    if (OS.offT < 24) {
      const t = OS.offT / 24;
      const hh = Math.max(1, 240 * (1 - t) * (1 - t) * 0.5);
      const ww = t < 0.6 ? 320 : 320 * (1 - (t - 0.6) / 0.4);
      g.fillStyle = `rgba(255,255,255,${(1 - t) * 0.9})`;
      g.fillRect(160 - ww / 2, 120 - hh / 2, ww, hh);
    }
    if (OS.hint && Math.floor(OS.t / 40) % 2 === 0) GW.text(g, 'PRESS ANY BUTTON', 160, 116, '#3c3c3c', { align: 'center' });
  }

  function drawBoot(g) {
    const t = OS.bootT;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 240);
    if (t < 18) return;
    // logo reveal
    const k = U.clamp((t - 18) / 40, 0, 1);
    const reveal = Math.floor(U.ease(k) * 220);
    g.save();
    g.beginPath();
    g.rect(160 - reveal / 2, 40, reveal, 110);
    g.clip();
    GW.text(g, 'GAME', 160, 58, '#FCFCFC', { align: 'center', scale: 3 });
    GW.text(g, '&', 160, 86, '#FCFCFC', { align: 'center', scale: 2 });
    GW.text(g, 'WATCH', 160, 106, '#FCFCFC', { align: 'center', scale: 3 });
    g.restore();
    if (t > 60) {
      const c = t % 16 < 8 ? '#FCBCB0' : '#FC9838';
      GW.text(g, 'SUPER MARIO BROS.', 160, 148, t > 80 ? '#FCBCB0' : c, { align: 'center' });
    }
    // ground + running Mario
    if (t > 50) {
      for (let x = 0; x < 320; x += 16) GW.draw(g, GW.S.tiles.o.ground, x, 208);
      for (let x = 0; x < 320; x += 16) GW.draw(g, GW.S.tiles.o.ground, x, 224);
      const mx = -20 + (t - 50) * 2.4;
      const frames = ['m_walk1', 'm_walk2', 'm_walk3'];
      if (mx < 340) GW.draw(g, GW.S.mario.mario[frames[Math.floor(t / 4) % 3]], mx, 192);
    }
    if (t > 100) {
      const blink = Math.floor(t / 20) % 2 === 0;
      if (blink) GW.text(g, '©2026 GAME & WATCH OS', 160, 176, '#7C7C7C', { align: 'center', small: true });
    }
    if (t > 170) {
      const a = (t - 170) / 30;
      g.fillStyle = `rgba(0,0,0,${U.clamp(a, 0, 1)})`;
      g.fillRect(0, 0, 320, 240);
    }
  }

  // --- home ---
  const stars = [];
  for (let i = 0; i < 46; i++) stars.push([Math.random() * 320, Math.random() * 200 + 14, Math.random() * 3 | 0, Math.random() * 100]);

  function drawStatusBar(g, title) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 14);
    g.fillStyle = '#26213a';
    g.fillRect(0, 14, 320, 1);
    const d = GW.now();
    const s = GW.save.settings;
    let h = d.getHours();
    let suffix = '';
    if (!s.hour24) { suffix = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; }
    const colon = d.getSeconds() % 2 ? ':' : ' ';
    GW.text(g, U.pad(h, 2) + colon + U.pad(d.getMinutes(), 2) + (suffix ? ' ' + suffix : ''), 6, 4, '#FCFCFC', { small: true });
    if (s.alarmOn) GW.text(g, '♪', 6 + (suffix ? 44 : 26), 4, '#F8B800', { small: true });
    GW.text(g, title || 'GAME & WATCH', 160, 4, '#F8B800', { align: 'center', small: true });
    // volume
    const vx = 262;
    g.fillStyle = '#FCFCFC';
    g.fillRect(vx, 6, 2, 3); g.fillRect(vx + 2, 5, 1, 5); g.fillRect(vx + 3, 4, 1, 7);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < s.volume ? '#FCFCFC' : '#3a3a4a';
      g.fillRect(vx + 6 + i * 3, 10 - i, 2, i + 1);
    }
    // battery
    const bx = 290;
    const lvl = OS.battery ? OS.battery.level : 1;
    g.fillStyle = '#FCFCFC';
    g.fillRect(bx, 4, 20, 7);
    g.fillRect(bx + 20, 6, 2, 3);
    g.fillStyle = '#000';
    g.fillRect(bx + 1, 5, 18, 5);
    const cells = Math.max(1, Math.round(lvl * 4));
    for (let i = 0; i < cells; i++) {
      g.fillStyle = lvl < 0.2 ? '#E04018' : '#80D010';
      g.fillRect(bx + 2 + i * 4, 6, 3, 3);
    }
    if (OS.battery && OS.battery.charging) GW.text(g, '+', bx - 7, 4, '#F8B800', { small: true });
  }

  function drawHomeBg(g) {
    const grd = g.createLinearGradient(0, 0, 0, 240);
    grd.addColorStop(0, '#171a3a');
    grd.addColorStop(0.6, '#0c0d20');
    grd.addColorStop(1, '#07070f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 320, 240);
    for (const st of stars) {
      const tw = Math.sin((OS.t + st[3] * 10) * 0.05) > 0.6;
      g.fillStyle = st[2] === 0 ? '#FCFCFC' : st[2] === 1 ? '#8a8ab8' : '#4b4b78';
      const x = (st[0] - OS.t * (0.05 + st[2] * 0.03) + 320) % 320;
      g.fillRect(Math.floor(x), Math.floor(st[1]), tw && st[2] === 0 ? 2 : 1, 1);
    }
    // brick floor
    for (let x = 0; x < 320; x += 16) GW.draw(g, GW.S.tiles.o.ground, x, 224);
  }

  const CARD_W = 124, CARD_H = 92;
  function drawHome(g) {
    drawHomeBg(g);
    drawStatusBar(g);
    const n = OS.cards.length;
    const cx = 160, cy = 96;
    const spacing = 146;
    // draw neighbours first, selected last
    const order = [];
    for (let i = 0; i < n; i++) {
      let off = i - OS.selPos;
      while (off > n / 2) off -= n;
      while (off < -n / 2) off += n;
      order.push({ i, off });
    }
    order.sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
    for (const { i, off } of order) {
      if (Math.abs(off) > 1.6) continue;
      const x = Math.round(cx + off * spacing - CARD_W / 2);
      const y = Math.round(cy - CARD_H / 2 + Math.abs(off) * 8);
      drawCard(g, OS.cards[i], x, y, Math.abs(off) < 0.5);
      if (Math.abs(off) > 0.02) {
        g.fillStyle = `rgba(7,7,15,${U.clamp(Math.abs(off) * 0.6, 0, 0.7)})`;
        g.fillRect(x - 2, y - 2, CARD_W + 4, CARD_H + 4);
      }
    }
    // selection arrows
    const bob = Math.floor(OS.t / 12) % 2;
    GW.text(g, '◀', cx - CARD_W / 2 - 13 - bob, cy - 4, '#F8B800', { shadow: '#000' });
    GW.text(g, '▶', cx + CARD_W / 2 + 6 + bob, cy - 4, '#F8B800', { shadow: '#000' });
    const card = OS.cards[OS.sel];
    GW.text(g, card.name, 160, 156, '#FCFCFC', { align: 'center', shadow: '#000' });
    GW.text(g, card.sub(), 160, 170, '#9a9ac8', { align: 'center', small: true });
    // page dots
    for (let i = 0; i < n; i++) {
      const x = 160 - (n - 1) * 5 + i * 10;
      g.fillStyle = i === OS.sel ? '#F8B800' : '#3c3c64';
      g.fillRect(x - 1, 185, i === OS.sel ? 4 : 3, i === OS.sel ? 4 : 3);
    }
    // hints
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 199, 320, 14);
    GW.text(g, '◀▶ SELECT   A OPEN   TIME CLOCK   PAUSE/SET SETTINGS', 160, 203, '#bdbde0', { align: 'center', small: true });
  }

  function drawCard(g, card, x, y, active) {
    // frame
    g.fillStyle = '#000';
    g.fillRect(x - 3, y - 3, CARD_W + 6, CARD_H + 7);
    g.fillStyle = active ? '#F8B800' : '#5a5a80';
    g.fillRect(x - 2, y - 2, CARD_W + 4, CARD_H + 4);
    if (active) {
      g.fillStyle = '#FCFCB0';
      g.fillRect(x - 2, y - 2, CARD_W + 4, 1);
      g.fillStyle = '#C84C0C';
      g.fillRect(x - 2, y + CARD_H + 1, CARD_W + 4, 1);
    }
    g.save();
    g.beginPath();
    g.rect(x, y, CARD_W, CARD_H);
    g.clip();
    const art = ART[card.id];
    if (art) art(g, x, y, CARD_W, CARD_H, OS.t);
    g.restore();
  }

  /* card artwork */
  const ART = {
    mario(g, x, y, w, h, t) {
      g.fillStyle = SMB.sky;
      g.fillRect(x, y, w, h);
      GW.draw(g, GW.S.cloud[0], x + 70 - ((t * 0.2) % 180), y + 6);
      GW.draw(g, GW.S.hillBig, x - 18, y + h - 16 - 35);
      GW.draw(g, GW.S.bush[1], x + 70, y + h - 16 - 17);
      for (let i = 0; i < w; i += 16) GW.draw(g, GW.S.tiles.o.ground, x + i, y + h - 16);
      const qf = [0, 0, 0, 1, 2, 1][Math.floor(t / 8) % 6];
      GW.draw(g, GW.S.tiles.o.brick, x + 44, y + 28);
      GW.draw(g, GW.S.q[qf], x + 60, y + 28);
      GW.draw(g, GW.S.tiles.o.brick, x + 76, y + 28);
      const period = 300;
      const p = t % period;
      const dir = p < period / 2 ? 1 : -1;
      const mx = dir > 0 ? 8 + p * 0.6 : 8 + (period - p) * 0.6;
      const frames = ['m_walk1', 'm_walk2', 'm_walk3'];
      GW.draw(g, GW.S.mario.mario[frames[Math.floor(t / 5) % 3]], x + mx, y + h - 32, dir < 0);
      const gx = w - 22 - ((t * 0.3) % 60);
      GW.draw(g, GW.S.goomba, x + gx, y + h - 32, Math.floor(t / 10) % 2 === 0);
    },
    flappy(g, x, y, w, h, t) {
      GW.apps.flappy.drawPreview(g, x, y, w, h, t);
    },
    ball(g, x, y, w, h, t) {
      GW.apps.ball.drawPreview(g, x, y, w, h, t);
    },
    clock(g, x, y, w, h, t) {
      GW.apps.clock.drawPreview(g, x, y, w, h, t);
    },
    settings(g, x, y, w, h, t) {
      g.fillStyle = '#23233a';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#2d2d4a';
      for (let i = 0; i < w; i += 8) g.fillRect(x + i, y, 1, h);
      for (let j = 0; j < h; j += 8) g.fillRect(x, y + j, w, 1);
      const gear = gearFrames[Math.floor(t / 6) % gearFrames.length];
      GW.draw(g, gear, x + 10, y + 16);
      // sliders
      const s = GW.save.settings;
      const rows = [['VOL', s.volume, 5], ['LIGHT', s.brightness, 5], ['24H', s.hour24 ? 5 : 0, 5]];
      rows.forEach(([lbl, v, max], i) => {
        const yy = y + 22 + i * 18;
        GW.text(g, lbl, x + 66, yy, '#bdbde0', { small: true });
        g.fillStyle = '#44446a';
        g.fillRect(x + 66, yy + 8, 48, 3);
        g.fillStyle = '#F8B800';
        g.fillRect(x + 66, yy + 8, Math.round((48 * v) / max), 3);
        g.fillStyle = '#FCFCFC';
        g.fillRect(x + 66 + Math.round((46 * v) / max), yy + 6, 3, 7);
      });
    },
  };

  const gearFrames = [];
  for (let f = 0; f < 6; f++) {
    const rot = (f / 6) * (Math.PI / 4);
    gearFrames.push(GW.blob(48, 48, (px, py) => {
      const dx = px - 24, dy = py - 24;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + rot;
      if (r < 7) return false;
      if (r < 16) return true;
      return r < 22 && Math.cos(a * 8) > 0.15;
    }, '#BCBCBC', '#000', (px, py) => (px + py < 44 ? '#FCFCFC' : px + py > 56 ? '#7C7C7C' : null)));
  }

  // --- settings ---
  function drawSettings(g) {
    drawHomeBg(g);
    drawStatusBar(g, 'SETTINGS');
    const s = GW.save.settings;
    const top = 26, rowH = 17;
    GW.frame(g, 12, top - 6, 296, SETTINGS.length * rowH + 10, 'rgba(8,8,20,0.88)', '#5a5a80', 2);
    SETTINGS.forEach((it, i) => {
      const y = top + i * rowH;
      const sel = i === OS.settingsSel;
      if (sel) {
        g.fillStyle = '#2a2a52';
        g.fillRect(16, y - 3, 288, rowH - 2);
        GW.draw(g, GW.S.cursor, 20, y);
      }
      const col = sel ? '#FCFCFC' : '#a8a8d0';
      const danger = it.key === 'off' || it.key === 'reset';
      GW.text(g, it.label, 34, y, danger && sel ? '#FC9838' : col);
      let val = '';
      const vx = 296;
      if (it.type === 'bar') {
        for (let k = it.min; k <= it.max; k++) {
          if (k === 0) continue;
          g.fillStyle = k <= s[it.key] ? '#F8B800' : '#3c3c64';
          g.fillRect(vx - (it.max - k + 1) * 9 + 2, y, 7, 7);
        }
        if (sel) {
          GW.text(g, '◀', vx - it.max * 9 - 10, y, '#F8B800', { small: true });
        }
      } else if (it.type === 'bool') val = s[it.key] ? 'ON' : 'OFF';
      else if (it.type === 'fmt') val = s.hour24 ? '24H' : '12H';
      else if (it.type === 'time') {
        const d = GW.now();
        val = U.pad(d.getHours(), 2) + ':' + U.pad(d.getMinutes(), 2);
        if (OS.edit && OS.edit.kind === 'time') val = '';
      } else if (it.type === 'alarm') {
        val = (s.alarmOn ? 'ON ' : 'OFF ') + U.pad(s.alarmH, 2) + ':' + U.pad(s.alarmM, 2);
        if (OS.edit && OS.edit.kind === 'alarm') val = '';
      } else if (it.type === 'action') {
        val = it.key === 'reset' && OS.confirm && sel ? 'PRESS A AGAIN' : sel ? 'A' : '';
      }
      if (val) GW.text(g, val, vx, y, it.type === 'action' ? '#F8B800' : s[it.key] === false ? '#6c6c90' : '#FCFCFC', { align: 'right' });
      if (OS.edit && ((OS.edit.kind === 'time' && it.key === 'time') || (OS.edit.kind === 'alarm' && it.key === 'alarm'))) {
        const e = OS.edit;
        const blink = Math.floor(OS.t / 10) % 2 === 0;
        const hs = U.pad(e.h, 2), ms = U.pad(e.m, 2);
        GW.text(g, (e.field === 0 && !blink ? '  ' : hs) + ':' + (e.field === 1 && !blink ? '  ' : ms), vx, y, '#F8B800', { align: 'right' });
        GW.text(g, '▲', vx - (e.field === 0 ? 36 : 12), y - 8, '#F8B800', { small: true });
      }
    });
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 199, 320, 14);
    const hint = OS.edit ? '▲▼ CHANGE   ◀▶ FIELD   A SAVE   B CANCEL' : '▲▼ MOVE   ◀▶ CHANGE   A SELECT   B BACK';
    GW.text(g, hint, 160, 203, '#bdbde0', { align: 'center', small: true });
  }

  // --- pause overlay ---
  function drawPause(g, w, h) {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, w, h);
    const bw = 136, bh = 86;
    const x = Math.floor((w - bw) / 2), y = Math.floor((h - bh) / 2);
    GW.frame(g, x, y, bw, bh, '#000', '#FCFCFC', 2);
    GW.frame(g, x + 2, y + 2, bw - 4, bh - 4, '#000', '#C84C0C', 2);
    GW.text(g, 'PAUSE', x + bw / 2, y + 10, '#F8B800', { align: 'center' });
    PAUSE_ITEMS.forEach((it, i) => {
      const yy = y + 30 + i * 16;
      const sel = i === OS.pauseSel;
      if (sel) GW.draw(g, GW.S.cursor, x + 18, yy);
      GW.text(g, it, x + 32, yy, sel ? '#FCFCFC' : '#8c8c8c');
    });
  }

  function drawToast(g, w) {
    if (OS.toastT <= 0 || !OS.toastMsg) return;
    const t = OS.toastT;
    const slide = Math.min(1, Math.min(t, 12) / 12);
    const tw = GW.textWidth(OS.toastMsg) + 20;
    const x = Math.floor((w - tw) / 2);
    const y = Math.round(-20 + slide * 26);
    GW.frame(g, x, y, tw, 16, '#000', '#F8B800', 2);
    GW.text(g, OS.toastMsg, w / 2, y + 4, '#FCFCFC', { align: 'center' });
  }

  function drawAlarmBadge(g, w) {
    if (Math.floor(OS.t / 15) % 2) return;
    GW.frame(g, w - 70, 20, 64, 14, '#E04018', '#FCFCFC', 2);
    GW.text(g, 'ALARM!', w - 38, 23, '#FCFCFC', { align: 'center' });
  }

  function drawTransition(g, w, h) {
    const tr = OS.trans;
    const p = tr.t < tr.dur ? tr.t / tr.dur : 1 - (tr.t - tr.dur) / tr.dur;
    if (tr.kind === 'fade') {
      g.fillStyle = `rgba(0,0,0,${U.clamp(p, 0, 1)})`;
      g.fillRect(0, 0, w, h);
    } else {
      const maxR = Math.hypot(w, h) / 2 + 4;
      const r = Math.max(0, maxR * (1 - U.ease(U.clamp(p, 0, 1))));
      g.fillStyle = '#000';
      g.beginPath();
      g.rect(0, 0, w, h);
      if (r > 0.5) g.arc(tr.cx || w / 2, tr.cy || h / 2, r, 0, Math.PI * 2, true);
      g.fill('evenodd');
    }
  }
})();

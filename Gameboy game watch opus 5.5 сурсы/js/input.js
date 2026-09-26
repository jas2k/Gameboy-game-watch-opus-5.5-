/* Game & Watch — unified input: keyboard, pointer (device buttons), gamepad */
(function () {
  'use strict';
  const GW = window.GW;

  const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'game', 'time', 'pause'];
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyX: 'a', KeyK: 'a', Space: 'a',
    KeyZ: 'b', KeyJ: 'b',
    Enter: 'game', KeyG: 'game', Digit1: 'game',
    KeyT: 'time', Digit2: 'time',
    KeyP: 'pause', Escape: 'pause', Digit3: 'pause',
  };

  const sources = {};     // btn -> Set(sourceId)
  const pendPress = {};
  const pendRelease = {};
  const listeners = [];

  const I = (GW.input = {
    BUTTONS,
    held: {}, pressed: {}, released: {}, holdTime: {},
    lastActivity: performance.now(),
    onChange(fn) { listeners.push(fn); },

    down(btn, src) {
      const s = sources[btn] || (sources[btn] = new Set());
      const was = s.size > 0;
      s.add(src);
      if (!was) {
        pendPress[btn] = true;
        listeners.forEach((f) => f(btn, true));
      }
      I.lastActivity = performance.now();
      GW.audio.unlock();
    },
    up(btn, src) {
      const s = sources[btn];
      if (!s || !s.has(src)) return;
      s.delete(src);
      if (s.size === 0) {
        pendRelease[btn] = true;
        listeners.forEach((f) => f(btn, false));
      }
    },
    releaseAll(prefix) {
      for (const b of BUTTONS) {
        const s = sources[b];
        if (!s) continue;
        for (const src of [...s]) if (!prefix || String(src).startsWith(prefix)) I.up(b, src);
      }
    },
    isDown(btn) { return !!(sources[btn] && sources[btn].size); },

    // called once per fixed update tick
    update() {
      pollGamepads();
      for (const b of BUTTONS) {
        const d = I.isDown(b);
        const prev = I.held[b];
        I.pressed[b] = !!pendPress[b];
        I.held[b] = d || I.pressed[b];
        I.released[b] = (prev && !I.held[b]) || (!!pendRelease[b] && !d);
        pendPress[b] = false;
        pendRelease[b] = false;
        I.holdTime[b] = I.held[b] ? (I.holdTime[b] || 0) + 1 : 0;
      }
    },
    // press + auto-repeat, for menus
    repeat(btn, delay, rate) {
      if (I.pressed[btn]) return true;
      const t = I.holdTime[btn] || 0;
      delay = delay || 18; rate = rate || 5;
      return t > delay && (t - delay) % rate === 0;
    },
    eat(btn) { I.pressed[btn] = false; },
    eatAll() { for (const b of BUTTONS) I.pressed[b] = false; },
    anyPressed(list) {
      return (list || BUTTONS).some((b) => I.pressed[b]);
    },
  });

  /* keyboard */
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    if (!e.repeat) I.down(b, 'k:' + e.code);
  });
  window.addEventListener('keyup', (e) => {
    const b = KEYMAP[e.code];
    if (b) { e.preventDefault(); I.up(b, 'k:' + e.code); }
  });
  window.addEventListener('blur', () => I.releaseAll());
  document.addEventListener('visibilitychange', () => { if (document.hidden) I.releaseAll(); });

  /* gamepads */
  const PADMAP = { 0: 'a', 1: 'a', 2: 'b', 3: 'b', 8: 'game', 9: 'pause', 16: 'game', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 4: 'time', 5: 'time' };
  const padState = {};
  function pollGamepads() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p || p.mapping !== 'standard') continue;
      const now = {};
      for (const [idx, b] of Object.entries(PADMAP)) {
        const btn = p.buttons[idx];
        if (btn && btn.pressed) now[b + ':' + idx] = b;
      }
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.5) now['left:ax'] = 'left';
      if (ax > 0.5) now['right:ax'] = 'right';
      if (ay < -0.5) now['up:ay'] = 'up';
      if (ay > 0.5) now['down:ay'] = 'down';
      const key = 'p' + p.index;
      const prev = padState[key] || {};
      for (const id of Object.keys(prev)) if (!now[id]) I.up(prev[id], key + ':' + id);
      for (const id of Object.keys(now)) if (!prev[id]) I.down(now[id], key + ':' + id);
      padState[key] = now;
    }
  }
})();

/* Game & Watch — core namespace, utilities, persistent storage */
(function () {
  'use strict';
  const GW = (window.GW = window.GW || {});
  GW.apps = {};

  GW.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    pad: (n, len, ch) => String(n).padStart(len, ch === undefined ? '0' : ch),
    sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
    approach: (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target)),
    overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

  const KEY = 'gw-smb-save-v1';
  const defaults = () => ({
    settings: {
      volume: 3,        // 0..5
      brightness: 5,    // 1..5
      hour24: true,
      timeOffset: 0,    // ms added to the system clock
      alarmOn: false,
      alarmH: 7,
      alarmM: 0,
      lcdGrid: false,
      clockTheme: 0,    // 0 auto, 1 day, 2 night, 3 underground, 4 castle
      menuMusic: true,
    },
    scores: { mario: 0, flappy: 0, ballA: 0, ballB: 0 },
    stats: { clockCoins: 0, plays: 0 },
  });

  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], extra[k]);
      else if (extra[k] !== undefined && typeof extra[k] === typeof base[k]) base[k] = extra[k];
    }
    return base;
  }

  let data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = merge(defaults(), JSON.parse(raw));
  } catch (e) { /* storage unavailable */ }
  GW.save = data;

  let saveTimer = 0;
  GW.persist = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(GW.save)); } catch (e) { /* ignore */ }
    }, 150);
  };
  GW.resetSave = function () {
    const s = GW.save.settings;
    GW.save = defaults();
    GW.save.settings = s;
    GW.persist();
  };

  GW.now = () => new Date(Date.now() + GW.save.settings.timeOffset);

  GW.submitScore = function (key, value) {
    if (value > (GW.save.scores[key] || 0)) {
      GW.save.scores[key] = value;
      GW.persist();
      return true;
    }
    return false;
  };

  GW.DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  GW.MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
})();

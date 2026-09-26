/* Game & Watch — chiptune audio: synthesized SFX + a small 4-channel sequencer */
(function () {
  'use strict';
  const GW = window.GW;

  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  const waves = {};

  function volGain() {
    const v = GW.save.settings.volume;
    return v <= 0 ? 0 : Math.pow(v / 5, 1.6) * 0.55;
  }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);

    // pulse waves with NES-like duty cycles
    for (const duty of [0.125, 0.25, 0.5]) {
      const n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        re[k] = 0;
        im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      }
      waves[duty] = ctx.createPeriodicWave(re, im);
    }
    // stepped NES triangle
    {
      const n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k += 2) im[k] = (8 / (Math.PI * Math.PI * k * k)) * (((k - 1) / 2) % 2 ? -1 : 1);
      waves.tri = ctx.createPeriodicWave(re, im);
    }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let lfsr = 1;
    for (let i = 0; i < d.length; i++) {
      // NES style LFSR noise, a new value every few samples
      if (i % 3 === 0) {
        const bit = (lfsr ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
      }
      d[i] = (lfsr & 1) ? 0.8 : -0.8;
    }
    return true;
  }

  const A = (GW.audio = {
    get ctx() { return ctx; },
    unlock() {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    setVolume() {
      if (master) master.gain.setTargetAtTime(volGain(), ctx.currentTime, 0.02);
    },
    t() { return ctx ? ctx.currentTime : 0; },
  });

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(name) {
    // e.g. "C4", "F#5", "Bb3"
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return n + (parseInt(m[3], 10) + 1) * 12;
  }
  A.midiOf = midiOf;

  /* ---------- voice primitives ---------- */
  function osc(type, t0, dur, f0, f1, vol, bus, opts) {
    opts = opts || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (type === 'tri') o.setPeriodicWave(waves.tri);
    else if (typeof type === 'number') o.setPeriodicWave(waves[type]);
    else o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) {
      if (opts.linear) o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    }
    const attack = opts.attack || 0.004;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    if (opts.sustain) {
      g.gain.setValueAtTime(vol, t0 + dur - 0.02);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    }
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vibrato;
      lg.gain.value = f0 * 0.012;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }

  function noise(t0, dur, vol, bus, hp, lp, sweepTo) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = lp ? 'lowpass' : 'highpass';
    f.frequency.setValueAtTime(lp || hp || 800, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  function seq(notes, step, type, vol, t0, opts) {
    // notes: array of midi (or null for rest)
    notes.forEach((n, i) => {
      if (n == null) return;
      osc(type, t0 + i * step, (opts && opts.len) || step * 0.95, freq(n), null, vol, sfxBus, Object.assign({ sustain: true }, opts));
    });
  }

  /* ---------- sound effects ---------- */
  const SFX = {
    jump(t) { osc(0.25, t, 0.2, 280, 820, 0.22, null, { linear: true }); },
    bigjump(t) { osc(0.25, t, 0.22, 220, 700, 0.22, null, { linear: true }); },
    coin(t) {
      osc(0.25, t, 0.07, freq(83), null, 0.2, null, { sustain: true });
      osc(0.25, t + 0.07, 0.45, freq(88), null, 0.2);
    },
    bump(t) { osc(0.5, t, 0.09, 180, 90, 0.28); osc('tri', t, 0.08, 120, 60, 0.3); },
    brick(t) { noise(t, 0.35, 0.35, null, null, 3000, 300); osc('tri', t, 0.15, 150, 50, 0.3); },
    stomp(t) { osc(0.5, t, 0.05, 420, 900, 0.2); osc(0.5, t + 0.05, 0.08, 900, 1500, 0.15); },
    kick(t) { osc(0.5, t, 0.06, 800, 1600, 0.18); noise(t, 0.06, 0.15, null, 2000); },
    powerup_appear(t) { seq([60, 67, 72, 64, 71, 76, 67, 74, 79, 69, 76, 81], 0.035, 0.5, 0.14, t); },
    powerup(t) { seq([60, 64, 67, 72, 62, 66, 69, 74, 64, 68, 71, 76, 65, 69, 72, 77], 0.028, 0.25, 0.16, t); },
    pipe(t) { for (let i = 0; i < 3; i++) osc(0.5, t + i * 0.12, 0.1, 400, 120, 0.2); },
    oneup(t) { seq([76, 79, 88, 84, 86, 91], 0.1, 0.25, 0.16, t); },
    fireball(t) { osc(0.5, t, 0.05, 1000, 300, 0.18); noise(t, 0.05, 0.08, null, 3000); },
    flagpole(t) { osc(0.25, t, 1.1, 300, 1400, 0.14, null, { linear: true }); },
    pause(t) { seq([76, 72, 76, 72], 0.07, 0.5, 0.16, t); },
    beep(t) { osc(0.5, t, 0.05, 1480, null, 0.12, null, { sustain: true }); },
    tick(t) { osc(0.5, t, 0.025, 2200, null, 0.06, null, { sustain: true }); },
    select(t) { osc(0.25, t, 0.05, 880, null, 0.13, null, { sustain: true }); osc(0.25, t + 0.05, 0.06, 1320, null, 0.13, null, { sustain: true }); },
    move(t) { osc(0.5, t, 0.035, 660, null, 0.1, null, { sustain: true }); },
    back(t) { osc(0.25, t, 0.05, 700, null, 0.12, null, { sustain: true }); osc(0.25, t + 0.05, 0.06, 440, null, 0.12, null, { sustain: true }); },
    error(t) { osc(0.5, t, 0.16, 140, null, 0.18, null, { sustain: true }); },
    damage(t) { for (let i = 0; i < 4; i++) osc(0.5, t + i * 0.07, 0.06, 500 - i * 60, 200, 0.18); },
    wing(t) { noise(t, 0.09, 0.18, null, null, 1800, 5000); osc(0.125, t, 0.07, 300, 520, 0.05); },
    point(t) { osc(0.5, t, 0.06, freq(83), null, 0.13, null, { sustain: true }); osc(0.5, t + 0.06, 0.3, freq(88), null, 0.13); },
    hit(t) { noise(t, 0.18, 0.4, null, null, 1500, 200); osc('tri', t, 0.12, 160, 60, 0.35); },
    die(t) { osc(0.5, t + 0.05, 0.45, 700, 120, 0.12); },
    swoosh(t) { noise(t, 0.3, 0.12, null, null, 600, 4000); },
    catch(t) { osc(0.5, t, 0.06, 1760, null, 0.12, null, { sustain: true }); },
    miss(t) { for (let i = 0; i < 3; i++) osc(0.5, t + i * 0.16, 0.1, 220, null, 0.15, null, { sustain: true }); },
    lcdstep(t) { osc(0.5, t, 0.018, 2600, null, 0.035, null, { sustain: true }); },
    firework(t) { noise(t, 0.5, 0.45, null, null, 1200, 150); osc('tri', t, 0.3, 90, 40, 0.3); },
    power_on(t) { seq([72, 76, 79, 84], 0.07, 0.25, 0.14, t); osc(0.25, t + 0.28, 0.5, freq(88), null, 0.12); },
    power_off(t) { seq([84, 79, 76, 72], 0.06, 0.25, 0.12, t); },
    count(t) { osc(0.25, t, 0.03, 1400, null, 0.07, null, { sustain: true }); },
    alarm(t) { for (let i = 0; i < 4; i++) { osc(0.25, t + i * 0.12, 0.08, 1568, null, 0.16, null, { sustain: true }); } },
    chime(t) { seq([79, 84], 0.18, 0.25, 0.12, t, { len: 0.5 }); },
  };

  A.sfx = function (name, delay) {
    if (!ctx || !GW.save.settings.volume) return;
    const f = SFX[name];
    if (f) f(ctx.currentTime + 0.005 + (delay || 0));
  };

  /* ---------- music sequencer ---------- */
  // song: { bpm, loop, tracks: { sq1, sq2, tri, noise } }, track text: "C5:2 E5:2 r:4 ..."
  // durations in 16th notes. For noise: k (kick), s (snare), h (hat)
  function parseTrack(txt) {
    const ev = [];
    let t = 0;
    for (const tok of txt.trim().split(/\s+/)) {
      if (!tok) continue;
      const [n, d] = tok.split(':');
      const dur = parseFloat(d || '1');
      if (n !== 'r' && n !== '-') ev.push({ t, dur, n });
      t += dur;
    }
    return { ev, len: t };
  }

  const songs = {};
  A.defineSong = function (name, def) {
    const tracks = {};
    let len = 0;
    for (const k of Object.keys(def.tracks)) {
      tracks[k] = parseTrack(def.tracks[k]);
      len = Math.max(len, tracks[k].len);
    }
    songs[name] = { bpm: def.bpm, loop: def.loop !== false, tracks, len, duty: def.duty || {}, vol: def.vol || {} };
  };

  const player = {
    song: null, name: null, startTime: 0, pos: 0, timer: null, speed: 1, paused: false, pausedAt: 0, gain: null, onEnd: null,
  };

  function stepLen(song) { return 60 / (song.bpm * player.speed) / 4; }

  function scheduleNote(tr, e, t, dur, song) {
    const g = player.gain;
    if (tr === 'noise') {
      if (e.n === 'k') { osc('tri', t, 0.09, 180, 50, 0.45, g); }
      else if (e.n === 's') { noise(t, 0.12, 0.22, g, 1000); }
      else if (e.n === 'h') { noise(t, 0.03, 0.08, g, 7000); }
      return;
    }
    const m = midiOf(e.n);
    if (m == null) return;
    if (tr === 'tri') {
      osc('tri', t, dur * 0.98, freq(m), null, song.vol.tri || 0.34, g, { sustain: true });
    } else {
      const duty = song.duty[tr] || (tr === 'sq1' ? 0.5 : 0.25);
      const v = song.vol[tr] || (tr === 'sq1' ? 0.13 : 0.08);
      osc(duty, t, Math.max(0.05, dur * 0.92), freq(m), null, v, g, { attack: 0.006, vibrato: dur > 0.3 ? 5.5 : 0 });
    }
  }

  function pump() {
    if (!player.song || player.paused || !ctx) return;
    const song = player.song;
    const sl = stepLen(song);
    const ahead = ctx.currentTime + 0.18;
    while (true) {
      const tStart = player.startTime + player.pos * sl;
      if (tStart > ahead) break;
      const chunkEnd = player.pos + 1;
      for (const tr of Object.keys(song.tracks)) {
        for (const e of song.tracks[tr].ev) {
          if (e.t >= player.pos && e.t < chunkEnd) {
            scheduleNote(tr, e, player.startTime + e.t * sl, e.dur * sl, song);
          }
        }
      }
      player.pos = chunkEnd;
      if (player.pos >= song.len) {
        if (song.loop) {
          player.startTime += song.len * sl;
          player.pos = 0;
        } else {
          const endAt = player.startTime + song.len * sl;
          const cb = player.onEnd;
          const nm = player.name;
          player.song = null;
          setTimeout(() => { if (player.name === nm && cb) cb(); }, Math.max(0, (endAt - ctx.currentTime) * 1000));
          return;
        }
      }
    }
  }

  A.music = {
    play(name, opts) {
      opts = opts || {};
      if (!ctx) init();
      if (!ctx) return;
      if (player.name === name && player.song && !opts.restart) { player.speed = opts.speed || 1; return; }
      this.stop();
      const song = songs[name];
      if (!song) return;
      player.gain = ctx.createGain();
      player.gain.gain.value = 1;
      player.gain.connect(musicBus);
      player.song = song;
      player.name = name;
      player.speed = opts.speed || 1;
      player.pos = 0;
      player.startTime = ctx.currentTime + 0.06;
      player.paused = false;
      player.onEnd = opts.onEnd || null;
      clearInterval(player.timer);
      player.timer = setInterval(pump, 25);
      pump();
    },
    stop() {
      clearInterval(player.timer);
      player.timer = null;
      if (player.gain && ctx) {
        const g = player.gain;
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        setTimeout(() => g.disconnect(), 200);
      }
      player.gain = null;
      player.song = null;
      player.name = null;
      player.onEnd = null;
    },
    pause() {
      if (!player.song || player.paused) return;
      player.paused = true;
      player.pausedAt = ctx.currentTime;
      if (player.gain) {
        const old = player.gain;
        old.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        setTimeout(() => old.disconnect(), 200);
        player.gain = null;
      }
    },
    resume() {
      if (!player.song || !player.paused) return;
      player.paused = false;
      player.gain = ctx.createGain();
      player.gain.connect(musicBus);
      // restart from the current step position
      player.startTime = ctx.currentTime + 0.05 - player.pos * stepLen(player.song);
      pump();
    },
    setSpeed(s) {
      if (!player.song) { player.speed = s; return; }
      const sl0 = stepLen(player.song);
      const now = ctx.currentTime;
      const curPos = (now - player.startTime) / sl0;
      player.speed = s;
      player.startTime = now - curPos * stepLen(player.song);
    },
    get current() { return player.song ? player.name : null; },
    get paused() { return player.paused; },
  };

  /* ---------- songs (original chiptune compositions) ---------- */
  A.defineSong('overworld', {
    bpm: 196,
    tracks: {
      sq1: `E5:2 G5:2 C6:2 G5:2 A5:3 G5:1 E5:2 r:2  F5:2 A5:2 C6:2 A5:2 G5:4 r:4
            E5:2 G5:2 C6:2 E6:2 D6:2 C6:2 A5:2 G5:2  F5:2 E5:2 D5:2 E5:2 C5:4 r:4
            A5:2 C6:2 A5:2 G5:2 E5:2 G5:2 E5:2 D5:2  F5:2 G5:2 A5:2 B5:2 C6:4 G5:4
            A5:2 G5:2 E5:2 G5:2 D6:3 C6:1 A5:2 G5:2  E5:2 D5:2 E5:2 G5:2 C6:6 r:2`,
      sq2: `C5:2 E5:2 G5:2 E5:2 F5:3 E5:1 C5:2 r:2  C5:2 F5:2 A5:2 F5:2 E5:4 r:4
            C5:2 E5:2 G5:2 C6:2 B5:2 A5:2 F5:2 E5:2  D5:2 C5:2 B4:2 C5:2 G4:4 r:4
            F5:2 A5:2 F5:2 E5:2 C5:2 E5:2 C5:2 B4:2  D5:2 E5:2 F5:2 G5:2 E5:4 D5:4
            F5:2 E5:2 C5:2 E5:2 B5:3 A5:1 F5:2 E5:2  C5:2 B4:2 C5:2 D5:2 E5:6 r:2`,
      tri: `C3:2 r:2 G3:2 r:2 F3:2 r:2 C3:2 r:2  F3:2 r:2 A3:2 r:2 C3:2 r:2 G3:2 r:2
            C3:2 r:2 E3:2 r:2 F3:2 r:2 D3:2 r:2  G3:2 r:2 G2:2 r:2 C3:2 r:2 G2:2 r:2
            F3:2 r:2 C3:2 r:2 A2:2 r:2 E3:2 r:2  D3:2 r:2 G3:2 r:2 C3:2 r:2 E3:2 r:2
            F3:2 r:2 C3:2 r:2 G3:2 r:2 D3:2 r:2  G2:2 r:2 G3:2 r:2 C3:2 r:2 C3:2 r:2`,
      noise: `k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2  k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2
              k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2  k:2 h:2 s:2 h:2 k:2 h:2 s:1 s:1 h:2
              k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2  k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2
              k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2  k:2 h:2 s:2 h:2 k:2 s:1 s:1 s:2 s:2`,
    },
  });

  A.defineSong('underground', {
    bpm: 150,
    duty: { sq1: 0.125 },
    tracks: {
      sq1: `C5:1 r:1 C6:1 r:1 A4:1 r:1 A5:1 r:1 Bb4:1 r:1 Bb5:1 r:5
            F4:1 r:1 F5:1 r:1 D4:1 r:1 D5:1 r:1 Eb4:1 r:1 Eb5:1 r:5
            C5:1 r:1 C6:1 r:1 A4:1 r:1 A5:1 r:1 Bb4:1 r:1 Bb5:1 r:5
            G4:1 r:1 G5:1 r:1 E4:1 r:1 E5:1 r:1 F4:2 Ab4:2 G4:2 r:2`,
      tri: `C3:2 r:2 C3:2 r:2 Bb2:2 r:2 Bb2:2 r:2  F2:2 r:2 F2:2 r:2 Eb2:2 r:2 Eb2:2 r:2
            C3:2 r:2 C3:2 r:2 Bb2:2 r:2 Bb2:2 r:2  G2:2 r:2 E2:2 r:2 F2:4 G2:4`,
      noise: `h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4 h:4`,
    },
  });

  A.defineSong('star', {
    bpm: 210,
    tracks: {
      sq1: `C5:1 C5:1 C5:1 r:1 C5:1 r:1 C5:1 D5:1 r:1 C5:1 r:1 C5:1 D5:1 r:1 C5:2
            D5:1 D5:1 D5:1 r:1 D5:1 r:1 D5:1 E5:1 r:1 D5:1 r:1 D5:1 E5:1 r:1 D5:2`,
      sq2: `F4:1 F4:1 F4:1 r:1 F4:1 r:1 F4:1 G4:1 r:1 F4:1 r:1 F4:1 G4:1 r:1 F4:2
            G4:1 G4:1 G4:1 r:1 G4:1 r:1 G4:1 A4:1 r:1 G4:1 r:1 G4:1 A4:1 r:1 G4:2`,
      tri: `F2:2 F3:2 F2:2 F3:2 F2:2 F3:2 F2:2 F3:2  G2:2 G3:2 G2:2 G3:2 G2:2 G3:2 G2:2 G3:2`,
      noise: `k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2`,
    },
  });

  A.defineSong('death', {
    bpm: 150, loop: false,
    tracks: {
      sq1: `r:2 B4:1 F5:2 r:1 F5:1 F5:2 E5:2 D5:2 C5:2 G4:2 E4:2 C4:4`,
      tri: `r:2 G3:3 r:1 G3:1 G3:2 A3:2 B3:2 C4:2 r:2 C3:4`,
    },
  });

  A.defineSong('gameover', {
    bpm: 120, loop: false,
    tracks: {
      sq1: `C5:3 G4:3 E4:2 A4:2 B4:2 A4:2 Ab4:2 Bb4:2 Ab4:2 G4:1 F4:1 G4:6`,
      tri: `E3:3 C3:3 G2:2 F3:6 Db3:6 C3:8`,
    },
  });

  A.defineSong('clear', {
    bpm: 170, loop: false,
    tracks: {
      sq1: `G4:1 C5:1 E5:1 G5:1 C6:1 E6:1 G6:3 E6:3  Ab4:1 C5:1 Eb5:1 Ab5:1 C6:1 Eb6:1 Ab6:3 Eb6:3
            Bb4:1 D5:1 F5:1 Bb5:1 D6:1 F6:1 Bb6:3 Bb6:1 Bb6:1 Bb6:1 C7:8`,
      sq2: `E4:1 G4:1 C5:1 E5:1 G5:1 C6:1 E6:3 C6:3  Eb4:1 Ab4:1 C5:1 Eb5:1 Ab5:1 C6:1 Eb6:3 C6:3
            F4:1 Bb4:1 D5:1 F5:1 Bb5:1 D6:1 F6:3 F6:1 F6:1 F6:1 E6:8`,
      tri: `C3:6 C3:6 Ab2:6 Ab2:6 Bb2:6 Bb2:3 Bb2:1 Bb2:1 Bb2:1 C3:8`,
    },
  });

  A.defineSong('castle_clear', {
    bpm: 150, loop: false,
    tracks: {
      sq1: `C5:2 G4:2 E4:2 G4:2 C5:2 E5:2 G5:4 E5:2 C5:2 D5:2 E5:2 C5:8`,
      tri: `C3:4 G2:4 C3:4 E3:4 C3:4 G2:4 C3:8`,
    },
  });

  A.defineSong('boot', {
    bpm: 160, loop: false,
    tracks: {
      sq1: `C5:1 E5:1 G5:1 C6:3 r:1 G5:1 C6:6`,
      sq2: `r:1 C5:1 E5:1 G5:3 r:1 E5:1 E5:6`,
      tri: `C3:3 G3:3 r:1 C3:1 C4:6`,
    },
  });

  A.defineSong('menu', {
    bpm: 112,
    duty: { sq1: 0.25, sq2: 0.125 },
    vol: { sq1: 0.07, sq2: 0.045, tri: 0.22 },
    tracks: {
      sq1: `E5:4 D5:2 C5:2 D5:4 G4:4  C5:4 B4:2 A4:2 B4:6 r:2
            A4:4 B4:2 C5:2 D5:4 E5:4  F5:2 E5:2 D5:2 C5:2 D5:6 r:2
            E5:4 D5:2 C5:2 D5:4 G5:4  A5:4 G5:2 E5:2 D5:6 r:2
            C5:2 D5:2 E5:2 G5:2 F5:2 E5:2 D5:2 B4:2  C5:8 r:8`,
      sq2: `G4:2 C5:2 G4:2 C5:2 G4:2 B4:2 G4:2 B4:2  E4:2 A4:2 E4:2 A4:2 D4:2 G4:2 D4:2 G4:2
            F4:2 A4:2 F4:2 A4:2 G4:2 B4:2 G4:2 B4:2  A4:2 C5:2 A4:2 C5:2 G4:2 B4:2 G4:2 B4:2
            G4:2 C5:2 G4:2 C5:2 G4:2 B4:2 G4:2 B4:2  F4:2 A4:2 F4:2 A4:2 G4:2 B4:2 G4:2 B4:2
            E4:2 G4:2 C5:2 E5:2 D4:2 F4:2 G4:2 B4:2  E4:4 G4:4 C5:8`,
      tri: `C3:8 G2:8 A2:8 G2:8 F2:8 G2:8 A2:8 G2:8 C3:8 G2:8 F2:8 G2:8 A2:8 G2:8 C3:8 C3:8`,
    },
  });

  A.defineSong('alarm', {
    bpm: 180,
    tracks: {
      sq1: `C6:1 G5:1 C6:1 G5:1 C6:1 G5:1 E6:2 r:4 D6:1 A5:1 D6:1 A5:1 D6:1 A5:1 F6:2 r:4`,
      tri: `C3:2 C4:2 C3:2 C4:2 r:4 D3:2 D4:2 D3:2 D4:2 r:4`,
    },
  });

  A.defineSong('hurry', {
    bpm: 150, loop: false,
    tracks: {
      sq1: `E6:1 r:1 F6:1 r:1 F#6:1 r:1 G6:4 r:2 E6:1 r:1 F6:1 r:1 F#6:1 r:1 G6:4 r:2 E6:1 r:1 F6:1 r:1 F#6:1 r:1 G6:6`,
    },
  });
})();

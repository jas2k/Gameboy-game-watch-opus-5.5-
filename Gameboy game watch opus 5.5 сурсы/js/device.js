/* Game & Watch — the physical device: layout scaling, D-pad geometry, touch/mouse buttons, LCD output */
(function () {
  'use strict';
  const GW = window.GW;
  const I = GW.input;
  const root = document.documentElement;
  const device = document.getElementById('device');
  const lcd = document.getElementById('lcd');
  const canvas = document.getElementById('screen');
  const dpad = document.getElementById('dpad');
  const hints = document.getElementById('hints');

  const DEV_W = 877, DEV_H = 524, LCD_W = 363, LCD_H = 284;
  let scale = 1;

  /* ---------- D-pad vector geometry (photo coordinates) ---------- */
  const CX = 183.6, CY = 459.6;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function roundedPoly(pts, rOut, rIn) {
    const n = pts.length;
    let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p = pts[i], p1 = pts[(i + 1) % n];
      const cross = (p[0] - p0[0]) * (p1[1] - p[1]) - (p[1] - p0[1]) * (p1[0] - p[0]);
      const r = cross > 0 ? rOut : rIn;
      const l0 = Math.hypot(p0[0] - p[0], p0[1] - p[1]);
      const l1 = Math.hypot(p1[0] - p[0], p1[1] - p[1]);
      const a = [p[0] + ((p0[0] - p[0]) / l0) * r, p[1] + ((p0[1] - p[1]) / l0) * r];
      const b = [p[0] + ((p1[0] - p[0]) / l1) * r, p[1] + ((p1[1] - p[1]) / l1) * r];
      d += (i ? 'L' : 'M') + a[0].toFixed(2) + ' ' + a[1].toFixed(2) +
        'Q' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ' ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
    }
    return d + 'Z';
  }
  function cross(ext, arm, rOut, rIn, ox, oy) {
    const cx = CX + (ox || 0), cy = CY + (oy || 0);
    const x0 = cx - ext, x1 = cx - arm, x2 = cx + arm, x3 = cx + ext;
    const y0 = cy - ext, y1 = cy - arm, y2 = cy + arm, y3 = cy + ext;
    return roundedPoly([[x1, y0], [x2, y0], [x2, y1], [x3, y1], [x3, y2], [x2, y2], [x2, y3], [x1, y3], [x1, y2], [x0, y2], [x0, y1], [x1, y1]], rOut, rIn);
  }
  function armRect(dir) {
    const a = 23.5, e = 67.5;
    const r = { up: [CX - a, CY - e, 2 * a, e - a], down: [CX - a, CY + a, 2 * a, e - a], left: [CX - e, CY - a, e - a, 2 * a], right: [CX + a, CY - a, e - a, 2 * a] }[dir];
    return `M${r[0]} ${r[1]}h${r[2]}v${r[3]}h${-r[2]}Z`;
  }

  function buildDpad() {
    const $ = (id) => document.getElementById(id);
    $('dpRimHalo').setAttribute('d', cross(77.4, 32.9, 9.5, 6.5, 0.5, 0.7));
    $('dpRim').setAttribute('d', cross(76.5, 32, 9, 6));
    $('dpRimEdge').setAttribute('d', cross(75.4, 30.9, 8, 6.5, -0.2, -0.2));
    $('dpWell').setAttribute('d', cross(70.2, 26.2, 6, 4));
    $('dpBody').setAttribute('d', cross(67.5, 23.5, 4.8, 3));
    $('dpHi').setAttribute('d', cross(66.9, 22.9, 4.2, 3));
    const arrows = $('dpArrows');
    const base = [[0, -58], [14.2, -44], [9, -44], [9, -31], [-9, -31], [-9, -44], [-14.2, -44]];
    const rot = { up: (x, y) => [x, y], right: (x, y) => [-y, x], down: (x, y) => [-x, -y], left: (x, y) => [y, -x] };
    for (const dir of ['up', 'right', 'down', 'left']) {
      const pts = base.map(([x, y]) => rot[dir](x, y)).map(([x, y]) => (CX + x).toFixed(2) + ',' + (CY + y).toFixed(2)).join(' ');
      const lit = document.createElementNS(SVGNS, 'polygon');
      lit.setAttribute('points', pts);
      lit.setAttribute('fill', 'none');
      lit.setAttribute('stroke', 'rgba(150,152,158,.75)');
      lit.setAttribute('stroke-width', '1.1');
      lit.setAttribute('transform', 'translate(.7 .8)');
      const body = document.createElementNS(SVGNS, 'polygon');
      body.setAttribute('points', pts);
      body.setAttribute('fill', '#141518');
      body.setAttribute('stroke', '#050506');
      body.setAttribute('stroke-width', '.9');
      arrows.appendChild(lit);
      arrows.appendChild(body);
    }
  }
  buildDpad();

  /* ---------- scaling ---------- */
  function layout() {
    const hintsH = hints && hints.offsetParent ? hints.offsetHeight + 22 : 0;
    const availW = window.innerWidth - 32;
    const availH = window.innerHeight - 40 - hintsH;
    scale = Math.min(availW / DEV_W, availH / DEV_H);
    scale = Math.max(0.2, Math.min(scale, 1.9));
    root.style.setProperty('--s', scale.toFixed(4));
    GW.display.resize();
  }

  /* ---------- LCD output ---------- */
  const out = canvas.getContext('2d');
  GW.display = {
    canvas, w: 320, h: 240, k: 1,
    setRes(w, h) {
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      lcd.style.setProperty('--gx', (LCD_W / w).toFixed(4) + 'px');
      lcd.style.setProperty('--gy', (LCD_H / h).toFixed(4) + 'px');
      this.resize();
    },
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const target = LCD_W * scale * dpr;
      const k = Math.max(1, Math.min(8, Math.ceil(target / this.w)));
      this.k = k;
      if (canvas.width !== this.w * k || canvas.height !== this.h * k) {
        canvas.width = this.w * k;
        canvas.height = this.h * k;
      }
      out.imageSmoothingEnabled = false;
    },
    present(buf) {
      out.imageSmoothingEnabled = false;
      out.drawImage(buf, 0, 0, this.w * this.k, this.h * this.k);
    },
    applySettings() {
      const s = GW.save.settings;
      canvas.style.filter = s.brightness >= 5 ? '' : `brightness(${(0.45 + s.brightness * 0.11).toFixed(2)})`;
      lcd.classList.toggle('grid', !!s.lcdGrid);
    },
  };

  /* ---------- pointer input on the device buttons ---------- */
  device.addEventListener('contextmenu', (e) => e.preventDefault());
  device.addEventListener('dblclick', (e) => e.preventDefault());

  document.querySelectorAll('.device [data-btn]').forEach((el) => {
    const btn = el.dataset.btn;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      I.down(btn, 'p' + e.pointerId);
    });
    const up = (e) => I.up(btn, 'p' + e.pointerId);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  });

  // D-pad: direction(s) from pointer position, supports diagonals and sliding
  const padPointers = new Map();
  function dirsAt(e) {
    const r = dpad.getBoundingClientRect();
    const k = r.width / 168;
    const dx = (e.clientX - r.left) / k - (CX - 100);
    const dy = (e.clientY - r.top) / k - (CY - 376);
    const dist = Math.hypot(dx, dy);
    if (dist < 9) return [];
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0 = right, 90 = down
    const dirs = [];
    const inSector = (center, half) => {
      let d = Math.abs(ang - center);
      if (d > 180) d = 360 - d;
      return d <= half;
    };
    if (inSector(0, 60)) dirs.push('right');
    if (inSector(180, 60)) dirs.push('left');
    if (inSector(90, 60)) dirs.push('down');
    if (inSector(-90, 60)) dirs.push('up');
    return dirs;
  }
  function setPadDirs(id, dirs) {
    const prev = padPointers.get(id) || [];
    for (const d of prev) if (!dirs.includes(d)) I.up(d, 'd' + id);
    for (const d of dirs) if (!prev.includes(d)) I.down(d, 'd' + id);
    padPointers.set(id, dirs);
  }
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { dpad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setPadDirs(e.pointerId, dirsAt(e));
  });
  dpad.addEventListener('pointermove', (e) => {
    if (padPointers.has(e.pointerId)) setPadDirs(e.pointerId, dirsAt(e));
  });
  const padUp = (e) => { setPadDirs(e.pointerId, []); padPointers.delete(e.pointerId); };
  dpad.addEventListener('pointerup', padUp);
  dpad.addEventListener('pointercancel', padUp);
  dpad.addEventListener('lostpointercapture', padUp);

  // pressed visuals follow the logical button state (keyboard included)
  const btnEls = {};
  document.querySelectorAll('.device [data-btn]').forEach((el) => (btnEls[el.dataset.btn] = el));
  I.onChange((btn) => {
    if (btnEls[btn]) btnEls[btn].classList.toggle('pressed', I.isDown(btn));
    if (['up', 'down', 'left', 'right'].includes(btn)) {
      dpad.dataset.dir = ['up', 'down', 'left', 'right'].filter((d) => I.isDown(d)).join(' ');
      const shade = document.getElementById('dpShade');
      const held = ['up', 'down', 'left', 'right'].filter((d) => I.isDown(d));
      shade.setAttribute('d', held.map(armRect).join(''));
      shade.setAttribute('fill', held.length ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,0)');
    }
  });

  /* ---------- page-level keys ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey) {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
    }
  });

  window.addEventListener('resize', layout);
  document.addEventListener('fullscreenchange', layout);
  if (window.matchMedia) {
    try { window.matchMedia('(resolution: 1dppx)').addEventListener('change', layout); } catch (e) { /* old browsers */ }
  }
  GW.layout = layout;
})();

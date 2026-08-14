/* The globe.

   An orthographic projection drawn to a canvas: the view you would have from
   very far away, which is the one that reads as a planet rather than a map.
   Everything is drawn by hand — no libraries, no network, so it works on a
   plane with the rest of the app.

   The camera is two angles and a zoom. Every animation eases one to another,
   which is what makes it feel like a camera rather than a slideshow. */

import { SHAPES, CENTRE, META } from './worldgeo.js';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* the shortest way round: turning 350° left beats turning 10° right */
const shortest = (from, to) => from + (((to - from) % 360 + 540) % 360 - 180);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Globe {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lon = 0;           // camera longitude
    this.lat = -12;         // camera latitude
    this.zoom = 1;
    this.marked = null;     // the country wearing the star
    this.revealed = false;  // whether to name and fill it
    this.dim = false;       // fade the rest of the world back
    /* Someone who has asked the system for less movement should not be given
       a spinning planet and a swooping camera. */
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.spin = this.calm ? 0 : (opts.spin ?? 0.022);   // degrees per frame when idle
    this.hover = null;
    this.hold = false;      // set while a question is waiting on an answer
    this._anim = null;
    this._raf = null;
    this._stars = null;
    this.resize();
  }

  /* ── geometry ─────────────────────────────────────────────── */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.cx = w / 2; this.cy = h / 2;
    this.r = Math.min(w, h) / 2 - Math.min(w, h) * 0.06;
    this._stars = null;                       // starfield is sized to the canvas
  }

  /* Longitude/latitude to screen. Returns null when the point is on the far
     side of the planet — that check is the whole difference between a globe
     and a flat map with a circle drawn round it. */
  project(lon, lat) {
    const l = (lon - this.lon) * RAD, p = lat * RAD, c = this.lat * RAD;
    const sinC = Math.sin(c), cosC = Math.cos(c);
    const sinP = Math.sin(p), cosP = Math.cos(p), cosL = Math.cos(l);
    const cosc = sinC * sinP + cosC * cosP * cosL;
    if (cosc < 0) return null;                       // behind the horizon
    const k = this.r * this.zoom;
    return [
      this.cx + k * cosP * Math.sin(l),
      this.cy - k * (cosC * sinP - sinC * cosP * cosL),
      cosc,
    ];
  }

  /* screen back to the sphere, for tapping a country */
  unproject(x, y) {
    const k = this.r * this.zoom;
    const dx = (x - this.cx) / k, dy = (this.cy - y) / k;
    const rho = Math.hypot(dx, dy);
    if (rho > 1) return null;
    const c = Math.asin(rho), sinC = Math.sin(c), cosC = Math.cos(c);
    const lat0 = this.lat * RAD;
    const lat = Math.asin(cosC * Math.sin(lat0) + (rho ? dy * sinC * Math.cos(lat0) / rho : 0));
    const lon = this.lon + Math.atan2(dx * sinC, rho * Math.cos(lat0) * cosC - dy * Math.sin(lat0) * sinC) / RAD;
    return [((lon + 540) % 360) - 180, lat / RAD];
  }

  countryAt(x, y) {
    const hit = this.unproject(x, y);
    if (!hit) return null;
    const [lon, lat] = hit;
    for (const [code, rings] of Object.entries(SHAPES)) {
      for (const ring of rings) if (pointInRing(lon, lat, ring)) return code;
    }
    return null;
  }

  /* ── camera moves ─────────────────────────────────────────── */
  /* Fly to a country: turn the planet under a fixed camera, easing all the
     way, and dip the zoom in the middle so it reads as pulling back and
     coming in again rather than sliding. */
  /* How wide a country is, in degrees, allowing for meridians crowding near
     the poles. Used to decide how close the camera needs to get. */
  static span(code) {
    const rings = SHAPES[code];
    const c = CENTRE[code];
    if (!rings || !c) return 1.2;                 // no outline: it is tiny
    /* the main landmass only. France carries Réunion and French Guiana, the
       United States carries Alaska and Hawaii — measuring all of it would put
       the camera in orbit for a country you could otherwise read. */
    const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < ring.length; i += 2) {
      minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]);
      minY = Math.min(minY, ring[i+1]); maxY = Math.max(maxY, ring[i+1]);
    }
    if (minX > maxX) return 1.2;
    return Math.max((maxX - minX) * Math.cos(c[1] * RAD), maxY - minY, 0.4);
  }

  /* Close enough to tell Belgium from the Netherlands, far enough that its
     neighbours are still on screen — the neighbours are what make it a
     question rather than a shape. Luxembourg and Russia cannot share a camera
     height, and the ceiling keeps the planet reading as a planet. */
  static zoomFor(code) {
    return clamp(20 / Globe.span(code), 1.05, 3.6);
  }

  flyTo(code, { ms = 1500, zoom = null } = {}) {
    const target = CENTRE[code];
    if (!target) return Promise.resolve();
    if (zoom === null) zoom = Globe.zoomFor(code);
    if (this.calm) ms = 260;
    const [tLon, tLat] = target;
    const from = { lon: this.lon, lat: this.lat, zoom: this.zoom };
    /* project() centres whatever the camera's own lon/lat are, so the camera
       takes the target's coordinates directly. Negating the longitude sent it
       to the opposite side of the planet — Afghanistan put us over Mexico. */
    const to = {
      lon: shortest(this.lon, tLon),
      lat: clamp(tLat, -72, 72),
      zoom,
    };
    return this.animate(from, to, ms);
  }

  animate(from, to, ms) {
    if (this._anim) this._anim.cancel();
    return new Promise((resolve) => {
      const t0 = performance.now();
      let cancelled = false, done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.lon = to.lon; this.lat = to.lat; this.zoom = to.zoom;
        this._anim = null;
        resolve();
      };
      this._anim = { cancel: () => { cancelled = true; done = true; resolve(); } };
      const step = (now) => {
        if (cancelled || done) return;
        const t = clamp((now - t0) / ms, 0, 1);
        const e = easeInOut(t);
        this.lon = from.lon + (to.lon - from.lon) * e;
        this.lat = from.lat + (to.lat - from.lat) * e;
        /* dip out and back in — the cinematic bit */
        const dip = this.calm ? 0
          : Math.sin(t * Math.PI) * (0.08 + Math.abs(to.zoom - from.zoom) * 0.16);
        this.zoom = (from.zoom + (to.zoom - from.zoom) * e) - dip;
        if (t < 1) requestAnimationFrame(step);
        else finish();
      };
      requestAnimationFrame(step);
      /* A backstop on a timer. Browsers pause animation frames whenever the tab
         is not being painted, and an await on one would otherwise never return
         — the quiz would sit on a blank planet forever. */
      setTimeout(finish, ms + 400);
    });
  }

  start() { if (!this._raf) this.loop(); }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }
  loop() {
    this._raf = requestAnimationFrame(() => this.loop());
    /* The planet turns while you are looking at it and stops while you are
       working on it. Drifting under a question moves the star off the country
       you were reading, which is the one thing the view has to keep still. */
    if (!this._anim && !this.dragging && !this.hold && this.spin) this.lon = (this.lon + this.spin) % 360;
    this.draw();
  }

  /* ── drawing ──────────────────────────────────────────────── */
  draw() {
    /* Self-heal the buffer size. ResizeObserver and animation frames are both
       delivered by the rendering pipeline, so neither can be relied on to tell
       us the box changed — and a buffer sized for the old box gets stretched
       into an ellipse. Checking here costs nothing and cannot be missed,
       because if nothing is drawing then nothing is wrong. */
    const rect = this.canvas.getBoundingClientRect();
    if (Math.abs(rect.width - this.w) > 1 || Math.abs(rect.height - this.h) > 1) this.resize();

    const { ctx, cx, cy } = this;
    const R = this.r * this.zoom;
    ctx.clearRect(0, 0, this.w, this.h);
    this.drawStars();

    /* the ocean, lit from the upper left so the sphere reads as a sphere */
    const sea = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.46, R * 0.05, cx, cy, R);
    sea.addColorStop(0, this.c('--globe-sea-lit', '#e8efe4'));
    sea.addColorStop(0.55, this.c('--globe-sea', '#cfdcc9'));
    sea.addColorStop(1, this.c('--globe-sea-dark', '#9fb39a'));
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = sea; ctx.fill();

    /* the graticule, faint — it sells the curvature more than anything else */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = this.c('--globe-grid', 'rgba(255,255,255,.28)');
    ctx.lineWidth = 0.6;
    for (let lat = -60; lat <= 60; lat += 30) this.strokeParallel(lat);
    for (let lon = 0; lon < 360; lon += 30) this.strokeMeridian(lon);
    ctx.restore();

    /* land */
    const landFill = this.c('--globe-land', '#6f8f52');
    const landDim = this.c('--globe-land-dim', '#b9c6ad');
    const edge = this.c('--globe-edge', 'rgba(30,42,24,.35)');
    for (const [code, rings] of Object.entries(SHAPES)) {
      const isMark = code === this.marked;
      const isHover = code === this.hover;
      ctx.beginPath();
      let drew = false;
      for (const ring of rings) if (this.tracePath(ring)) drew = true;
      if (!drew) continue;
      const mark = this.c('--globe-mark', '#c9553d');
      ctx.fillStyle = isMark
        ? (this.revealed ? mark : this.c('--globe-marked-fill', landFill))
        : isHover ? this.c('--globe-hover', '#88a765')
        : this.dim ? landDim : landFill;
      ctx.fill();
      /* The country in question is drawn as a country, not as a dot on top of
         one — you should be able to see its shape and where its borders run. */
      if (isMark) {
        ctx.save();
        ctx.shadowColor = mark; ctx.shadowBlur = 14;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.6; ctx.strokeStyle = mark; ctx.stroke();
        ctx.restore();
      } else {
        ctx.lineWidth = 0.5; ctx.strokeStyle = edge; ctx.stroke();
      }
    }

    /* the limb: a soft rim, then the atmosphere bleeding outward */
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = this.c('--globe-rim', 'rgba(40,60,32,.45)');
    ctx.lineWidth = 1; ctx.stroke();
    const halo = ctx.createRadialGradient(cx, cy, R * 0.985, cx, cy, R * 1.09);
    halo.addColorStop(0, this.c('--globe-halo', 'rgba(150,190,130,.5)'));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.09, 0, Math.PI * 2);
    ctx.fillStyle = halo; ctx.fill();

    if (this.marked) this.drawMarker();
  }

  strokeParallel(lat) {
    const ctx = this.ctx; let started = false; ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = this.project(lon, lat);
      if (!p) { started = false; continue; }
      started ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      started = true;
    }
    ctx.stroke();
  }
  strokeMeridian(lon) {
    const ctx = this.ctx; let started = false; ctx.beginPath();
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = this.project(lon, lat);
      if (!p) { started = false; continue; }
      started ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      started = true;
    }
    ctx.stroke();
  }

  /* A ring straddling the horizon has to be broken, or the shape closes across
     the face of the planet and paints a wedge over everything. */
  tracePath(ring) {
    const ctx = this.ctx;
    let started = false, any = false;
    for (let i = 0; i < ring.length; i += 2) {
      const p = this.project(ring[i], ring[i + 1]);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
      any = true;
    }
    if (any) ctx.closePath();
    return any;
  }

  drawMarker() {
    const c = CENTRE[this.marked];
    if (!c) return;
    const p = this.project(c[0], c[1]);
    if (!p) return;
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    const pulse = this.calm ? 1 : 1 + Math.sin(t * 2.4) * 0.12;
    const col = this.c('--globe-mark', '#c9553d');

    /* a ring that breathes, so the eye finds it without a label */
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.arc(p[0], p[1], 20 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    star(ctx, p[0], p[1], 5, 10.5, 4.6);
    ctx.fillStyle = col;
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 1;
    ctx.fill();
    ctx.restore();
  }

  drawStars() {
    const ctx = this.ctx;
    if (!this._stars) {
      /* fixed seed so the sky does not shimmer between frames or reloads */
      let s = 20260813;
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      this._stars = Array.from({ length: 90 }, () => ({
        x: rnd() * this.w, y: rnd() * this.h, r: rnd() * 1.1 + 0.25, a: rnd() * 0.5 + 0.15,
      }));
    }
    const col = this.c('--globe-star', '');
    if (!col) return;                     // light theme draws no sky
    ctx.save();
    for (const st of this._stars) {
      const d = Math.hypot(st.x - this.cx, st.y - this.cy);
      if (d < this.r * this.zoom * 1.05) continue;      // never behind the planet
      ctx.globalAlpha = st.a;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
    }
    ctx.restore();
  }

  c(name, fallback) {
    const v = getComputedStyle(this.canvas).getPropertyValue(name).trim();
    return v || fallback;
  }
}

function star(ctx, x, y, points, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/* ray casting over a flat [lon,lat,lon,lat,…] ring */
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (Math.abs(xi - xj) > 180) continue;        // segment wraps the date line
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export { META, CENTRE, SHAPES };

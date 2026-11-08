/* =====================================================================
   ARCADE KIT - shared pieces for Smarty Stars' arcade games (games/*.js)
   - start(main, makeScene, thing) / stop(): loads the Phaser game engine and runs a scene in the
     .arcade box, carefully: three download sites, a 2-second font limit, a plain-graphics fallback
     if WebGL breaks, and an on-screen error with a Try again button instead of a blank box.
   - sceneReady(): call at the end of the scene's create() to hide the loading message.
   - html(text): the HTML a game's render() returns.
   - sound.tone / sound.noise: little sound effects made with Web Audio (no sound files).
   - draw.*: canvas drawing helpers for making textures in code (see games/zombie-splat.js).
   - question(age): the age-based question every arcade game asks.
   Plain ASCII on purpose (special characters are \u codes).
   ===================================================================== */
(function(){
'use strict';
const SS = window.SmartyStars;
if (!SS) return;
const INK = '#2B1B3D';
const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
const PHASER_URLS = [   // the same game engine file from three different sites, tried in order
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js',
  'https://unpkg.com/phaser@3.80.1/dist/phaser.min.js'
];

/* ---------- Questions ----------
   question(age) -> {sign, show, say, math}: sign = the short answer a zombie holds or a ball shows,
   show = what the banner shows, say = what the voice reads. Ages 4-5: letters and numbers; 6-8: + - x. */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function question(age){
  const add = max => { const s = SS.rint(2, max), a = SS.rint(1, s - 1); return {sign:'' + s, show:a + ' + ' + (s - a), say:a + ' plus ' + (s - a), math:true}; };
  const sub = max => { const a = SS.rint(3, max), b = SS.rint(1, a - 1); return {sign:'' + (a - b), show:a + ' \u2212 ' + b, say:a + ' minus ' + b, math:true}; };
  const times = () => { const t = SS.pick([2, 5, 10]), n = SS.rint(1, 10); return {sign:'' + (t * n), show:n + ' \u00D7 ' + t, say:n + ' times ' + t, math:true}; };
  const letter = lower => { const L = SS.pick(ABC); return {sign:L, show:lower ? L.toLowerCase() : L, say:'the letter ' + L}; };
  const number = max => { const n = SS.rint(1, max); return {sign:'' + n, show:'' + n, say:'number ' + n}; };
  if (age <= 4) return Math.random() < .6 ? letter(false) : number(10);
  if (age === 5) return Math.random() < .6 ? letter(true) : number(20);   // banner shows "b", zombie holds "B"
  if (age === 6) return add(10);
  if (age === 7) return Math.random() < .5 ? add(20) : sub(20);
  const r = Math.random();
  return r < .3 ? add(20) : r < .6 ? sub(20) : times();
}

/* ---------- Sound effects (made with Web Audio, no sound files) ---------- */
let AC = null;
function ac(){
  if (!SS.soundOn()) return null;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch(e){ return null; }
  return AC;
}
function tone(f1, f2, dur, type, vol, delay){
  const a = ac(); if (!a) return;
  const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .2, t + .012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, freq, vol, type, delay){
  const a = ac(); if (!a) return;
  const t = a.currentTime + (delay || 0);
  const len = Math.max(1, Math.floor(a.sampleRate * dur)), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = type || 'lowpass'; f.frequency.value = freq; g.gain.value = vol || .3;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
}

/* ---------- Drawing helpers (plain canvas, so it works on every phone) ---------- */
function mk(w, h){ const c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h)); return c; }
function rr(x, X, Y, w, h, r){ r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function paint(x, fill, lw, stroke){
  if (fill){ x.fillStyle = fill; x.fill(); }
  if (lw){ x.lineWidth = lw; x.strokeStyle = stroke || INK; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
}
function path(x, d, fill, lw, stroke){
  const p = new Path2D(d);
  if (fill){ x.fillStyle = fill; x.fill(p); }
  if (lw){ x.lineWidth = lw; x.strokeStyle = stroke || INK; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(p); }
}
function oval(x, cx, cy, rx, ry, fill, lw, rot){ x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2); paint(x, fill, lw); }
function limb(x, pts, w, fill){   // a thick outlined arm or leg through the points
  const go = () => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); };
  x.lineJoin = 'round'; x.lineCap = 'round';
  go(); x.strokeStyle = INK; x.lineWidth = w + 12; x.stroke();
  go(); x.strokeStyle = fill; x.lineWidth = w; x.stroke();
}
function hand(x, cx, cy, r, fill, ang){   // round hand with three stubby fingers pointing toward ang
  for (let i = -1; i <= 1; i++){ const a = ang + i * 0.6; oval(x, cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05, r * .46, r * .46, fill, 5); }
  oval(x, cx, cy, r, r, fill, 5);
}
function seeded(s){ return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function tex(scene, key, w, h, draw, k){
  k = k || 2;
  const c = mk(w * k, h * k), x = c.getContext('2d');
  x.scale(k, k); draw(x, w, h);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

/* ---------- Starting and stopping (called by the app) ----------
   Starting is careful because it has to work on every phone and network:
   - the game engine is tried from three different download sites,
   - the font gets at most 2 seconds (some Safari versions can wait forever),
   - if the fast graphics mode (WebGL) breaks, it tries again in plain canvas mode,
   - and if it still fails, the box says what went wrong instead of staying blank. */
let game = null, ro = null, token = null, phaserLoading = null, onSceneReady = null;
function loadScript(src, ms){
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => { fail(new Error('too slow: ' + src.split('/')[2])); }, ms);
    s.src = src;
    s.onload = () => { clearTimeout(timer); if (window.Phaser) ok(); else fail(new Error('bad file from ' + src.split('/')[2])); };
    s.onerror = () => { clearTimeout(timer); s.remove(); fail(new Error('blocked: ' + src.split('/')[2])); };
    document.head.appendChild(s);
  });
}
function loadPhaser(){
  if (window.Phaser) return Promise.resolve();
  if (!phaserLoading){
    let chain = Promise.reject(new Error('none tried'));
    PHASER_URLS.forEach(u => { chain = chain.catch(() => window.Phaser ? null : loadScript(u, 20000)); });
    phaserLoading = chain.catch(err => { phaserLoading = null; throw new Error('The game engine would not download (' + err.message + ').'); });
  }
  return phaserLoading;
}
function fontReady(ms){
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([document.fonts.load('800 40px "Baloo 2"').catch(() => {}), new Promise(ok => setTimeout(ok, ms))]);
}
function stopGame(){
  if (ro){ ro.disconnect(); ro = null; }
  if (game){ try { game.destroy(true); } catch(e){} game = null; }
}
function start(main, makeScene, thing){
  thing = thing || 'game';
  const box = main.querySelector('#arcade'), msg = box.querySelector('.arcade-msg'), my = token = {};
  const show = html => { if (token === my && msg){ msg.style.display = ''; msg.innerHTML = html; } };
  const loading = step => show('<div>Loading the ' + thing + '...<div class="arcade-detail">' + step + '</div></div>');
  const slow = setTimeout(() => loading('Still working on it. Slow internet? Give it a few more seconds.'), 10000);
  let triedCanvas = false;
  const onErr = e => fail((e && (e.error || e.reason)) || new Error((e && e.message) || 'unknown problem'));
  const listen = on => ['error', 'unhandledrejection'].forEach(t => on ? window.addEventListener(t, onErr) : window.removeEventListener(t, onErr));
  function fail(err){
    if (token !== my) return;
    listen(false); stopGame();
    if (!triedCanvas && window.Phaser){ triedCanvas = true; return start(Phaser.CANVAS); }   // try the simpler drawing mode once
    clearTimeout(slow);
    show('<div>Uh oh, the ' + thing + ' got stuck!<div class="arcade-detail">Tell a grown-up: ' + SS.esc(String((err && err.message) || err).slice(0, 180)) +
      '</div><button class="btn" id="zsRetry" type="button" style="margin-top:16px">Try again</button></div>');
    const b = box.querySelector('#zsRetry');
    if (b) b.addEventListener('click', () => { if (token === my) start(main, makeScene, thing); });
  }
  function start(type){
    if (token !== my) return;
    loading(type === Phaser.CANVAS ? 'trying simple graphics' : 'getting ready to play');
    listen(true);
    onSceneReady = () => { if (token !== my) return; clearTimeout(slow); listen(false); msg.style.display = 'none'; };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => [Math.max(200, Math.round(box.clientWidth * dpr)), Math.max(200, Math.round(box.clientHeight * dpr))];
    const [w, h] = size();
    try {
      game = new Phaser.Game({
        type, parent: box, backgroundColor: '#120A26', banner: false,
        scale: {mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / dpr},
        audio: {noAudio: true},
        scene: [makeScene()]
      });
    } catch(e){ return fail(e); }
    if (window.ResizeObserver){
      ro = new ResizeObserver(() => { if (!game) return; const [nw, nh] = size(); if (nw !== game.scale.width || nh !== game.scale.height) game.scale.resize(nw, nh); });
      ro.observe(box);
    }
  }
  box.addEventListener('pointerdown', () => ac());   // phones only allow sound after a tap
  loading('downloading the game');
  loadPhaser()
    .then(() => { if (token === my) loading('getting the letters ready'); return fontReady(2000); })
    .then(() => start(Phaser.AUTO))
    .catch(fail);
}
function stop(){
  token = null; onSceneReady = null;
  stopGame();
  SS.hush();
}

window.ArcadeKit = {
  INK, FONT, question, start, stop,
  sceneReady: () => { if (onSceneReady) onSceneReady(); },
  html: text => '<div class="arcade" id="arcade"><div class="arcade-msg">' + SS.esc(text || 'Loading...') + '</div></div>',
  sound: {ac, tone, noise},
  draw: {mk, rr, paint, path, oval, limb, hand, seeded, tex}
};
})();

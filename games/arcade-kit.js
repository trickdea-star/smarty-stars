/* =====================================================================
   ARCADE KIT - shared pieces for Smarty Stars' arcade games (games/*.js)
   - start(main, makeScene, thing) / stop(): loads the Phaser game engine and runs a scene in the
     .arcade box, carefully: three download sites, a 2-second font limit, a plain-graphics fallback
     if WebGL breaks, and an on-screen error with a Try again button instead of a blank box.
   - sceneReady(): call at the end of the scene's create() to hide the loading message.
   - html(text): the HTML a game's render() returns.
   - sound.tone / sound.noise: little sound effects made with Web Audio (no sound files).
   - draw.*: canvas drawing helpers for making textures in code (see games/zombie-splat.js).
   - question(age, opts) / showOptions(): what to practice - see the section below.
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

/* ---------- What to practice ----------
   Each arcade game opens with a "pick what to practice" screen (showOptions below). The choice is saved
   per player and per game, and question(age, opts) follows it:
     ages 3-5: 'abc' (letters), 'colors', 'numbers', or 'young-mix' (all three)
     ages 6-8: 'add', 'sub', 'mul', 'div' or 'mix', plus nums: the 1 or 2 numbers to practice
               (e.g. [7] = the sevens: 7 x 1 ... 7 x 12, 56 / 7, 15 - 7, 7 + 9), or [] for all of them.
   question() returns {kind, sign, show, say, math, color}: sign = the short answer a zombie holds or a ball
   shows (for colors, the color's name - games draw a colored dot), show = the banner text, say = what the
   voice reads. If you add a question type, add its sentences to tools/voice_lines.py too. */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COLORS = [
  {id:'red', hex:'#E63946'}, {id:'orange', hex:'#FF8C1A'}, {id:'yellow', hex:'#FFD23F'}, {id:'green', hex:'#3BB273'},
  {id:'blue', hex:'#3E8EF7'}, {id:'purple', hex:'#8E5CF7'}, {id:'pink', hex:'#FF6FB5'}, {id:'brown', hex:'#8B5A2B'},
  {id:'black', hex:'#222222'}, {id:'white', hex:'#FFFFFF'}
];
const YOUNG_MODES = [
  {id:'abc', label:'ABC', icon:'\uD83D\uDD24', say:'Letters!'},
  {id:'colors', label:'Colors', icon:'\uD83C\uDFA8', say:'Colors!'},
  {id:'numbers', label:'Numbers', icon:'\uD83D\uDD22', say:'Numbers!'},
  {id:'young-mix', label:'Mix', icon:'\uD83D\uDD00', say:'Mix it up!'}
];
const MATH_MODES = [
  {id:'add', label:'Adding', icon:'\u2795', say:'Adding!'},
  {id:'sub', label:'Taking away', icon:'\u2796', say:'Taking away!'},
  {id:'mul', label:'Times', icon:'\u2716\uFE0F', say:'Times!'},
  {id:'div', label:'Dividing', icon:'\u2797', say:'Dividing!'},
  {id:'mix', label:'Mix', icon:'\uD83D\uDD00', say:'Mix it up!'}
];
const NUM_WORDS = {1:'ones', 2:'twos', 3:'threes', 4:'fours', 5:'fives', 6:'sixes', 7:'sevens', 8:'eights',
  9:'nines', 10:'tens', 11:'elevens', 12:'twelves', 20:'twenties'};
const ONE_TO_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const young = age => age <= 5;
const numbersFor = mode => mode === 'add' || mode === 'sub' || mode === 'mix' ? ONE_TO_12.concat([20]) : ONE_TO_12;   // 20s only for + and -
function defaultOpts(age){ return {mode: young(age) ? 'young-mix' : age >= 8 ? 'mix' : 'add', nums: []}; }
function cleanOpts(age, o){
  const modes = young(age) ? YOUNG_MODES : MATH_MODES, d = defaultOpts(age);
  if (!o || !modes.some(m => m.id === o.mode)) return d;
  const ok = numbersFor(o.mode);
  return {mode: o.mode, nums: (o.nums || []).filter(n => ok.indexOf(n) >= 0).slice(-2)};
}
function question(age, opts){
  opts = cleanOpts(age, opts);
  const letter = lower => { const L = SS.pick(ABC); return {kind:'letter', sign:L, show:lower ? L.toLowerCase() : L, say:'the letter ' + L}; };
  const number = max => { const n = SS.rint(1, max); return {kind:'number', sign:'' + n, show:'' + n, say:'number ' + n}; };
  const color = () => { const c = SS.pick(COLORS); return {kind:'color', sign:c.id, show:c.id.toUpperCase(), say:'the color ' + c.id, color:c.hex}; };
  if (young(age)){
    const m = opts.mode === 'young-mix' ? SS.pick(['abc', 'colors', 'numbers']) : opts.mode;
    if (m === 'abc') return letter(age === 5);            // age 5: banner shows "b", the answer is "B"
    if (m === 'colors') return color();
    return number(age <= 4 ? 10 : 20);
  }
  let op = opts.mode === 'mix' ? SS.pick(['add', 'sub', 'mul', 'div']) : opts.mode;
  const n = SS.pick(opts.nums.length ? opts.nums : numbersFor(opts.mode)), k = SS.rint(1, 12);
  if (n === 20 && (op === 'mul' || op === 'div')) op = SS.pick(['add', 'sub']);
  const flip = Math.random() < .5;
  const q = (sign, a, sym, b, word) => ({kind:'math', math:true, sign:'' + sign, show:a + ' ' + sym + ' ' + b, say:a + ' ' + word + ' ' + b});
  if (op === 'add') return flip ? q(n + k, n, '+', k, 'plus') : q(n + k, k, '+', n, 'plus');
  if (op === 'sub') return flip ? q(k, n + k, '\u2212', n, 'minus') : q(n, n + k, '\u2212', k, 'minus');
  if (op === 'mul') return flip ? q(n * k, n, '\u00D7', k, 'times') : q(n * k, k, '\u00D7', n, 'times');
  return q(k, n * k, '\u00F7', n, 'divided by');
}

/* The start screen: big buttons to pick what to practice, then Play.
   cfg = {game, title, color, sub, age, onPlay(opts)}; it covers the game box until Play is tapped. */
let optsEl = null;
function hideOptions(){ if (optsEl){ optsEl.remove(); optsEl = null; } }
function showOptions(cfg){
  hideOptions();
  if (!curBox) return;
  const p = SS.player(), age = cfg.age;
  let o = cleanOpts(age, p && p.arcade && p.arcade[cfg.game]);
  const el = document.createElement('div');
  el.className = 'arcade-opts';
  const draw = () => {
    const modes = young(age) ? YOUNG_MODES : MATH_MODES;
    const nums = young(age) ? null : numbersFor(o.mode);
    el.innerHTML = '<div class="ao-card"><div class="ao-title" style="color:' + cfg.color + '">' + SS.esc(cfg.title) + '</div>' +
      (cfg.sub ? '<div class="ao-sub">' + SS.esc(cfg.sub) + '</div>' : '') +
      '<div class="ao-label">Pick what to practice</div><div class="ao-modes">' +
      modes.map(m => '<button type="button" class="ao-btn' + (m.id === o.mode ? ' on' : '') + '" data-o="mode" data-v="' + m.id + '" aria-pressed="' + (m.id === o.mode) + '">' +
        '<span class="emo">' + m.icon + '</span>' + m.label + '</button>').join('') + '</div>' +
      (nums ? '<div class="ao-label">Which numbers? <span class="ao-small">All, or pick 1 or 2</span></div><div class="ao-nums">' +
        '<button type="button" class="ao-num ao-all' + (o.nums.length ? '' : ' on') + '" data-o="all">All</button>' +
        nums.map(n => '<button type="button" class="ao-num' + (o.nums.indexOf(n) >= 0 ? ' on' : '') + '" data-o="num" data-v="' + n + '" aria-pressed="' + (o.nums.indexOf(n) >= 0) + '">' + n + '</button>').join('') +
        '</div>' : '') +
      '<button type="button" class="btn go ao-play" data-o="play">Play! \u25B6</button></div>';
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-o]'); if (!b) return;
    ac();   // a tap: phones allow sound from here on
    const what = b.dataset.o;
    if (what === 'mode'){
      o.mode = b.dataset.v; o = cleanOpts(age, o);
      const m = (young(age) ? YOUNG_MODES : MATH_MODES).find(x => x.id === o.mode); SS.say(m.say);
    } else if (what === 'all'){ o.nums = []; SS.say('All the numbers!'); }
    else if (what === 'num'){
      const n = +b.dataset.v, i = o.nums.indexOf(n);
      if (i >= 0) o.nums.splice(i, 1); else { o.nums.push(n); if (o.nums.length > 2) o.nums.shift(); }   // keep the 2 newest
      if (i < 0) SS.say('The ' + NUM_WORDS[n] + '!');
    } else if (what === 'play'){
      if (p){ p.arcade = p.arcade || {}; p.arcade[cfg.game] = {mode:o.mode, nums:o.nums.slice()}; SS.save(); }
      hideOptions(); cfg.onPlay({mode:o.mode, nums:o.nums.slice()});
      return;
    }
    draw();
  });
  draw();
  curBox.appendChild(el); optsEl = el;
  SS.say('What do you want to practice?');
}
/* A colored dot texture per color ('sw-red', ...), for color questions on signs and balls. */
function colorTextures(scene){
  COLORS.forEach(c => tex(scene, 'sw-' + c.id, 100, 100, x => {
    oval(x, 50, 50, 45, 45, '#FFFFFF', 7);          // white ring, so orange shows on an orange ball and brown on a sign
    oval(x, 50, 50, 33, 33, c.hex, 4);
    oval(x, 40, 38, 9, 5, 'rgba(255,255,255,.55)', 0, -.6);
  }));
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
let game = null, ro = null, token = null, phaserLoading = null, onSceneReady = null, curBox = null;
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
  curBox = box; hideOptions();
  const show = html => { if (token === my && msg){ msg.style.display = ''; msg.innerHTML = html; } };
  const loading = step => show('<div>Loading the ' + thing + '...<div class="arcade-detail">' + step + '</div></div>');
  const slow = setTimeout(() => loading('Still working on it. Slow internet? Give it a few more seconds.'), 10000);
  let triedCanvas = false;
  const onErr = e => fail((e && (e.error || e.reason)) || new Error((e && e.message) || 'unknown problem'));
  const listen = on => ['error', 'unhandledrejection'].forEach(t => on ? window.addEventListener(t, onErr) : window.removeEventListener(t, onErr));
  function fail(err){
    if (token !== my) return;
    listen(false); stopGame();
    if (!triedCanvas && window.Phaser){ triedCanvas = true; return boot(Phaser.CANVAS); }   // try the simpler drawing mode once
    clearTimeout(slow);
    show('<div>Uh oh, the ' + thing + ' got stuck!<div class="arcade-detail">Tell a grown-up: ' + SS.esc(String((err && err.message) || err).slice(0, 180)) +
      '</div><button class="btn" id="zsRetry" type="button" style="margin-top:16px">Try again</button></div>');
    const b = box.querySelector('#zsRetry');
    if (b) b.addEventListener('click', () => { if (token === my) start(main, makeScene, thing); });
  }
  function boot(type){   // (named boot, not start: the Try again button must call the outer start)
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
    .then(() => boot(Phaser.AUTO))
    .catch(fail);
}
function stop(){
  token = null; onSceneReady = null; hideOptions(); curBox = null;
  stopGame();
  SS.hush();
}

window.ArcadeKit = {
  INK, FONT, COLORS, question, start, stop, showOptions, hideOptions, colorTextures,
  isYoung: young,
  sceneReady: () => { if (onSceneReady) onSceneReady(); },
  html: text => '<div class="arcade" id="arcade"><div class="arcade-msg">' + SS.esc(text || 'Loading...') + '</div></div>',
  sound: {ac, tone, noise},
  draw: {mk, rr, paint, path, oval, limb, hand, seeded, tex}
};
})();

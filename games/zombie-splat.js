/* =====================================================================
   ZOMBIE SPLAT - an arcade game for Smarty Stars
   Goofy zombies climb out of the graveyard and shuffle toward your fort,
   each holding a sign. The voice asks for one ("Splat the letter B!" or
   "What is 3 plus 4?"). Tap that zombie to splat it with goo before it
   knocks the boards off your fort.
   - Ages 4-5: letters and numbers. Ages 6-8: adding, taking away, times tables.
   - Rounds get faster. 5 right in a row earns a GOO BOMB that splats everyone.
   - 1 star per right answer, +2 for clearing a round.
   Uses the free Phaser game engine, downloaded the first time the game opens.
   This file is plain ASCII on purpose (special characters are \u codes).
   ===================================================================== */
(function(){
'use strict';
const SS = window.SmartyStars;
if (!SS) return;
const PHASER_URLS = [   // the same game engine file from three different sites, tried in order
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js',
  'https://unpkg.com/phaser@3.80.1/dist/phaser.min.js'
];
const INK = '#2B1B3D';
const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';

/* ---------- THE ZOMBIES ----------
   To add a kid's drawing: cut it out with tools/cutout_drawing.py into assets/zombies/, then add a line:
     {name:'Mr. Stinky', kind:'runner', art:'assets/zombies/mr-stinky.webp'},
   kind: 'walker' = normal, 'crawler' = slow and low to the ground, 'runner' = fast (shows up from round 2),
         'boss' = big and slow, takes 2 splats (shows up from round 3).
   weight (optional) = how often it shows up compared with the others; the kids' own zombies show up most.
   art that starts with '@' is one of the built-in cartoon zombies drawn further down. */
const ZOMBIES = [
  {name:'Creepy Crawler', kind:'crawler', art:'assets/zombies/crawler.webp?v=1', weight:7},   // drawn by DJ's kid
  {name:'Bone Hand',      kind:'walker',  art:'assets/zombies/arm-up.webp?v=1',  weight:7},   // drawn by DJ's kid
  {name:'Gloop',          kind:'walker',  art:'@walker'},
  {name:'Zippy',          kind:'runner',  art:'@runner'},
  {name:'Big Moe',        kind:'boss',    art:'@boss'}
];
const KINDS = {
  walker:  {speed:1.0,  size:1.0,  hits:1, fromRound:1, weight:4},
  crawler: {speed:0.8,  size:1.2,  hits:1, fromRound:1, weight:4},
  runner:  {speed:1.65, size:0.9,  hits:1, fromRound:2, weight:3},
  boss:    {speed:0.62, size:1.28, hits:2, fromRound:3, weight:2}
};
const weightOf = z => z.weight || KINDS[z.kind].weight;

/* ---------- Questions ----------
   Each zombie carries one: sign = what it holds, show = what the banner shows, say = what the voice says. */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function makeQuestion(age){
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
function settings(age, round){
  age = Math.max(4, Math.min(8, age || 6));
  const walk = {4:24, 5:21, 6:18, 7:16, 8:14}[age];      // seconds from the graveyard to the fence in round 1
  return {
    walkSecs: Math.max(6, walk * Math.pow(0.92, round - 1)),
    onScreen: Math.min(5, (age <= 4 ? 2 : age <= 6 ? 3 : 4) + Math.floor((round - 1) / 3)),
    toClear: Math.min(12, 4 + round),
    bangSecs: age <= 5 ? 3.4 : 2.6,                      // seconds between board knocks
    hintSecs: age <= 5 ? 8 : 14                          // the right sign starts glowing after this long
  };
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
const SFX = {
  shoot(){ tone(820, 170, .16, 'sine', .2); },
  splat(){ noise(.32, 1100, .6); tone(170, 55, .28, 'triangle', .4); },
  boing(){ tone(240, 520, .1, 'square', .06); tone(520, 230, .16, 'square', .06, .1); },
  crack(){ noise(.16, 2400, .55, 'bandpass'); tone(110, 45, .22, 'triangle', .35); },
  bomb(){ noise(1.0, 700, .8); tone(220, 40, .9, 'sawtooth', .12); },
  groan(){ tone(150, 95, .55, 'sawtooth', .04); },
  rise(){ noise(.25, 380, .3); },
  fanfare(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, .2, 'triangle', .2, i * .12)); },
  sad(){ [392, 330, 262].forEach((f, i) => tone(f, f * .97, .28, 'triangle', .18, i * .2)); }
};

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

/* ---------- Built-in zombies (drawn in a 300 x 430 box, feet at the bottom) ---------- */
const ART = {
  walker(x){   // "Gloop": green, torn blue shirt, one big eye
    const skin = '#8BD46A', shade = '#72BB55';
    path(x, 'M104 296 L196 296 L198 396 L160 396 L150 338 L140 396 L102 396 Z', '#7A5230', 6);
    path(x, 'M102 396 L110 386 L118 396 L126 386 L134 396 M166 396 L174 386 L182 396 L190 386 L198 396', null, 4);
    oval(x, 120, 408, 30, 13, '#3A2A44', 6); oval(x, 180, 408, 30, 13, '#3A2A44', 6);
    path(x, 'M96 196 Q150 176 204 196 L210 300 L196 290 L184 304 L170 290 L156 304 L142 290 L128 304 L114 290 L90 300 Z', '#4E7FD9', 6);
    rr(x, 160, 232, 28, 24, 4); paint(x, '#F2C14E', 4);
    path(x, 'M164 240 L184 240 M164 248 L184 248', null, 3);
    limb(x, [[110, 212], [62, 224], [40, 196]], 26, skin); hand(x, 36, 184, 15, skin, -1.9);
    limb(x, [[190, 212], [244, 206], [266, 228]], 26, skin); hand(x, 270, 240, 15, skin, 1.3);
    oval(x, 108, 210, 21, 19, '#4E7FD9', 6); oval(x, 192, 210, 21, 19, '#4E7FD9', 6);
    rr(x, 134, 164, 32, 34, 9); paint(x, skin, 6);
    oval(x, 150, 112, 74, 68, skin, 6);
    path(x, 'M102 76 L108 40 L126 62 L136 28 L150 58 L166 26 L172 60 L192 38 L198 78 Q150 52 102 76 Z', '#2F5D3A', 6);
    oval(x, 122, 110, 27, 29, shade, 0); oval(x, 182, 104, 19, 19, shade, 0);
    oval(x, 122, 106, 22, 24, '#FFFFFF', 5); oval(x, 127, 112, 8.5, 8.5, INK, 0); oval(x, 130, 108, 2.8, 2.8, '#FFFFFF', 0);
    oval(x, 182, 102, 14, 14, '#FFF7C2', 5); oval(x, 179, 105, 5.5, 5.5, INK, 0);
    path(x, 'M166 82 L198 88', null, 7);
    path(x, 'M114 148 Q150 180 190 142 Q178 164 150 166 Q128 166 114 148 Z', '#3A0F2F', 6);
    rr(x, 134, 150, 13, 11, 2); paint(x, '#FFFFFF', 3);
    oval(x, 168, 158, 10, 5, '#FF7FA8', 0);
    path(x, 'M190 118 L208 136 M194 130 L202 124 M200 136 L208 130', null, 3.5);
    path(x, 'M118 152 Q115 166 120 172 Q125 166 122 152 Z', '#BDF3FF', 3);
  },
  runner(x){   // "Zippy": teal, red hoodie, tongue out, arms up
    const skin = '#7FD1C1';
    limb(x, [[134, 318], [126, 392]], 16, skin); limb(x, [[166, 318], [176, 392]], 16, skin);
    rr(x, 114, 358, 24, 30, 5); paint(x, '#FFFFFF', 4); rr(x, 164, 358, 24, 30, 5); paint(x, '#FFFFFF', 4);
    path(x, 'M116 366 L136 366 M116 376 L136 376 M166 366 L186 366 M166 376 L186 376', null, 4, '#E2504C');
    path(x, 'M96 406 Q96 386 120 386 L138 388 Q146 402 140 412 L102 412 Q96 410 96 406 Z', '#E2504C', 6);
    path(x, 'M204 406 Q204 386 180 386 L162 388 Q154 402 160 412 L198 412 Q204 410 204 406 Z', '#E2504C', 6);
    path(x, 'M108 280 L192 280 L198 330 L156 330 L150 306 L144 330 L102 330 Z', '#3B3B6D', 6);
    limb(x, [[112, 204], [68, 186], [50, 148]], 24, '#E2504C'); hand(x, 48, 134, 14, skin, -1.6);
    limb(x, [[188, 204], [232, 180], [248, 140]], 24, '#E2504C'); hand(x, 250, 126, 14, skin, -1.4);
    path(x, 'M104 186 Q150 170 196 186 L202 292 L98 292 Z', '#E2504C', 6);
    path(x, 'M122 252 L178 252 L184 284 L116 284 Z', '#C93F3B', 4);
    path(x, 'M140 196 L136 230 M160 196 L164 230', null, 4);
    oval(x, 150, 112, 72, 72, '#C93F3B', 6);
    oval(x, 150, 120, 56, 58, skin, 6);
    x.beginPath(); x.ellipse(150, 114, 64, 66, 0, Math.PI * 0.96, Math.PI * 2.04); x.lineWidth = 12; x.strokeStyle = '#E2504C'; x.stroke();
    oval(x, 130, 110, 16, 18, '#FFFFFF', 5); oval(x, 134, 106, 6.5, 6.5, INK, 0);
    oval(x, 172, 112, 18, 16, '#FFFFFF', 5); oval(x, 165, 118, 6.5, 6.5, INK, 0);
    path(x, 'M126 140 Q150 158 176 140', null, 6);
    path(x, 'M148 148 Q148 174 160 174 Q172 172 168 147 Z', '#FF7FA8', 5);
    oval(x, 118, 130, 3, 3, '#4E9E8E', 0); oval(x, 124, 136, 3, 3, '#4E9E8E', 0); oval(x, 184, 134, 3, 3, '#4E9E8E', 0);
  },
  boss(x){   // "Big Moe": huge, overalls, bandage, underbite
    const skin = '#A7B86E';
    path(x, 'M88 330 L212 330 L216 396 L162 396 L150 362 L138 396 L84 396 Z', '#3E6CF7', 6);
    oval(x, 110, 406, 36, 15, '#4A3426', 6); oval(x, 190, 406, 36, 15, '#4A3426', 6);
    limb(x, [[70, 222], [32, 262], [42, 300]], 42, skin); hand(x, 44, 314, 27, skin, 1.7);
    limb(x, [[230, 222], [272, 252], [262, 296]], 42, skin); hand(x, 260, 310, 27, skin, 1.4);
    oval(x, 150, 252, 100, 98, '#F2E1C1', 6);
    path(x, 'M70 226 L84 240 L92 222 L104 238', null, 4);
    path(x, 'M94 268 Q150 292 206 268 L210 338 L90 338 Z', '#3E6CF7', 6);
    path(x, 'M116 204 L184 204 L188 284 L112 284 Z', '#3E6CF7', 6);
    path(x, 'M118 208 L100 166 M182 208 L200 166', null, 14); path(x, 'M118 208 L100 166 M182 208 L200 166', null, 7, '#3E6CF7');
    oval(x, 124, 214, 6, 6, '#FFD23F', 3); oval(x, 176, 214, 6, 6, '#FFD23F', 3);
    rr(x, 134, 236, 32, 22, 4); paint(x, '#2F57C9', 3);
    path(x, 'M96 120 Q96 66 150 66 Q204 66 204 120 Q204 172 150 172 Q96 172 96 120 Z', skin, 6);
    path(x, 'M94 100 Q150 84 206 100 L206 118 Q150 102 94 118 Z', '#F5EBDD', 5);
    path(x, 'M120 92 L128 108 M176 92 L170 108', null, 3);
    path(x, 'M116 128 Q150 114 184 128', null, 10);
    oval(x, 132, 140, 9, 10, '#FFFFFF', 4); oval(x, 133, 142, 4, 4, INK, 0);
    oval(x, 168, 140, 9, 10, '#FFFFFF', 4); oval(x, 167, 142, 4, 4, INK, 0);
    path(x, 'M122 156 Q150 168 178 156 L178 162 Q150 184 122 162 Z', '#3A0F2F', 5);
    path(x, 'M130 162 L134 146 L140 163 Z M160 163 L166 146 L170 162 Z', '#FFFFFF', 3);
  }
};

/* ---------- Scenery and game pieces ---------- */
function drawBackground(W, H, hz){
  const c = mk(W, H), x = c.getContext('2d'), U = Math.min(W, H) / 100, rnd = seeded(7);
  let g = x.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#0E0722'); g.addColorStop(.6, '#2A1452'); g.addColorStop(1, '#5A2E78');
  x.fillStyle = g; x.fillRect(0, 0, W, hz + 2);
  x.fillStyle = '#FFF6D6';
  for (let i = 0; i < 80; i++){ x.globalAlpha = .25 + rnd() * .75; x.beginPath(); x.arc(rnd() * W, rnd() * hz * .85, (rnd() * .35 + .12) * U, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  const mx = W * .8, my = hz * .3, mr = Math.min(W, H) * .085;
  g = x.createRadialGradient(mx, my, mr * .6, mx, my, mr * 3.2);
  g.addColorStop(0, 'rgba(255,240,190,.45)'); g.addColorStop(1, 'rgba(255,240,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, hz);
  oval(x, mx, my, mr, mr, '#FFF1BF', 0);
  oval(x, mx - mr * .3, my - mr * .25, mr * .2, mr * .2, '#F0D98F', 0); oval(x, mx + mr * .35, my + mr * .2, mr * .14, mr * .14, '#F0D98F', 0); oval(x, mx - mr * .05, my + mr * .45, mr * .1, mr * .1, '#F0D98F', 0);
  x.fillStyle = '#2B1748'; x.beginPath(); x.moveTo(0, hz);
  for (let i = 0; i <= 8; i++){ const px = W * i / 8; x.quadraticCurveTo(px - W / 16, hz - H * (.03 + rnd() * .05), px, hz - H * .02); }
  x.lineTo(W, hz); x.closePath(); x.fill();
  x.strokeStyle = '#150A2A'; x.lineCap = 'round';
  const branch = (X, Y, len, ang, w, depth) => {
    const X2 = X + Math.cos(ang) * len, Y2 = Y + Math.sin(ang) * len;
    x.lineWidth = w; x.beginPath(); x.moveTo(X, Y); x.lineTo(X2, Y2); x.stroke();
    if (depth > 0){ const n = rnd() < .4 ? 3 : 2; for (let i = 0; i < n; i++) branch(X2, Y2, len * (.55 + rnd() * .2), ang + (rnd() - .5) * 1.5, w * .62, depth - 1); }
  };
  branch(W * .08, hz + 4, H * .085, -Math.PI / 2 + .1, H * .014, 4);
  branch(W * .93, hz + 4, H * .07, -Math.PI / 2 - .12, H * .012, 4);
  branch(W * .3, hz + 2, H * .035, -Math.PI / 2, H * .006, 3);
  g = x.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, '#1E3529'); g.addColorStop(1, '#2F6A40');
  x.fillStyle = g; x.fillRect(0, hz, W, H - hz);
  x.beginPath(); x.moveTo(W / 2 - W * .05, hz); x.lineTo(W / 2 + W * .05, hz); x.lineTo(W / 2 + W * .55, H); x.lineTo(W / 2 - W * .55, H); x.closePath();
  g = x.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#3E3026'); g.addColorStop(1, '#7A5E40');
  x.fillStyle = g; x.fill();
  const stone = (X, Y, w, h, cross) => {
    x.beginPath(); x.moveTo(X - w / 2, Y); x.lineTo(X - w / 2, Y - h + w / 2); x.arc(X, Y - h + w / 2, w / 2, Math.PI, 0); x.lineTo(X + w / 2, Y); x.closePath();
    paint(x, '#5B5577', Math.max(1.5, w * .08));
    if (cross){ x.strokeStyle = '#3D3858'; x.lineWidth = w * .1; x.beginPath(); x.moveTo(X, Y - h * .75); x.lineTo(X, Y - h * .3); x.moveTo(X - w * .2, Y - h * .6); x.lineTo(X + w * .2, Y - h * .6); x.stroke(); }
  };
  stone(W * .16, hz + H * .025, W * .05, H * .05, true); stone(W * .25, hz + H * .012, W * .035, H * .035, false);
  stone(W * .72, hz + H * .02, W * .045, H * .045, false); stone(W * .84, hz + H * .035, W * .06, H * .06, true);
  x.strokeStyle = '#183024'; x.lineWidth = Math.max(1, U * .35);
  for (let i = 0; i < 70; i++){
    const gx = rnd() * W, gy = hz + (H - hz) * Math.pow(rnd(), .7), s = U * (.6 + (gy - hz) / (H - hz) * 1.4);
    if (Math.abs(gx - W / 2) < (W * .05 + (gy - hz) / (H - hz) * W * .5)) continue;   // not on the dirt path
    x.beginPath(); x.moveTo(gx - s, gy); x.lineTo(gx - s * .3, gy - s * 1.6); x.moveTo(gx, gy); x.lineTo(gx + s * .2, gy - s * 2); x.moveTo(gx + s, gy); x.lineTo(gx + s * .4, gy - s * 1.4); x.stroke();
  }
  return c;
}
function makeTextures(scene){
  Object.keys(ART).forEach(k => tex(scene, 'z' + k, 300, 430, ART[k]));
  tex(scene, 'shadow', 200, 50, x => oval(x, 100, 25, 96, 22, 'rgba(0,0,0,.35)', 0), 1);
  tex(scene, 'goo', 64, 64, x => { oval(x, 32, 32, 26, 26, '#7CF05A', 5, null); x.strokeStyle = '#2E7D32'; x.lineWidth = 5; x.stroke(); oval(x, 24, 23, 8, 5, 'rgba(255,255,255,.7)', 0, -.5); });
  tex(scene, 'dirt', 32, 32, x => oval(x, 16, 16, 12, 12, '#6B4A2B', 0), 1);
  tex(scene, 'star', 64, 64, x => { x.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); paint(x, '#FFD23F', 4); });
  tex(scene, 'puddle', 240, 90, x => { path(x, 'M20 50 Q10 30 50 28 Q70 8 110 22 Q150 6 180 26 Q230 24 222 50 Q236 72 190 72 Q160 86 120 74 Q80 88 50 74 Q8 74 20 50 Z', '#7CF05A', 5, '#2E7D32'); oval(x, 90, 40, 22, 8, 'rgba(255,255,255,.45)', 0); });
  tex(scene, 'fog', 512, 160, (x, w, h) => { x.save(); x.translate(w / 2, h / 2); x.scale(1, h / w); const g = x.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, 'rgba(225,215,255,.9)'); g.addColorStop(1, 'rgba(225,215,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, w / 2, 0, 7); x.fill(); x.restore(); }, 1);
  tex(scene, 'sign', 240, 130, x => { rr(x, 6, 10, 228, 112, 20); paint(x, INK); rr(x, 6, 4, 228, 112, 20); paint(x, '#F6E7C1', 6); path(x, 'M24 40 Q90 32 150 42 T216 38 M28 86 Q100 78 160 88 T214 82', null, 3, '#E3C98E'); oval(x, 22, 20, 4, 4, '#9AA0AA', 0); oval(x, 218, 20, 4, 4, '#9AA0AA', 0); });
  tex(scene, 'stick', 24, 200, x => { rr(x, 4, 2, 16, 196, 6); paint(x, '#8E5C2F', 4); });
  tex(scene, 'plank', 800, 80, x => { rr(x, 6, 8, 788, 64, 14); paint(x, '#B07A45', 6); path(x, 'M30 28 Q200 20 400 30 T780 26 M40 52 Q260 46 480 54 T770 50', null, 3, '#8E5C2F'); [44, 756].forEach(nx => { oval(x, nx, 40, 7, 7, '#C9CED6', 3); }); });
  tex(scene, 'post', 80, 400, x => { rr(x, 6, 6, 68, 388, 14); paint(x, '#8E5C2F', 6); path(x, 'M24 30 Q30 200 22 380 M52 20 Q46 180 56 370', null, 3, '#6F4422'); });
  tex(scene, 'blaster', 260, 300, x => {   // goo cannon seen from behind: barrel up, round goo tank at the bottom
    path(x, 'M86 210 L174 210 L162 58 L98 58 Z', '#6B7699', 6);
    path(x, 'M104 200 L112 70', null, 6, 'rgba(255,255,255,.35)');
    rr(x, 90, 150, 80, 18, 6); paint(x, '#FFD23F', 5);
    rr(x, 96, 100, 68, 16, 6); paint(x, '#FFD23F', 5);
    rr(x, 84, 28, 92, 42, 14); paint(x, '#FFD23F', 6);
    oval(x, 130, 34, 30, 9, '#2A3350', 4);
    path(x, 'M100 58 Q104 78 110 66 Q114 86 122 64', '#7CF05A', 4, '#2E7D32');
    rr(x, 30, 214, 34, 44, 12); paint(x, '#4E5A7A', 6); rr(x, 196, 214, 34, 44, 12); paint(x, '#4E5A7A', 6);
    oval(x, 130, 236, 66, 58, '#4E5A7A', 6);
    oval(x, 130, 240, 46, 40, '#7CF05A', 5, '#2E7D32');
    oval(x, 114, 228, 9, 9, '#C8FFB0', 0); oval(x, 144, 254, 6, 6, '#C8FFB0', 0); oval(x, 150, 224, 4.5, 4.5, '#C8FFB0', 0);
    oval(x, 106, 214, 14, 7, 'rgba(255,255,255,.55)', 0, -.5);
  });
  tex(scene, 'banner', 600, 180, x => { rr(x, 8, 18, 584, 150, 42); paint(x, INK); rr(x, 8, 8, 584, 150, 42); paint(x, '#FFF6D8', 8); });
  tex(scene, 'button', 400, 140, x => { rr(x, 8, 22, 384, 110, 55); paint(x, INK); rr(x, 8, 8, 384, 110, 55); paint(x, '#FFD23F', 8); });
  tex(scene, 'bomb', 200, 200, x => {
    path(x, 'M128 44 Q150 20 170 30', null, 8); oval(x, 172, 28, 12, 12, '#FFD23F', 5); oval(x, 172, 28, 5, 5, '#FF6B5E', 0);
    oval(x, 100, 112, 78, 78, '#3A2A5A', 8);
    path(x, 'M44 92 Q60 60 100 58 Q140 56 156 88 Q150 104 140 100 Q136 120 126 102 Q112 112 104 98 Q90 116 84 100 Q70 110 66 96 Q52 104 44 92 Z', '#7CF05A', 5, '#2E7D32');
    oval(x, 76, 80, 14, 8, 'rgba(255,255,255,.55)', 0, -.5);
  });
}

/* ---------- The game scene ---------- */
function makeScene(){
  return class ZombieScene extends Phaser.Scene {
    constructor(){ super('zombie'); }
    preload(){
      ZOMBIES.forEach((z, i) => { if (z.art.charAt(0) !== '@') this.load.image('zfile' + i, z.art); });
    }
    create(){
      this.p = SS.player();
      this.age = this.p ? this.p.age : 6;
      makeTextures(this);
      this.roster = ZOMBIES.map((z, i) => Object.assign({}, z, {key: z.art.charAt(0) === '@' ? 'z' + z.art.slice(1) : 'zfile' + i}))
        .filter(z => KINDS[z.kind] && this.textures.exists(z.key));
      this.zombies = []; this.round = 0; this.state = 'start'; this.bgN = 0;
      this.bg = this.add.image(0, 0, 'shadow').setOrigin(0).setDepth(0);
      this.fogs = [0, 1, 2].map(i => this.add.image(Math.random() * 1000, 0, 'fog').setDepth(6 + i).setAlpha(.14 + i * .04));
      this.posts = [0, 1].map(() => this.add.image(0, 0, 'post').setOrigin(.5, 0).setDepth(300));
      this.boards = [0, 1, 2, 3, 4].map(i => this.add.image(0, 0, 'plank').setDepth(310 + i));
      this.blaster = this.add.image(0, 0, 'blaster').setOrigin(.5, .9).setDepth(330);
      const T = (color, stroke) => this.add.text(0, 0, '', {fontFamily:FONT, fontStyle:'800', fontSize:'20px', color, stroke:stroke || INK, strokeThickness:0, align:'center'});
      this.banner = this.add.container(0, 0).setDepth(400).setVisible(false);
      this.bannerBg = this.add.image(0, 0, 'banner');
      this.bannerLabel = T(INK).setOrigin(.5);
      this.bannerText = T(INK).setOrigin(.5);
      this.banner.add([this.bannerBg, this.bannerLabel, this.bannerText]);
      this.roundText = T('#FFFFFF').setOrigin(0, .5).setDepth(400);
      this.progText = T('#FFFFFF').setOrigin(1, .5).setDepth(400);
      this.bombBtn = this.add.container(0, 0).setDepth(420).setVisible(false);
      this.bombImg = this.add.image(0, 0, 'bomb');
      this.bombText = T('#FFFFFF').setOrigin(.5).setText('GOO BOMB!');
      this.bombBtn.add([this.bombImg, this.bombText]);
      this.input.on('pointerdown', p => this.tap(p.x, p.y));
      this.scale.on('resize', () => this.layout());
      this.layout();
      this.showStart();
      if (/[?&]debug\b/.test(location.search)) window.ZS = this;   // for testing: open the page with ?debug
      if (onSceneReady) onSceneReady();
    }

    /* Everything is placed from the screen size, so phones, tablets and laptops all work. */
    layout(){
      const W = this.scale.width, H = this.scale.height;
      this.W = W; this.H = H;
      const u = this.u = Math.min(W, H * .62) / 100;
      this.horizon = H * .34; this.fenceTop = H * .78; this.feetY = H * .8;
      this.zh = Math.min(H * .27, W * .38);          // a zombie's height when it reaches the fence
      this.spread = W * .4;
      const key = 'bg' + (++this.bgN), old = this.bg.texture.key;
      this.textures.addCanvas(key, drawBackground(W, H, this.horizon));
      this.bg.setTexture(key).setPosition(0, 0).setDisplaySize(W, H);
      if (old.indexOf('bg') === 0) this.textures.remove(old);
      this.fogs.forEach((f, i) => f.setDisplaySize(W * 1.1, H * .1).setY(this.horizon + H * (.005 + .03 * i)));
      const ph = H * .045;
      this.boards.forEach((b, i) => {
        b.homeY = this.fenceTop + ph * .55 + i * ph * 1.1;
        b.homeAng = [-2.2, 1.6, -1.1, 2, -1.4][i];
        b.setDisplaySize(W * 1.12, ph);
        if (!b.gone) b.setPosition(W / 2, b.homeY).setAngle(b.homeAng).setAlpha(1);
      });
      this.posts[0].setPosition(W * .07, this.fenceTop - H * .025).setDisplaySize(W * .075, H - this.fenceTop + H * .03);
      this.posts[1].setPosition(W * .93, this.fenceTop - H * .025).setDisplaySize(W * .075, H - this.fenceTop + H * .03);
      this.blaster.setScale(H * .2 / this.blaster.height).setPosition(W / 2, H * 1.02);
      const bw = Math.min(W * .72, H * .42), bh = bw * .3;
      this.bannerBg.setDisplaySize(bw, bh);
      this.banner.setPosition(W / 2, H * .015 + bh / 2);
      this.bannerLabel.setFontSize(Math.round(bh * .2)).setY(-bh * .23);
      this.bannerText.setFontSize(Math.round(bh * .46)).setY(bh * .1);
      this.bannerBox = {x0: W / 2 - bw / 2, x1: W / 2 + bw / 2, y0: H * .015, y1: H * .015 + bh};
      const hy = H * .015 + bh + u * 5;
      this.roundText.setPosition(W * .04, hy).setFontSize(Math.round(u * 4.6)).setStroke(INK, Math.round(u * 1.1));
      this.progText.setPosition(W * .96, hy).setFontSize(Math.round(u * 4.6)).setStroke(INK, Math.round(u * 1.1));
      const br = Math.min(W, H) * .085;
      this.bombBtn.setPosition(W * .15, H * .875);
      this.bombImg.setDisplaySize(br * 2.1, br * 2.1);
      this.bombText.setFontSize(Math.round(br * .34)).setStroke(INK, Math.round(br * .09)).setY(br * .95);
      this.bombBox = {x: W * .15, y: H * .875, r: br * 1.2};
      this.zombies.forEach(z => this.sizeZombie(z));
      this.makeEmitters();
      this.layoutPanel();
    }
    makeEmitters(){
      [this.gooFx, this.starFx, this.dirtFx].forEach(e => { if (e) e.destroy(); });
      const u = this.u;
      this.gooFx = this.add.particles(0, 0, 'goo', {speed:{min:u * 30, max:u * 85}, angle:{min:0, max:360}, scale:{start:u * .055, end:u * .015}, lifespan:{min:450, max:900}, gravityY:u * 170, rotate:{min:0, max:360}, emitting:false}).setDepth(350);
      this.starFx = this.add.particles(0, 0, 'star', {speed:{min:u * 20, max:u * 60}, angle:{min:200, max:340}, scale:{start:u * .05, end:0}, lifespan:900, gravityY:u * 60, rotate:{min:-180, max:180}, emitting:false}).setDepth(352);
      this.dirtFx = this.add.particles(0, 0, 'dirt', {speed:{min:u * 8, max:u * 30}, angle:{min:210, max:330}, scale:{start:u * .035, end:0}, lifespan:650, gravityY:u * 90, emitting:false}).setDepth(150);
    }

    /* ---------- Screens inside the game ---------- */
    showStart(){
      this.state = 'start';
      for (let i = 0; i < 3; i++) this.spawn(true);
      const best = this.p && this.p.zombieBest ? 'Your best: Round ' + this.p.zombieBest : 'Splat the zombie the voice asks for!';
      this.showPanel('ZOMBIE SPLAT', best, 'START', () => { this.hidePanel(); ac(); this.startRound(1); });
    }
    showPanel(title, sub, btn, cb){
      this.hidePanel();
      const dim = this.add.rectangle(0, 0, 10, 10, 0x0A0518, .55).setOrigin(0);
      const t = this.add.text(0, 0, title, {fontFamily:FONT, fontStyle:'800', fontSize:'40px', color:'#9BFF6A', stroke:INK, strokeThickness:8, align:'center'}).setOrigin(.5);
      const s = this.add.text(0, 0, sub, {fontFamily:FONT, fontStyle:'800', fontSize:'20px', color:'#FFFFFF', stroke:INK, strokeThickness:4, align:'center'}).setOrigin(.5);
      const b = this.add.image(0, 0, 'button');
      const bt = this.add.text(0, 0, btn, {fontFamily:FONT, fontStyle:'800', fontSize:'30px', color:INK, align:'center'}).setOrigin(.5);
      this.panel = this.add.container(0, 0, [dim, t, s, b, bt]).setDepth(600);
      this.panelParts = {dim, t, s, b, bt, cb};
      this.layoutPanel();
      this.tweens.add({targets:b, scaleX:{from:b.scaleX * .6, to:b.scaleX}, scaleY:{from:b.scaleY * .6, to:b.scaleY}, duration:350, ease:'Back.Out'});
      this.tweens.add({targets:bt, scale:{from:.6, to:1}, duration:350, ease:'Back.Out'});
    }
    layoutPanel(){
      if (!this.panel) return;
      const {dim, t, s, b, bt} = this.panelParts, W = this.W, H = this.H, u = this.u;
      dim.setSize(W, H);
      t.setPosition(W / 2, H * .3).setFontSize(Math.round(u * 13)).setStroke(INK, Math.round(u * 2.4));
      s.setPosition(W / 2, H * .3 + u * 14).setFontSize(Math.round(u * 5.2)).setStroke(INK, Math.round(u * 1.3)).setWordWrapWidth(W * .86);
      b.setDisplaySize(u * 46, u * 16).setPosition(W / 2, H * .56);
      bt.setFontSize(Math.round(u * 8)).setPosition(W / 2, H * .56 - u * 1);
      this.btnBox = {x0: W / 2 - u * 23, x1: W / 2 + u * 23, y0: H * .56 - u * 8, y1: H * .56 + u * 8};
    }
    hidePanel(){ if (this.panel){ this.panel.destroy(true); this.panel = null; this.btnBox = null; } }
    bigText(main, sub){
      const u = this.u, out = [];
      const a = this.add.text(this.W / 2, this.H * .44, main, {fontFamily:FONT, fontStyle:'800', fontSize:Math.round(u * 12) + 'px', color:'#9BFF6A', stroke:INK, strokeThickness:Math.round(u * 2.2), align:'center'}).setOrigin(.5).setDepth(550);
      a.setWordWrapWidth(this.W * .92); out.push(a);
      if (sub) out.push(this.add.text(this.W / 2, this.H * .44 + u * 13, sub, {fontFamily:FONT, fontStyle:'800', fontSize:Math.round(u * 6.5) + 'px', color:'#FFD23F', stroke:INK, strokeThickness:Math.round(u * 1.4)}).setOrigin(.5).setDepth(550));
      out.forEach(o => {
        this.tweens.add({targets:o, scale:{from:.3, to:1}, duration:380, ease:'Back.Out'});
        this.tweens.add({targets:o, alpha:0, y:o.y - this.H * .05, delay:1700, duration:450, onComplete:() => o.destroy()});
      });
    }
    popText(s, x, y, color){
      const u = this.u;
      const t = this.add.text(x, y, s, {fontFamily:FONT, fontStyle:'800', fontSize:Math.round(u * 7.5) + 'px', color:color || '#9BFF6A', stroke:INK, strokeThickness:Math.round(u * 1.6)}).setOrigin(.5).setDepth(450).setAngle(SS.rint(-14, 14));
      this.tweens.add({targets:t, scale:{from:.2, to:1}, duration:220, ease:'Back.Out'});
      this.tweens.add({targets:t, alpha:0, y:y - u * 10, delay:450, duration:450, onComplete:() => t.destroy()});
    }
    updateHud(){
      this.roundText.setText('ROUND ' + this.round);
      this.progText.setText(this.st ? 'SPLATS ' + Math.min(this.splats, this.st.toClear) + '/' + this.st.toClear : '');
    }

    /* ---------- Rounds ---------- */
    startRound(n){
      this.round = n; this.st = settings(this.age, n);
      this.splats = 0; this.streak = this.streak || 0; this.target = null; this.bossThisRound = false; this.cheer = '';
      this.zombies.forEach(z => this.removeZombie(z)); this.zombies = [];
      this.boards.forEach((b, i) => {
        if (!b.gone) return;
        b.gone = false; this.tweens.killTweensOf(b);
        b.setPosition(this.W / 2, b.homeY + this.H * .06).setAngle(b.homeAng).setAlpha(0);
        this.tweens.add({targets:b, alpha:1, y:b.homeY, duration:300, delay:i * 90, ease:'Back.Out'});
      });
      this.state = 'intro';
      this.updateHud();
      this.bigText('ROUND ' + n, n === 1 ? 'Splat the one I ask for!' : 'They\'re faster now!');
      SS.say(n === 1 ? 'Round 1! Zombies are coming. Splat the zombie I ask for!' : 'Round ' + n + '! Here they come!');
      this.time.delayedCall(1900, () => {
        if (this.state !== 'intro') return;
        this.state = 'play'; this.nextSpawnAt = 0; this.nextTargetAt = this.time.now + 900;
      });
    }
    roundClear(){
      this.state = 'clear'; this.target = null; this.banner.setVisible(false);
      this.zombies.forEach(z => { if (z.alive){ z.alive = false; z.state = 'flee'; } });
      SFX.fanfare(); SS.addStar(2);
      if (this.p){ this.p.zombieBest = Math.max(this.p.zombieBest || 0, this.round); SS.save(); }
      this.bigText('ROUND ' + this.round + ' CLEAR!', '+2 stars');
      SS.say(SS.pick(['Round clear! Awesome!', 'You did it! Round clear!', 'Zombies splatted! Round clear!']));
      this.time.delayedCall(3200, () => { if (this.state === 'clear') this.startRound(this.round + 1); });
    }
    lose(){
      this.state = 'lost'; this.target = null; this.banner.setVisible(false);
      SFX.sad();
      SS.say('Oh no! The zombies broke in! Let\'s try that round again.');
      this.time.delayedCall(900, () => {
        if (this.state !== 'lost') return;
        this.showPanel('THEY BROKE IN!', 'Now they\'re having a dance party. Try again!', 'TRY AGAIN', () => { this.hidePanel(); this.startRound(this.round); });
      });
    }

    /* ---------- Zombies ---------- */
    uniqueQuestion(skip){
      const used = new Set(this.zombies.filter(z => z.alive && z !== skip).map(z => z.q.sign));
      for (let i = 0; i < 40; i++){ const q = makeQuestion(this.age); if (!used.has(q.sign)) return q; }
      return makeQuestion(this.age);
    }
    spawn(decor){
      const round = decor ? 1 : this.round;
      let pool = this.roster.filter(z => KINDS[z.kind].fromRound <= round);
      if (this.bossThisRound || this.zombies.some(z => z.alive && z.kind === 'boss')) pool = pool.filter(z => z.kind !== 'boss');
      if (!pool.length) pool = this.roster.slice(0, 1);
      let w = pool.reduce((a, z) => a + weightOf(z), 0) * Math.random(), def = pool[0];
      for (const z of pool){ w -= weightOf(z); if (w <= 0){ def = z; break; } }
      if (def.kind === 'boss') this.bossThisRound = true;
      const lanes = [-.85, -.42, 0, .42, .85], used = this.zombies.filter(z => z.alive).map(z => z.lane);
      const free = lanes.filter(l => used.indexOf(l) < 0);
      const lane = SS.pick(free.length ? free : lanes);
      const K = KINDS[def.kind];
      const q = decor ? {sign:'', show:'', say:''} : this.uniqueQuestion();
      // Two pieces: the zombie (c), and its sign (sc), which is drawn above every zombie so a body never hides a sign.
      const c = this.add.container(0, 0);
      const shadow = this.add.image(0, 0, 'shadow');
      const body = this.add.image(0, 0, def.key).setOrigin(.5, 1);
      c.add([shadow, body]);
      const stick = this.add.image(0, 0, 'stick').setOrigin(.5, 1);
      const sign = this.add.image(0, 0, 'sign');
      const label = this.add.text(0, 0, q.sign, {fontFamily:FONT, fontStyle:'800', fontSize:'20px', color:INK}).setOrigin(.5);
      const sc = this.add.container(0, 0, [stick, sign, label]).setVisible(!decor);
      const z = {def, kind:def.kind, K, q, c, sc, shadow, stick, body, sign, label, lane, alive:!decor, decor:!!decor,
        state:decor ? 'idle' : 'walk', t:decor ? .2 + Math.random() * .5 : 0, hits:K.hits, emerge:decor ? 1 : 0,
        phase:Math.random() * 6, punch:1, shake:0};
      this.sizeZombie(z);
      this.zombies.push(z);
      if (!decor){ SFX.rise(); this.placeZombie(z, this.time.now); this.dirtFx.explode(10, z.c.x, z.c.y); }
      return z;
    }
    sizeZombie(z){
      const signW = this.zh * .62, signH = this.zh * .3, aspect = z.body.width / z.body.height;
      // fit the drawing in a box: as tall as the kind says, but a wide one (like the crawler) is limited by width
      const bodyH = Math.min(this.zh * z.K.size, this.zh * z.K.size * 1.1 / aspect);
      z.body.setScale(bodyH / z.body.height);
      z.bodyH = bodyH; z.bodyW = bodyH * z.body.width / z.body.height; z.signH = signH;
      z.shadow.setDisplaySize(z.bodyW * .9, z.bodyW * .2);
      // the sign container's (0,0) sits on top of the zombie's head; a short stick holds the sign up
      const stickH = this.zh * .07;
      z.stickH = stickH;
      z.stick.setDisplaySize(this.zh * .05, stickH + signH * .4).setPosition(0, this.zh * .02);
      z.sign.setDisplaySize(signW, signH).setPosition(0, -stickH - signH * .5);
      z.label.setFontSize(Math.round(signH * .64)).setPosition(0, -stickH - signH * .5);
    }
    placeZombie(z, time){
      if (z.state === 'dying') return;
      const e = z.t * z.t * .35 + z.t * .65;
      const y = this.horizon + (this.feetY - this.horizon) * e;
      const s = .42 + .58 * e;
      const x = this.W / 2 + z.lane * this.spread * (.45 + .55 * e);
      const party = this.state === 'lost' || z.state === 'idle';
      const pace = z.state === 'walk' ? .0065 * z.K.speed : party ? .009 : .004;
      const wob = Math.sin(time * pace + z.phase);
      let rot = wob * (party ? .2 : .07);
      if (z.shake > 0) rot += Math.sin(time * .06) * .18;
      const bob = Math.abs(wob) * this.zh * .03 * s;
      const sx = s * z.punch, sy = s * z.emerge * z.punch, fy = y - bob;
      z.c.setPosition(x, fy).setScale(sx, sy).setRotation(rot).setDepth(100 + e * 100);
      // the sign rides on top of the head as the zombie wobbles
      z.sc.setPosition(x + Math.sin(rot) * z.bodyH * sy, fy - Math.cos(rot) * z.bodyH * sy).setScale(sx, sy).setRotation(rot).setDepth(220 + e * 60).setAlpha(z.c.alpha);
      const hw = Math.max(z.bodyW, this.zh * .62) * .5 * s;
      z.box = {x0:x - hw, x1:x + hw, y0:y - (z.bodyH + z.stickH + z.signH) * s, y1:y + this.zh * .05, cx:x};
    }
    removeZombie(z){ if (z.removed) return; z.removed = true; z.alive = false; this.tweens.killTweensOf([z.c, z.sc, z.sign]); z.c.destroy(); z.sc.destroy(); }
    killZombie(z){
      z.alive = false; z.state = 'dying';
      z.body.setTint(0x8CF56A); z.sign.setTint(0x8CF56A);
      this.tweens.add({targets:z.sc, alpha:0, y:z.sc.y + z.bodyH * z.c.scaleY * .6, angle:SS.rint(-40, 40), duration:420, ease:'Quad.In'});
      this.tweens.add({targets:z.c, scaleX:z.c.scaleX * 1.4, scaleY:z.c.scaleY * .04, duration:480, ease:'Quad.In', onComplete:() => this.removeZombie(z)});
      const pud = this.add.image(z.c.x, z.c.y, 'puddle').setDepth(95).setScale(z.bodyW * z.c.scaleX * 1.2 / 240);
      this.tweens.add({targets:pud, alpha:0, delay:1500, duration:1100, onComplete:() => pud.destroy()});
      this.starFx.explode(8, z.c.x, z.c.y - z.bodyH * .5 * z.c.scaleY);
    }
    bang(z){
      const b = this.boards.find(bd => !bd.gone);
      if (!b){ this.lose(); return; }
      b.gone = true;
      this.tweens.add({targets:b, y:b.y - this.H * .16, angle:b.angle + SS.rint(-70, 70), alpha:0, duration:650, ease:'Quad.Out'});
      SFX.crack(); this.cameras.main.shake(200, .012);
      this.tweens.addCounter({from:1.12, to:1, duration:260, onUpdate:tw => { z.punch = tw.getValue(); }});
      this.popText('BANG!', b.x + SS.rint(-1, 1) * this.W * .2, b.y, '#FFD23F');
      if (!this.boards.some(bd => !bd.gone)) this.time.delayedCall(500, () => { if (this.state === 'play') this.lose(); });
    }

    /* ---------- Asking for a zombie ---------- */
    pickTarget(time){
      const cands = this.zombies.filter(z => z.alive && (z.state === 'walk' || z.state === 'fence') && z.emerge >= 1);
      if (!cands.length || time < this.nextTargetAt) return;
      this.target = SS.pick(cands);
      this.targetSince = time; this.hinted = false; this.repeated = false;
      this.showPrompt(true);
    }
    promptLine(){ const q = this.target.q; return q.math ? 'What is ' + q.say + '?' : 'Splat ' + q.say + '!'; }
    showPrompt(fresh){
      if (!this.target) return;
      const q = this.target.q;
      this.bannerLabel.setText(q.math ? 'WHAT IS' : (/[A-Za-z]/.test(q.sign) ? 'SPLAT THE LETTER' : 'SPLAT NUMBER'));
      this.bannerText.setText(q.show);
      this.banner.setVisible(true);
      if (fresh) this.tweens.add({targets:this.banner, scale:{from:.85, to:1}, duration:260, ease:'Back.Out'});
      SS.say((this.cheer ? this.cheer + ' ' : '') + this.promptLine());
      this.cheer = '';
    }

    /* ---------- Tapping ---------- */
    tap(x, y){
      const inBox = b => b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
      if (this.panel){ if (inBox(this.btnBox)) this.panelParts.cb(); return; }
      if (this.state !== 'play') return;
      if (this.banner.visible && inBox(this.bannerBox)){ this.showPrompt(false); return; }
      if (this.bombReady && Math.hypot(x - this.bombBox.x, y - this.bombBox.y) < this.bombBox.r){ this.fireBomb(); return; }
      if (this.time.now < (this.lockUntil || 0)) return;
      const hits = this.zombies.filter(z => z.alive && z.box && inBox(z.box));
      hits.sort((a, b) => (b.c.depth - a.c.depth) || (Math.abs(a.box.cx - x) - Math.abs(b.box.cx - x)));
      this.shoot(x, y, hits[0] || null);
    }
    shoot(x, y, z){
      const bl = this.blaster, ang = Phaser.Math.Clamp(Math.atan2(x - bl.x, bl.y - y), -1.2, 1.2);
      this.tweens.killTweensOf(bl);
      bl.setRotation(ang);
      this.tweens.add({targets:bl, scaleY:{from:bl.scaleX * .88, to:bl.scaleX}, duration:160});
      const len = bl.displayHeight * .82, sx = bl.x + Math.sin(ang) * len, sy = bl.y - Math.cos(ang) * len;
      SFX.shoot();
      const blob = this.add.image(sx, sy, 'goo').setDepth(340).setScale(this.u * .12);
      this.tweens.add({targets:blob, x, y, scale:this.u * .07, duration:170, ease:'Quad.In', onComplete:() => {
        blob.destroy();
        if (this.state !== 'play') return;
        if (z && z.alive){ if (z === this.target) this.hit(z, x, y); else this.miss(z, x, y); }
        else { this.gooFx.explode(6, x, y); }
      }});
    }
    hit(z, x, y){
      SFX.splat(); this.gooFx.explode(22, x, y); this.cameras.main.shake(90, .004);
      this.popText(SS.pick(['SPLAT!', 'SPLOOSH!', 'GLOOP!', 'SPLAT!']), x, y - this.u * 6);
      this.streak++; this.splats++; SS.addStar(1);
      z.hits--;
      if (z.hits > 0){   // a boss takes two splats: it stumbles back with a new sign
        z.body.setTint(0x9CF57A); z.sign.clearTint();
        z.t = Math.max(0, z.t - .22); z.state = 'walk'; z.shake = .4;
        z.q = this.uniqueQuestion(z); z.label.setText(z.q.sign);
        this.popText('OOF!', x, y - this.u * 16, '#FFD23F');
      } else this.killZombie(z);
      this.target = null; this.nextTargetAt = this.time.now + 450;
      this.cheer = SS.pick(['Splat!', 'Nice shot!', 'Gooey!', 'Got it!', 'Yes!']);
      if (this.streak >= 5 && !this.bombReady){
        this.bombReady = true; this.bombBtn.setVisible(true).setScale(1);
        this.tweens.add({targets:this.bombBtn, scale:{from:1, to:1.12}, yoyo:true, repeat:-1, duration:420});
        this.cheer = 'Five in a row! Goo bomb ready!';
      }
      this.updateHud();
      if (this.splats >= this.st.toClear) this.roundClear();
    }
    miss(z, x, y){
      SFX.boing(); this.gooFx.explode(5, x, y);
      z.shake = .45; this.streak = 0; this.lockUntil = this.time.now + 700;
      this.popText('NOPE!', x, y - this.u * 6, '#FF8FC7');
      SS.say('That\'s ' + z.q.sign + '. ' + this.promptLine());
    }
    fireBomb(){
      this.bombReady = false; this.streak = 0;
      this.tweens.killTweensOf(this.bombBtn); this.bombBtn.setVisible(false);
      SFX.bomb(); this.cameras.main.flash(300, 140, 255, 110); this.cameras.main.shake(450, .02);
      const victims = this.zombies.filter(z => z.alive);
      victims.forEach((z, i) => this.time.delayedCall(80 + i * 110, () => {
        if (!z.alive || this.state !== 'play') return;
        this.gooFx.explode(26, z.c.x, z.c.y - z.bodyH * .5 * z.c.scaleY);
        this.splats++; z.hits = 0; this.killZombie(z);
        this.updateHud();
        if (this.splats >= this.st.toClear) this.roundClear();
      }));
      SS.addStar(1); SS.say('Goo bomb! Splat splat splat!');
      this.target = null; this.banner.setVisible(false); this.nextTargetAt = this.time.now + 1500;
    }

    /* ---------- Every frame ---------- */
    update(time, delta){
      const dt = Math.min(delta, 50) / 1000;
      this.zombies = this.zombies.filter(z => !z.removed);
      this.fogs.forEach((f, i) => {
        f.x += (i % 2 ? -1 : 1) * this.W * .012 * dt * (1 + i * .5);
        if (f.x > this.W * 1.5) f.x = -this.W * .5; if (f.x < -this.W * .5) f.x = this.W * 1.5;
      });
      for (const z of this.zombies){
        if (z.removed) continue;
        z.shake = Math.max(0, z.shake - dt);
        z.emerge = Math.min(1, z.emerge + dt * 2.2);
        if (this.state === 'play' || this.state === 'intro'){
          if (z.state === 'walk'){
            z.t = Math.min(1, z.t + dt / (this.st.walkSecs / z.K.speed));
            if (z.t >= 1){ z.state = 'fence'; z.bangT = 0; SFX.groan(); }
          } else if (z.state === 'fence' && z === this.target && this.state === 'play'){
            z.bangT += dt;
            if (z.bangT >= this.st.bangSecs){ z.bangT = 0; this.bang(z); }
          }
        }
        if (z.state === 'flee'){
          z.t = Math.max(0, z.t - dt * .8); z.c.alpha = Math.max(0, z.c.alpha - dt * 1.1);
          if (z.c.alpha <= 0){ this.removeZombie(z); continue; }
        }
        this.placeZombie(z, time);
      }
      if (this.state !== 'play') return;
      const alive = this.zombies.filter(z => z.alive).length;
      if (alive < this.st.onScreen && time >= this.nextSpawnAt){
        this.spawn(false);
        this.nextSpawnAt = time + SS.rint(1100, 2300);
      }
      if (!this.target || !this.target.alive){ this.target = null; this.pickTarget(time); }
      else {
        const waited = (time - this.targetSince) / 1000;
        if (!this.hinted && waited > this.st.hintSecs){
          this.hinted = true; const sg = this.target.sign;
          sg.setTint(0xFFF27A);
          this.tweens.add({targets:sg, scaleX:sg.scaleX * 1.18, scaleY:sg.scaleY * 1.18, yoyo:true, repeat:5, duration:260});
        }
        if (!this.repeated && waited > this.st.hintSecs + 7){ this.repeated = true; this.showPrompt(false); }
      }
    }
  };
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
function mount(main){
  const box = main.querySelector('#arcade'), msg = box.querySelector('.arcade-msg'), my = token = {};
  const show = html => { if (token === my && msg){ msg.style.display = ''; msg.innerHTML = html; } };
  const loading = step => show('<div>Loading the zombies...<div class="arcade-detail">' + step + '</div></div>');
  const slow = setTimeout(() => loading('Still working on it. Slow internet? Give it a few more seconds.'), 10000);
  let triedCanvas = false;
  const onErr = e => fail((e && (e.error || e.reason)) || new Error((e && e.message) || 'unknown problem'));
  const listen = on => ['error', 'unhandledrejection'].forEach(t => on ? window.addEventListener(t, onErr) : window.removeEventListener(t, onErr));
  function fail(err){
    if (token !== my) return;
    listen(false); stopGame();
    if (!triedCanvas && window.Phaser){ triedCanvas = true; return start(Phaser.CANVAS); }   // try the simpler drawing mode once
    clearTimeout(slow);
    show('<div>Uh oh, the zombies got stuck!<div class="arcade-detail">Tell a grown-up: ' + SS.esc(String((err && err.message) || err).slice(0, 180)) +
      '</div><button class="btn" id="zsRetry" type="button" style="margin-top:16px">Try again</button></div>');
    const b = box.querySelector('#zsRetry');
    if (b) b.addEventListener('click', () => { if (token === my) mount(main); });
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
function unmount(){
  token = null; onSceneReady = null;
  stopGame();
  SS.hush();
}

SS.addGame({
  id:'zombie', name:'Zombie Splat', emoji:'\uD83E\uDDDF', blurb:'Splat the right zombie!', color:'#9BE15D',
  newRound: () => SS.startRound({game:'zombie', prompt:'Zombie Splat!'}),
  render: () => '<div class="arcade" id="arcade"><div class="arcade-msg">Loading the zombies...</div></div>',
  mount, unmount
});
})();

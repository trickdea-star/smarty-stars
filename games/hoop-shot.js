/* =====================================================================
   HOOP SHOT - an arcade basketball game for Smarty Stars
   The question is on the backboard ("7 + 5", or a letter for little kids) and three basketballs
   show answers. Drag (or just tap) the right ball to shoot: SWISH! A wrong ball clanks off the rim.
   - Ages 4-5: make 10 baskets, no clock. Ages 6-8: 60-second rounds, beat your best score.
   - 3 baskets in a row puts the ball ON FIRE: baskets are worth 3 points instead of 2.
   - 1 star per basket, +2 for finishing a round.
   Uses the Phaser game engine through games/arcade-kit.js. Plain ASCII (special characters are \u codes).
   ===================================================================== */
(function(){
'use strict';
const SS = window.SmartyStars, K = window.ArcadeKit;
if (!SS || !K) return;
const INK = K.INK, FONT = K.FONT;
const {tone, noise} = K.sound;
const {mk, rr, paint, path, oval, seeded, tex} = K.draw;

const ROUND_SECS = 60;   // ages 6-8: length of a beat-the-buzzer round
const GOAL = 10;         // ages 4-5: baskets to finish a round
const timed = age => age >= 6;

/* ---------- Sound effects ---------- */
const SFX = {
  bounce(){ tone(140, 70, .12, 'sine', .35); },
  whoosh(){ noise(.3, 1600, .16, 'bandpass'); },
  swish(){ noise(.4, 3800, .32, 'highpass'); },
  clank(){ tone(820, 760, .28, 'square', .05); tone(1230, 1170, .22, 'triangle', .1); noise(.08, 2600, .3, 'bandpass'); },
  cheer(){ noise(1.3, 900, .3, 'bandpass'); noise(1.0, 2300, .14, 'bandpass', .1); },
  buzzer(){ tone(170, 160, .9, 'sawtooth', .18); tone(340, 330, .9, 'square', .05); },
  tick(){ tone(1000, 1000, .05, 'square', .05); },
  fire(){ noise(.7, 700, .35); tone(300, 900, .45, 'sawtooth', .06); },
  fanfare(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, .2, 'triangle', .2, i * .12)); }
};

/* ---------- Answer balls ---------- */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function choices(q){   // the right answer plus two different wrong ones of the same kind, shuffled
  const out = [q.sign];
  for (let guard = 0; out.length < 3 && guard < 60; guard++){
    let c;
    if (q.kind === 'color') c = SS.pick(K.COLORS).id;
    else if (q.kind === 'letter') c = SS.pick(ABC);
    else { const n = +q.sign + SS.pick([-3, -2, -1, 1, 2, 3]); if (n < 1 || n > 150) continue; c = '' + n; }   // numbers: close to the answer
    if (out.indexOf(c) < 0) out.push(c);
  }
  return SS.shuffle(out);
}

/* ---------- Art (drawn in code) ---------- */
function drawArena(W, H, L){
  const c = mk(W, H), x = c.getContext('2d'), U = Math.min(W, H) / 100, rnd = seeded(11);
  let g = x.createLinearGradient(0, 0, 0, L.floorY);
  g.addColorStop(0, '#120C2E'); g.addColorStop(1, '#2E2063');
  x.fillStyle = g; x.fillRect(0, 0, W, L.floorY + 2);
  [[.18, .0], [.5, -.02], [.82, 0]].forEach(([px]) => {   // arena spotlights
    const sg = x.createRadialGradient(W * px, 0, 0, W * px, 0, H * .45);
    sg.addColorStop(0, 'rgba(255,240,200,.28)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, L.floorY);
  });
  const skins = ['#F6D2B5', '#E7B48A', '#C98E5F', '#9C6640', '#6E4425'];
  const shirts = ['#FF6B5E', '#FFD23F', '#45C4E0', '#5BD17D', '#9B6BF7', '#FF8FC7', '#FF9F43', '#FFFFFF'];
  const rowGap = U * 6.2;
  for (let row = 0, y = L.floorY - U * 5; y > H * .08; row++, y -= rowGap){   // the crowd, back rows dimmer
    const dim = Math.max(.35, 1 - row * .1), r = U * (2.4 - row * .1);
    x.globalAlpha = dim;
    x.fillStyle = '#1A1240'; x.fillRect(0, y, W, rowGap * .45);
    for (let px = (row % 2) * r * 1.2; px < W + r; px += r * 2.5){
      x.fillStyle = SS.pick(shirts); x.beginPath(); x.ellipse(px, y + r * .2, r * 1.05, r * .9, 0, Math.PI, 0); x.fill();
      x.fillStyle = skins[Math.floor(rnd() * skins.length)]; x.beginPath(); x.arc(px, y - r * .9, r * .72, 0, 7); x.fill();
      if (rnd() < .2){ x.fillStyle = SS.pick(shirts); x.fillRect(px - r * .9, y - r * 2.4, r * 1.8, r * .9); }   // a sign in the crowd
    }
  }
  x.globalAlpha = 1;
  x.fillStyle = '#FF6B5E'; x.fillRect(0, L.floorY - U * 4.2, W, U * 4.2);   // ad boards under the crowd
  x.fillStyle = '#FFFFFF'; x.font = '800 ' + Math.round(U * 3) + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let px = W * .17; px < W; px += W * .33) x.fillText('SMARTY STARS', px, L.floorY - U * 2);
  g = x.createLinearGradient(0, L.floorY, 0, H);   // wooden court
  g.addColorStop(0, '#C9874C'); g.addColorStop(1, '#E8B176');
  x.fillStyle = g; x.fillRect(0, L.floorY, W, H - L.floorY);
  const vx = W / 2, vy = L.floorY - H * .35;      // planks run toward a far-away point
  x.strokeStyle = 'rgba(120,70,30,.28)'; x.lineWidth = Math.max(1, U * .25);
  for (let i = -14; i <= 14; i++){ const bx = W / 2 + i * W * .09; x.beginPath(); x.moveTo(vx + (bx - vx) * ((L.floorY - vy) / (H - vy)), L.floorY); x.lineTo(bx, H); x.stroke(); }
  const kw0 = W * .1, kw1 = W * .3, ky1 = L.floorY + (H - L.floorY) * .42;   // the painted key under the hoop
  x.beginPath(); x.moveTo(W / 2 - kw0, L.floorY); x.lineTo(W / 2 + kw0, L.floorY); x.lineTo(W / 2 + kw1, ky1); x.lineTo(W / 2 - kw1, ky1); x.closePath();
  x.fillStyle = 'rgba(232,83,59,.55)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = U * .7; x.stroke();
  x.beginPath(); x.ellipse(W / 2, ky1, kw1, U * 4.5, 0, 0, Math.PI); x.stroke();
  x.beginPath(); x.ellipse(W / 2, L.floorY + U, W * .52, (H - L.floorY) * .62, 0, 0, Math.PI); x.stroke();   // 3-point line
  x.fillStyle = '#8E95A8'; x.strokeStyle = INK; x.lineWidth = U * .6;        // the hoop's pole
  rr(x, W / 2 - U * 1.6, L.boardBottom, U * 3.2, L.floorY + U * 1.5 - L.boardBottom, U); x.fill(); x.stroke();
  rr(x, W / 2 - U * 5, L.floorY - U * .5, U * 10, U * 3.5, U * 1.2); x.fillStyle = '#4E5A7A'; x.fill(); x.stroke();
  return c;
}
function makeTextures(scene){
  tex(scene, 'hsBall', 128, 128, x => {
    oval(x, 64, 64, 58, 58, '#F07B2A', 6);
    path(x, 'M64 8 L64 120 M8 64 L120 64 M26 20 Q50 64 26 108 M102 20 Q78 64 102 108', null, 4);
    oval(x, 44, 40, 15, 9, 'rgba(255,255,255,.45)', 0, -.6);
  });
  tex(scene, 'hsBoard', 300, 190, x => {
    rr(x, 8, 14, 284, 168, 18); paint(x, INK);
    rr(x, 8, 6, 284, 168, 18); paint(x, '#FFFFFF', 8);
    rr(x, 20, 18, 260, 144, 10); paint(x, null, 4, '#45C4E0');
    rr(x, 112, 112, 76, 50, 4); paint(x, null, 7, '#E8533B');
  });
  const ring = (x, from, to) => { x.beginPath(); x.ellipse(110, 30, 96, 20, 0, from, to); x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 15; x.stroke(); x.strokeStyle = '#F26B1D'; x.lineWidth = 8; x.stroke(); };
  tex(scene, 'hsRimBack', 220, 60, x => ring(x, Math.PI, Math.PI * 2));
  tex(scene, 'hsRimFront', 220, 60, x => ring(x, 0, Math.PI));
  tex(scene, 'hsNet', 220, 150, x => {
    x.strokeStyle = '#FFFFFF'; x.lineWidth = 4; x.lineCap = 'round';
    const top = i => [14 + i * 24, 30 + Math.sin(i / 8 * Math.PI) * 18], bot = i => [62 + i * 12, 140];
    for (let i = 0; i <= 8; i++){ x.beginPath(); x.moveTo(...top(i)); x.lineTo(...bot(i)); x.stroke(); }
    for (let i = 0; i < 8; i++){ x.beginPath(); x.moveTo(...top(i)); x.lineTo(...bot(i + 1)); x.moveTo(...top(i + 1)); x.lineTo(...bot(i)); x.stroke(); }
    x.beginPath(); x.moveTo(62, 140); x.lineTo(158, 140); x.stroke();
  });
  tex(scene, 'hsFlame', 64, 64, x => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(.4, 'rgba(255,170,40,.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }, 1);
  tex(scene, 'hsConfetti', 16, 10, x => { x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 16, 10); }, 1);
  tex(scene, 'hsStar', 64, 64, x => { x.beginPath(); for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); paint(x, '#FFD23F', 4); });
  tex(scene, 'hsShadow', 200, 50, x => oval(x, 100, 25, 96, 22, 'rgba(0,0,0,.3)', 0), 1);
  tex(scene, 'hsButton', 400, 140, x => { rr(x, 8, 22, 384, 110, 55); paint(x, INK); rr(x, 8, 8, 384, 110, 55); paint(x, '#FFD23F', 8); });
}

/* ---------- The game scene ---------- */
function makeScene(){
  return class HoopScene extends Phaser.Scene {
    constructor(){ super('hoop'); }
    create(){
      this.p = SS.player();
      this.age = this.p ? this.p.age : 6;
      this.timed = timed(this.age);
      makeTextures(this);
      K.colorTextures(this);
      this.bgN = 0; this.balls = []; this.state = 'start'; this.points = 0; this.baskets = 0; this.streak = 0; this.fire = false;
      this.bg = this.add.image(0, 0, 'hsShadow').setOrigin(0).setDepth(0);
      this.board = this.add.image(0, 0, 'hsBoard').setDepth(10);
      const T = (size, color, stroke) => this.add.text(0, 0, '', {fontFamily:FONT, fontStyle:'800', fontSize:size + 'px', color, stroke:stroke || INK, strokeThickness:0, align:'center'}).setOrigin(.5);
      this.boardLabel = T(20, '#2B1B3D').setDepth(11);
      this.boardText = T(40, '#2B1B3D').setDepth(11);
      this.rimBack = this.add.image(0, 0, 'hsRimBack').setDepth(20);
      this.net = this.add.image(0, 0, 'hsNet').setOrigin(.5, .2).setDepth(24);
      this.rimFront = this.add.image(0, 0, 'hsRimFront').setDepth(25);
      this.scoreText = T(20, '#FFD23F').setOrigin(0, .5).setDepth(50);
      this.clockText = T(20, '#FFFFFF').setOrigin(1, .5).setDepth(50);
      this.input.on('pointerdown', p => this.down(p.x, p.y));
      this.input.on('pointermove', p => this.move(p.x, p.y));
      this.input.on('pointerup', p => this.up(p.x, p.y));
      this.scale.on('resize', () => this.layout());
      this.layout();
      this.showStart();
      if (/[?&]debug\b/.test(location.search)) window.HS = this;   // for testing: open the page with ?debug
      K.sceneReady();
    }

    layout(){
      const W = this.scale.width, H = this.scale.height;
      this.W = W; this.H = H;
      const u = this.u = Math.min(W, H * .62) / 100;
      this.floorY = H * .47;
      this.boardW = Math.min(W * .6, H * .34); this.boardH = this.boardW * .63;
      this.boardX = W / 2; this.boardY = H * .1 + this.boardH / 2;
      this.rimW = this.boardW * .44; this.rimH = this.rimW * 60 / 220;
      this.rimX = W / 2; this.rimY = this.boardY + this.boardH * .5 + this.rimH * .15;
      this.netH = this.rimW * 150 / 220;
      this.ballR = Math.min(W * .12, H * .075);
      this.rackY = H * .84;
      this.rackX = [W * .2, W * .5, W * .8];
      const key = 'hsBg' + (++this.bgN), old = this.bg.texture.key;
      this.textures.addCanvas(key, drawArena(W, H, {floorY:this.floorY, boardBottom:this.boardY + this.boardH * .3}));
      this.bg.setTexture(key).setPosition(0, 0).setDisplaySize(W, H);
      if (old.indexOf('hsBg') === 0) this.textures.remove(old);
      this.board.setPosition(this.boardX, this.boardY).setDisplaySize(this.boardW, this.boardH);
      this.boardLabel.setPosition(this.boardX, this.boardY - this.boardH * .3).setFontSize(Math.round(this.boardH * .11));
      this.boardText.setPosition(this.boardX, this.boardY - this.boardH * .06).setFontSize(Math.round(this.boardH * .3));
      this.boardBox = {x0:this.boardX - this.boardW / 2, x1:this.boardX + this.boardW / 2, y0:this.boardY - this.boardH / 2, y1:this.boardY + this.boardH / 2};
      [this.rimBack, this.rimFront].forEach(r => r.setPosition(this.rimX, this.rimY).setDisplaySize(this.rimW, this.rimH));
      this.net.setPosition(this.rimX, this.rimY).setDisplaySize(this.rimW, this.netH); this.netSY = this.net.scaleY; this.netSX = this.net.scaleX;
      this.scoreText.setPosition(W * .04, H * .05).setFontSize(Math.round(u * 5.4)).setStroke(INK, Math.round(u * 1.2));
      this.clockText.setPosition(W * .96, H * .05).setFontSize(Math.round(u * 5.4)).setStroke(INK, Math.round(u * 1.2));
      this.balls.forEach(b => this.sizeBall(b));
      this.makeEmitters();
      this.layoutPanel();
      this.updateHud();
    }
    makeEmitters(){
      [this.flameFx, this.confettiFx, this.starFx].forEach(e => { if (e) e.destroy(); });
      const u = this.u;
      this.flameFx = this.add.particles(0, 0, 'hsFlame', {speed:{min:u * 3, max:u * 12}, angle:{min:200, max:340}, scale:{start:u * .1, end:0}, lifespan:380, frequency:16, gravityY:-u * 40, blendMode:'ADD', emitting:false}).setDepth(41);
      this.confettiFx = this.add.particles(0, 0, 'hsConfetti', {speed:{min:u * 30, max:u * 70}, angle:{min:200, max:340}, scale:{start:u * .12, end:u * .06}, rotate:{min:0, max:360}, lifespan:1400, gravityY:u * 60, tint:[0xFF6B5E, 0xFFD23F, 0x45C4E0, 0x5BD17D, 0x9B6BF7, 0xFF8FC7], emitting:false}).setDepth(45);
      this.starFx = this.add.particles(0, 0, 'hsStar', {speed:{min:u * 15, max:u * 45}, angle:{min:0, max:360}, scale:{start:u * .05, end:0}, lifespan:800, emitting:false}).setDepth(46);
    }

    /* ---------- Panels and big words ---------- */
    showStart(){
      this.state = 'start';
      const p = this.p, best = this.timed ? (p && p.hoopBest ? 'Your best: ' + p.hoopBest + ' points' : 'Shoot the ball with the right answer!')
        : 'Make ' + GOAL + ' baskets!';
      this.pickPractice(best);
    }
    pickPractice(sub){   // the "pick what to practice" screen (games/arcade-kit.js), then a new round
      K.showOptions({game:'hoop', title:'HOOP SHOT', color:'#FFD23F', sub, age:this.age,
        onPlay: opts => { this.opts = opts; K.sound.ac(); this.startRound(); }});
    }
    showPanel(title, sub, btn, cb){
      this.hidePanel();
      const dim = this.add.rectangle(0, 0, 10, 10, 0x0A0518, .55).setOrigin(0);
      const t = this.add.text(0, 0, title, {fontFamily:FONT, fontStyle:'800', fontSize:'40px', color:'#FFD23F', stroke:INK, strokeThickness:8, align:'center'}).setOrigin(.5);
      const s = this.add.text(0, 0, sub, {fontFamily:FONT, fontStyle:'800', fontSize:'20px', color:'#FFFFFF', stroke:INK, strokeThickness:4, align:'center'}).setOrigin(.5);
      const b = this.add.image(0, 0, 'hsButton');
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
      s.setPosition(W / 2, H * .3 + u * 14).setFontSize(Math.round(u * 5.6)).setStroke(INK, Math.round(u * 1.3)).setWordWrapWidth(W * .86);
      b.setDisplaySize(u * 50, u * 16).setPosition(W / 2, H * .56);
      bt.setFontSize(Math.round(u * 8)).setPosition(W / 2, H * .56 - u);
      this.btnBox = {x0:W / 2 - u * 25, x1:W / 2 + u * 25, y0:H * .56 - u * 8, y1:H * .56 + u * 8};
    }
    hidePanel(){ if (this.panel){ this.panel.destroy(true); this.panel = null; this.btnBox = null; } }
    bigText(main, color, y){
      const u = this.u;
      const a = this.add.text(this.W / 2, y || this.H * .55, main, {fontFamily:FONT, fontStyle:'800', fontSize:Math.round(u * 11) + 'px', color:color || '#FFD23F', stroke:INK, strokeThickness:Math.round(u * 2.2), align:'center'}).setOrigin(.5).setDepth(550);
      a.setWordWrapWidth(this.W * .92);
      this.tweens.add({targets:a, scale:{from:.3, to:1}, duration:380, ease:'Back.Out'});
      this.tweens.add({targets:a, alpha:0, y:a.y - this.H * .05, delay:1300, duration:450, onComplete:() => a.destroy()});
    }
    popText(s, x, y, color){
      const u = this.u;
      const t = this.add.text(x, y, s, {fontFamily:FONT, fontStyle:'800', fontSize:Math.round(u * 7) + 'px', color:color || '#FFFFFF', stroke:INK, strokeThickness:Math.round(u * 1.5)}).setOrigin(.5).setDepth(450).setAngle(SS.rint(-10, 10));
      this.tweens.add({targets:t, scale:{from:.2, to:1}, duration:220, ease:'Back.Out'});
      this.tweens.add({targets:t, alpha:0, y:y - u * 10, delay:500, duration:450, onComplete:() => t.destroy()});
    }
    updateHud(){
      if (!this.scoreText) return;
      this.scoreText.setText(this.timed ? 'SCORE ' + this.points : 'BASKETS ' + this.baskets + '/' + GOAL);
      if (this.timed){
        const s = Math.max(0, Math.ceil(this.timeLeft == null ? ROUND_SECS : this.timeLeft));
        this.clockText.setText('0:' + (s < 10 ? '0' : '') + s).setColor(s <= 10 ? '#FF6B5E' : '#FFFFFF');
      } else this.clockText.setText(this.fire ? 'ON FIRE!' : '').setColor('#FF9F43');
    }

    /* ---------- Rounds ---------- */
    startRound(){
      this.points = 0; this.baskets = 0; this.streak = 0; this.setFire(false);
      this.timeLeft = ROUND_SECS; this.lastTick = ROUND_SECS;
      this.state = 'play'; this.busy = false;
      this.updateHud();
      this.bigText(this.timed ? 'GO!' : 'MAKE ' + GOAL + '!', '#FFD23F', this.H * .62);
      SS.say(this.timed ? 'Ready? You have 60 seconds. Go!' : 'Make 10 baskets! Ready? Go!');
      this.time.delayedCall(1700, () => { if (this.state === 'play') this.newQuestion(false); });
    }
    endRound(){
      if (this.state !== 'play') return;
      this.state = 'over'; this.setFire(false);
      this.clearBalls(true);
      this.boardLabel.setText(''); this.boardText.setText('');
      SS.addStar(2);
      let sub, line;
      if (this.timed){
        SFX.buzzer();
        const best = this.p && this.points > (this.p.hoopBest || 0);
        if (this.p){ this.p.hoopBest = Math.max(this.p.hoopBest || 0, this.points); SS.save(); }
        sub = 'You scored ' + this.points + ' points!' + (best ? ' New best!' : '  Best: ' + (this.p ? this.p.hoopBest : this.points));
        line = "Time's up! You scored " + this.points + ' points!' + (best ? ' New best score!' : '');
        this.bigText("TIME'S UP!", '#FF6B5E', this.H * .55);
        this.time.delayedCall(2600, () => { if (this.state === 'over') this.pickPractice("Time's up! " + sub + '  +2 stars'); });
      } else {
        SFX.fanfare(); SFX.cheer(); this.confettiFx.explode(60, this.W / 2, this.H * .2);
        if (this.p){ this.p.hoopRounds = (this.p.hoopRounds || 0) + 1; SS.save(); }
        line = 'You did it! 10 baskets!';
        this.bigText('YOU DID IT!', '#FFD23F', this.H * .55);
        this.time.delayedCall(2600, () => { if (this.state === 'over') this.pickPractice('You did it! ' + GOAL + ' baskets!  +2 stars'); });
      }
      SS.say(line);
    }

    /* ---------- Questions and balls ---------- */
    newQuestion(cheer){
      if (this.state !== 'play') return;
      this.q = K.question(this.age, this.opts);
      this.asked = this.time.now; this.hinted = false;
      const q = this.q;
      this.boardLabel.setText({math:'WHAT IS', letter:'SHOOT THE LETTER', number:'SHOOT NUMBER', color:'SHOOT THE COLOR'}[q.kind] || 'SHOOT');
      // color words are written in their own color, with a dark outline so yellow and white still show up
      this.boardText.setText(q.show).setColor(q.color || INK).setStroke(INK, q.color ? Math.round(parseInt(this.boardText.style.fontSize, 10) * .1) : 0);
      this.tweens.add({targets:[this.boardText], scale:{from:.6, to:1}, duration:260, ease:'Back.Out'});
      this.clearBalls(false);
      choices(q).forEach((sign, i) => this.addBall(sign, i));
      this.sayPrompt(cheer);
    }
    promptLine(){ const q = this.q; return q.math ? 'What is ' + q.say + '?' : 'Shoot ' + q.say + '!'; }
    sayPrompt(cheer){ SS.say((cheer ? cheer + ' ' : '') + this.promptLine()); }
    addBall(sign, i){
      const c = this.add.container(0, 0).setDepth(30);
      const shadow = this.add.image(0, 0, 'hsShadow');
      const img = this.add.image(0, 0, 'hsBall');
      const color = this.q.kind === 'color';   // color balls show a colored dot instead of writing
      const label = this.add.text(0, 0, color ? '' : sign, {fontFamily:FONT, fontStyle:'800', fontSize:'20px', color:'#FFFFFF', stroke:INK, strokeThickness:6}).setOrigin(.5);
      const swatch = this.add.image(0, 0, color ? 'sw-' + sign : 'sw-red').setVisible(color);
      c.add([shadow, img, label, swatch]);
      const b = {c, shadow, img, label, swatch, sign, slot:i, state:'rolling', phase:Math.random() * 6};
      this.sizeBall(b);
      c.setPosition(this.W + this.ballR * 2, this.rackY);
      this.tweens.add({targets:c, x:this.rackX[i], duration:420 + i * 110, ease:'Quad.Out', onComplete:() => { if (b.state === 'rolling') b.state = 'idle'; }});
      this.tweens.add({targets:img, angle:-540, duration:420 + i * 110, ease:'Quad.Out'});
      this.balls.push(b);
    }
    sizeBall(b){
      const r = this.ballR;
      b.img.setDisplaySize(r * 2, r * 2);
      b.shadow.setDisplaySize(r * 1.8, r * .45).setPosition(0, r * .95);
      b.label.setFontSize(Math.round(r * (b.sign.length > 2 ? .72 : .9))).setStroke(INK, Math.max(2, Math.round(r * .12)));
      b.swatch.setDisplaySize(r * 1.15, r * 1.15);
      if (b.state === 'idle') b.c.setPosition(this.rackX[b.slot], this.rackY);
    }
    clearBalls(all){
      this.balls.forEach(b => {
        if (b.state === 'flying' && !all) return;
        b.state = 'gone';
        this.tweens.add({targets:b.c, x:b.c.x - this.W * .6, alpha:0, duration:400, ease:'Quad.In', onComplete:() => b.c.destroy()});
      });
      this.balls = this.balls.filter(b => b.state !== 'gone');
    }

    /* ---------- Touch: tap or drag a ball, let go to shoot ---------- */
    down(x, y){
      const inBox = bx => bx && x >= bx.x0 && x <= bx.x1 && y >= bx.y0 && y <= bx.y1;
      if (this.panel){ if (inBox(this.btnBox)) this.panelParts.cb(); return; }
      if (this.state !== 'play') return;
      if (inBox(this.boardBox) && this.q){ this.sayPrompt(''); return; }
      if (this.busy || this.time.now < (this.lockUntil || 0)) return;
      const b = this.balls.find(b => b.state === 'idle' && Math.hypot(x - b.c.x, y - b.c.y) < this.ballR * 1.25);
      if (b){ this.held = b; b.dx = b.c.x - x; b.dy = b.c.y - y; b.c.setDepth(35); this.tweens.add({targets:b.c, scale:1.12, duration:120}); }
    }
    move(x, y){
      const b = this.held; if (!b) return;
      b.c.setPosition(x + b.dx, Math.max(this.floorY + this.ballR * 2, y + b.dy));
    }
    up(){
      const b = this.held; if (!b) return;
      this.held = null;
      this.shoot(b);
    }
    shoot(b){
      if (this.state !== 'play') return;
      const right = b.sign === this.q.sign;
      this.busy = true; b.state = 'flying';
      this.tweens.killTweensOf(b.c); b.c.setScale(1).setDepth(40);
      b.shadow.setVisible(false);
      SFX.whoosh();
      if (this.fire){ this.flameFx.startFollow(b.c); this.flameFx.start(); }
      const sx = b.c.x, sy = b.c.y, side = sx < this.rimX ? -1 : 1;
      const tx = right ? this.rimX : this.rimX + side * this.rimW * .48;
      const ty = this.rimY - this.rimH * (right ? .3 : .45);
      const apexY = this.boardY - this.boardH * .62;
      const cx = (sx + tx) / 2, cy = 2 * apexY - (sy + ty) / 2;
      const endScale = (this.rimW * .5) / (this.ballR * 2);
      this.tweens.addCounter({from:0, to:1, duration:760, ease:'Linear',
        onUpdate:tw => {
          const t = tw.getValue(), m = 1 - t;
          b.c.setPosition(m * m * sx + 2 * m * t * cx + t * t * tx, m * m * sy + 2 * m * t * cy + t * t * ty);
          b.c.setScale(1 + (endScale - 1) * t);
          b.img.rotation -= .09;
          if (t > .55) b.c.setDepth(22);   // coming down: behind the front of the rim
        },
        onComplete:() => { if (this.state !== 'play'){ b.c.destroy(); this.busy = false; return; } right ? this.swish(b) : this.clank(b, side); }
      });
    }
    swish(b){
      SFX.swish();
      this.tweens.add({targets:this.net, scaleY:{from:this.netSY * 1.3, to:this.netSY}, scaleX:{from:this.netSX * .82, to:this.netSX}, duration:420, ease:'Quad.Out'});
      this.tweens.add({targets:b.c, y:this.rimY + this.netH * .9, duration:260, ease:'Quad.In', onComplete:() => {
        this.flameFx.stop(); this.flameFx.stopFollow();
        this.tweens.add({targets:b.c, y:this.floorY + this.H * .02, duration:300, ease:'Bounce.Out', onComplete:() => {
          SFX.bounce();
          this.tweens.add({targets:b.c, alpha:0, duration:400, delay:200, onComplete:() => b.c.destroy()});
        }});
      }});
      const pts = this.fire ? 3 : 2;
      this.points += pts; this.baskets++; this.streak++;
      SS.addStar(1); SFX.cheer();
      this.confettiFx.explode(28, this.rimX, this.rimY);
      this.starFx.explode(10, this.rimX, this.rimY);
      this.popText('+' + pts, this.rimX + this.rimW * .7, this.rimY, '#FFD23F');
      this.popText(SS.pick(['SWISH!', 'SCORE!', 'NICE!']), this.rimX, this.rimY + this.netH * 1.5, '#5BD17D');   // under the net, not over the question
      this.balls = this.balls.filter(x => x !== b);
      let cheer = SS.pick(['Swish!', 'Nothing but net!', 'Score!', 'Great shot!', 'Yes!']);
      if (this.streak === 3 && !this.fire){ this.setFire(true); cheer = "You're on fire!"; }
      this.updateHud();
      this.cameras.main.shake(120, .004);
      if (!this.timed && this.baskets >= GOAL){ this.busy = false; this.endRound(); return; }
      this.time.delayedCall(700, () => { this.busy = false; this.newQuestion(cheer); });
    }
    clank(b, side){
      SFX.clank(); this.cameras.main.shake(100, .006);
      this.flameFx.stop(); this.flameFx.stopFollow();
      this.popText('CLANK!', this.rimX + side * this.rimW * .9, this.rimY + this.netH * .6, '#FF8FC7');
      const x0 = b.c.x, y0 = b.c.y, x1 = x0 + side * this.W * .22, y1 = this.floorY + this.H * .05;
      b.c.setDepth(40);
      this.tweens.addCounter({from:0, to:1, duration:650, onUpdate:tw => {
        const t = tw.getValue();
        b.c.setPosition(x0 + (x1 - x0) * t, y0 - Math.sin(t * Math.PI) * this.H * .06 + (y1 - y0) * t * t);
        b.img.rotation += .12 * side;
      }, onComplete:() => { SFX.bounce(); this.tweens.add({targets:b.c, alpha:0, duration:350, onComplete:() => b.c.destroy()}); }});
      this.balls = this.balls.filter(x => x !== b);
      this.streak = 0; this.setFire(false); this.updateHud();
      this.lockUntil = this.time.now + 700;
      this.busy = false;
      SS.say("That's " + b.sign + '. ' + this.promptLine());
    }
    setFire(on){
      if (on && !this.fire){ SFX.fire(); this.bigText('ON FIRE!', '#FF9F43', this.H * .62); }
      this.fire = on;
      if (!on && this.flameFx){ this.flameFx.stop(); this.flameFx.stopFollow(); }
      if (this.board) this.board.setTint(on ? 0xFFE0B0 : 0xFFFFFF);
      this.updateHud();
    }

    /* ---------- Every frame ---------- */
    update(time, delta){
      const dt = Math.min(delta, 50) / 1000;
      this.balls.forEach(b => {   // resting balls bob a little; the right one bounces if a kid is stuck
        if (b.state !== 'idle' || b === this.held) return;
        const hint = this.hinted && b.sign === this.q.sign;
        const bob = Math.abs(Math.sin(time * (hint ? .012 : .003) + b.phase)) * this.ballR * (hint ? .45 : .08);
        b.c.y = this.rackY - bob;
      });
      if (this.state !== 'play') return;
      if (this.q && !this.hinted && (time - this.asked) / 1000 > (this.age <= 5 ? 9 : 15)){ this.hinted = true; }
      if (this.timed){
        this.timeLeft -= dt;
        const s = Math.ceil(this.timeLeft);
        if (s !== this.lastTick){ this.lastTick = s; if (s <= 5 && s > 0) SFX.tick(); this.updateHud(); }
        if (this.timeLeft <= 0) this.endRound();
      }
    }
  };
}

SS.addGame({
  id:'hoop', name:'Hoop Shot', emoji:'\uD83C\uDFC0', blurb:'Shoot the right answer!', color:'#FF9F43',
  newRound: () => SS.startRound({game:'hoop', prompt:'Hoop Shot!'}),
  render: () => K.html('Loading the basketballs...'),
  mount: main => K.start(main, makeScene, 'basketballs'),
  unmount: () => K.stop()
});
})();

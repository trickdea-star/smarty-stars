/* narrator.js - play recorded natural-voice clips (made by record.py), fall back to the device voice.
   Drop-in for any web page. No dependencies. Keep this file ASCII-only.

   Narrator.load('voice/index.json?v=BUILD');   // once at start-up; version the URL on every release
   Narrator.say('Find the letter B!', onDone);   // instead of speechSynthesis.speak(...)
   Narrator.stop();                              // instead of speechSynthesis.cancel()
   Narrator.misses();                            // sentences that had no recording (use while testing)
   Narrator.natural = false;                     // force the device voice (e.g. a grown-ups setting)

   Each sentence of the text must have a clip, or the whole line uses the device voice (mixing voices
   mid-line sounds odd). Math like "47 + 25 = ?" plays from the --math pieces as "47 plus" + "25 equals what?".
*/
(function(){
  'use strict';
  var REC = null, base = 'voice/', ctx = null, token = 0, sources = [], misses = {}, bufs = {}, speakTimer = null;
  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;

  // Same rules as record.py: sentences and a punctuation-free lowercase key.
  function speakable(t){
    return String(t).replace(/<[^>]+>/g, '')
      .replace(/=\s*\?/g, ' equals what?')
      .replace(/\u00d7/g, ' times ').replace(/\u00f7/g, ' divided by ').replace(/\u2212/g, ' minus ')
      .replace(/\+/g, ' plus ').replace(/=/g, ' equals ')
      .replace(/\s+/g, ' ').trim();
  }
  function sentencesOf(s){ return (s.match(/[^.!?]+[.!?]*/g) || []).map(function(x){ return x.trim(); }).filter(Boolean); }
  function keyOf(s){ return s.toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

  function num(n){
    n = Number(n);
    if(!(n >= 0) || n >= 1000 || n !== Math.floor(n)) return [null];
    if(n <= 100) return ['num:' + n];
    var h = n - n % 100, r = n % 100;
    return ['num:' + h].concat(r ? ['num:' + r] : []);
  }
  function chunk(n, kind, word){
    n = Number(n);
    if(!(n >= 0) || n >= 1000 || n !== Math.floor(n)) return [null];
    var id = function(r){ return (kind === 'pre' ? 'pre:' : 'post:') + r + ' ' + word; };
    if(n <= 100) return [id(n)];
    var h = n - n % 100, r = n % 100;
    return ['num:' + h, r ? id(r) : (kind === 'pre' ? 'op:' + word : word === 'what' ? 'op:equals what' : 'op:equals')];
  }
  function plan(spoken){
    if(!REC || N.natural === false) return null;
    var out = [], list = sentencesOf(spoken);
    for(var i = 0; i < list.length; i++){
      var s = list[i], f = REC.clips[keyOf(s)];
      if(f){ out.push({ f: f, gap: 0.28 }); continue; }
      var m = s.match(/^(\d+) (plus|minus|times|divided by) (\d+) equals (what\?|\d+)[.!]?$/i);
      if(m && REC.parts){
        var op = m[2].toLowerCase(), ask = /^what/i.test(m[4]);
        var ids = chunk(m[1], 'pre', op).concat(ask ? chunk(m[3], 'post', 'what') : chunk(m[3], 'post', 'eq').concat(num(m[4])));
        var fs = ids.map(function(id){ return id && REC.parts[id]; });
        if(fs.every(Boolean)){ fs.forEach(function(x, j){ out.push({ f: x, gap: j === fs.length - 1 ? 0.28 : 0.07 }); }); continue; }
      }
      misses[s] = true;
      return null;
    }
    return out.length ? out : null;
  }

  function audio(){
    if(!ctx){ try{ var C = window.AudioContext || window.webkitAudioContext; if(C) ctx = new C(); }catch(e){ ctx = null; } }
    if(ctx && ctx.state === 'suspended'){ try{ ctx.resume(); }catch(e){} }
    return ctx;
  }
  function load(f){
    if(!bufs[f]){
      var c = audio();
      bufs[f] = fetch(base + f).then(function(r){ if(!r.ok) throw new Error('clip ' + r.status); return r.arrayBuffer(); })
        .then(function(b){ return new Promise(function(res, rej){ c.decodeAudioData(b, res, rej); }); });
      bufs[f].catch(function(){ delete bufs[f]; });
    }
    return bufs[f];
  }
  function stopClips(){ token++; sources.forEach(function(s){ try{ s.stop(); }catch(e){} }); sources = []; }
  function play(p, spoken, onend){
    var c = audio(); if(!c) return device(spoken, onend);
    var my = ++token;
    Promise.all(p.map(function(x){ return load(x.f); })).then(function(list){
      if(my !== token) return;
      var t = c.currentTime + 0.04;
      list.forEach(function(b, i){ var s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(t); sources.push(s); t += b.duration + p[i].gap; });
      if(onend) setTimeout(function(){ if(my === token) onend(); }, Math.max(0, (t - c.currentTime) * 1000));
    }).catch(function(){ if(my === token) device(spoken, onend); });
    return true;
  }

  // The device voice, best one first: neural/Natural, Premium, Enhanced, Google; robotic novelty voices last.
  var ROBOT = /fred|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|espeak|junior|ralph|kathy|grandma|grandpa|rocko|shelley|reed|sandy|eddy|flo\b/i;
  function score(v){
    var n = v.name || '', s = 0;
    if(/natural|neural/i.test(n)) s += 100;
    if(/premium/i.test(n)) s += 95;
    if(/enhanced/i.test(n)) s += 70;
    if(/google/i.test(n)) s += 45;
    if(/en[-_]US/i.test(v.lang)) s += 10;
    if(ROBOT.test(n)) s -= 300;
    return s;
  }
  function bestVoice(){
    if(!synth) return null;
    var en = (synth.getVoices() || []).filter(function(v){ return /^en([-_]|$)/i.test(v.lang); });
    en.sort(function(a, b){ return score(b) - score(a); });
    return en[0] || null;
  }
  function device(spoken, onend){
    if(!synth || N.fallback === false){ if(onend) setTimeout(onend, 0); return false; }
    try{
      clearTimeout(speakTimer);
      var busy = synth.speaking || synth.pending;
      synth.cancel();
      var u = new SpeechSynthesisUtterance(spoken), v = bestVoice();
      if(v) u.voice = v;
      u.lang = (v && v.lang) || 'en-US'; u.rate = N.rate; u.pitch = N.pitch;
      if(onend){ u.onend = onend; u.onerror = onend; }
      if(!busy) synth.speak(u); else speakTimer = setTimeout(function(){ synth.speak(u); }, 60);  // iPhone needs speak() inside a tap
      return true;
    }catch(e){ return false; }
  }

  // iPhone/iPad: unlock audio on the first tap, and play even with the silent switch on.
  function unlock(){
    if(unlock.done) return; unlock.done = true;
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}
    audio();
    if(synth){ try{ var u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }catch(e){} }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function(ev){ document.addEventListener(ev, unlock, { once: true, capture: true }); });

  var N = window.Narrator = {
    natural: true, fallback: true, rate: 0.95, pitch: 1,
    load: function(url){
      url = url || 'voice/index.json';
      base = url.replace(/[^\/]*$/, '');
      return fetch(url).then(function(r){ return r.ok ? r.json() : null; })
        .then(function(j){ if(j && j.clips) REC = j; return !!REC; })
        .catch(function(){ return false; });
    },
    ready: function(){ return !!REC; },
    has: function(text){ return !!plan(speakable(text)); },
    say: function(text, onend){
      var spoken = speakable(text), p = plan(spoken);
      stopClips();
      if(synth){ try{ clearTimeout(speakTimer); synth.cancel(); }catch(e){} }
      return p ? play(p, spoken, onend) : device(spoken, onend);
    },
    stop: function(){ stopClips(); clearTimeout(speakTimer); if(synth){ try{ synth.cancel(); }catch(e){} } },
    misses: function(){ return Object.keys(misses); },
    unlock: unlock
  };
})();

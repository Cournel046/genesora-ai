/* Genesora AI: Gena's voice + lip-sync engine.
 *
 * What it does
 *  - Speaks text with the browser's built-in text-to-speech (optional, user toggles "Sound").
 *  - Moves the cartoon mouth in time with the words. Browsers do not give access to the audio itself,
 *    so the mouth shape is worked out from the TEXT (vowels open wide, b/m/p close the lips, commas and
 *    full stops make Gena pause) and then kept in step with the real voice using the browser's word
 *    events, plus a learned speaking speed per voice. Movements are smoothed so nothing flickers.
 *  - Works without sound too: with sound off, the same engine drives the mouth and the on-screen
 *    captions from a built-in clock, so the face and the text still move together.
 *
 *  Public API: window.GenesoraVoice  (see the bottom of this file)
 */
(function () {
  'use strict';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var synth = window.speechSynthesis;
  var supported = !!(synth && window.SpeechSynthesisUtterance);

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { /* storage blocked: fine */ }
    return null;
  }

  /* ───────── on / off (remembered) ───────── */
  var on = supported && store('gen-sound') === '1';
  var listeners = [];
  var activated = false;     // browsers only allow speech after the visitor has clicked/tapped something once
  function markActive() { activated = true; }
  try { if (navigator.userActivation && navigator.userActivation.hasBeenActive) activated = true; } catch (e) { /* ignore */ }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, markActive, { once: true, passive: true, capture: true }); });

  function setOn(v) {
    v = !!v && supported;
    if (v === on) return;
    on = v;
    if (v) activated = true;                  // called from a click, which counts
    store('gen-sound', v ? '1' : '0');
    if (!v) stop();
    else liveSilent.slice().forEach(function (h) { try { h.upgrade(); } catch (e) { /* ignore */ } });
    listeners.forEach(function (fn) { try { fn(on); } catch (e) { /* ignore */ } });
  }

  /* ───────── choose a voice ───────── */
  var voice = null;
  // Gena has ONE voice: a female US English voice. A website cannot ship its own voice through the browser, so the
  // best matching voice already installed on the visitor's device is chosen automatically, in this order of preference:
  //   Edge/Windows "natural" voices (Jenny, Aria, Ava), Chrome's "Google US English", Apple's Samantha/Ava/Allison,
  //   Windows Zira, then any other US English voice that is not a known male voice.
  var BEST = [/microsoft jenny.*natural/i, /microsoft aria.*natural/i, /microsoft ava.*natural/i, /microsoft (jenny|aria|ava|michelle|emma)/i,
              /google us english/i, /(samantha|ava|allison|susan|zoe|nicky).*(premium|enhanced)/i, /samantha/i, /\b(ava|allison|susan|zoe|nicky)\b/i,
              /microsoft zira/i, /female/i];
  var MALE = /\b(david|mark|guy|james|richard|george|fred|alex|tom|daniel|aaron|arthur|gordon|ryan|eric|roger|steffan|christopher|male)\b/i;
  function pickVoice() {
    if (!supported) return;
    var all = synth.getVoices() || [];
    if (!all.length) return;
    var us = all.filter(function (v) { return /^en[-_]us$/i.test(v.lang || ''); });
    var en = all.filter(function (v) { return /^en([-_]|$)/i.test(v.lang || ''); });
    var pool = us.length ? us : en.length ? en : all;
    for (var i = 0; i < BEST.length; i++) {
      for (var j = 0; j < pool.length; j++) if (BEST[i].test(pool[j].name || '')) { voice = pool[j]; return; }
    }
    voice = pool.filter(function (v) { return !MALE.test(v.name || ''); })[0] || pool[0] || null;
  }
  store('gen-voice', null);
  if (supported) {
    pickVoice();
    try { synth.addEventListener('voiceschanged', pickVoice); } catch (e) { synth.onvoiceschanged = pickVoice; }
  }

  /* ───────── learned speaking speed (ms per "cost unit"), per voice ───────── */
  var BASE_MS = 62;
  var speed = {};
  try { speed = JSON.parse(store('gen-vspd') || '{}') || {}; } catch (e) { speed = {}; }
  function voiceKey() { return voice ? (voice.voiceURI || voice.name || 'v') : 'none'; }
  function learnedSpeed() { var s = speed[voiceKey()]; return (typeof s === 'number' && s > 25 && s < 170) ? s : BASE_MS; }
  function rememberSpeed(ms) {
    if (!(ms > 25 && ms < 170)) return;
    var k = voiceKey();
    speed[k] = speed[k] ? speed[k] * 0.5 + ms * 0.5 : ms;
    store('gen-vspd', JSON.stringify(speed));
  }

  /* ───────── text -> mouth timeline ───────── */
  var EMOJI = null;
  try { EMOJI = new RegExp('[\\p{Extended_Pictographic}\\u200d\\ufe0f]', 'u'); } catch (e) { EMOJI = /[☀-➿\ud83c-\ud83e][\udc00-\udfff]?|[‍️]/; }

  // strip emoji / markdown, but remember where every kept character came from
  function clean(text) {
    var out = '', map = [], i = 0, last = '';
    var chars = Array.from(String(text));
    var pos = 0;
    chars.forEach(function (ch) {
      var len = ch.length;
      var skip = EMOJI.test(ch) || /[*_`#~<>\[\]{}|\\^]/.test(ch);
      if (!skip) {
        if (/\s/.test(ch)) { ch = ' '; if (last === ' ' || out === '') { pos += len; return; } }
        out += ch; map.push(pos); last = ch;
      }
      pos += len;
    });
    // trailing space
    while (out.length && out.charAt(out.length - 1) === ' ') { out = out.slice(0, -1); map.pop(); }
    return { text: out, map: map };
  }

  var OPEN = { a: 1, o: 0.86, u: 0.58, e: 0.68, i: 0.48, y: 0.42 };
  var WIDE = { a: 1.0, o: 0.7, u: 0.62, e: 1.12, i: 1.2, y: 1.1 };
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // one entry per character: how long it takes (cost), how open the mouth is, how wide
  function timeline(txt) {
    var n = txt.length, cost = new Array(n), open = new Array(n), wide = new Array(n), cum = new Array(n + 1);
    var wordStart = 0, vary = 1;
    for (var i = 0; i < n; i++) {
      var ch = txt.charAt(i), lc = ch.toLowerCase();
      if (i === 0 || txt.charAt(i - 1) === ' ') {
        var end = txt.indexOf(' ', i); if (end < 0) end = n;
        wordStart = i; vary = 0.86 + (hash(txt.slice(i, end).toLowerCase()) % 26) / 100;   // 0.86 .. 1.11: no two words look identical
      }
      var c = 1, o = 0.3, w = 1;
      if (OPEN[lc]) { o = OPEN[lc] * vary; w = WIDE[lc]; c = 1.15; }
      else if (/[bmp]/.test(lc)) { o = 0; c = 0.9; }                       // lips close
      else if (/[fv]/.test(lc)) { o = 0.14; c = 0.9; w = 1.1; }
      else if (/[wq]/.test(lc)) { o = 0.32; c = 1; w = 0.68; }
      else if (/[sz]/.test(lc)) { o = 0.2; c = 0.95; w = 1.18; }
      else if (/[cxjk]|g/.test(lc)) { o = 0.36; c = 0.95; }
      else if (/[tdnl]/.test(lc)) { o = 0.3; c = 0.9; }
      else if (lc === 'h') { o = 0.4; c = 0.7; }
      else if (lc === 'r') { o = 0.36; c = 0.95; w = 0.85; }
      else if (/[0-9]/.test(lc)) { o = 0.7; c = 2.4; w = 0.9; }
      else if (ch === ' ') { o = 0.1; c = 0.55; }
      else if (ch === ',' || ch === ';' || ch === ':') { o = 0; c = 3.2; }
      else if (ch === '.' || ch === '!' || ch === '?') { o = 0; c = 5.5; }
      else if (ch === '-' || ch === '–' || ch === '—') { o = 0.05; c = 1.5; }
      else if (ch === "'" || ch === '’') { o = 0.2; c = 0.1; }
      else if (/[%&@$]/.test(ch)) { o = 0.6; c = 3; }
      else if (!/[a-z]/.test(lc)) { o = 0.3; c = 1; }                       // any other letter
      // a word's last letter relaxes a little
      if (i + 1 >= n || txt.charAt(i + 1) === ' ' || /[.,!?;:]/.test(txt.charAt(i + 1))) o *= 0.9;
      cost[i] = c; open[i] = Math.min(1, o); wide[i] = w;
    }
    cum[0] = 0;
    for (var k = 0; k < n; k++) cum[k + 1] = cum[k] + cost[k];
    return { n: n, cost: cost, open: open, wide: wide, cum: cum, total: cum[n] };
  }

  function charAt(tl, u) {                 // which character is being spoken at cost position u
    var lo = 0, hi = tl.n - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (tl.cum[mid] <= u) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function sample(tl, u) {                 // smooth mouth target at position u (linear between character centres)
    if (!tl.n) return { o: 0, w: 1 };
    var i = charAt(tl, u), f = tl.cost[i] ? (u - tl.cum[i]) / tl.cost[i] : 0;
    var p = i + f - 0.5, a = Math.floor(p), t = p - a;
    var a0 = Math.max(0, Math.min(tl.n - 1, a)), a1 = Math.max(0, Math.min(tl.n - 1, a + 1));
    return { o: tl.open[a0] + (tl.open[a1] - tl.open[a0]) * t, w: tl.wide[a0] + (tl.wide[a1] - tl.wide[a0]) * t };
  }

  /* ───────── the speaker ───────── */
  var current = null;
  var liveSilent = [];          // lines currently running without a voice that could be given one

  function splitChunks(txt) {              // sentence-sized pieces keep the browser voice happy (some stop after ~15 s)
    var chunks = [], re = /[^.!?]+[.!?]*\s*/g, m, start = 0, buf = '';
    while ((m = re.exec(txt))) {
      var piece = m[0];
      if (buf && (buf + piece).length > 170) { chunks.push({ start: start, text: buf }); start += buf.length; buf = ''; }
      buf += piece;
    }
    if (buf) chunks.push({ start: start, text: buf });
    return chunks.filter(function (c) { return /\S/.test(c.text); });
  }

  function stop() {
    if (current) { var c = current; current = null; c.cancel(true); }
    else if (supported) { try { synth.cancel(); } catch (e) { /* ignore */ } }
  }

  /*  say(text, opts)
        opts.face        a face from GenesoraFun.mountFace (needs .lip / .lipEnd), optional
        opts.silent      true = never use audio (mouth and captions still run)
        opts.msPerUnit   speed of the built-in clock when silent (default 44)
        opts.pitch/rate  voice settings (defaults 1.05 / 1)
        opts.tag         a label such as 'chat' so other parts of the page can tell who is talking
        opts.onCancel()  called if something else interrupts this line
        opts.onStart()   opts.onProgress(endOfCurrentWordInOriginalText, fraction 0..1)   opts.onEnd()
      returns { cancel(), done }  */
  function say(text, opts) {
    opts = opts || {};
    stop();
    var cl = clean(text);
    var tl = timeline(cl.text);
    var face = opts.face && opts.face.lip ? opts.face : null;
    var useAudio = supported && on && activated && !opts.silent && cl.text.length > 0;
    var animate = !reduceMotion;
    var h = { cancelled: false, finished: false, quiet: false, child: null, from: 0, tag: opts.tag || '' };
    var msPerUnit = useAudio ? learnedSpeed() / (opts.rate || 1) : (opts.msPerUnit || 44);
    var u = 0, openNow = 0, wideNow = 1, lastT = 0, raf = 0, timer = 0, started = 0;
    var lastB = null, lastWord = -1, chunks = [], ci = 0, audioDone = !useAudio, wd = 0, ending = 0;
    var waitingStart = false, chunkEndU = 0, startGuard = 0;
    var utter = null;

    function wordEnd(idx) {                // end of the word containing clean index idx, mapped to the original text
      var e = idx; while (e < cl.text.length && cl.text.charAt(e) !== ' ') e++;
      return (cl.map[Math.max(0, Math.min(e - 1, cl.map.length - 1))] || 0) + 1;
    }
    function progress(idx) {
      var wi = idx;
      while (wi > 0 && cl.text.charAt(wi - 1) !== ' ') wi--;
      if (wi === lastWord) return; lastWord = wi;
      h.from = cl.map[wi] || 0;                                                   // where this word starts in the original text
      if (opts.onProgress) { try { opts.onProgress(wordEnd(idx), tl.total ? Math.min(1, tl.cum[idx] / tl.total) : 1); } catch (e) { /* ignore */ } }
    }
    function finish(natural) {
      if (h.finished) return; h.finished = true;
      cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(wd); clearTimeout(startGuard);
      if (face) { try { face.lipEnd(); } catch (e) { /* ignore */ } }
      if (current === h) current = null;
      var li = liveSilent.indexOf(h); if (li >= 0) liveSilent.splice(li, 1);
      if (natural && opts.onProgress) { try { opts.onProgress(String(text).length, 1); } catch (e) { /* ignore */ } }
      if (natural && opts.onEnd) { try { opts.onEnd(); } catch (e) { /* ignore */ } }
      if (!natural && !h.quiet && opts.onCancel) { try { opts.onCancel(); } catch (e) { /* ignore */ } }
    }
    h.cancel = function (quiet) {
      if (h.child) h.child.cancel(quiet);
      if (h.finished) return; h.cancelled = true;
      if (utter) { utter.onend = utter.onerror = utter.onboundary = null; }
      if (useAudio) { try { synth.cancel(); } catch (e) { /* ignore */ } }
      finish(false);
    };

    /* animation loop: advance the position, snap gently to real word events, drive the mouth */
    function frame(t) {
      if (h.finished) return;
      var dt = lastT ? Math.min(64, t - lastT) : 16; lastT = t;
      if (!ending && !(useAudio && waitingStart)) u = Math.min(tl.total, u + dt / msPerUnit);   // hold still until the voice actually starts
      if (useAudio && !audioDone && u > chunkEndU - 0.3) u = Math.max(0, chunkEndU - 0.3);       // never run ahead of a voice that is still talking this sentence
      var i = Math.min(tl.n - 1, charAt(tl, u));
      var holding = useAudio && waitingStart;                                    // voice not started yet: caption empty, lips closed
      if (!holding) progress(i);
      var tgt = (ending || holding) ? { o: 0, w: 1 } : sample(tl, u);
      var tau = tgt.o < openNow ? 22 : 38;                                       // lips close a bit faster than they open
      var k = 1 - Math.exp(-dt / tau);
      var step = (tgt.o - openNow) * k, cap = 0.0105 * dt;                     // a jaw cannot snap: limit how fast it can swing
      openNow += Math.max(-cap * 1.3, Math.min(cap, step));
      wideNow += (tgt.w - wideNow) * k;
      if (face && animate) face.lip(Math.max(0, openNow) * 0.95, wideNow);
      if (!useAudio && u >= tl.total) {                                          // built-in clock reached the end
        if (!ending) { ending = 1; timer = setTimeout(function () { finish(true); }, 140); }
      }
      raf = requestAnimationFrame(frame);
    }

    /* audio */
    function speakChunk() {
      if (h.cancelled || h.finished) return;
      if (ci >= chunks.length) { audioDone = true; u = tl.total; endAudio(); return; }
      var c = chunks[ci], done = false;
      chunkEndU = tl.cum[Math.min(tl.n, c.start + c.text.length)];
      waitingStart = true; clearTimeout(startGuard);
      startGuard = setTimeout(function () { waitingStart = false; }, 4500);         // online voices can need a few seconds; only give up if no start is ever reported
      var ut = new SpeechSynthesisUtterance(c.text);
      utter = ut;
      try { if (voice) { ut.voice = voice; ut.lang = voice.lang || 'en-US'; } else ut.lang = 'en-US'; } catch (e) { /* mock voices etc. */ }
      ut.rate = opts.rate || 1; ut.pitch = opts.pitch || 1.05; ut.volume = 1;
      var t0 = 0;
      function next(realMs) {
        if (done) return; done = true; clearTimeout(wd);
        ut.onend = ut.onerror = ut.onboundary = null;
        if (h.cancelled || h.finished) return;
        var units = tl.cum[Math.min(tl.n, c.start + c.text.length)] - tl.cum[c.start];
        if (realMs > 600 && units > 8) { var sp = realMs / units * (opts.rate || 1); msPerUnit = Math.max(25, Math.min(160, msPerUnit * 0.4 + (sp / (opts.rate || 1)) * 0.6)); rememberSpeed(sp); }
        u = Math.max(u, tl.cum[Math.min(tl.n, c.start + c.text.length)] - 0.01);
        ci++; lastB = null;
        speakChunk();
      }
      ut.onstart = function () { waitingStart = false; clearTimeout(startGuard); t0 = performance.now(); if (ci === 0 && opts.onStart) { try { opts.onStart(); } catch (e) { /* ignore */ } } };
      ut.onboundary = function (e) {
        if (h.cancelled || h.finished) return;
        if (e && e.name && e.name !== 'word') return;
        var idx = c.start + (e.charIndex || 0);
        if (idx >= tl.n) return;
        var now = performance.now(), target = tl.cum[idx];
        if (lastB) {                                                              // measured speed between two word starts
          var du = target - lastB.u, dr = now - lastB.t;
          if (du > 2.5 && dr > 70) msPerUnit = Math.max(25, Math.min(160, msPerUnit * 0.7 + (dr / du) * 0.3));
        }
        lastB = { u: target, t: now };
        u += (target - u) * 0.7;                                                  // glide to the real position, don't jump
      };
      ut.onend = function () { next(t0 ? performance.now() - t0 : 0); };
      ut.onerror = function (e) {
        if (e && (e.error === 'not-allowed' || e.error === 'synthesis-failed' || e.error === 'audio-busy')) { audioDone = true; useAudio = false; waitingStart = false; msPerUnit = opts.msPerUnit || 44; return; }   // carry on silently
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) { if (!h.cancelled) next(0); return; }
        next(0);
      };
      wd = setTimeout(function () { next(0); }, c.text.length * 95 + 3500);       // never get stuck
      try { synth.resume(); } catch (e) { /* ignore */ }
      try { synth.speak(ut); } catch (e) { audioDone = true; useAudio = false; waitingStart = false; msPerUnit = opts.msPerUnit || 44; }
    }
    function endAudio() {
      if (h.finished) return;
      ending = 1; timer = setTimeout(function () { finish(true); }, 160);
    }

    // Sound switched on while this line is already running silently: carry on from the current word, now with a voice.
    h.upgrade = function () {
      if (h.finished || useAudio || opts.silent === true || !supported) return;
      var from = h.from || 0, rest = String(text).slice(from);
      if (!/\S/.test(rest)) return;
      h.quiet = true; h.cancel();
      var inner = {};
      for (var k in opts) inner[k] = opts[k];
      inner.onProgress = function (end, frac) { if (opts.onProgress) opts.onProgress(from + end, frac); };
      inner.onStart = null;
      h.child = say(rest, inner);
      h.finished = true;                // the parent is done; the child now owns the line
    };
    if (!useAudio && !opts.silent && supported && cl.text.length) liveSilent.push(h);

    current = h;
    started = performance.now();
    if (!cl.text.length) { finish(true); return h; }
    if (reduceMotion || !animate) { if (opts.onProgress) { try { opts.onProgress(String(text).length, 1); } catch (e) { /* ignore */ } } }
    raf = requestAnimationFrame(frame);
    if (useAudio) {
      chunks = splitChunks(cl.text);
      if (opts.onStart && false) opts.onStart();
      setTimeout(function () { if (!h.cancelled && !h.finished) speakChunk(); }, 40);     // let a previous cancel() settle
    } else if (opts.onStart) { try { opts.onStart(); } catch (e) { /* ignore */ } }
    return h;
  }

  /* ───────── the Sound button ───────── */
  function mountToggle(container, opts) {
    if (!container || !supported) return null;
    opts = opts || {};
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gen-sound' + (opts.className ? ' ' + opts.className : '');
    function paint() {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = '<span aria-hidden="true">' + (on ? '🔊' : '🔇') + '</span><span class="gs-txt">' + (opts.compact ? '' : (on ? ' Sound on' : ' Sound off')) + '</span>';
      b.title = on ? 'Turn Gena’s voice off' : 'Turn Gena’s voice on';
      b.setAttribute('aria-label', b.title);
    }
    b.addEventListener('click', function () { setOn(!on); });

    listeners.push(paint);
    paint();
    if (opts.before) container.insertBefore(b, opts.before); else container.appendChild(b);
    return b;
  }

  window.GenesoraVoice = {
    supported: supported,
    isOn: function () { return on; },
    setOn: setOn,
    toggle: function () { setOn(!on); },
    onChange: function (fn) { listeners.push(fn); },
    say: say,
    stop: stop,
    activeTag: function () { return current ? current.tag : ''; },
    mountToggle: mountToggle,
    _voice: function () { return voice ? voice.name : null; },   // exposed for testing
    _timeline: timeline,
    _clean: clean
  };
})();

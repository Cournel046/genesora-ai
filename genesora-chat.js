/* Genesora AI: "Ask Gena" chat window.
 *
 * Fully in the browser. There is no server, no API key and nothing you type is sent anywhere.
 * Answers come from the built-in knowledge base (gena-kb.js, built from gena-kb/kb/*.txt)
 * using the matcher in genesora-chat-match.js.
 *
 * To teach Gena new things: edit gena-kb/kb/*.txt and run  python gena-kb/build-kb.py
 * To see what visitors' kind of questions were NOT understood (during your own testing),
 * open the browser console and type:  GenaChat.unanswered()
 */
(function () {
  'use strict';
  var KB = window.GENA_KB, GM = window.GenaMatch;
  if (!KB || !GM || !document.body) return;

  var matcher = new GM.Matcher(KB);
  var byId = {};
  KB.forEach(function (e) { byId[e.id] = e; });

  var ANSWER_MIN = 0.38;       // below this Gena says she is not sure
  var CONFIDENT = 0.72;        // below this (but above ANSWER_MIN) she also offers "Did you mean…" chips
  var MAX_LEN = 300;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var Voice = window.GenesoraVoice;
  var Fun = window.GenesoraFun;

  var STARTERS = [
    ['When do you launch?', 'launch-date'], ['How do I join the waitlist?', 'waitlist-what'],
    ['Is this demo real?', 'demo-real'], ['How is my 60-second score calculated?', 'challenge-score'],
    ['How do I stop being nervous in interviews?', 'nervous'], ['How does hiring work for companies?', 'company-steps'],
    ['Who founded Genesora?', 'founders'], ['What will it cost?', 'pricing'],
    ['How do I answer "Tell me about yourself"?', 'tell-me-about-yourself'], ['What is the AI video call?', 'ai-video-call']
  ];
  // after an answer, nudge the visitor towards natural next questions
  var FOLLOW = {
    'what-is': ['three-pillars', 'is-it-live', 'waitlist-what'],
    'three-pillars': ['ai-video-call', 'recruitment-overview', 'ai-chat-pillar'],
    'is-it-live': ['waitlist-what', 'roadmap', 'launch-date'],
    'launch-date': ['waitlist-what', 'roadmap', 'phase-beta'],
    'waitlist-what': ['waitlist-referral', 'waitlist-benefit', 'waitlist-cost'],
    'waitlist-referral': ['waitlist-benefit', 'launch-date'],
    'pricing': ['waitlist-what', 'launch-date'],
    'ai-video-call': ['own-character', 'demo-real', 'phase-video'],
    'demo-real': ['demo-vs-launch', 'challenge-what', 'launch-date'],
    'challenge-what': ['challenge-score', 'challenge-privacy'],
    'recruitment-overview': ['jobseeker-steps', 'company-steps', 'who-decides'],
    'jobseeker-steps': ['practice-mode', 'who-decides', 'jobseeker-control'],
    'company-steps': ['company-report', 'who-decides', 'company-pilot'],
    'founders': ['kamal', 'karanvir', 'contact'],
    'roadmap': ['phase-beta', 'phase-public', 'launch-date'],
    'contact': ['partnerships', 'waitlist-what'],
    'hello': ['what-is', 'tell-me-about-yourself', 'launch-date'],
    'nervous': ['mind-blank', 'mock-interview', 'day-before'],
    'tell-me-about-yourself': ['strengths', 'weaknesses', 'why-hire-you'],
    'star-method': ['behavioural-examples', 'quantify', 'answer-length'],
    'video-interview': ['camera-setup', 'what-to-wear', 'ai-interview'],
    'resume-structure': ['resume-bullets', 'ats', 'resume-length'],
    'salary-expectations': ['negotiation-offer', 'ask-salary-range']
  };
  var FALLBACKS = [
    "I'm not sure about that one. I know Genesora AI and interview basics well, so try asking about those. Or email {EMAIL} and a human will reply.",
    "Hmm, that's outside what I know. I'm a small demo assistant. Ask me about Genesora, the waitlist, or interview tips, or email {EMAIL}.",
    "I don't have a good answer for that, and I'd rather not guess. Here are some things I can help with:"
  ];
  var EMAIL = 'contact@genesoraai.com';
  var misses = [], fbIndex = 0, lastId = '', lastAt = 0, history = [];

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function label(e) {
    var q = e.q[0];
    q = cap(q).replace(/\bi\b/g, 'I');
    if (/^(what|who|when|where|why|how|is|are|can|do|does|will|should|which|could)\b/i.test(q) && !/[?.!]$/.test(q)) q += '?';
    return q;
  }
  function pickN(arr, n) {
    var a = arr.slice(), out = [];
    while (a.length && out.length < n) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    return out;
  }
  function starterChips(n) { return pickN(STARTERS, n).map(function (s) { return { text: s[0], q: s[0] }; }); }

  /* ───────── build the window ───────── */
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'gc-fab';
  fab.setAttribute('aria-label', 'Chat with Gena, the AI HR demo');
  fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = '<span class="gc-fab-face"></span><span class="gc-fab-txt">Ask Gena</span>';

  var panel = document.createElement('section');
  panel.className = 'gc-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with Gena');
  panel.innerHTML =
    '<header class="gc-head">' +
      '<div class="gc-face"></div>' +
      '<div class="gc-title">Gena<small>AI HR demo · answers from a built-in knowledge base</small></div>' +
      '<div class="gc-tools"></div>' +
    '</header>' +
    '<div class="gc-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div class="gc-chips" aria-label="Suggested questions"></div>' +
    '<form class="gc-form" autocomplete="off">' +
      '<input class="gc-input" type="text" maxlength="' + MAX_LEN + '" placeholder="Ask about Genesora or interviews…" aria-label="Your question" enterkeyhint="send">' +
      '<button class="gc-send" type="submit" aria-label="Send">➤</button>' +
    '</form>' +
    '<p class="gc-note">Demo assistant. Replies come from a built-in knowledge base in your browser, and nothing you type is sent anywhere. It can be wrong, so for anything important email <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.</p>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector('.gc-log'), chipsEl = panel.querySelector('.gc-chips');
  var form = panel.querySelector('.gc-form'), input = panel.querySelector('.gc-input');
  var tools = panel.querySelector('.gc-tools');

  var headFace = Fun && Fun.mountFace ? Fun.mountFace(panel.querySelector('.gc-face')) : null;
  var fabFace = Fun && Fun.mountFace ? Fun.mountFace(fab.querySelector('.gc-fab-face')) : null;
  if (headFace) headFace.setMood('smile');
  if (fabFace) fabFace.setMood('smile');

  if (Voice && Voice.supported) Voice.mountToggle(tools, { className: 'gc-sound', compact: true });
  var clearBtn = document.createElement('button');
  clearBtn.type = 'button'; clearBtn.className = 'gc-tool'; clearBtn.title = 'Clear chat'; clearBtn.setAttribute('aria-label', 'Clear chat');
  clearBtn.textContent = '↺';
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button'; closeBtn.className = 'gc-tool'; closeBtn.title = 'Close chat'; closeBtn.setAttribute('aria-label', 'Close chat');
  closeBtn.textContent = '✕';
  tools.appendChild(clearBtn); tools.appendChild(closeBtn);

  /* ───────── messages ───────── */
  function fill(el, text, link) {      // plain text; the contact email becomes a link
    el.textContent = '';
    if (!link) { el.textContent = text; return; }
    var parts = text.split(EMAIL);
    parts.forEach(function (p, i) {
      if (p) el.appendChild(document.createTextNode(p));
      if (i < parts.length - 1) { var a = document.createElement('a'); a.href = 'mailto:' + EMAIL; a.textContent = EMAIL; el.appendChild(a); }
    });
  }
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function addMsg(who, text) {
    var m = document.createElement('div');
    m.className = 'gc-msg gc-' + who;
    var b = document.createElement('div'); b.className = 'gc-bubble';
    fill(b, text, who === 'bot');
    m.appendChild(b); log.appendChild(m); scrollDown();
    return b;
  }
  function addTyping() {
    var m = document.createElement('div');
    m.className = 'gc-msg gc-bot gc-typing';
    m.innerHTML = '<div class="gc-bubble" aria-label="Gena is typing"><i></i><i></i><i></i></div>';
    log.appendChild(m); scrollDown();
    return m;
  }
  function setChips(list) {
    chipsEl.textContent = '';
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'gc-chip'; b.textContent = c.text;
      b.addEventListener('click', function () { send(c.q); });
      chipsEl.appendChild(b);
    });
  }
  function chipsFor(ids, exclude) {
    var out = [];
    ids.forEach(function (id) { if (byId[id] && id !== exclude && out.length < 3) out.push({ text: label(byId[id]), q: byId[id].q[0] }); });
    return out;
  }

  /* ───────── thinking of a reply ───────── */
  function decide(text) {
    var norm = GM.normalize(text);
    if (/^(more|tell me more|go on|continue|elaborate|explain|explain that|why|why\?|what do you mean|and|and\?|then|so)$/.test(norm)) {
      if (lastId) {
        var f = (FOLLOW[lastId] || []).slice();
        var chips = chipsFor(f, lastId);
        if (!chips.length) chips = starterChips(3);
        return { text: "That's all I have on that one. Here are some good next questions:", chips: chips, id: lastId };
      }
      return { text: "Happy to! Ask me about Genesora AI, the waitlist, or interview tips. Try one of these:", chips: starterChips(3), id: '' };
    }
    var r = matcher.match(text);
    if (r.best && r.score >= ANSWER_MIN) {
      var e = r.best.entry;
      if (e.id === lastId && Date.now() - lastAt < 120000) {
        return { text: "I just covered that. Want to dig into something related?", chips: chipsFor(FOLLOW[e.id] || [], e.id).concat(starterChips(2)).slice(0, 3), id: e.id };
      }
      var talk = e.c === 't';
      var chips2 = chipsFor(FOLLOW[e.id] || [], e.id);
      if (r.score < CONFIDENT && !talk) {              // not sure: also offer the nearest alternatives
        var alts = r.list.slice(1).filter(function (x) { return x.score >= 0.3 && x.entry.c !== 't'; }).slice(0, 2).map(function (x) { return { text: label(x.entry), q: x.entry.q[0] }; });
        return { text: e.a, chips: alts.length ? alts : chips2, did: alts.length > 0, id: e.id };
      }
      if (!chips2.length && !talk) {
        chips2 = r.list.slice(1).filter(function (x) { return x.score >= 0.3 && x.entry.c !== 't'; }).slice(0, 3).map(function (x) { return { text: label(x.entry), q: x.entry.q[0] }; });
      }
      return { text: e.a, chips: chips2.length ? chips2 : starterChips(3), id: e.id };
    }
    // not understood
    if (misses.length < 200) misses.push(text.slice(0, 200));
    var near = r.list ? r.list.filter(function (x) { return x.score >= 0.18 && x.entry.c !== 't'; }).slice(0, 3).map(function (x) { return { text: label(x.entry), q: x.entry.q[0] }; }) : [];
    var fb = FALLBACKS[fbIndex++ % FALLBACKS.length].replace('{EMAIL}', EMAIL);
    return { text: fb, chips: near.length >= 2 ? near : starterChips(3), id: '', miss: true };
  }

  var busy = false, speaking = null, greeted = false;
  function stopSpeaking() { if (Voice && Voice.activeTag() === 'chat') Voice.stop(); if (headFace) headFace.lipEnd(); speaking = null; }

  function botSay(res, done) {
    var useVoice = Voice && Voice.supported && Voice.isOn();
    var typing = addTyping();
    var wait = reduceMotion ? 0 : Math.min(900, 250 + res.text.length * 4);
    if (useVoice) wait = 220;
    setTimeout(function () {
      typing.remove();
      var bubble = addMsg('bot', useVoice ? '' : res.text);
      var finished = false;
      function end() {
        if (finished) return; finished = true;
        fill(bubble, res.text, true);
        if (res.did) {
          var hint = document.createElement('div'); hint.className = 'gc-hint'; hint.textContent = 'Or did you mean:';
          chipsEl.parentNode.insertBefore(hint, chipsEl);
        }
        setChips(res.chips || []);
        scrollDown();
        busy = false; if (done) done();
      }
      if (Voice) {
        // lips (and, with Sound on, the voice) follow the reply; with Sound on the words appear as they are spoken
        speaking = Voice.say(res.text, {
          face: headFace, tag: 'chat', silent: !useVoice, msPerUnit: 30,
          onProgress: useVoice ? function (endIdx) { bubble.textContent = res.text.slice(0, endIdx); scrollDown(); } : null,
          onEnd: end, onCancel: end
        });
        if (!useVoice) end();                  // muted: show everything right away, the mouth just moves along
      } else { end(); }
    }, wait);
  }

  function clearHint() { var h = panel.querySelector('.gc-hint'); if (h) h.remove(); }

  function send(raw) {
    var text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    if (Date.now() - lastAt < 250) return;
    stopSpeaking(); clearHint();
    addMsg('user', text);
    setChips([]);
    input.value = '';
    busy = true;
    var res = decide(text);
    lastAt = Date.now();
    if (!res.miss) lastId = res.id || lastId;
    botSay(res);
    if (headFace) headFace.setMood(res.miss ? 'shy' : 'smile');
  }

  function greet() {
    if (greeted) return; greeted = true;
    busy = true;
    botSay({ text: "Hi, I'm Gena, the AI HR on this site 👋 Ask me about Genesora AI or for a quick interview tip. I know a lot, but I'm still a demo.", chips: starterChips(4) });
  }
  function reset() {
    stopSpeaking(); clearHint();
    log.textContent = ''; chipsEl.textContent = '';
    busy = false; greeted = false; lastId = '';
    greet();
  }

  /* ───────── open / close ───────── */
  var isOpen = false;
  function openPanel() {
    if (isOpen) return; isOpen = true;
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); document.documentElement.classList.add('gc-open');
    requestAnimationFrame(function () { panel.classList.add('in'); });
    greet();
    setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }, 60);
  }
  function closePanel() {
    if (!isOpen) return; isOpen = false;
    panel.classList.remove('in'); fab.setAttribute('aria-expanded', 'false'); document.documentElement.classList.remove('gc-open');
    stopSpeaking();
    setTimeout(function () { if (!isOpen) panel.hidden = true; }, reduceMotion ? 0 : 200);
    try { fab.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  fab.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
  closeBtn.addEventListener('click', closePanel);
  clearBtn.addEventListener('click', reset);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) closePanel(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  // typing in the chat must not trigger the page's hidden keyboard easter eggs
  input.addEventListener('keydown', function (e) { e.stopPropagation(); });

  // if the cookie banner is showing, sit above it on small screens
  var banner = document.querySelector('.cookie-banner');
  function bannerCheck() { document.documentElement.classList.toggle('gc-cookie', !!banner && !banner.classList.contains('hidden')); }
  if (banner) {
    bannerCheck();
    try { new MutationObserver(bannerCheck).observe(banner, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* ignore */ }
  }

  // small hello-wiggle on the button after a few seconds (once)
  if (!reduceMotion) setTimeout(function () { if (!isOpen) fab.classList.add('nudge'); }, 5000);
  fab.addEventListener('animationend', function () { fab.classList.remove('nudge'); });

  window.GenaChat = {
    open: openPanel, close: closePanel,
    ask: function (q) { openPanel(); send(q); },
    unanswered: function () { return misses.slice(); },   // questions Gena could not match (this page view only)
    topics: KB.length
  };
})();

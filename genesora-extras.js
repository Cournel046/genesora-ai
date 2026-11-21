/* ==========================================================
   Genesora AI — fun extras
   1. Hero face that follows the cursor
   2. Living AI video-call demo
   3. 60-Second Interview Challenge
   4. Referral waitlist game
   5. Easter eggs (confetti, toasts, konami code)
   Everything here runs in the browser. No backend needed,
   except the optional referral position (see apps-script-referral.gs).
   ========================================================== */
(function () {
  'use strict';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var uidCounter = 0;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
    return null;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (e) { return false; }
  }
  function pageUrl() { return location.href.split('#')[0].split('?')[0]; }

  // Challenge: ask one follow-up question before scoring. Off for now; set to true to enable.
  var ENABLE_FOLLOWUP = false;

  /* ──────────────────────────────────────────────
     SHARED: the animated AI face ("Gena")
     ────────────────────────────────────────────── */
  var MOUTH = {
    neutral: 'M84 140 Q100 147 116 140',
    smile:   'M74 134 Q100 161 126 134',
    shy:     'M88 145 Q100 141 112 145',
    wow:     'M96 144 Q100 142 104 144'
  };
  var MOODS = ['neutral', 'smile', 'shy', 'wow'];

  function faceMarkup(id) {
    var eyes = [70, 130].map(function (x) {
      return '<ellipse cx="' + x + '" cy="92" rx="15" ry="17" fill="#fff"/>' +
        '<g class="pupil"><circle cx="' + x + '" cy="93" r="8" fill="#0b1020"/><circle cx="' + (x + 3) + '" cy="89" r="2.6" fill="#fff"/></g>' +
        '<ellipse class="lid" cx="' + x + '" cy="92" rx="16.5" ry="18.5" fill="url(#fg-' + id + ')"/>';
    }).join('');
    return '<svg class="ai-face" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gena, an animated AI character">' +
      '<defs>' +
        '<linearGradient id="fg-' + id + '" gradientUnits="userSpaceOnUse" x1="30" y1="20" x2="170" y2="180"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#2563eb"/></linearGradient>' +
        '<radialGradient id="fh-' + id + '" cx="35%" cy="25%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<circle cx="100" cy="100" r="94" fill="url(#fg-' + id + ')" opacity=".22"/>' +
      '<circle cx="100" cy="100" r="80" fill="url(#fg-' + id + ')"/>' +
      '<ellipse class="cheek" cx="50" cy="122" rx="12" ry="7" fill="#fb7185"/>' +
      '<ellipse class="cheek" cx="150" cy="122" rx="12" ry="7" fill="#fb7185"/>' +
      eyes +
      '<circle cx="100" cy="100" r="80" fill="url(#fh-' + id + ')" pointer-events="none"/>' +
      '<path d="M22 96 C22 30 178 30 178 96" fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="12" y="88" width="14" height="32" rx="7" fill="#e2e8f0"/>' +
      '<rect x="174" y="88" width="14" height="32" rx="7" fill="#e2e8f0"/>' +
      '<path d="M180 118 C182 150 160 160 130 156" fill="none" stroke="#e2e8f0" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="126" cy="156" r="5" fill="#e2e8f0"/>' +
      '<path class="brow brow-l" d="M54 64 Q70 56 86 64"/>' +
      '<path class="brow brow-r" d="M114 64 Q130 56 146 64"/>' +
      '<ellipse class="mouth-open" cx="100" cy="142" rx="14" ry="10" fill="#1a0b3a"/>' +
      '<path class="mouth" d="' + MOUTH.neutral + '" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
    '</svg>';
  }

  // Which look to use for Gena: 'cartoon' (the SVG face) or 'photo' (the AI persona photo, parked for later).
  // To try the photo again, set this to 'photo' and add sunita-face.jpg and sunita-tile.jpg next to index.html.
  var FACE_MODE = 'cartoon';
  var PHOTO_SQUARE = 'sunita-face.jpg';
  var PHOTO_TILE = 'sunita-tile.jpg';

  function photoMarkup(shape) {
    var src = shape === 'tile' ? PHOTO_TILE : PHOTO_SQUARE;
    return '<div class="ai-face ai-photo' + (shape === 'tile' ? ' ai-photo-tile' : '') + '" role="img" aria-label="Gena, an AI character (demo preview)">' +
      '<span class="ap-ring"></span>' +
      '<span class="ap-clip"><span class="ap-move"><img class="ap-img" src="' + src + '" alt="" draggable="false" decoding="async"></span></span>' +
      '<span class="ap-bars"><i></i><i></i><i></i><i></i><i></i></span>' +
    '</div>';
  }

  function mountFace(host, opts) {
    if (!host) return null;
    var shape = (opts && opts.shape === 'tile') ? 'tile' : 'circle';
    var el = null, pupils = [], mouth = null, move = null;
    var api = {
      svg: null,           // the face element (an <svg> for the cartoon, a <div> for the photo)
      mood: 'neutral',
      setMood: function (m) {
        if (MOODS.indexOf(m) < 0) m = 'neutral';
        MOODS.forEach(function (x) { el.classList.remove('mood-' + x); });
        el.classList.add('mood-' + m);
        if (mouth) mouth.setAttribute('d', MOUTH[m]);
        api.mood = m;
      },
      look: function (x, y) {
        if (move) { move.style.transform = 'translate(' + x + 'px,' + y + 'px)'; return; }
        pupils.forEach(function (p) { p.style.transform = 'translate(' + x + 'px,' + y + 'px)'; });
      },
      talk: function (on) {
        if (on) el.classList.add('talking'); else el.classList.remove('talking');
      },
      // Lip-sync: open (0 closed .. 1 wide open) and wide (0.6 narrow .. 1.2 wide), set every frame by GenesoraVoice.
      lip: function (open, wide) {
        if (mouth) {                                   // cartoon face
          if (!el.classList.contains('lipsync')) el.classList.add('lipsync', 'talking');
          var mo = el.querySelector('.mouth-open');
          mo.style.transform = 'scale(' + (wide || 1).toFixed(3) + ',' + Math.max(0, open).toFixed(3) + ')';
          mo.style.opacity = open > 0.06 ? '1' : '0';
          mouth.style.opacity = open > 0.06 ? '0' : '1';
        } else {                                       // photo face: just pulse the "speaking" ring
          el.classList.toggle('talking', open > 0.22);
        }
      },
      lipEnd: function () {
        el.classList.remove('lipsync', 'talking');
        if (mouth) {
          var mo = el.querySelector('.mouth-open');
          mo.style.transform = ''; mo.style.opacity = ''; mouth.style.opacity = '';
        }
      }
    };

    function buildCartoon() {
      host.classList.remove('has-photo');
      host.innerHTML = faceMarkup('f' + (++uidCounter));
      el = host.querySelector('svg');
      pupils = $$('.pupil', el); mouth = $('.mouth', el); move = null;
      api.svg = el;
    }
    function buildPhoto() {
      host.innerHTML = photoMarkup(shape);
      host.classList.add('has-photo');
      el = host.querySelector('.ai-photo');
      move = $('.ap-move', el); pupils = []; mouth = null;
      api.svg = el;
      // If the photo file is missing, quietly fall back to the cartoon face.
      $('.ap-img', el).addEventListener('error', function () {
        var m = api.mood, t = el.classList.contains('talking');
        buildCartoon(); api.setMood(m); api.talk(t);
      });
    }

    if (FACE_MODE === 'photo') buildPhoto(); else buildCartoon();
    api.setMood('neutral');
    return api;
  }

  /* ──────────────────────────────────────────────
     SHARED: confetti + toast
     ────────────────────────────────────────────── */
  function confetti(opts) {
    if (reduceMotion) return;
    opts = opts || {};
    var c = document.createElement('canvas');
    c.className = 'gen-confetti';
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    var colors = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#38BDF8'];
    var n = opts.count || 150;
    var ox = opts.x != null ? opts.x : W / 2;
    var oy = opts.y != null ? opts.y : H * 0.65;
    var parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: ox + (Math.random() - 0.5) * 160, y: oy,
        vx: (Math.random() - 0.5) * 18, vy: -(Math.random() * 15 + 8),
        g: 0.34 + Math.random() * 0.12,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 6,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        c: colors[(Math.random() * colors.length) | 0]
      });
    }
    var start = performance.now();
    function frame(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var alive = 0;
      var fade = Math.max(0, 1 - (t - start) / 4200);
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr;
        if (p.y < H + 30) {
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.globalAlpha = fade; ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive && t - start < 4500) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }

  var toastEl = null, toastTimer = null;
  function toast(title, body, opts) {
    opts = opts || {};
    if (toastEl) { toastEl.remove(); toastEl = null; }
    clearTimeout(toastTimer);
    var el = document.createElement('div');
    el.className = 'gen-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="gt-face"></div><div class="gt-text"><b></b><span></span></div><button type="button" class="gt-x" aria-label="Dismiss">&times;</button>';
    $('b', el).textContent = title;
    $('span', el).textContent = body || '';
    document.body.appendChild(el);
    var f = mountFace($('.gt-face', el));
    f.setMood(opts.mood || 'smile');
    toastEl = el;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('show'); }); });
    function close() {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); if (toastEl === el) toastEl = null; }, 400);
    }
    $('.gt-x', el).addEventListener('click', close);
    toastTimer = setTimeout(close, opts.ms || 5200);
  }

  /* ──────────────────────────────────────────────
     4. REFERRAL WAITLIST GAME
        (defined first so index.html's form code can call it)
     ────────────────────────────────────────────── */
  var WL = (function () {
    var KEY = 'genesora_waitlist';
    var REF = 'genesora_ref';
    var SPOTS = 5;
    var pending = '';
    // On localhost we show simulated numbers (clearly labelled "demo") so you can test the UI.
    // On the live site a number only appears when the backend actually returns one.
    var isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);

    // Remember who invited this visitor
    try {
      var q = new URLSearchParams(location.search).get('ref');
      if (q && /^[A-Za-z0-9-]{4,20}$/.test(q)) store(REF, q.toUpperCase());
    } catch (e) { /* ignore */ }

    function makeCode(name) {
      var base = String(name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'GEN';
      var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
      var arr = new Uint32Array(4);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
      else for (var i = 0; i < 4; i++) arr[i] = Math.random() * 4294967296;
      for (var j = 0; j < 4; j++) s += alphabet[arr[j] % alphabet.length];
      return base + '-' + s;
    }
    function load() {
      try { return JSON.parse(store(KEY) || 'null'); } catch (e) { return null; }
    }
    function save(d) { store(KEY, JSON.stringify(d)); }
    function linkFor(code) { return pageUrl() + '?ref=' + encodeURIComponent(code); }

    function fetchStatus(code) {
      if (typeof SCRIPT_URL === 'undefined') return Promise.resolve(null);
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
      return fetch(SCRIPT_URL + '?action=status&code=' + encodeURIComponent(code), ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) { return r.json(); })
        .then(function (j) { clearTimeout(timer); return (j && j.ok && typeof j.position === 'number') ? j : null; })
        .catch(function () { clearTimeout(timer); return null; });
    }

    function animateNumber(el, from, to, prefix) {
      if (reduceMotion || from === to) { el.textContent = prefix + to.toLocaleString(); return; }
      var t0 = performance.now(), dur = 800;
      (function step(t) {
        var p = clamp((t - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(from + (to - from) * e).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    function render(d) {
      var card = $('#referralCard');
      if (!card) return;
      var form = $('#userForm'), title = $('#userCardTitle'), note = $('#refNote'), msg = $('#userMsg');
      if (form) form.style.display = 'none';
      if (note) note.hidden = true;
      if (msg) msg.textContent = '';
      if (title) title.textContent = "You're on the list 🎉";

      var pos = (typeof d.position === 'number') ? d.position : (isLocal ? d.simPosition : undefined);
      var isDemo = (typeof d.position !== 'number') && isLocal;
      var link = linkFor(d.code);
      var text = 'I just joined the waitlist for Genesora AI, an AI that interviews you face to face. Join with my link and help me move up the line: ' + link;

      card.hidden = false;
      card.innerHTML =
        '<div class="rf-top">' +
          '<div class="rf-pos"><span class="rf-label">Your place in line</span>' +
            (pos ? '<span class="rf-num" id="rfNum">#' + pos.toLocaleString() + '</span>' + (isDemo ? '<span class="rf-demo">demo data</span>' : '')
                 : '<span class="rf-num small">Spot saved ✓</span>') +
          '</div>' +
          '<div class="rf-friends"><b id="rfCount">' + (d.referrals || 0) + '</b><span>friends joined</span></div>' +
        '</div>' +
        '<p class="rf-text">Every friend who joins with your link moves you up <b>' + SPOTS + ' spots</b>. Share it anywhere:</p>' +
        '<div class="rf-link"><input type="text" id="rfLink" readonly value="' + esc(link) + '" aria-label="Your referral link" />' +
          '<button type="button" class="rf-btn" id="rfCopy">Copy</button></div>' +
        '<div class="rf-share">' +
          '<a class="rf-btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(text) + '">WhatsApp</a>' +
          '<a class="rf-btn ghost" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '">Post on X</a>' +
          (navigator.share ? '<button type="button" class="rf-btn ghost" id="rfShare">Share…</button>' : '') +
        '</div>' +
        '<div class="rf-foot">' +
          (isDemo ? '<button type="button" class="rf-link-btn" id="rfSim">+ Simulate a friend joining (demo)</button>' : '<button type="button" class="rf-link-btn" id="rfRefresh">↻ Refresh my spot</button>') +
          '<button type="button" class="rf-link-btn" id="rfReset">Not you?</button>' +
        '</div>';

      $('#rfCopy').addEventListener('click', function () {
        var b = this;
        copyText(link).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); });
      });
      $('#rfLink').addEventListener('focus', function () { this.select(); });
      var sh = $('#rfShare');
      if (sh) sh.addEventListener('click', function () { navigator.share({ title: 'Genesora AI', text: text, url: link }).catch(function () {}); });

      var sim = $('#rfSim');
      if (sim) sim.addEventListener('click', function () {
        var cur = load() || d;
        var from = (typeof cur.position === 'number') ? cur.position : cur.simPosition;
        cur.referrals = (cur.referrals || 0) + 1;
        var to = Math.max(1, from - SPOTS);
        if (typeof cur.position === 'number') cur.position = to; else cur.simPosition = to;
        save(cur);
        var num = $('#rfNum'), cnt = $('#rfCount');
        if (num) animateNumber(num, from, to, '#');
        if (cnt) cnt.textContent = cur.referrals;
        confetti({ count: 60, x: window.innerWidth / 2, y: window.innerHeight * 0.7 });
      });

      var rf = $('#rfRefresh');
      if (rf) rf.addEventListener('click', function () {
        var b = this; b.textContent = 'Checking…';
        fetchStatus(d.code).then(function (j) {
          if (j) {
            var cur = load() || d;
            cur.position = j.position; cur.referrals = j.referrals || 0; cur.total = j.total;
            save(cur); render(cur);
          } else { b.textContent = 'Not available yet'; setTimeout(function () { b.textContent = '↻ Refresh my spot'; }, 2000); }
        });
      });

      $('#rfReset').addEventListener('click', function () {
        store(KEY, null);
        card.hidden = true; card.innerHTML = '';
        if (form) form.style.display = '';
        if (title) title.textContent = 'Join as a User';
        var btn = $('.submit-user');
        if (btn) { btn.disabled = false; btn.textContent = 'Join as a User — Get Early Access'; }
        updateNote();
      });
    }

    function updateNote() {
      var note = $('#refNote');
      if (note) note.hidden = !store(REF) || !!load();
    }

    return {
      getRef: function () { return store(REF) || ''; },
      getSavedCode: function () { var d = load(); return d ? d.code : ''; },
      prepareCode: function (name) { pending = makeCode(name); return pending; },
      onJoined: function (data, info) {
        data = data || {};
        var d = {
          code: data.refCode || pending || makeCode(info && info.name),
          name: info && info.name || '',
          referrals: data.referrals || 0,
          position: (typeof data.position === 'number') ? data.position : undefined,
          total: data.total,
          simPosition: isLocal ? 900 + Math.floor(Math.random() * 500) : undefined
        };
        save(d);
        render(d);
        confetti({ count: 120 });
      },
      init: function () {
        updateNote();
        var d = load();
        if (d && d.code) {
          render(d);
          fetchStatus(d.code).then(function (j) {
            if (j) { d.position = j.position; d.referrals = j.referrals || 0; d.total = j.total; save(d); render(d); }
          });
        }
      }
    };
  })();
  window.GenesoraWaitlist = WL;

  /* ──────────────────────────────────────────────
     1. HERO FACE
     ────────────────────────────────────────────── */
  var heroApi = null;

  function initHeroFace() {
    var host = $('#heroFaceMount'), wrap = $('#heroFace'), bubble = $('#heroFaceBubble');
    if (!host || !wrap) return;
    var face = mountFace(host);
    var st = { hover: false, shy: false, wow: false };
    var lastMove = 0, bubbleTimer = null, greetedCta = false, raf = 0, mx = 0, my = 0;

    function refresh() {
      var m = st.wow ? 'wow' : st.shy ? 'shy' : st.hover ? 'smile' : 'neutral';
      face.setMood(m);
      if (m === 'shy') { face.look(-4, 6); face.svg.style.transform = ''; }
    }
    function say(t, ms) {
      bubble.textContent = t;
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, ms || 3200);
    }
    heroApi = {
      wow: function (msg) {
        st.wow = true; refresh();
        if (msg) say(msg, 2600);
        setTimeout(function () { st.wow = false; refresh(); }, 1400);
      }
    };

    function track() {
      raf = 0;
      var r = face.svg.getBoundingClientRect();
      if (!r.width || st.shy) return;
      var cx = r.left + r.width / 2, cy = r.top + r.height * 0.46;
      var dx = mx - cx, dy = my - cy;
      var a = Math.atan2(dy, dx), m = Math.min(Math.hypot(dx, dy) / 220, 1);
      face.look(Math.cos(a) * m * 6, Math.sin(a) * m * 7);
      face.svg.style.transform = 'translate(' + clamp(dx / 40, -10, 10) + 'px,' + clamp(dy / 50, -8, 8) + 'px) rotate(' + clamp(dx / 200, -5, 5) + 'deg)';
    }
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY; lastMove = Date.now();
      if (!raf) raf = requestAnimationFrame(track);
    }, { passive: true });

    // Idle: eyes wander when the mouse is still (or on touch devices)
    if (!reduceMotion) {
      setInterval(function () {
        if (st.shy || st.wow) return;
        if (Date.now() - lastMove > 3500) face.look(rand(-5, 5), rand(-4, 5));
      }, 1800);
    }

    // Smiles when you hover the call-to-action buttons
    var HOVER_SEL = '.nav-cta, .cta-btn-hero, .submit-user, .submit-ent, .ch-btn.primary';
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest(HOVER_SEL);
      if (t && !st.hover) {
        st.hover = true; refresh();
        if (t.classList.contains('nav-cta') && !greetedCta && wrap.offsetParent) { greetedCta = true; say('Yes!! Come on in 😄', 2600); }
      }
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest && e.target.closest(HOVER_SEL);
      var to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(HOVER_SEL);
      if (t && !to && st.hover) { st.hover = false; refresh(); }
    });

    // Gets shy when you scroll past
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var r = entries[0].intersectionRatio;
        var shy = r > 0 && r < 0.7;
        if (shy !== st.shy) { st.shy = shy; refresh(); }
      }, { threshold: [0, 0.2, 0.4, 0.6, 0.7, 0.8, 1] }).observe(wrap);
    }

    // Poke it
    var lines = ['Hey! Eyes up here 👀', 'Psst… try the 60-second challenge below ↓', "I'm Gena. I don't bite. Much.", 'Stop poking me, I\'m interviewing! 😳'];
    var li = 0;
    host.addEventListener('click', function () {
      heroApi.wow(lines[li++ % lines.length]);
    });

    // Say hi once per session
    var seen = null;
    try { seen = sessionStorage.getItem('genesora_gena_hi'); } catch (e) { /* ignore */ }
    if (!seen) {
      setTimeout(function () {
        if (wrap.offsetParent && !st.shy) say("Hi, I'm Gena 👋", 3500);
        try { sessionStorage.setItem('genesora_gena_hi', '1'); } catch (e) { /* ignore */ }
      }, 2200);
    }
  }

  /* ──────────────────────────────────────────────
     2. LIVING VIDEO-CALL DEMO
     ────────────────────────────────────────────── */
  function initLiveDemo() {
    var root = $('#liveDemo');
    if (!root) return;
    var face = mountFace($('#ldFaceMount'), { shape: 'tile' });
    var elText = $('#ldText'), elSpk = $('#ldSpeaker'), elTimer = $('#ldTimer');
    var paneYou = $('#ldYou'), paneAi = $('#ldAi');

    function buildWave(el) {
      var bars = [];
      for (var i = 0; i < 22; i++) { var b = document.createElement('i'); el.appendChild(b); bars.push(b); }
      return bars;
    }
    var waves = { you: buildWave($('[data-wave="you"]', root)), ai: buildWave($('[data-wave="ai"]', root)) };
    function animateWaves(active) {
      ['you', 'ai'].forEach(function (who) {
        waves[who].forEach(function (b, i) {
          var h = (active === who && !reduceMotion) ? 18 + Math.random() * 82 : 10 + (i % 3) * 2;
          b.style.height = h + '%';
        });
      });
    }

    var script = [
      { who: 'ai',  text: "Hi Priya! I'm Gena. Ready to warm up? Tell me about yourself in thirty seconds." },
      { who: 'you', text: "Sure! I'm a product designer with three years of experience, mostly in fintech." },
      { who: 'ai',  text: "Love that. What's one project you're proudest of, and what was your exact role?" },
      { who: 'you', text: "I redesigned our onboarding flow and cut drop-off by 28 percent." },
      { who: 'ai',  text: "Specific and measurable, great. How did you get buy-in from engineering?" },
      { who: 'you', text: "I ran a quick prototype test and shared the results in a one-page summary." },
      { who: 'ai',  text: "Interview score so far: 86 out of 100. Want to polish that answer, or move on?" }
    ];
    var idx = 0, phase = 'idle', hold = 0, ticks = 0, secs = 0, visible = false, speaker = null, lineNo = 0;
    var Voice = window.GenesoraVoice;

    // Sound button (only shown where the browser can speak)
    if (Voice && Voice.supported) Voice.mountToggle($('.ld-bar', root), { before: $('.ld-live', root) });

    function startLine() {
      var l = script[idx], myLine = ++lineNo;
      elSpk.textContent = l.who === 'ai' ? 'Gena' : 'You';
      elSpk.className = 'ld-speaker ' + l.who;
      paneAi.classList.toggle('speaking', l.who === 'ai');
      paneYou.classList.toggle('speaking', l.who === 'you');
      face.setMood('neutral');
      face.look(l.who === 'ai' ? 0 : -5, l.who === 'ai' ? 0 : 1);
      elText.textContent = '';
      phase = 'speak';
      // The voice engine drives BOTH the mouth and the caption, so words appear exactly as Gena says them.
      // Gena's lines are spoken aloud when Sound is on; the candidate's lines are only typed.
      var run = function () {
        speaker = Voice ? Voice.say(l.text, {
          face: l.who === 'ai' ? face : null,
          silent: l.who !== 'ai',
          tag: 'demo',
          onCancel: function () { if (myLine === lineNo) { phase = 'idle'; } },
          msPerUnit: l.who === 'ai' ? 44 : 34,
          onProgress: function (end) { if (myLine === lineNo) elText.textContent = l.text.slice(0, end); },
          onEnd: function () {
            if (myLine !== lineNo) return;
            elText.textContent = l.text;
            phase = 'hold'; hold = 42;
            if (l.who === 'ai') face.setMood('smile');
          }
        }) : null;
        if (!Voice) { elText.textContent = l.text; phase = 'hold'; hold = 60; }
      };
      run();
    }
    function tick() {
      if (!visible) return;
      ticks++;
      if (ticks % 25 === 0) { secs++; elTimer.textContent = pad(Math.floor(secs / 60) % 60) + ':' + pad(secs % 60); }
      if (Voice && (Voice.activeTag() === 'chat' || Voice.activeTag() === 'challenge')) return;             // let the chat assistant finish talking
      if (phase === 'idle') { startLine(); return; }
      var l = script[idx];
      if (phase === 'hold' && --hold <= 0) {
        idx = (idx + 1) % script.length;
        startLine();
      }
      if (ticks % 2 === 0) animateWaves(phase === 'speak' ? l.who : null);
    }
    function pauseOffscreen() {          // scrolled away: stop talking, pick the line up again when back
      if (phase === 'speak') { if (speaker) speaker.cancel(); phase = 'idle'; lineNo++; paneAi.classList.remove('speaking'); paneYou.classList.remove('speaking'); face.lipEnd && face.lipEnd(); }
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (!visible) pauseOffscreen(); }, { threshold: 0.2 }).observe(root);
    } else { visible = true; }
    animateWaves(null);
    setInterval(tick, 40);
  }

  /* ──────────────────────────────────────────────
     3. 60-SECOND INTERVIEW CHALLENGE
     ────────────────────────────────────────────── */
  // A big pool of story-style questions. The challenge deals them like a shuffled deck, so you never see a repeat
  // until every question has been asked (and the order is remembered between visits in this browser).
  var QUESTIONS = [
    "Tell me about a time you failed, and what you learned from it.",
    "Describe a moment when you had to learn something fast. What did you do?",
    "Tell me about a time you disagreed with someone. How did it end?",
    "What's the achievement you're proudest of, and what was your exact part in it?",
    "Tell me about a time you had to work under real pressure.",
    "Describe a time you helped someone else succeed.",
    "Tell me about a time you took the lead when nobody asked you to.",
    "Describe a mistake you made at work or school. How did you fix it?",
    "Tell me about a time you had to persuade someone who disagreed with you.",
    "Describe a project you owned from start to finish. What was the result?",
    "Tell me about a time you missed a deadline, or nearly did. What happened?",
    "Describe a time you received tough feedback. What did you do with it?",
    "Tell me about a time you had to deal with a difficult teammate.",
    "What's a problem you solved that nobody else could? Walk me through it.",
    "Tell me about a time you changed your mind after hearing someone else's view.",
    "Describe a situation where you had too much to do. How did you prioritise?",
    "Tell me about a time you went above and beyond for a customer, client or user.",
    "Describe the hardest decision you've made at work or school. How did you decide?",
    "Tell me about a time you had to adapt to a big change.",
    "Describe a time you spotted a problem early and prevented it from growing.",
    "Tell me about a time you had to explain something complicated to someone new.",
    "Describe a time you worked with someone very different from you.",
    "Tell me about a goal you set for yourself and how you reached it.",
    "Describe a time you were asked to do something you had never done before.",
    "Tell me about a time you made something better that nobody asked you to improve.",
    "Describe a time you had to make a decision without all the information.",
    "Tell me about a time you let someone down. What did you do afterwards?",
    "Describe a moment you felt proud of your team. What was your part in it?",
    "Tell me about a time you had to say no. How did you handle it?",
    "Describe a time you had to motivate other people.",
    "Tell me about a time you worked under a very tight budget or very few resources.",
    "Describe a time you handled a conflict between two other people.",
    "Tell me about a time you had to learn from someone younger or less experienced than you.",
    "Describe a time you disagreed with your manager or teacher. What did you do?",
    "Tell me about a time you juggled several tasks at once. How did you stay on top of them?",
    "Describe a time you had to deliver bad news. How did you do it?",
    "Tell me about the most creative solution you've come up with.",
    "Describe a time your first plan did not work. What did you do next?",
    "Tell me about a time you had to build trust with someone quickly.",
    "Describe a time you took a risk. How did it turn out?",
    "Tell me about a time you noticed something that others missed.",
    "Describe a time you had to work with a tight, unclear brief. How did you get clarity?",
    "Tell me about a time you helped a team get unstuck.",
    "Describe a time you stayed calm when everyone else was stressed.",
    "Tell me about a time you were new somewhere and had to find your feet fast.",
    "Describe a time you taught yourself a skill. How did you go about it?",
    "Tell me about a time you made a quick decision that turned out right, or wrong.",
    "Describe a time you had to manage your own time with no one checking on you.",
    "Tell me about a time you improved a process or a way of working.",
    "Describe a time you were asked to take on more than your role. What did you do?",
    "Tell me about a time you had to follow a rule you did not agree with.",
    "Describe a time you had to give someone honest feedback.",
    "Tell me about a time you recovered from a setback.",
    "Describe a time you worked on a team that did not get along. What did you do?",
    "Tell me about a time you made sure everyone's voice was heard.",
    "Describe a time you were proud of something you made or built.",
    "Tell me about a time your work was criticised in front of others.",
    "Describe a moment you had to choose between speed and quality. What did you pick?",
    "Tell me about a time you took ownership of a mistake that was not entirely yours.",
    "Describe a time you had to learn a new tool or technology quickly.",
    "Tell me about a time you balanced work or study with something difficult in life.",
    "Describe the best team you have worked in. What did you contribute?",
    "Tell me about a time you did not know the answer. What did you do?",
    "Describe a time you had to compromise. What did you give up and what did you gain?",
    "Tell me about a time you mentored or supported someone.",
    "Describe a time you used data or facts to make a decision.",
    "Tell me about a time you had to handle an angry or upset person.",
    "Describe a time you started something from scratch.",
    "Tell me about a time you had to cope with a lot of uncertainty.",
    "Describe a time you made a long-term sacrifice for a better outcome.",
    "Tell me about a time you challenged the usual way of doing things.",
    "Describe a time you had to work a very long stretch to finish something. What kept you going?",
    "Tell me about a time you got a result you were not expecting.",
    "Describe a time you asked for help. Why and what happened?",
    "Tell me about a time you had to rebuild something that fell apart.",
    "Describe a time you were responsible for other people's work or success.",
    "Tell me about a time you did something that was outside your comfort zone.",
    "Describe a time you had two good options and had to choose one.",
    "Tell me about a time you changed how a team or a friend group did something.",
    "Describe a time you were told something could not be done, and what you did about it.",
    "Tell me about a time you wished you had acted sooner. What did you learn?",
    "Describe a time you went back and improved something that was already good enough.",
    "Tell me about a time you had to be patient to get a good result.",
    "Describe a time you kept a promise even though it was hard.",
    "Tell me about a time you found a smarter way to do something repetitive.",
    "What's something you've learned recently, and how did you learn it?",
    "Describe a time you were really curious about something at work or school. What did you do about it?",
    "Tell me about an idea of yours that other people liked. How did it start?",
    "Describe a moment when you felt out of your depth. What did you do?",
    "Tell me about a time you had to keep something confidential or handle it with care.",
    "Describe a time you celebrated someone else's win.",
    "Tell me about a time you stood up for something you believed in."
];
  var FILLERS = ['um', 'umm', 'uh', 'uhh', 'basically', 'literally', 'you know', 'kind of', 'sort of', 'whatever', 'stuff'];
  var BUZZ = ['synergy', 'passionate', 'passion', 'team player', 'hard-working', 'hard working', 'hardworking', 'go-getter', 'self-starter', 'detail-oriented', 'results-driven', 'think outside the box', 'out of the box', 'fast learner', 'dynamic', 'leverage', 'proactive', 'rockstar', 'ninja', 'guru', 'game-changer', 'game changer', 'thought leader', 'value add', 'move the needle', 'circle back', 'win-win', 'best practices', 'strong communication', 'multitask'];
  var HEDGES = ['maybe', 'i think', 'i guess', 'probably', 'hopefully', 'sort of', 'kind of', 'i suppose', 'not sure', 'a little bit'];

  function countMatches(text, list) {
    var n = 0;
    list.forEach(function (p) {
      var safe = p.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
      var m = text.match(new RegExp('(^|[^a-z])' + safe + '(?![a-z])', 'gi'));
      if (m) n += m.length;
    });
    return n;
  }
  function countWords(t) { return t.trim() ? t.trim().split(/\s+/).length : 0; }

  // Picks a follow-up question based on what was weakest in the first answer (only used when ENABLE_FOLLOWUP is true).
  function pickFollowUp(text) {
    var hasNum = /\d/.test(text);
    var hedge = countMatches(text, HEDGES), buzz = countMatches(text, BUZZ);
    var iCount = (text.match(/\b(i|i'm|i've|i'd|i'll|my)\b/gi) || []).length;
    var weCount = (text.match(/\b(we|our|us)\b/gi) || []).length;
    if (countWords(text) < 35) return 'Can you give me a bit more detail? Walk me through what actually happened.';
    if (weCount > iCount * 1.5 && weCount >= 3) return 'You said "we" a lot. What was your own part in it?';
    if (buzz >= 2) return 'Skip the buzzwords for a moment. What is one concrete thing you actually did?';
    if (hedge >= 2) return 'You sounded a little unsure. What is the one thing you are most certain you did well?';
    if (!hasNum) return 'Can you put a number on the result? A percentage, a time saved, a count, anything measurable.';
    return 'If you could do it all again, what is the one thing you would change?';
  }

  // Simple, on-device scoring. It's for fun, not a real assessment.
  function scoreAnswer(text) {
    var words = countWords(text);
    var buzz = countMatches(text, BUZZ);
    var filler = countMatches(text, FILLERS);
    var hedge = countMatches(text, HEDGES);

    var star = 0;
    if (/\b(when|once|last (year|month|semester)|during|at my|in my (previous|last)|while (i|we)|situation|project)\b/i.test(text)) star++;
    if (/\b(needed to|had to|goal|responsible|my (role|job|task)|challenge|deadline|problem|asked to)\b/i.test(text)) star++;
    if (/\bi (\w+ed|built|led|ran|made|took|wrote|chose|taught|began|set up|spoke|decided|started|created|learned)\b/i.test(text)) star++;
    if (/\b(result|outcome|ended up|improved|increased|reduced|saved|grew|delivered|achieved|learned|lesson|since then|next time)\b/i.test(text)) star++;

    var hasNum = /\d/.test(text);
    var iCount = (text.match(/\b(i|i'm|i've|i'd|i'll|my)\b/gi) || []).length;
    var weCount = (text.match(/\b(we|our|us)\b/gi) || []).length;

    var lengthPts = words <= 60 ? (words / 60) * 28 : words <= 140 ? 28 : 28 - Math.min((words - 140) / 10, 12);
    var numPts = hasNum ? 6 : 0;
    var ownPts = (iCount >= 2 && iCount >= weCount) ? 5 : (weCount > iCount * 2 ? -3 : 0);
    var energy = Math.round(clamp(22 + lengthPts + star * 9 + numPts + ownPts - Math.min(filler * 2, 12) - Math.min(buzz * 2, 10), 10, 99));

    var cScore = hedge * 2 + filler, confidence, confEmoji;
    if (words < 20) { confidence = 'Too short to tell'; confEmoji = '🤔'; }
    else if (cScore <= 1) { confidence = 'High'; confEmoji = '😎'; }
    else if (cScore <= 4) { confidence = 'Medium'; confEmoji = '🙂'; }
    else { confidence = 'Low'; confEmoji = '😬'; }

    var title = energy >= 85 ? 'Hire-ready ⭐' : energy >= 70 ? 'Smooth Operator 😎' : energy >= 55 ? 'Solid Contender 💪' : energy >= 40 ? 'Warming Up 🔥' : 'Needs a Second Take 🔁';

    var notes = [];
    if (words < 30) notes.push('Short and sweet, but Gena wants a bit more story. Aim for 60–100 words.');
    if (words > 180) notes.push('A little long. Tighten it to under 120 words.');
    if (star <= 1 && words >= 30) notes.push('You gave the what, but not the story. Try: situation, then what you did, then the result.');
    if (buzz >= 3) notes.push('Buzzword alert: ' + buzz + ' of them. Swap the adjectives for one real example.');
    if (filler >= 3) notes.push("Trim the filler words and you'll sound a lot sharper.");
    if (hedge >= 3) notes.push('Lots of “I think / maybe”. Say it like you mean it.');
    if (weCount > iCount * 2 && weCount >= 3) notes.push('Lots of “we”. Gena wants to hear what you did.');
    if (!hasNum && star >= 3) notes.push('Great structure! Add one number (a %, a time, a count) to make it stick.');
    if (energy >= 80) notes.unshift('Specific, owned and structured. Gena would send you straight to round two.');
    if (!notes.length) notes.push('Solid answer. Add a concrete result and it becomes a great one.');

    return { words: words, energy: energy, confidence: confidence, confEmoji: confEmoji, buzz: buzz, star: star, title: title, comment: notes.slice(0, 2).join(' ') };
  }

  function initChallenge() {
    var card = $('#chCard');
    if (!card) return;
    var face = mountFace($('#chFaceMount'));
    var ta = $('#chAnswer'), hint = $('#chHint'), micBtn = $('#chMic');
    var introBubble = $('#chIntro'), startBtn = $('#chStart');
    var timerBox = $('#chTimerBox'), timeEl = $('#chTime'), ring = $('#chTimerRing');
    var C = 163.36, endAt = 0, timerId = null, qIndex = -1;
    var Voice = window.GenesoraVoice;
    if (Voice && Voice.supported) Voice.mountToggle($('.ch-gena', card), { className: 'ch-sound' });
    var limit = 60000, round = 1, firstAnswer = '';

    function show(name) {
      $$('.ch-stage', card).forEach(function (s) { s.classList.toggle('active', s.getAttribute('data-stage') === name); });
    }
    function stopTimer() { clearInterval(timerId); timerId = null; }
    function stopSpeak() { if (Voice && Voice.activeTag() === 'challenge') Voice.stop(); face.lipEnd(); }

    // Deals questions from a shuffled deck so none repeats until all have been asked. The deck is
    // remembered in this browser, so a new visit carries on where the last one stopped.
    function dealQuestion() {
      var deck = [], saved = null;
      try { saved = JSON.parse(store('gen-qdeck') || 'null'); } catch (e) { saved = null; }
      if (saved && saved.n === QUESTIONS.length && Array.isArray(saved.d)) {
        deck = saved.d.filter(function (i) { return typeof i === 'number' && i >= 0 && i < QUESTIONS.length; });
      }
      if (!deck.length) {
        for (var i = 0; i < QUESTIONS.length; i++) deck.push(i);
        for (var j = deck.length - 1; j > 0; j--) {          // Fisher-Yates shuffle
          var k = Math.floor(Math.random() * (j + 1)), tmp = deck[j]; deck[j] = deck[k]; deck[k] = tmp;
        }
        if (deck[deck.length - 1] === qIndex && deck.length > 1) { var s = deck.shift(); deck.push(s); }   // never repeat the one just asked
      }
      var n = deck.pop();
      store('gen-qdeck', JSON.stringify({ n: QUESTIONS.length, d: deck }));
      return n;
    }
    function pickQuestion() {
      qIndex = dealQuestion();
      $('#chQuestion').textContent = QUESTIONS[qIndex];
    }
    function tickTimer() {
      var leftMs = endAt - Date.now();
      var left = Math.max(0, Math.ceil(leftMs / 1000));
      timeEl.textContent = left;
      ring.style.strokeDashoffset = String(C * (1 - clamp(leftMs / limit, 0, 1)));
      timerBox.classList.toggle('low', left <= 10);
      if (left <= 10 && left > 0 && face.mood !== 'wow') face.setMood('wow');
      if (left <= 0) { submit(true); }
    }
    // Gena "asks" the question: mouth and (if Sound is on) voice follow the question text.
    function sayQuestion() {
      var q = $('#chQuestion').textContent;
      if (!Voice) return;
      Voice.say(q, { face: face, tag: 'challenge', msPerUnit: 40, onEnd: function () { face.look(0, 5); } });
    }
    function start() {
      round = 1; firstAnswer = ''; limit = 60000;
      pickQuestion();
      show('question');
      ta.value = ''; hint.textContent = '';
      stopMic(); stopTimer(); stopSpeak();
      face.setMood('neutral'); face.look(0, 0);
      sayQuestion();
      endAt = Date.now() + limit;
      timerId = setInterval(tickTimer, 250);
      tickTimer();
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    }
    startBtn.addEventListener('click', start);
    $('#chSkip').addEventListener('click', start);
    ta.addEventListener('input', function () { hint.textContent = ''; });

    function finish(first, second) {
      stopTimer(); stopMic(); stopSpeak();
      var r = scoreAnswer((first + ' ' + (second || '')).trim());
      if (second) r.comment = 'You handled the follow-up, which is what a real interview does. ' + r.comment;
      showResult(r);
    }
    function submit(auto) {
      var text = ta.value.trim();
      if (round === 2) {                       // answering the follow-up
        if (countWords(text) >= 5) { finish(firstAnswer, text); }
        else if (auto) { finish(firstAnswer, ''); }
        else { hint.textContent = 'Say a little more. Gena needs at least 5 words 🙂'; }
        return;
      }
      if (countWords(text) < 5) {
        if (auto) {
          stopTimer(); stopMic(); stopSpeak(); show('intro');
          introBubble.textContent = "Time's up, and I didn't catch an answer 😅 Want another go?";
          startBtn.textContent = 'Try again ⏱';
          face.setMood('shy'); face.look(-3, 5);
        } else {
          hint.textContent = 'Say a little more. Gena needs at least 5 words 🙂';
        }
        return;
      }
      if (ENABLE_FOLLOWUP) {                   // ask one follow-up before scoring
        firstAnswer = text; round = 2;
        stopMic(); stopTimer(); stopSpeak();
        $('#chQuestion').textContent = 'Follow-up: ' + pickFollowUp(text);
        ta.value = ''; hint.textContent = '';
        limit = 30000; endAt = Date.now() + limit;
        timerId = setInterval(tickTimer, 250); tickTimer();
        face.setMood('neutral'); face.look(0, 0);
        sayQuestion();
        try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
        return;
      }
      finish(text, '');
    }
    $('#chSubmit').addEventListener('click', function () { submit(false); });
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(false); }
    });

    /* Voice input (browser speech recognition, where available) */
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = null, listening = false, baseText = '';
    function setListening(on) {
      listening = on;
      micBtn.classList.toggle('on', on);
      micBtn.textContent = on ? '⏹ Stop mic' : '🎤 Speak';
    }
    function stopMic() { if (rec) { try { rec.stop(); } catch (e) { /* ignore */ } } setListening(false); }
    if (SR && micBtn) {
      micBtn.hidden = false;
      micBtn.addEventListener('click', function () {
        if (listening) { stopMic(); return; }
        try { rec = new SR(); } catch (e) { micBtn.hidden = true; return; }
        rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-US';
        baseText = ta.value.trim();
        rec.onresult = function (e) {
          var t = '';
          for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          ta.value = (baseText ? baseText + ' ' : '') + t.trim();
        };
        rec.onerror = function (e) {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') hint.textContent = 'Mic permission was blocked. You can just type instead.';
          setListening(false);
        };
        rec.onend = function () { setListening(false); };
        try { rec.start(); setListening(true); } catch (e) { setListening(false); }
      });
    }

    /* Result */
    function shareText(r) {
      var url = pageUrl() + '#challenge';
      var code = WL.getSavedCode();
      if (code) url = pageUrl() + '?ref=' + encodeURIComponent(code) + '#challenge';
      return { text: 'I scored ' + r.energy + '/100 on the Genesora AI 60-second interview challenge, "' + r.title.replace(/\s*[^\w\s]+$/, '') + '". Think you can beat me? 👉 ' + url, url: url };
    }
    var lastResult = null;
    function showResult(r) {
      lastResult = r;
      show('result');
      $('#chTitle').textContent = r.title;
      $('#chComment').textContent = r.comment;
      $('#chConf').textContent = r.confidence + ' ' + r.confEmoji;
      $('#chBuzz').textContent = r.buzz === 0 ? '0 ✨ clean' : r.buzz >= 5 ? r.buzz + ' 🙈' : String(r.buzz);
      $('#chStarVal').textContent = r.star + '/4';
      $$('#chPips i').forEach(function (p, i) { p.classList.toggle('on', i < r.star); });

      var scoreEl = $('#chScoreNum'), fg = $('#chScoreRing'), bar = $('#chEnergyBar');
      scoreEl.textContent = '0'; fg.style.strokeDashoffset = '263.9'; bar.style.width = '0%';
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        fg.style.strokeDashoffset = String(263.9 * (1 - r.energy / 100));
        bar.style.width = r.energy + '%';
      }); });
      var t0 = performance.now(), dur = reduceMotion ? 1 : 1000;
      (function step(t) {
        var p = clamp((t - t0) / dur, 0, 1);
        scoreEl.textContent = Math.round(r.energy * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);

      face.look(0, 0);
      face.setMood(r.energy >= 70 ? 'smile' : r.energy < 45 ? 'shy' : 'neutral');
      // With Sound on, Gena says her verdict out loud (mouth follows the words).
      if (Voice && Voice.isOn()) Voice.say(r.title.replace(/\s*[^\w\s]+$/, '') + '. ' + r.comment, { face: face, tag: 'challenge', msPerUnit: 40 });
      if (r.energy >= 85) confetti({ count: 110 });

      var s = shareText(r);
      $('#chShareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(s.text);
      $('#chShareWA').href = 'https://wa.me/?text=' + encodeURIComponent(s.text);
      var nativeBtn = $('#chShareNative');
      nativeBtn.hidden = !navigator.share;
      var rect = card.getBoundingClientRect();
      if (rect.top < 0) card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
    $('#chShareNative').addEventListener('click', function () {
      if (!lastResult) return;
      var s = shareText(lastResult);
      navigator.share({ title: 'Genesora AI interview challenge', text: s.text, url: s.url }).catch(function () {});
    });
    $('#chCopy').addEventListener('click', function () {
      if (!lastResult) return;
      var b = this;
      copyText(shareText(lastResult).text).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy brag text'; }, 1600); });
    });
    $('#chRetry').addEventListener('click', start);
  }

  /* ──────────────────────────────────────────────
     6. CURSOR GLOW + SCROLL PROGRESS
     ────────────────────────────────────────────── */
  function initGlow() {
    if (reduceMotion) return;
    var glow = document.createElement('div');
    glow.className = 'gen-glow'; glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
    var raf = 0, x = 0, y = 0;
    document.addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0; glow.style.setProperty('--mx', x + 'px'); glow.style.setProperty('--my', y + 'px');
      });
    }, { passive: true });
  }
  function initProgress() {
    var bar = document.createElement('div');
    bar.className = 'gen-progress'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i>';
    document.body.appendChild(bar);
    var fill = bar.firstChild, raf = 0;
    function update() {
      raf = 0;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.transform = 'scaleX(' + (h > 0 ? clamp(window.scrollY / h, 0, 1) : 0) + ')';
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ──────────────────────────────────────────────
     5. EASTER EGGS
     ────────────────────────────────────────────── */
  function initEggs() {
    var buf = '', kbuf = [];
    var KONAMI = 'arrowup,arrowup,arrowdown,arrowdown,arrowleft,arrowright,arrowleft,arrowright,b,a';

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key) return;
      var k = e.key.toLowerCase();

      kbuf.push(k); kbuf = kbuf.slice(-10);
      if (kbuf.join(',') === KONAMI) { party(); kbuf = []; return; }

      if (k.length === 1) {
        buf = (buf + k).slice(-12);
        if (/hired$/.test(buf)) {
          buf = '';
          confetti({ count: 190 });
          toast("Congrats, you're hired! 🎉", 'Salary: bragging rights. Start date: whenever you like. – Gena, AI HR');
        } else if (/fired$/.test(buf)) {
          buf = '';
          toast('Whoa, wrong platform! 😅', 'We only do hiring here. – Gena, AI HR', { mood: 'wow' });
        } else if (/gena$/.test(buf)) {
          buf = '';
          if (heroApi) heroApi.wow('You called? 👋');
          toast('You called? 👋', "I'm Gena, your AI HR. Try the 60-second challenge!");
        }
      }
    });

    function party() {
      document.documentElement.classList.add('party');
      confetti({ count: 200 });
      toast('Konami code! 🎮', "Party mode on. You'd ace the technical round.", { mood: 'wow' });
      setTimeout(function () { document.documentElement.classList.remove('party'); }, 7000);
    }

    // Click the footer brand 5 times
    var brand = $('.site-footer .brand'), clicks = 0, clickTimer = null;
    if (brand) {
      brand.style.cursor = 'default';
      brand.addEventListener('click', function () {
        clicks++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(function () { clicks = 0; }, 3000);
        if (clicks >= 5) {
          clicks = 0;
          confetti({ count: 90 });
          toast('You found a secret! 🕵️', "Gena added you to the 'very curious candidates' shortlist. Not legally binding.");
        }
      });
    }
  }

  window.GenesoraFun = { confetti: confetti, toast: toast, mountFace: mountFace };

  [WL.init, initHeroFace, initLiveDemo, initChallenge, initEggs, initGlow, initProgress].forEach(function (fn) {
    try { fn(); } catch (err) { console.error('[Genesora extras]', err); }
  });
})();

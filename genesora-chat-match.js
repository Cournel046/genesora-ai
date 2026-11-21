/* Gena's question matcher. Runs fully in the browser: no network, no API key.
   Works in the page (window.GenaMatch) and in Node for testing (module.exports). */
(function (root) {
  'use strict';

  var CONTRACTIONS = [
    [/\bwhat'?s\b/g, 'what is'], [/\bwho'?s\b/g, 'who is'], [/\bwhere'?s\b/g, 'where is'], [/\bhow'?s\b/g, 'how is'],
    [/\bwhen'?s\b/g, 'when is'], [/\bthat'?s\b/g, 'that is'], [/\bit'?s\b/g, 'it is'], [/\bi'?m\b/g, 'i am'],
    [/\bi'?ve\b/g, 'i have'], [/\bi'?ll\b/g, 'i will'], [/\bi'?d\b/g, 'i would'], [/\bdon'?t\b/g, 'do not'],
    [/\bdoesn'?t\b/g, 'does not'], [/\bdidn'?t\b/g, 'did not'], [/\bcan'?t\b/g, 'cannot'], [/\bwon'?t\b/g, 'will not'],
    [/\bisn'?t\b/g, 'is not'], [/\baren'?t\b/g, 'are not'], [/\bwasn'?t\b/g, 'was not'], [/\bcouldn'?t\b/g, 'could not'],
    [/\bshouldn'?t\b/g, 'should not'], [/\bwouldn'?t\b/g, 'would not'], [/\byou'?re\b/g, 'you are'],
    [/\bthey'?re\b/g, 'they are'], [/\bwe'?re\b/g, 'we are'], [/\blet'?s\b/g, 'let us'], [/\bgonna\b/g, 'going to'],
    [/\bwanna\b/g, 'want to'], [/\bu\b/g, 'you'], [/\bur\b/g, 'your'], [/\bpls\b|\bplz\b/g, 'please'], [/\bthx\b/g, 'thanks'],
    [/\bwat\b|\bwht\b/g, 'what'], [/\bhw\b/g, 'how'], [/\bwen\b/g, 'when']
  ];

  // words that carry no meaning for matching
  var STOP = {};
  ('a an the is are was were am be been being do does did to of in on at for with and or it its this that these those ' +
   'i me my mine we our you your yours can could will would should shall may might have has had so just please there here ' +
   'as by from about into if then than too very really any some tell give show let us get got also up out off').split(' ').forEach(function (w) { STOP[w] = 1; });

  // small synonym table: different words, same idea
  var SYN = {
    cv: 'resume', resumes: 'resume', curriculum: 'resume', vitae: 'resume',
    cost: 'price', costs: 'price', pricing: 'price', prices: 'price', charge: 'price', fee: 'price', fees: 'price', expensive: 'price', cheap: 'price',
    hiring: 'hire', hired: 'hire', hire: 'hire', hires: 'hire', recruit: 'hire', recruiting: 'hire', recruitment: 'hire', recruiter: 'hire', recruiters: 'hire', employer: 'company', employers: 'company', enterprise: 'company', companies: 'company',
    interviews: 'interview', interviewer: 'interview', interviewing: 'interview', interviewed: 'interview',
    practise: 'practice', practising: 'practice', practicing: 'practice', rehearse: 'practice', mock: 'practice', train: 'practice',
    behavioral: 'behavioural', jobs: 'job', vacancies: 'job',
    candidates: 'candidate', applicants: 'candidate', applicant: 'candidate', seekers: 'candidate', seeker: 'candidate',
    launch: 'launch', launched: 'launch', launching: 'launch', release: 'launch', released: 'launch', live: 'launch', available: 'launch', availability: 'launch',
    signup: 'join', register: 'join', registration: 'join', enroll: 'join', subscribe: 'join', waitlist: 'waitlist', waiting: 'waitlist',
    nervous: 'nervous', anxious: 'nervous', anxiety: 'nervous', scared: 'nervous', afraid: 'nervous', nerves: 'nervous', stressed: 'nervous', worried: 'nervous', panic: 'nervous',
    mail: 'email', emails: 'email', contact: 'contact', reach: 'contact', touch: 'contact',
    safe: 'secure', security: 'secure', privacy: 'secure', private: 'secure', protect: 'secure',
    founder: 'founder', founders: 'founder', founded: 'founder', ceo: 'founder', cto: 'founder', owner: 'founder', creator: 'founder', created: 'founder', made: 'founder', built: 'founder',
    apps: 'app',
    hi: 'hello', hey: 'hello', hii: 'hello', hiya: 'hello', hola: 'hello', namaste: 'hello', howdy: 'hello', greetings: 'hello', yo: 'hello', sup: 'hello',
    thanks: 'thanks', thank: 'thanks', thankyou: 'thanks', cheers: 'thanks', appreciate: 'thanks',
    goodbye: 'bye', cya: 'bye', later: 'bye',
    fake: 'scam', fraud: 'scam', legit: 'scam', trust: 'scam', trustworthy: 'scam',
    salary: 'salary', wage: 'salary', compensation: 'salary', raise: 'salary',
    questions: 'question', ask: 'question', asked: 'question', asking: 'question',
    nervousness: 'nervous', weakness: 'weakness', weaknesses: 'weakness', strengths: 'strength',
    bot: 'robot', chatbot: 'robot', machine: 'robot', human: 'human', real: 'real',
    language: 'language', languages: 'language', hindi: 'language', spanish: 'language', french: 'language', german: 'language', english: 'language',
    keep: 'store', save: 'store', saved: 'store', saves: 'store', saving: 'store', record: 'store', recorded: 'store', recording: 'store', history: 'store', log: 'store', logs: 'store', upload: 'store', uploaded: 'store',
    better: 'improve', improve: 'improve', improving: 'improve', enhance: 'improve', boost: 'improve', optimise: 'improve', optimize: 'improve', upgrade: 'improve', polish: 'improve',
    nervousness: 'nervous', shake: 'nervous', shaking: 'nervous', sweat: 'nervous', sweaty: 'nervous', jitters: 'nervous',
    layoff: 'fired', laid: 'fired', fired: 'fired', terminated: 'fired', dismissed: 'fired', redundant: 'fired',
    flaw: 'weakness', flaws: 'weakness', negative: 'weakness',
    vacancy: 'job', opening: 'job', openings: 'job', ad: 'posting', advert: 'posting', advertisement: 'posting', posting: 'posting', post: 'posting',
    raised: 'funding', raise: 'funding', investor: 'funding', investors: 'funding', invest: 'funding', investment: 'funding', funded: 'funding', valuation: 'funding',
    queue: 'line', jump: 'line', skip: 'line', position: 'line',
    friend: 'refer', friends: 'refer', referral: 'refer', refer: 'refer', invite: 'refer', invited: 'refer',
    canada: 'country', india: 'country', usa: 'country', america: 'country', uk: 'country', europe: 'country', australia: 'country', countries: 'country', country: 'country', region: 'country',
    proposal: 'partner', partnership: 'partner', partnerships: 'partner', collaborate: 'partner', collaboration: 'partner', sponsor: 'partner',
    forget: 'ignore', disregard: 'ignore', ignore: 'ignore', override: 'ignore', bypass: 'ignore', previous: 'ignore', earlier: 'ignore',
    coding: 'code', program: 'code', programming: 'code', script: 'code', function: 'code', javascript: 'code', python: 'code', java: 'code', sql: 'code', html: 'code', debug: 'code',
    assignment: 'homework', essay: 'homework', exam: 'homework', equation: 'homework', math: 'homework', maths: 'homework',
    chief: 'founder', technology: 'tech', technical: 'tech', engineering: 'tech',
    discriminate: 'bias', discrimination: 'bias', biased: 'bias', unfair: 'bias', fair: 'bias', fairness: 'bias',
    camera: 'video', webcam: 'video', zoom: 'video', face: 'video'
  };

  function stem(w) {
    if (w.length > 4) {
      if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
      if (/(ing)$/.test(w) && w.length > 5) return w.slice(0, -3);
      if (/(ed)$/.test(w) && w.length > 5) return w.slice(0, -2);
      if (/(es)$/.test(w) && w.length > 5) return w.slice(0, -2);
      if (/s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    }
    return w;
  }

  function normalize(s) {
    s = String(s || '').toLowerCase().replace(/[‘’`´]/g, "'");
    CONTRACTIONS.forEach(function (c) { s = s.replace(c[0], c[1]); });
    return s.replace(/[^a-z0-9À-ɏЀ-ӿऀ-ॿ؀-ۿ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tokens(s, keepStop) {
    var out = [];
    normalize(s).split(' ').forEach(function (w) {
      if (!w) return;
      if (!keepStop && STOP[w]) return;
      w = SYN[w] || w;
      w = SYN[stem(w)] || stem(w);
      out.push(w);
    });
    return out;
  }

  function lev1(a, b) {                     // are two words within a small edit distance?
    var la = a.length, lb = b.length;
    var max = la >= 8 ? 2 : 1;
    if (Math.abs(la - lb) > max) return false;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return false;
      prev = cur;
    }
    return prev[lb] <= max;
  }

  // character trigrams: catches spelling and word-form differences ("simulation" ~ "simulated")
  function trigrams(words) {
    var set = {}, n = 0;
    words.forEach(function (w) {
      if (w.length < 3) return;
      var s = '_' + w + '_';
      for (var i = 0; i + 3 <= s.length; i++) { set[s.substr(i, 3)] = 1; n++; }
    });
    return set;
  }
  function dice3(a, b) {
    var na = 0, nb = 0, inter = 0, k;
    for (k in a) { na++; if (b[k]) inter++; }
    for (k in b) nb++;
    return na && nb ? (2 * inter) / (na + nb) : 0;
  }

  function Matcher(kb) {
    var self = this;
    self.kb = kb;
    var df = {}, N = kb.length;
    var dfAns = {};
    self.items = kb.map(function (e) {
      var variants = e.q.map(function (q) { var tt = tokens(q); return { raw: normalize(q), t: tt, tri: trigrams(tt) }; });
      var kw = tokens(e.k || '');
      var all = {};
      variants.forEach(function (v) { v.t.forEach(function (t) { all[t] = 1; }); });
      kw.forEach(function (t) { all[t] = 1; });
      Object.keys(all).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
      // saliency of every word for this topic: how many phrasings use it, keywords, and (weakly) the answer text
      var sal = {}, bigrams = {};
      variants.forEach(function (v) {
        var seen = {};
        v.t.forEach(function (w, i) {
          if (!seen[w]) { sal[w] = (sal[w] || 0) + 1 / Math.max(2, variants.length * 0.5); seen[w] = 1; }
          if (i > 0) bigrams[v.t[i - 1] + '_' + w] = 1;
        });
      });
      Object.keys(sal).forEach(function (w) { sal[w] = Math.min(1, 0.55 + sal[w]); });
      kw.forEach(function (w) { sal[w] = Math.max(sal[w] || 0, 0.8); });
      tokens(e.a).forEach(function (w) { if (!sal[w]) sal[w] = 0.3; });
      return { e: e, variants: variants, kw: kw, sal: sal, bigrams: bigrams };
    });
    self.idf = function (t) { return Math.log(1 + N / (1 + (df[t] || 0))) + 0.3; };
    self.vocab = Object.keys(df);
  }

  // does query token q match term t? exact = 1, close spelling = 0.75, else 0
  Matcher.prototype.tokSim = function (q, t) {
    if (q === t) return 1;
    if (q.length >= 5 && t.length >= 5 && lev1(q, t)) return 0.75;
    return 0;
  };

  Matcher.prototype.cover = function (qt, terms) {
    // weighted share of the terms (idf-weighted) that appear in the query, and share of query used
    var self = this, hit = 0, termSum = 0, qHit = 0, qSum = 0;
    terms.forEach(function (t) { termSum += self.idf(t); });
    qt.forEach(function (q) { qSum += self.idf(q); });
    terms.forEach(function (t) {
      var best = 0;
      qt.forEach(function (q) { var s = self.tokSim(q, t); if (s > best) best = s; });
      hit += best * self.idf(t);
    });
    qt.forEach(function (q) {
      var best = 0;
      terms.forEach(function (t) { var s = self.tokSim(q, t); if (s > best) best = s; });
      qHit += best * self.idf(q);
    });
    return { termCover: termSum ? hit / termSum : 0, qCover: qSum ? qHit / qSum : 0, terms: terms.length };
  };

  var TRI_W = 0.8;
  var GREET = /^(hi|hello|hey|hii|hiya|hola|yo|good (morning|afternoon|evening)|namaste|howdy)\b[ ,!.]*/;
  var TAIL = /[ ,!.]*(please|thanks|thank you|thx|pls|plz)[ !.?]*$/;

  Matcher.prototype.match = function (input) {
    var self = this;
    var norm = normalize(input);
    if (!norm) return { best: null, score: 0, list: [] };

    // "hi, how much does it cost?" -> look at the real question
    var core = norm;
    var stripped = core.replace(GREET, '').replace(TAIL, '').trim();
    if (stripped.split(' ').filter(Boolean).length >= 2) core = stripped;

    var qt = tokens(core);
    var qtAll = tokens(core, true);
    if (!qt.length) qt = qtAll;

    var qTri = qt.length ? trigrams(qt) : null;
    var results = self.items.map(function (it) {
      var vBest = 0;
      it.variants.forEach(function (v) {
        if (v.raw === core) { vBest = Math.max(vBest, 1.2); return; }
        if (!v.t.length) return;
        var c = self.cover(qt, v.t);
        // Dice-like balance: the question should be about the same things as the phrasing
        var dice = (c.termCover * c.qCover) ? (2 * c.termCover * c.qCover) / (c.termCover + c.qCover) : 0;
        var s = dice;
        // a longer user message that fully contains a multi-word phrasing still counts
        var mass = 0; v.t.forEach(function (w) { mass += self.idf(w); });
        if (v.t.length >= 2 && c.termCover >= 0.99 && mass >= 5.5) s = Math.max(s, 0.62 + 0.3 * c.qCover);
        if (v.t.length === 1 && c.termCover >= 0.99 && qt.length > 2) s = Math.min(s, 0.45); // lone word in a long sentence
        if (s > 0.98) s = 0.98;           // only an exact phrasing may score a full 1
        if (s > vBest) vBest = s;
      });
      var triBest = 0;
      if (qTri) it.variants.forEach(function (v) { var d = dice3(qTri, v.tri); if (d > triBest) triBest = d; });
      var kwScore = 0;
      if (it.kw.length) {
        var kc = self.cover(qt, it.kw);
        // keywords: reward query words that are topic keywords
        kwScore = 0.8 * kc.qCover * Math.min(1, 0.5 + 0.2 * Math.min(qt.length, 3)) * (kc.termCover > 0 ? 1 : 0);
        kwScore = Math.min(kwScore, 0.6);
      }
      // bag-of-words evidence: how much of what the visitor said is about this topic
      var bagHit = 0, bagSum = 0;
      qt.forEach(function (q) {
        var w = self.idf(q); bagSum += w;
        var best = 0;
        if (it.sal[q]) best = it.sal[q];
        else if (q.length >= 5) { for (var t2 in it.sal) { if (t2.length >= 5 && lev1(q, t2)) { best = 0.75 * it.sal[t2]; break; } } }
        bagHit += w * best;
      });
      var bag = bagSum ? bagHit / bagSum : 0;
      // bigram bonus: two words in a row that this topic also has in a row ("cover letter", "job description")
      var bi = 0;
      for (var bq = 1; bq < qt.length; bq++) if (it.bigrams[qt[bq - 1] + '_' + qt[bq]]) bi++;
      var biBonus = Math.min(0.2, bi * 0.1);

      var score = Math.max(vBest, 0.55 * vBest + 0.55 * kwScore);
      if (kwScore > vBest) score = Math.max(score, kwScore * 0.85);
      score = Math.max(score, 0.9 * bag * (qt.length >= 2 ? 1 : 0.8));
      score = Math.max(score, TRI_W * triBest);
      if (vBest < 1.2) score = Math.min(score + biBonus, 0.98);
      return { id: it.e.id, entry: it.e, score: Math.min(score, 1.2), v: vBest, k: kwScore };
    });

    results.sort(function (a, b) { return b.score - a.score; });
    return { best: results[0], score: results[0].score, list: results.slice(0, 4), qt: qt };
  };

  var api = { Matcher: Matcher, normalize: normalize, tokens: tokens };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GenaMatch = api;
})(typeof window !== 'undefined' ? window : globalThis);

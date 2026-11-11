(function(){var m=document.getElementById("bench");if(m&&!m.firstChild){m.outerHTML="<main class=\"wrap\">\n  <header class=\"top\">\n    <h1>Ticket Bench</h1>\n    <div class=\"top-right\">\n      <span class=\"tag\" id=\"course\">Prototype</span>\n      <div class=\"restart\" id=\"restart-box\"></div>\n    </div>\n  </header>\n  <div class=\"grid\">\n    <div class=\"a-side\">\n      <section class=\"a-ticket\" aria-labelledby=\"t-h\">\n        <h2 id=\"t-h\"></h2>\n        <p class=\"who\" id=\"twho\"></p>\n        <p class=\"report\" id=\"treport\"></p>\n        <div id=\"tmore\">\n          <p class=\"arrive-h\">When you arrive</p>\n          <ul class=\"arrive\" id=\"tarrive\"></ul>\n        </div>\n        <button class=\"link\" id=\"ttoggle\" type=\"button\" aria-controls=\"tmore\"></button>\n      </section>\n      <section class=\"a-log\" aria-labelledby=\"l-h\" tabindex=\"0\">\n        <div class=\"log-head\"><h2 id=\"l-h\">Investigation record</h2><div class=\"log-copy\" id=\"log-copy\"></div></div>\n        <ol class=\"log\" id=\"log\"></ol>\n        <p class=\"empty\" id=\"log-empty\">Nothing yet. Each question you ask and check you run shows up here with its result.</p>\n      </section>\n    </div>\n    <div class=\"a-work\">\n      <section id=\"work\" aria-label=\"Next step\">\n        <div class=\"hypstrip\" id=\"hyp\" role=\"region\" aria-label=\"Hypothesis\"></div>\n        <div class=\"wbody\" id=\"wbody\"></div>\n      </section>\n    </div>\n  </div>\n  <p id=\"sr-status\" class=\"sr\" role=\"status\" aria-live=\"polite\"></p>\n  <footer class=\"note\">Your progress is kept only in this browser so a reload doesn't lose it. Nothing is sent anywhere.</footer>\n</main>";}})();
(function () {
  if (!document.documentElement.lang) document.documentElement.lang = 'en';
  const S = JSON.parse(document.getElementById('scenario').textContent);
  const KEY = 'ticketbench:v4:' + S.id;
  const fresh = () => ({ hyp: null, editHyp: false, ticketOpen: null, done: [], log: [], flags: {}, pending: null, lastNote: null,
    stage: 'investigate', diagTries: [], evidence: [], fixTries: [], fix: null, prevention: [], refusals: [] });
  let st;
  try { st = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { st = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const act = (id) => S.actions.find(a => a.id === id);
  const isFinding = (a) => Object.prototype.hasOwnProperty.call(a, 'pointsTo');
  const UNSURE = { id: 'unsure', label: "I'm not sure yet" };
  const NONE = 'none';
  const hypLabel = (id) => (S.hypotheses.concat(UNSURE).find(h => h.id === id) || {}).label || '';
  const real = (id) => !!id && id !== 'unsure' && id !== 'none';
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  // Lowercase a hypothesis label mid-sentence only when it starts with an article, so names like Windows or Jen's keep their capital
  const lowerLabel = (t) => /^(The|A|An) /.test(t) ? lower(t) : t;
  const refusalText = (a) => a.refusal.replace(/^Not yet\.\s*/, '');
  const hypName = (id) => (S.hypotheses.find(h => h.id === id) || {}).name || lower(hypLabel(id));
  const list = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const CHEV = '<svg viewBox="0 0 12 20" aria-hidden="true" focusable="false"><path d="M2.5 2.5 9.5 10l-7 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const Q = (t, id) => '<h2 class="q"' + (id ? ' id="' + id + '"' : '') + '>' + CHEV + '<span>' + t + '</span></h2>';

  // Causes the evidence has ruled out so far (only results the student has already read)
  const ruledOut = (except) => {
    const s = new Set();
    st.log.forEach(e => { if (e.type === 'action' && e.read && e !== except) (act(e.id).rulesOut || []).forEach(h => s.add(h)); });
    return s;
  };
  // What a correct read looks like: the cause the result points toward, the causes it clearly rules out, and any it arguably rules out (mayRuleOut: checked or not, either is fine).
  // Missing a rule-out of another cause still counts as a good read; the feedback names it. The wrong cause, missing that your own hypothesis is ruled out, or ruling out something the result doesn't rule out needs another look.
  function expectedRead(e) {
    const a = act(e.id);
    const prior = ruledOut(e);
    const open = (xs) => (xs || []).filter(h => !prior.has(h));
    return { first: a.pointsTo || NONE, others: open(a.rulesOut), maybe: open(a.mayRuleOut) };
  }
  function readCheck(e) {
    const x = expectedRead(e);
    const missed = x.others.filter(h => !e.read.others.includes(h));
    return { firstOk: e.read.first === x.first,
      missOwn: real(e.rh) && missed.includes(e.rh),
      missing: missed.filter(h => h !== e.rh),
      extra: e.read.others.filter(h => !x.others.includes(h) && !x.maybe.includes(h)) };
  }
  const readRight = (e) => { const c = readCheck(e); return c.firstOk && !c.missOwn && !c.extra.length; };
  const alsoRules = (e) => { const m = readCheck(e).missing; return m.length ? ' It also rules out ' + list(m.map(hypName)) + '.' : ''; };

  // Evidence is told apart by typeface: what a person said is quoted text with the speaker's name; what a check showed is monospace
  const ASK = S.groups.find(g => g.id === 'ask');
  const speaker = ASK ? ASK.label.replace(/^Ask\s+/, '') : '';
  const isSaid = (a) => a.group === 'ask';
  const resultHTML = (a) => isSaid(a) ? '<p class="say">' + esc(speaker) + ': ' + esc(a.result) + '</p>' : '<p class="out">' + esc(a.result) + '</p>';

  $('course').textContent = S.course;
  $('t-h').textContent = S.ticket + ' · ' + S.device;
  $('twho').textContent = 'Reported by ' + S.reportedBy;
  $('treport').textContent = '"' + S.report + '"';
  $('tarrive').innerHTML = S.arrival.map(a => '<li>' + esc(a) + '</li>').join('');
  $('ttoggle').addEventListener('click', () => { st.ticketOpen = !ticketOpen(); save(); renderTicket(); });
  const ticketOpen = () => st.ticketOpen === null || st.ticketOpen === undefined ? !st.hyp : st.ticketOpen;
  function renderTicket() {
    const open = ticketOpen();
    $('twho').hidden = !open; $('tmore').hidden = !open;
    $('ttoggle').textContent = open ? 'Hide details' : 'Show full ticket';
    $('ttoggle').setAttribute('aria-expanded', String(open));
  }

  // Hypothesis strip: the top edge of the card
  function renderHyp() {
    const el = $('hyp');
    if (!st.hyp) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const canChange = st.stage === 'investigate' && !st.editHyp && !st.pending;
    const diagnosed = st.stage !== 'investigate' && st.stage !== 'diagnose';
    const gone = real(st.hyp) && ruledOut().has(st.hyp);
    el.innerHTML = '<span class="lab">' + (diagnosed ? 'Cause' : 'Hypothesis') + '</span>' +
      (canChange ? '<button class="pill" id="hyp-change" type="button">Change hypothesis</button>' : '<span></span>') +
      '<span class="txt">' + (gone ? '<span class="gone">' + esc(hypLabel(st.hyp)) + '</span> <span class="note">(ruled out)</span>' : esc(hypLabel(st.hyp))) + '</span>';
    const c = $('hyp-change'); if (c) c.addEventListener('click', openHypChooser);
  }
  function openHypChooser() {
    st.editHyp = true; save(); render();
    const r = $('wbody').querySelector('input:checked') || $('wbody').querySelector('input'); if (r) r.focus();
  }
  const optLabel = (h, gone) => gone.has(h.id) ? '<span class="gone">' + esc(h.label) + '</span> <span class="muted">(ruled out)</span>' : esc(h.label);

  // The hypothesis chooser takes over the card body, so nothing else competes with it
  function workChooseHyp() {
    const w = $('wbody');
    const first = !st.hyp;
    const gone = ruledOut();
    w.innerHTML = Q(first ? 'Start with a working hypothesis' : 'Change your working hypothesis') +
      '<form id="hyp-form"><fieldset><legend>What do you think is most likely, right now?</legend><div class="opts">' +
      S.hypotheses.concat(UNSURE).map(x => '<label class="opt"><input type="radio" name="hyp" value="' + x.id + '"' + (st.hyp === x.id ? ' checked' : '') + '> <span class="t">' + optLabel(x, gone) + '</span></label>').join('') +
      '</div></fieldset><div class="row"><button class="primary" type="submit">Set it</button>' +
      (first ? '' : '<button type="button" id="hyp-cancel">Cancel</button>') + '</div></form>' +
      '<p class="hint">It\'s a starting point, not a final answer, and you can change it at any time. If you\'re not sure yet, you can still ask questions, but you\'ll need a hypothesis to test before you run checks.</p>';
    $('hyp-form').addEventListener('submit', e => {
      e.preventDefault();
      const v = (new FormData(e.target)).get('hyp'); if (!v) return;
      if (v !== st.hyp) st.log.push({ type: 'hyp', hyp: v });
      if (!st.hyp && (st.ticketOpen === null || st.ticketOpen === undefined)) st.ticketOpen = false;
      st.hyp = v; st.editHyp = false; save(); render();
      $('sr-status').textContent = 'Hypothesis set: ' + hypLabel(v) + '.';
    });
    const x = $('hyp-cancel'); if (x) x.addEventListener('click', () => {
      st.editHyp = false; save(); render(); const c = $('hyp-change'); if (c) c.focus();
    });
  }

  function feedbackText(e) {
    const a = act(e.id), x = expectedRead(e), c = readCheck(e);
    if (readRight(e)) return '✓ Good read.' + alsoRules(e) + ' ' + a.note;
    const parts = [];
    if (!c.firstOk) parts.push(x.first === NONE ? "This doesn't single out one cause." : 'This points toward ' + hypName(x.first) + '.');
    if (c.missOwn) parts.push('It rules out your hypothesis.');
    if (c.extra.length) parts.push("It doesn't rule out " + list(c.extra.map(hypName)) + '.');
    return 'Look again. ' + parts.join(' ') + alsoRules(e) + ' ' + a.note;
  }
  function readLine(e) {
    const x = expectedRead(e);
    let s = 'You read it as ' + (e.read.first === NONE ? 'not singling out one cause' : 'pointing toward ' + hypName(e.read.first));
    if (e.read.others.length) s += ' and ruled out ' + list(e.read.others.map(hypName));
    s += '.';
    if (readRight(e)) return '✓ ' + s + alsoRules(e);
    let b = x.first === NONE ? 'not singling out one cause' : 'pointing toward ' + hypName(x.first);
    if (x.others.length) b += ', ruling out ' + list(x.others.map(hypName));
    return s + ' Better read: ' + b + '.';
  }

  function renderLog() {
    const items = []; let n = 0;
    st.log.forEach((e, i) => {
      const cls = i === st.log.length - 1 ? ' class="new"' : '';
      if (e.type === 'hyp') { items.push('<li' + cls + '><div class="hl"><span class="dot" aria-hidden="true"></span><span>' + (real(e.hyp) ? 'Hypothesis set: ' + esc(lowerLabel(hypLabel(e.hyp))) : 'Hypothesis: not sure yet') + '</span></div></li>'); return; }
      const a = act(e.id);
      if (e.type === 'refused') { items.push('<li' + cls + '><div class="q">Tried: ' + esc(a.label) + '</div><p class="rd">Not done yet. ' + esc(refusalText(a)) + '</p></li>'); return; }
      n++;
      let h = '<li' + cls + '><div class="q">' + n + '. ' + esc(a.label) + '</div>';
      if (isFinding(a) && !e.read) h += '<p class="rd">Waiting for your read →</p>';
      else { h += resultHTML(a); if (e.read) h += '<p class="rd">' + esc(readLine(e)) + '</p>'; }
      items.push(h + '</li>');
    });
    if (st.stage === 'debrief') {
      const fix = (S.fixes.find(f => f.id === st.fix) || {}).label || '';
      const prev = st.prevention.map(id => S.prevention.find(p => p.id === id).label).join('; ') || 'None chosen';
      items.push('<li class="close"><div class="q">Diagnosis: ' + esc(hypLabel(S.diagnosis.correct)) + '</div><p class="rd">Supporting findings: ' + esc(st.evidence.map(id => act(id).label).join('; ')) + '</p></li>');
      items.push('<li><div class="q">Fix: ' + esc(fix) + '</div><p class="out">' + esc(S.verify) + '</p></li>');
      items.push('<li><div class="q">Prevention</div><p class="rd">' + esc(prev) + '</p></li>');
    }
    $('log').innerHTML = items.join('');
    const lc = $('log-copy');
    if (st.stage === 'debrief') {
      lc.innerHTML = '<button class="pill" type="button" id="copy-log">Copy the record</button><span class="hint" id="copied-log" role="status"></span>';
      $('copy-log').addEventListener('click', () => copyRecord($('copied-log')));
    } else lc.innerHTML = '';
    $('log-empty').hidden = st.log.length > 0;
    const lp = document.querySelector('.a-log'); if (lp && lp.scrollHeight > lp.clientHeight) lp.scrollTop = lp.scrollHeight;
  }

  function doAction(id) {
    const a = act(id);
    if (a.value === 'premature') { st.log.push({ type: 'refused', id }); st.refusals.push(id); st.lastNote = { refused: id }; save(); render(); return; }
    if (!a.repeatable) st.done.push(id);
    if (a.sets) st.flags[a.sets] = true;
    if (a.clears) st.flags[a.clears] = false;
    st.log.push({ type: 'action', id, hyp: st.hyp });
    st.lastNote = null;
    if (isFinding(a)) st.pending = id;
    save(); render();
  }

  // What the result means for the working hypothesis. The engine says this; students only say what the result points toward and rules out.
  function nextText(a) {
    const h = st.hyp, p = a.pointsTo;
    if (!real(h)) return real(p) ? 'This points toward ' + hypName(p) + '. When you\'re ready, set a working hypothesis and choose a check that could test it.' : 'Choose what to ask or check next.';
    if ((a.rulesOut || []).includes(h)) return 'This rules out your hypothesis' + (real(p) ? ' and points toward ' + hypName(p) : '') + '. Change it before you check anything else.';
    if (p === h) return 'This points toward your hypothesis. Look for a check that could prove it wrong, or choose "I know the cause" when the evidence is enough.';
    if (real(p)) return 'This points toward ' + hypName(p) + ', not your hypothesis. If that cause now fits better, change your hypothesis.';
    return 'Choose what to ask or check next.';
  }
  const suggestsChange = (a) => real(a.pointsTo) ? a.pointsTo !== st.hyp : real(st.hyp) && (a.rulesOut || []).includes(st.hyp);

  function workRead() {
    const w = $('wbody');
    const a = act(st.pending);
    const h = st.hyp;
    const prior = ruledOut();
    const mine = (id) => real(h) && id === h ? ' <span class="muted">(your hypothesis)</span>' : '';
    const row = (x, type, name) => prior.has(x.id)
      ? '<div class="opt off"><span class="t"><span class="gone">' + esc(x.label) + '</span> (already ruled out)</span></div>'
      : '<label class="opt"><input type="' + type + '" name="' + name + '" value="' + x.id + '"> <span class="t">' + esc(x.label) + mine(x.id) + '</span></label>';
    const q1 = '<fieldset><legend>Which cause does this point toward?</legend><div class="opts">' +
      S.hypotheses.map(x => row(x, 'radio', 'r')).join('') +
      '<label class="opt"><input type="radio" name="r" value="' + NONE + '"> <span class="t">It doesn\'t single out one cause</span></label></div></fieldset>';
    const q2 = '<fieldset><legend>Does it rule out any cause?</legend><div class="opts">' +
      S.hypotheses.map(x => row(x, 'checkbox', 'o')).join('') +
      '</div><p class="hint" style="margin-top:6px">Leave these blank if it doesn\'t rule anything out.</p></fieldset>';
    w.innerHTML = Q(esc(a.label)) + '<div style="margin:-6px 0 20px 24px">' + resultHTML(a) + '</div>' +
      '<form id="read">' + q1 + q2 + '<p class="err" id="read-err" hidden></p><div class="row"><button class="primary" type="submit">Log my read</button></div></form>';
    $('read').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const v = fd.get('r'), o = fd.getAll('o');
      const err = (msg) => { const m = $('read-err'); m.hidden = false; m.textContent = msg; m.setAttribute('tabindex', '-1'); m.focus(); };
      if (!v) { err('Choose which cause this points toward, or that it doesn\'t single out one.'); return; }
      if (o.includes(v)) { err("A result can't point toward a cause and rule it out. Change one of your answers."); return; }
      const entry = st.log.slice().reverse().find(x => x.type === 'action' && x.id === st.pending);
      entry.rh = h;
      entry.read = { first: v, others: o };
      st.lastNote = { id: a.id };
      st.pending = null; save(); render();
    });
  }

  function workInvestigate() {
    const w = $('wbody');
    if (!st.hyp || st.editHyp) { workChooseHyp(); return; }
    if (st.pending) { workRead(); return; }
    let h = '';
    if (st.lastNote && st.lastNote.refused) {
      const r = act(st.lastNote.refused);
      h += '<div class="top-fb"><p><strong>Tried: ' + esc(r.label) + '</strong></p><p>Not done yet. ' + esc(refusalText(r)) + '</p></div>';
    }
    if (st.lastNote && st.lastNote.id) {
      const entry = st.log.slice().reverse().find(x => x.type === 'action' && x.id === st.lastNote.id);
      const a = act(st.lastNote.id);
      h += '<div class="top-fb"><p>' + esc(feedbackText(entry)) + '</p><p><strong>Next:</strong> ' + esc(nextText(a)) + '</p>' +
        (suggestsChange(a) ? '<div class="row" style="margin-top:10px"><button class="pill" type="button" id="fb-change">Change hypothesis</button></div>' : '') + '</div>';
    }
    h += Q('What do you do next?');
    S.groups.forEach(g => {
      const gActs = S.actions.filter(a => a.group === g.id && !(a.hiddenWhen && st.flags[a.hiddenWhen]) && !(a.shownWhen && !st.flags[a.shownWhen]));
      const locked = g.needsHypothesis && !real(st.hyp);
      h += '<div class="group"><h3>' + esc(g.label) + '</h3>';
      if (locked) h += '<p class="lock">' + (g.needsRealHypothesis ? 'Make a change only once you have a working hypothesis.' : 'Choose a working hypothesis to test first. If you\'re unsure, pick the cause the evidence so far fits best; you can change it.') + '</p>';
      h += '<div class="actions">' + gActs.map(a => {
        const done = st.done.includes(a.id);
        const needs = (a.requires && !st.flags[a.requires]) || (a.forbiddenWhen && st.flags[a.forbiddenWhen]);
        return '<button class="action' + (done ? ' done' : '') + '" data-id="' + a.id + '"' + ((locked || done) ? ' disabled' : '') + (needs ? ' data-needs="1"' : '') + '><span>' + esc(a.label) + '</span>' + (done ? '<span class="done-w">Done</span>' : '') + '</button>';
      }).join('') + '</div></div>';
    });
    const findings = st.done.filter(id => isFinding(act(id))).length;
    h += '<div class="row"><button class="primary" id="go-diag"' + (findings < S.minFindingsToDiagnose ? ' disabled' : '') + '>I know the cause</button>' +
      (findings < S.minFindingsToDiagnose ? '<span class="hint" style="margin:0">Gather at least ' + S.minFindingsToDiagnose + ' findings first.</span>' : '') + '</div>';
    w.innerHTML = h;
    w.querySelectorAll('button.action').forEach(b => b.addEventListener('click', () => {
      const a = act(b.dataset.id);
      if (b.dataset.needs) { w.querySelectorAll('.needs-msg').forEach(n => n.remove()); b.insertAdjacentHTML('afterend', '<p class="needs-msg" role="status">Not done yet. ' + esc(a.requires && !st.flags[a.requires] ? a.requiresText : a.forbiddenText) + '</p>'); return; }
      doAction(b.dataset.id);
    }));
    const fc = $('fb-change'); if (fc) fc.addEventListener('click', openHypChooser);
    const go = $('go-diag'); if (go) go.addEventListener('click', () => { st.lastNote = null; st.editHyp = false; st.stage = 'diagnose'; save(); render(); });
  }

  function workDiagnose() {
    const w = $('wbody');
    const found = st.done.filter(id => isFinding(act(id)));
    const gone = ruledOut();
    const last = st.diagTries[st.diagTries.length - 1];
    const fb = last && !last.ok ? '<p class="err">Look again. ' + esc(last.msg) + '</p>' : '';
    w.innerHTML = Q('What is the cause?') + '<form id="diag"><fieldset><legend class="sr">Cause</legend><div class="opts">' +
      S.hypotheses.map(x => '<label class="opt"><input type="radio" name="c" value="' + x.id + '"' + (st.hyp === x.id ? ' checked' : '') + '> <span class="t">' + optLabel(x, gone) + '</span></label>').join('') +
      '</div></fieldset><fieldset><legend>Which findings support it? Choose the ones that matter.</legend><div class="opts">' +
      found.map(id => { const a = act(id); return '<label class="opt"><input type="checkbox" name="e" value="' + id + '"> <span class="t">' + esc(a.label) + '<span class="line1' + (isSaid(a) ? '' : ' mono') + '">' + esc(isSaid(a) ? speaker + ': ' + a.result : a.result) + '</span></span></label>'; }).join('') +
      '</div></fieldset>' + fb + '<div class="row"><button class="primary" type="submit">Submit diagnosis</button><button type="button" id="back">Keep investigating</button></div></form>';
    $('back').addEventListener('click', () => { st.stage = 'investigate'; save(); render(); });
    $('diag').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target); const c = fd.get('c'); const ev = fd.getAll('e');
      if (!c) return;
      if (c !== S.diagnosis.correct) { st.diagTries.push({ cause: c, ok: false, msg: S.diagnosis.feedback[c] + ' Keep investigating, or choose again.' }); save(); render(); return; }
      if (!ev.some(x => S.diagnosis.keyEvidence.includes(x))) { st.diagTries.push({ cause: c, ok: false, msg: S.diagnosis.evidenceFeedback }); save(); render(); return; }
      st.diagTries.push({ cause: c, ok: true }); st.evidence = ev; st.hyp = c; st.stage = 'fix'; save(); render();
    });
  }

  function workFix() {
    const w = $('wbody');
    const last = st.fixTries[st.fixTries.length - 1];
    const fb = last && !last.ok ? '<p class="err">Look again. ' + esc(last.msg) + '</p>' : '';
    w.innerHTML = Q('What will you do?') + '<form id="fix"><fieldset><legend class="sr">Fix</legend><div class="opts">' +
      S.fixes.map(x => '<label class="opt"><input type="radio" name="f" value="' + x.id + '"> <span class="t">' + esc(x.label) + '</span></label>').join('') +
      '</div></fieldset>' + fb + '<div class="row"><button class="primary" type="submit">Make the fix</button></div></form>';
    $('fix').addEventListener('submit', e => {
      e.preventDefault();
      const v = (new FormData(e.target)).get('f'); if (!v) return;
      const f = S.fixes.find(x => x.id === v);
      if (!f.correct) { st.fixTries.push({ id: v, ok: false, msg: f.feedback }); save(); render(); return; }
      st.fixTries.push({ id: v, ok: true }); st.fix = v; st.stage = 'verify'; save(); render();
    });
  }

  function workVerify() {
    $('wbody').innerHTML = Q('Did it work?') + '<p class="out" style="margin:-6px 0 20px 24px">' + esc(S.verify) + '</p>' +
      '<form id="prev"><fieldset><legend>What will keep it from coming back? Choose any that apply.</legend><div class="opts">' +
      S.prevention.map(x => '<label class="opt"><input type="checkbox" name="p" value="' + x.id + '"> <span class="t">' + esc(x.label) + '</span></label>').join('') +
      '</div></fieldset><div class="row"><button class="primary" type="submit">Close the ticket</button></div></form>';
    $('prev').addEventListener('submit', e => {
      e.preventDefault();
      st.prevention = (new FormData(e.target)).getAll('p'); st.stage = 'debrief'; save(); render();
    });
  }

  function readPlain(e) {
    const x = expectedRead(e), m = readCheck(e).missing;
    let s = e.read.first === NONE ? "it doesn't single out one cause" : 'it points toward ' + hypName(e.read.first);
    if (e.read.others.length) s += '; it rules out ' + list(e.read.others.map(hypName));
    if (readRight(e)) return s + (m.length ? ' (it also rules out ' + list(m.map(hypName)) + ')' : '');
    let b = x.first === NONE ? "it doesn't single out one cause" : 'it points toward ' + hypName(x.first);
    if (x.others.length) b += '; it rules out ' + list(x.others.map(hypName));
    return s + ' (better read: ' + b + ')';
  }
  function record() {
    const L = [S.course + ', ' + S.ticket + ': ' + S.device, 'Reported by ' + S.reportedBy + ': "' + S.report + '"', '', 'INVESTIGATION'];
    let n = 0;
    st.log.forEach(e => {
      if (e.type === 'hyp') { L.push('  Working hypothesis: ' + hypLabel(e.hyp)); return; }
      const a = act(e.id);
      if (e.type === 'refused') { L.push('  Tried: ' + a.label + ' (not done yet: premature)'); return; }
      n++; L.push('  ' + n + '. ' + a.label); L.push('     Result: ' + (isSaid(a) ? speaker + ': ' : '') + a.result);
      if (e.read) L.push('     My read: ' + readPlain(e));
    });
    const wrong = st.diagTries.filter(d => !d.ok && d.cause !== S.diagnosis.correct).map(d => hypLabel(d.cause));
    L.push('', 'DIAGNOSIS: ' + hypLabel(S.diagnosis.correct) + (wrong.length ? ' (earlier tries: ' + wrong.join('; ') + ')' : ''));
    L.push('  Supporting findings: ' + st.evidence.map(id => act(id).label).join('; '));
    L.push('FIX: ' + (S.fixes.find(f => f.id === st.fix) || {}).label);
    const wf = st.fixTries.filter(f => !f.ok).length;
    if (wf) L.push('  (' + wf + ' other fix' + (wf > 1 ? 'es' : '') + ' tried first)');
    L.push('VERIFY: ' + S.verify);
    L.push('PREVENTION: ' + (st.prevention.map(id => S.prevention.find(p => p.id === id).label).join('; ') || 'none chosen'));
    return L.join('\n');
  }

  function workDebrief() {
    const w = $('wbody');
    const finds = st.done.map(act).filter(isFinding);
    const key = finds.filter(a => a.value === 'key').length, useful = finds.filter(a => a.value === 'useful').length, low = finds.filter(a => a.value === 'low').length;
    const reads = st.log.filter(e => e.type === 'action' && e.read);
    const right = reads.filter(readRight).length;
    let s = 'You asked or checked ' + finds.length + ' thing' + (finds.length === 1 ? '' : 's') + '. ' + key + ' pointed straight at the cause';
    s += useful ? ', ' + useful + ' narrowed the list' : '';
    s += low ? ', and ' + low + ' told you little you needed.' : '.';
    if (st.refusals.length) s += ' You tried ' + st.refusals.length + ' change' + (st.refusals.length > 1 ? 's' : '') + ' before you had the evidence for ' + (st.refusals.length > 1 ? 'them' : 'it') + '.';
    const prevFb = S.prevention.map(p => {
      const chose = st.prevention.includes(p.id);
      if (chose === p.good) return p.good ? '<li>' + esc(p.feedback) + '</li>' : '';
      return '<li>' + (p.good ? 'You could also: ' + esc(lower(p.label)) + '.' : esc(p.feedback)) + '</li>';
    }).join('');
    w.innerHTML = Q('Ticket closed') + '<div class="row" style="margin:0 0 18px"><button class="primary" id="copy">Copy the record</button><span id="copied" class="hint" role="status" style="margin:0">Paste it into your template.</span></div>' + '<p class="stage-title" style="margin-top:0">What was wrong</p><p style="margin:0">' + esc(S.debrief.summary) + '</p>' +
      '<div class="stats"><div class="stat"><b>' + finds.length + '</b><span>questions and checks</span></div><div class="stat"><b>' + key + '</b><span>pointed at the cause</span></div><div class="stat"><b>' + right + '/' + reads.length + '</b><span>results read well</span></div></div>' +
      '<p style="margin:0">' + esc(s) + '</p>' +
      '<p class="stage-title">The checks that mattered most</p><ul class="debrief-list">' + S.debrief.mostInformative.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<p class="hint">' + esc(S.debrief.note) + '</p>' +
      (prevFb ? '<p class="stage-title">Keeping it from coming back</p><ul class="debrief-list">' + prevFb + '</ul>' : '') +
      '<p class="stage-title">For your template</p><p style="margin:0">Answer these in your template, under the record you copied:</p><ol class="reflect">' + S.reflection.map(r => '<li>' + esc(r) + '</li>').join('') + '</ol>';
    $('copy').addEventListener('click', () => copyRecord($('copied')));
  }

  // Copies the plain-text record (it adds the diagnosis, fix and prevention, and leaves out the check marks)
  function copyRecord(out) {
    const text = record(), back = document.activeElement;
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove(); if (back) back.focus();
      out.textContent = ok ? 'Copied.' : "Couldn't copy. Select the record and press Ctrl+C (or Cmd+C).";
    };
    try { navigator.clipboard.writeText(text).then(() => { out.textContent = 'Copied.'; }, fallback); } catch (e) { fallback(); }
  }

  let firstRender = true;
  function placeFocus() {
    if (firstRender) { firstRender = false; return; } // on page load, leave focus at the top so the ticket is read first
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.isConnected) return;
    const w = $('wbody');
    const t = w.querySelector('.err:not([hidden])') || w.querySelector('.top-fb') || w.querySelector('h2');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
  }
  function render() {
    renderTicket(); renderHyp(); renderLog();
    ({ investigate: workInvestigate, diagnose: workDiagnose, fix: workFix, verify: workVerify, debrief: workDebrief })[st.stage]();
    placeFocus();
  }
  function renderRestart(asking) {
    const b = $('restart-box');
    if (!asking) {
      b.innerHTML = '<button class="link" id="restart" type="button">Start over</button>';
      $('restart').addEventListener('click', () => renderRestart(true));
      return;
    }
    b.innerHTML = '<span>Clear your progress and start this ticket over?</span><button class="link" id="restart-yes" type="button">Yes, start over</button><button class="link" id="restart-no" type="button">Cancel</button>';
    $('restart-yes').addEventListener('click', () => { st = fresh(); save(); renderRestart(false); render(); window.scrollTo(0, 0); $('restart').focus(); });
    $('restart-no').addEventListener('click', () => { renderRestart(false); $('restart').focus(); });
    $('restart-yes').focus();
  }
  renderRestart(false);
  render();
})();

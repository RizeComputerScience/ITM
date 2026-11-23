(function(){var m=document.getElementById("bench");if(m&&!m.firstChild){m.outerHTML="<main class=\"wrap\">\n  <header class=\"top\">\n    <h1>Ticket Bench</h1>\n    <div class=\"top-right\">\n      <span class=\"tag\" id=\"course\">Prototype</span>\n      <button class=\"link\" id=\"help-open\" type=\"button\" aria-haspopup=\"dialog\">Help</button>\n      <div class=\"restart\" id=\"restart-box\"></div>\n    </div>\n    <dialog id=\"help\" aria-labelledby=\"help-h\">\n      <div class=\"help-head\"><h2 id=\"help-h\">How a ticket works</h2><button type=\"button\" class=\"link\" id=\"help-close\">Close</button></div>\n      <ol class=\"help-steps\">\n        <li>Rank the causes, most likely first. Your top cause is your working hypothesis, the one you're testing.</li>\n        <li>Ask questions and run checks. After each result, update your ranking: drag a cause or use its arrow buttons, and choose <strong>Rule out</strong> for any cause the evidence rules out. Your rankings aren't graded.</li>\n        <li>When a check you ran backs up your top cause, choose <strong>I know the cause</strong>. You don't need to rule out every other cause.</li>\n        <li>Make the fix, see whether it worked, and choose what will keep the problem from coming back.</li>\n        <li>Copy the case record and paste it into your template.</li>\n      </ol>\n      <h3>Why is a check unavailable?</h3>\n      <p>Something has to happen first. Think about what a technician would do before that check.</p>\n    </dialog>\n  </header>\n  <div class=\"grid\">\n    <div class=\"a-side\">\n      <section class=\"a-ticket\" aria-labelledby=\"tno t-h\">\n        <div class=\"tk-head\"><span class=\"tk-no\" id=\"tno\"></span></div>\n        <div class=\"tk-body\">\n          <h2 id=\"t-h\"></h2>\n          <p class=\"who\" id=\"twho\"></p>\n          <p class=\"report\" id=\"treport\"></p>\n          <div id=\"tmore\">\n            <p class=\"arrive-h\">When you arrive</p>\n            <ul class=\"arrive\" id=\"tarrive\"></ul>\n          </div>\n          <button class=\"link\" id=\"ttoggle\" type=\"button\" aria-controls=\"tmore\"></button>\n        </div>\n      </section>\n      <section class=\"a-log\" aria-labelledby=\"l-h\" tabindex=\"0\">\n        <div class=\"log-head\"><h2 id=\"l-h\">Case record</h2><div class=\"log-copy\" id=\"log-copy\"></div></div>\n        <ol class=\"log\" id=\"log\"></ol>\n        <p class=\"empty\" id=\"log-empty\">Nothing yet. Each question you ask and check you run shows up here with its result.</p>\n      </section>\n    </div>\n    <div class=\"a-work\">\n      <section id=\"work\" aria-label=\"Next step\">\n        <div class=\"hypstrip\" id=\"hyp\" role=\"region\" aria-label=\"Hypothesis\"></div>\n        <div class=\"wbody\" id=\"wbody\"></div>\n      </section>\n    </div>\n  </div>\n  <p id=\"sr-status\" class=\"sr\" role=\"status\" aria-live=\"polite\"></p>\n  <footer class=\"note\">Your progress is saved in this browser, so you can close this page and come back to it later on the same computer. Nothing is sent anywhere.</footer>\n</main>";}})();
(function () {
  if (!document.documentElement.lang) document.documentElement.lang = 'en';
  const S = JSON.parse(document.getElementById('scenario').textContent);
  const KEY = 'ticketbench:v5:' + S.id;
  // v2 (ranking): the student keeps every cause in a ranked list, most likely first; the top cause is the working hypothesis.
  // After each result the student re-ranks (drag, or the Up and Down buttons) and can set causes aside as ruled out. Reads are not graded.
  const fresh = () => ({ rank: null, out: [], draft: null, reranking: false, ticketOpen: null, done: [], log: [], flags: {}, pending: null, lastNote: null,
    stage: 'investigate', diagTries: [], evidence: [], fixTries: [], fix: null, prevention: [], refusals: [] });
  let st;
  try { st = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { st = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const act = (id) => S.actions.find(a => a.id === id);
  const isFinding = (a) => Object.prototype.hasOwnProperty.call(a, 'pointsTo');
  const hyp = (id) => S.hypotheses.find(h => h.id === id) || {};
  const hypLabel = (id) => hyp(id).label || '';
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const refusalText = (a) => a.refusal.replace(/^Not yet\.\s*/, '');
  const hypName = (id) => hyp(id).name || lower(hypLabel(id));
  const list = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const top = () => st.rank ? st.rank[0] : null;
  const CHEV = '<svg viewBox="0 0 12 20" aria-hidden="true" focusable="false"><path d="M2.5 2.5 9.5 10l-7 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const GRIP = '<svg viewBox="0 0 10 16" aria-hidden="true" focusable="false"><g fill="currentColor"><circle cx="2.5" cy="3" r="1.5"/><circle cx="7.5" cy="3" r="1.5"/><circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/><circle cx="2.5" cy="13" r="1.5"/><circle cx="7.5" cy="13" r="1.5"/></g></svg>';
  const Q = (t, id) => '<h2 class="q"' + (id ? ' id="' + id + '"' : '') + '>' + CHEV + '<span>' + t + '</span></h2>';

  // Evidence is told apart by typeface: what a person said is quoted text with the speaker's name; what a check showed is monospace
  const ASK = S.groups.find(g => g.id === 'ask');
  const speaker = ASK ? ASK.label.replace(/^Ask\s+/, '') : '';
  const isSaid = (a) => a.group === 'ask';
  const resultHTML = (a) => isSaid(a) ? '<p class="say">' + esc(speaker) + ': ' + esc(a.result) + '</p>' : '<p class="out">' + esc(a.result) + '</p>';

  $('course').textContent = S.course;
  $('tno').textContent = S.ticket;
  $('t-h').textContent = S.device;
  $('twho').textContent = 'Reported by ' + S.reportedBy;
  $('treport').textContent = '"' + S.report + '"';
  $('tarrive').innerHTML = S.arrival.map(a => '<li>' + esc(a) + '</li>').join('');
  $('ttoggle').addEventListener('click', () => { st.ticketOpen = !ticketOpen(); save(); renderTicket(); });
  const ticketOpen = () => st.ticketOpen === null || st.ticketOpen === undefined ? !st.rank : st.ticketOpen;
  function renderTicket() {
    const open = ticketOpen();
    $('twho').hidden = !open; $('tmore').hidden = !open;
    $('ttoggle').textContent = open ? 'Hide details' : 'Show full ticket';
    $('ttoggle').setAttribute('aria-expanded', String(open));
  }

  // Hypothesis strip: the top edge of the card. It shows the cause ranked first.
  function renderHyp() {
    const el = $('hyp');
    if (!st.rank) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const canChange = st.stage === 'investigate' && !st.reranking && !st.pending;
    const diagnosed = st.stage !== 'investigate' && st.stage !== 'diagnose';
    el.innerHTML = '<span class="lab">' + (diagnosed ? 'Cause' : 'Working hypothesis (your top cause)') + '</span>' +
      (canChange ? '<button class="pill" id="hyp-change" type="button">Change ranking</button>' : '<span></span>') +
      '<span class="txt">' + esc(hypLabel(diagnosed ? S.diagnosis.correct : shownTop())) + '</span>';
    const c = $('hyp-change'); if (c) c.addEventListener('click', openRerank);
  }
  // While the student is re-ranking, the strip follows the list so the two never disagree
  const shownTop = () => st.draft && (st.pending || st.reranking) ? st.draft.order.filter(id => !st.draft.out.includes(id))[0] : top();
  function openRerank() {
    st.reranking = true; st.lastNote = null; save(); render();
    const h = $('wbody').querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  // The ranking list. Working copy lives in st.draft until the student saves it.
  function draft() {
    if (!st.draft) st.draft = { order: (st.rank || S.hypotheses.map(h => h.id)).slice(), out: st.out.slice() };
    return st.draft;
  }
  function rankHTML() {
    const d = draft();
    const live = d.order.filter(id => !d.out.includes(id));
    const gone = d.order.filter(id => d.out.includes(id));
    const n = live.length;
    let h = '<ol class="rank" id="rank" aria-describedby="rank-help">' + live.map((id, i) =>
      '<li class="rrow' + (i === 0 ? ' first' : '') + '" data-id="' + id + '">' +
      '<span class="grip" title="Drag to reorder">' + GRIP + '</span>' +
      '<span class="num" aria-hidden="true">' + (i + 1) + '</span>' +
      '<span class="t">' + esc(hypLabel(id)) + (i === 0 ? '<span class="tag1">Most likely</span>' : '') + '</span>' +
      '<span class="ctl">' +
      '<button type="button" class="mv" data-mv="up" data-id="' + id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up: ' + esc(hypLabel(id)) + '">↑</button>' +
      '<button type="button" class="mv" data-mv="down" data-id="' + id + '"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move down: ' + esc(hypLabel(id)) + '">↓</button>' +
      '<button type="button" class="link sm" data-out="' + id + '"' + (n < 2 ? ' disabled' : '') + ' aria-label="Rule out: ' + esc(hypLabel(id)) + '">Rule out</button>' +
      '</span></li>').join('') + '</ol>';
    if (gone.length) h += '<p class="gone-h">Ruled out</p><ul class="rank out">' + gone.map(id =>
      '<li class="rrow off" data-id="' + id + '"><span class="t"><span class="gone">' + esc(hypLabel(id)) + '</span></span>' +
      '<span class="ctl"><button type="button" class="link sm" data-in="' + id + '" aria-label="Bring back: ' + esc(hypLabel(id)) + '">Bring back</button></span></li>').join('') + '</ul>';
    return h;
  }
  // Wires up the list inside container el; focusSel restores focus after a re-render
  function bindRank(el) {
    const d = draft();
    const redraw = (focusSel, msg) => {
      save();
      el.innerHTML = rankHTML(); bindRank(el); renderHyp();
      if (focusSel) { let f = el.querySelector(focusSel); if (f && f.disabled) f = f.closest('li').querySelector('button:not(:disabled)'); if (f) f.focus(); }
      if (msg) $('sr-status').textContent = msg;
    };
    const liveIds = () => d.order.filter(id => !d.out.includes(id));
    const pos = (id) => liveIds().indexOf(id) + 1;
    el.querySelectorAll('button.mv').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id, live = liveIds(), i = live.indexOf(id), j = b.dataset.mv === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= live.length) return;
      const other = live[j];
      const a = d.order.indexOf(id), c = d.order.indexOf(other);
      d.order[a] = other; d.order[c] = id;
      redraw('button[data-mv="' + b.dataset.mv + '"][data-id="' + id + '"]', hypLabel(id) + ': now number ' + pos(id) + ' of ' + liveIds().length + '.');
    }));
    el.querySelectorAll('button[data-out]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.out; if (liveIds().length < 2) return;
      d.out.push(id);
      redraw('button[data-in="' + id + '"]', hypLabel(id) + ': ruled out. Moved to the Ruled out list.');
    }));
    el.querySelectorAll('button[data-in]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.in;
      d.out = d.out.filter(x => x !== id);
      d.order = d.order.filter(x => x !== id); d.order.push(id);
      redraw('button[data-out="' + id + '"]', hypLabel(id) + ': back in the list at number ' + pos(id) + '.');
    }));
    // Drag to reorder: mouse from anywhere on the row, touch and pen from the grip (so the page can still scroll)
    const ol = el.querySelector('#rank');
    ol.querySelectorAll('li.rrow').forEach(li => li.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button > 0) return;
      if (e.pointerType !== 'mouse' && !e.target.closest('.grip')) return;
      e.preventDefault();
      // Listen on the window: moving the row in the page drops pointer capture.
      // The grabbed tile follows the pointer; the others slide out of its way (no slide when the student prefers reduced motion).
      li.classList.add('dragging'); ol.classList.add('sorting');
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const grab = e.clientY - li.getBoundingClientRect().top;
      const place = (y) => {
        const want = y - grab - ol.getBoundingClientRect().top;
        const top = Math.max(0, Math.min(ol.offsetHeight - li.offsetHeight, want));
        li.style.transform = 'translateY(' + (top - li.offsetTop) + 'px)';
        return top;
      };
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        const center = place(ev.clientY) + li.offsetHeight / 2;
        const sibs = [...ol.children].filter(x => x !== li);
        const before = sibs.find(x => center < x.offsetTop + x.offsetHeight / 2);
        const stay = before ? li.nextElementSibling === before : ol.lastElementChild === li;
        if (stay) return;
        const was = new Map(sibs.map(x => [x, x.offsetTop]));
        if (before) ol.insertBefore(li, before); else ol.appendChild(li);
        [...ol.children].forEach((x, i) => { x.querySelector('.num').textContent = i + 1; x.classList.toggle('first', i === 0); });
        place(ev.clientY);
        if (calm) return;
        sibs.forEach(x => {
          const dy = was.get(x) - x.offsetTop; if (!dy) return;
          x.style.transition = 'none'; x.style.transform = 'translateY(' + dy + 'px)';
          void x.offsetWidth;
          x.style.transition = 'transform .15s ease-out'; x.style.transform = '';
        });
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        li.style.transform = '';
        const live = [...ol.children].map(x => x.dataset.id);
        d.order = live.concat(d.order.filter(id => d.out.includes(id)));
        redraw(null, hypLabel(li.dataset.id) + ': now number ' + pos(li.dataset.id) + ' of ' + live.length + '.');
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }));
  }
  const RANK_HELP = '<p class="hint" id="rank-help" style="margin:0 0 10px">Drag a cause to reorder, or use its arrow buttons. Your top cause is the one you test.</p>';
  // Saves the draft as the ranking and returns what changed, for the case record
  function commitRank() {
    const d = draft();
    const live = d.order.filter(id => !d.out.includes(id));
    const prevTop = top();
    const newOut = d.out.filter(id => !st.out.includes(id));
    st.rank = live.concat(d.out); st.out = d.out.slice(); st.draft = null;
    return { order: live.slice(), out: st.out.slice(), newOut, was: prevTop };
  }

  // Start of the ticket: a first ranking from the ticket alone
  function workFirstRank() {
    const w = $('wbody');
    w.innerHTML = Q('Rank the causes, most likely first') +
      '<p style="margin:-4px 0 12px">From the ticket alone, which cause seems most likely? A guess is fine. You\'ll re-rank after every answer and check.</p>' + RANK_HELP +
      '<div id="rank-box">' + rankHTML() + '</div><div class="row"><button class="primary" type="button" id="rank-save">Start with this ranking</button></div>';
    bindRank($('rank-box'));
    $('rank-save').addEventListener('click', () => {
      const r = commitRank();
      st.log.push({ type: 'rank', first: true, rank: r });
      if (st.ticketOpen === null || st.ticketOpen === undefined) st.ticketOpen = false;
      save(); render();
      $('sr-status').textContent = 'Ranking saved. Working hypothesis: ' + hypLabel(top()) + '.';
    });
  }
  // Re-ranking whenever the student chooses to, outside a result
  function workRerank() {
    const w = $('wbody');
    w.innerHTML = Q('Change your ranking') + RANK_HELP + '<div id="rank-box">' + rankHTML() + '</div>' +
      '<div class="row"><button class="primary" type="button" id="rank-save">Save ranking</button><button type="button" id="rank-cancel">Cancel</button></div>';
    bindRank($('rank-box'));
    $('rank-save').addEventListener('click', () => {
      const r = commitRank();
      if (r.was !== top() || r.newOut.length) st.log.push({ type: 'rank', rank: r });
      st.reranking = false; save(); render();
      $('sr-status').textContent = 'Ranking saved. Working hypothesis: ' + hypLabel(top()) + '.';
    });
    $('rank-cancel').addEventListener('click', () => { st.draft = null; st.reranking = false; save(); render(); const c = $('hyp-change'); if (c) c.focus(); });
  }

  // How a ranking step reads in the case record on the page
  function rankLine(r, first) {
    if (first) return 'Starting ranking: ' + r.order.map((id, i) => (i + 1) + '. ' + hypName(id)).join(', ');
    let s = r.was && r.was !== r.order[0] ? 'Top cause now: ' + hypName(r.order[0]) + ' (was ' + hypName(r.was) + ')' : 'Top cause still: ' + hypName(r.order[0]);
    if (r.newOut.length) s += '. Ruled out: ' + list(r.newOut.map(hypName));
    return s + '.';
  }
  function renderLog() {
    const items = []; let n = 0;
    st.log.forEach((e, i) => {
      const cls = i === st.log.length - 1 ? ' class="new"' : '';
      if (e.type === 'rank') { items.push('<li' + cls + '><div class="hl"><span class="dot" aria-hidden="true"></span><span>' + esc(rankLine(e.rank, e.first)) + '</span></div></li>'); return; }
      const a = act(e.id);
      if (e.type === 'refused') { items.push('<li' + cls + '><div class="q">Tried: ' + esc(a.label) + '</div><p class="rd">Not done yet. ' + esc(refusalText(a)) + '</p></li>'); return; }
      n++;
      let h = '<li' + cls + '><div class="q">' + n + '. ' + esc(a.label) + '</div>';
      if (isFinding(a) && !e.rank) h += resultHTML(a) + '<p class="rd">Waiting for your ranking →</p>';
      else { h += resultHTML(a); if (e.rank) h += '<div class="hl"><span class="dot" aria-hidden="true"></span><span>' + esc(rankLine(e.rank)) + '</span></div>'; }
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
      lc.innerHTML = '<button class="pill" type="button" id="copy-log">Copy the case record</button><span class="hint" id="copied-log" role="status"></span>';
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
    st.log.push({ type: 'action', id, hyp: top() });
    st.lastNote = null;
    if (isFinding(a)) st.pending = id;
    save(); render();
  }

  // A new result: show it, then the ranking to update. Nothing here is graded.
  function workResult() {
    const w = $('wbody');
    const a = act(st.pending);
    w.innerHTML = Q(esc(a.label)) + '<div id="res" style="margin:-6px 0 20px 24px">' + resultHTML(a) + '</div>' +
      '<h3 class="sub" id="rank-h">Does this change your ranking?</h3>' + RANK_HELP +
      '<div id="rank-box">' + rankHTML() + '</div>' +
      '<div class="row"><button class="primary" type="button" id="rank-save">Save ranking</button><span class="hint" style="margin:0">If nothing changes, save it as it is.</span></div>';
    flashOnce('r' + st.log.length, [$('res')]);
    bindRank($('rank-box'));
    $('rank-save').addEventListener('click', () => {
      const entry = st.log.slice().reverse().find(x => x.type === 'action' && x.id === st.pending);
      entry.rank = commitRank();
      st.lastNote = { id: a.id };
      st.pending = null; save(); render();
    });
  }

  function workInvestigate() {
    const w = $('wbody');
    if (!st.rank) { workFirstRank(); return; }
    if (st.pending) { workResult(); return; }
    if (st.reranking) { workRerank(); return; }
    let h = '';
    if (st.lastNote && st.lastNote.refused) {
      const r = act(st.lastNote.refused);
      h += '<div class="top-fb"><p><strong>Tried: ' + esc(r.label) + '</strong></p><p>Not done yet. ' + esc(refusalText(r)) + '</p></div>';
    }
    h += Q('What do you do next?');
    S.groups.forEach(g => {
      const gActs = S.actions.filter(a => a.group === g.id && !(a.hiddenWhen && st.flags[a.hiddenWhen]) && !(a.shownWhen && !st.flags[a.shownWhen]));
      h += '<div class="group"><h3>' + esc(g.label) + '</h3>';
      h += '<div class="actions">' + gActs.map(a => {
        const done = st.done.includes(a.id);
        const needs = (a.requires && !st.flags[a.requires]) || (a.forbiddenWhen && st.flags[a.forbiddenWhen]);
        // A check that can't be done yet is grayed out and marked Unavailable; working out why is part of the job
        const why = needs && !done ? 'Unavailable' : '';
        return '<button class="action' + (done ? ' done' : '') + (why ? ' blocked' : '') + '" data-id="' + a.id + '"' + ((done || why) ? ' disabled' : '') + '><span>' + esc(a.label) + (why ? '<span class="why">' + esc(why) + '</span>' : '') + '</span>' + (done ? '<span class="done-w">Done</span>' : '') + '</button>';
      }).join('') + '</div></div>';
    });
    const findings = st.done.filter(id => isFinding(act(id))).length;
    h += '<div class="row"><button class="primary" id="go-diag"' + (findings < S.minFindingsToDiagnose ? ' disabled' : '') + '>I know the cause</button>' +
      (findings < S.minFindingsToDiagnose ? '<span class="hint" style="margin:0">Gather at least ' + S.minFindingsToDiagnose + ' findings first.</span>' : '') + '</div>';
    w.innerHTML = h;
    if (st.lastNote) flashOnce('n' + st.log.length, w.querySelectorAll('.top-fb'));
    w.querySelectorAll('button.action').forEach(b => b.addEventListener('click', () => doAction(b.dataset.id)));
    const go = $('go-diag'); if (go) go.addEventListener('click', () => { st.lastNote = null; st.reranking = false; st.stage = 'diagnose'; save(); render(); });
  }

  const optLabel = (h, gone) => gone.has(h.id) ? '<span class="gone">' + esc(h.label) + '</span> <span class="muted">(you ruled this out)</span>' : esc(h.label);

  function workDiagnose() {
    const w = $('wbody');
    const found = st.done.filter(id => isFinding(act(id)));
    const gone = new Set(st.out);
    const last = st.diagTries[st.diagTries.length - 1];
    const bad = last && !last.ok ? (last.field || 'cause') : '';
    const fbIn = (f) => bad === f ? '<p class="err">' + (last.plain ? '' : 'Look again. ') + esc(last.msg) + '</p>' : '';
    const inv = (f) => bad === f ? ' class="invalid"' : '';
    w.innerHTML = Q('What is the cause?') + '<form id="diag" novalidate><fieldset' + inv('cause') + '><legend class="sr">Cause</legend>' + fbIn('cause') + '<div class="opts">' +
      S.hypotheses.map(x => '<label class="opt"><input type="radio" name="c" value="' + x.id + '"' + ((st.diagPick || top()) === x.id ? ' checked' : '') + '> <span class="t">' + optLabel(x, gone) + '</span></label>').join('') +
      '</div></fieldset><fieldset' + inv('evidence') + '><legend>Which findings support it? Choose the ones that matter. <span class="req">(required)</span></legend>' + fbIn('evidence') + '<div class="opts">' +
      found.map(id => { const a = act(id); return '<label class="opt"><input type="checkbox" name="e" value="' + id + '"' + ((st.diagEv || []).includes(id) ? ' checked' : '') + '> <span class="t">' + esc(a.label) + '<span class="line1' + (isSaid(a) ? '' : ' mono') + '">' + esc(isSaid(a) ? speaker + ': ' + a.result : a.result) + '</span></span></label>'; }).join('') +
      '</div></fieldset><div class="row"><button class="primary" type="submit">Submit diagnosis</button><button type="button" id="back">Keep investigating</button></div></form>';
    $('back').addEventListener('click', () => { st.diagPick = null; st.diagEv = null; st.stage = 'investigate'; save(); render(); });
    $('diag').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target); const c = fd.get('c'); const ev = fd.getAll('e');
      if (!c) { st.diagTries.push({ ok: false, field: 'cause', plain: true, msg: 'Choose the cause.' }); save(); render(); return; }
      if (c !== S.diagnosis.correct) { st.diagTries.push({ cause: c, ok: false, field: 'cause', msg: S.diagnosis.feedback[c] + ' Keep investigating, or choose again.' }); st.diagPick = c; st.diagEv = ev; save(); render(); return; }
      if (!ev.length) { st.diagTries.push({ cause: c, ok: false, field: 'evidence', plain: true, msg: 'Choose the findings that support this cause.' }); st.diagPick = c; st.diagEv = ev; save(); render(); return; }
      if (!ev.some(x => S.diagnosis.keyEvidence.includes(x))) { st.diagTries.push({ cause: c, ok: false, field: 'evidence', msg: S.diagnosis.evidenceFeedback }); st.diagPick = c; st.diagEv = ev; save(); render(); return; }
      st.diagTries.push({ cause: c, ok: true }); st.diagPick = null; st.diagEv = null; st.evidence = ev; st.stage = 'fix'; save(); render();
    });
  }

  function workFix() {
    const w = $('wbody');
    const last = st.fixTries[st.fixTries.length - 1];
    const fb = last && !last.ok ? '<p class="err">' + (last.plain ? '' : 'Look again. ') + esc(last.msg) + '</p>' : '';
    w.innerHTML = Q('What will you do?') + '<form id="fix" novalidate><fieldset' + (last && !last.ok ? ' class="invalid"' : '') + '><legend class="sr">Fix</legend>' + fb + '<div class="opts">' +
      S.fixes.map(x => '<label class="opt"><input type="radio" name="f" value="' + x.id + '"> <span class="t">' + esc(x.label) + '</span></label>').join('') +
      '</div></fieldset><div class="row"><button class="primary" type="submit">Make the fix</button></div></form>';
    $('fix').addEventListener('submit', e => {
      e.preventDefault();
      const v = (new FormData(e.target)).get('f'); if (!v) { st.fixTries.push({ ok: false, plain: true, msg: 'Choose a fix.' }); save(); render(); return; }
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

  const rankPlain = (r) => r.order.map((id, i) => (i + 1) + '. ' + hypLabel(id)).join('; ') + (r.out.length ? ' | Ruled out: ' + r.out.map(hypLabel).join('; ') : '');
  function record() {
    const L = [S.course + ', ' + S.ticket + ': ' + S.device, 'Reported by ' + S.reportedBy + ': "' + S.report + '"', '', 'INVESTIGATION'];
    let n = 0;
    st.log.forEach(e => {
      if (e.type === 'rank') { L.push('  ' + (e.first ? 'Starting ranking' : 'Re-ranked') + ': ' + rankPlain(e.rank)); return; }
      const a = act(e.id);
      if (e.type === 'refused') { L.push('  Tried: ' + a.label + ' (not done yet: premature)'); return; }
      n++; L.push('  ' + n + '. ' + a.label); L.push('     Result: ' + (isSaid(a) ? speaker + ': ' : '') + a.result);
      if (e.rank) L.push('     My ranking after this: ' + rankPlain(e.rank));
    });
    const wrong = st.diagTries.filter(d => !d.ok && d.cause && d.cause !== S.diagnosis.correct).map(d => hypLabel(d.cause));
    L.push('', 'DIAGNOSIS: ' + hypLabel(S.diagnosis.correct) + (wrong.length ? ' (earlier tries: ' + wrong.join('; ') + ')' : ''));
    L.push('  Supporting findings: ' + st.evidence.map(id => act(id).label).join('; '));
    L.push('FIX: ' + (S.fixes.find(f => f.id === st.fix) || {}).label);
    const wf = st.fixTries.filter(f => !f.ok && f.id).length;
    if (wf) L.push('  (' + wf + ' other fix' + (wf > 1 ? 'es' : '') + ' tried first)');
    L.push('VERIFY: ' + S.verify);
    L.push('PREVENTION: ' + (st.prevention.map(id => S.prevention.find(p => p.id === id).label).join('; ') || 'none chosen'));
    return L.join('\n');
  }

  function workDebrief() {
    const w = $('wbody');
    // Each prevention choice is named with its feedback; good steps the student skipped are offered as "You could also"
    const prevFb = S.prevention.map(p => {
      if (st.prevention.includes(p.id)) return '<li>You chose: ' + esc(lower(p.label)) + '. ' + esc(p.feedback) + '</li>';
      return p.good ? '<li>You could also: ' + esc(lower(p.label)) + '.</li>' : '';
    }).join('');
    w.innerHTML = Q('Ticket closed') + '<div class="row" style="margin:0 0 18px"><button class="primary" id="copy">Copy the case record</button><span id="copied" class="hint" role="status" style="margin:0">Paste it into your template.</span></div>' + '<p class="stage-title" style="margin-top:0">What was wrong</p><p style="margin:0">' + esc(S.debrief.summary) + '</p>' +
      '<p class="stage-title">The checks that mattered most</p><ul class="debrief-list">' + S.debrief.mostInformative.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<p class="hint">' + esc(S.debrief.note) + '</p>' +
      (prevFb ? '<p class="stage-title">Keeping it from coming back</p><ul class="debrief-list">' + prevFb + '</ul>' : '');
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
      out.textContent = ok ? 'Copied.' : "Couldn't copy. Select the case record and press Ctrl+C (or Cmd+C).";
    };
    try { navigator.clipboard.writeText(text).then(() => { out.textContent = 'Copied.'; }, fallback); } catch (e) { fallback(); }
  }

  // Highlight new text once; a re-render of the same screen doesn't repeat it
  let lastFlash = null, ticketFlashed = false;
  function flashOnce(key, els) {
    if (key === lastFlash) return;
    lastFlash = key;
    els.forEach(el => { if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
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
    if (!st.rank && !st.log.length && !ticketFlashed) { ticketFlashed = true; const tk = document.querySelector('.a-ticket'); tk.classList.remove('flash'); void tk.offsetWidth; tk.classList.add('flash'); }
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
    $('restart-yes').addEventListener('click', () => { st = fresh(); ticketFlashed = false; lastFlash = null; save(); renderRestart(false); render(); window.scrollTo(0, 0); $('restart').focus(); });
    $('restart-no').addEventListener('click', () => { renderRestart(false); $('restart').focus(); });
    $('restart-yes').focus();
  }
  const help = $('help');
  $('help-open').addEventListener('click', () => { help.showModal(); $('help-close').focus(); });
  $('help-close').addEventListener('click', () => help.close());
  help.addEventListener('click', e => { if (e.target === help) help.close(); }); // a click on the dimmed page outside the panel closes it
  help.addEventListener('close', () => $('help-open').focus());
  renderRestart(false);
  render();
})();

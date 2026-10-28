import { PONG_RULES } from './pong-engine.js';

const API = '/api/pong/rooms';
const SESSION_PREFIX = 'qadam-pong:room:';
const ACTIVE_SESSION = 'qadam-pong:active';
const memorySessions = new Map();
const glyph = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const roomCode = value => /^[A-Z0-9]{6}$/.test(String(value ?? '').toUpperCase()) ? String(value).toUpperCase() : '';

function sessionValue(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key) ?? memorySessions.get(key) ?? null;
    if (value === null) { sessionStorage.removeItem(key); memorySessions.delete(key); }
    else { sessionStorage.setItem(key, value); memorySessions.set(key, value); }
  } catch {
    if (value === undefined) return memorySessions.get(key) ?? null;
    if (value === null) memorySessions.delete(key); else memorySessions.set(key, value);
  }
  return value;
}

function readSession(code) {
  try {
    const parsed = JSON.parse(sessionValue(SESSION_PREFIX + code) || 'null');
    if (parsed && parsed.code === code && ['left','right'].includes(parsed.side) && typeof parsed.token === 'string' && parsed.token.length > 10) {
      return { ...parsed, seq:Number.isSafeInteger(parsed.seq) && parsed.seq >= 0 ? parsed.seq : 0 };
    }
  } catch { /* An invalid tab-local session does not prevent joining a new room. */ }
  return null;
}

export function renderPongLobby() {
  return `<section class="pong-root" data-pong-root aria-label="Онлайн Pong">
    <div data-pong-lobby>
      <div class="pong-intro"><div><span class="pong-eyebrow">PONG · 1 VS 1</span><h2>Бір код. Екі ойыншы.</h2><p>Досыңды бөлмеге шақыр. Допты қайтарып, алғашқы ${PONG_RULES.scoreToWin} ұпайға жет.</p></div><span class="pong-format">${glyph('monitor')}Екі құрылғыда</span></div>
      <div class="pong-lobby-grid">
        <section class="panel pong-entry"><div class="pong-entry-icon">${glyph('gamepad-2')}</div><h3>Ойынға қосыл</h3><p>Екеуің де осы сайтты ашып, бір бөлме кодын қолданасыңдар.</p>
          <label class="form-label" for="pong-name">Ойындағы атың</label><input class="form-control" id="pong-name" data-pong-name name="pong-name" autocomplete="nickname" placeholder="Сені қалай атаймыз?" minlength="1" maxlength="20" required>
          <form data-pong-create><button type="submit" class="btn btn-primary pong-create">${glyph('plus')}Бөлме ашу${glyph('arrow-right')}</button></form>
          <div class="pong-divider"><span>немесе кодпен қосыл</span></div>
          <form data-pong-join class="pong-join"><label class="form-label" for="pong-code">Бөлме коды</label><div><input class="form-control pong-code-input" id="pong-code" data-pong-code autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" maxlength="6" pattern="[A-Za-z0-9]{6}" required aria-describedby="pong-code-help"><button type="submit" class="btn btn-outline" aria-label="Кодпен бөлмеге қосылу">${glyph('log-in')}Қосылу</button></div><small id="pong-code-help">Досың жіберген 6 таңбалы кодты енгіз.</small></form>
          <div class="pong-message" data-pong-message role="status" aria-live="polite" hidden></div>
        </section>
        <aside class="panel pong-guide"><div class="pong-mini-court" aria-hidden="true"><span></span><i></i><b></b><em></em></div><span class="pong-eyebrow">ҚАЛАЙ ОЙНАЙМЫЗ?</span><h3>Қарапайым ереже.<br>Шынайы бәсеке.</h3><ol><li><span>01</span><div><strong>Бөлмені бөліс</strong><p>Кодты досыңа жібер. Ол басқа құрылғыдан қосылсын.</p></div></li><li><span>02</span><div><strong>Қалақшаны басқар</strong><p><kbd>W</kbd> / <kbd>S</kbd> немесе <kbd>↑</kbd> / <kbd>↓</kbd>. Телефонда алаңды сүйре.</p></div></li><li><span>03</span><div><strong>${PONG_RULES.scoreToWin} ұпай жина</strong><p>Доп қарсыластың шекарасынан өтсе, ұпай аласың.</p></div></li></ol><p class="pong-network-note">${glyph('wifi')}Екі ойыншыға да интернет байланысы қажет.</p></aside>
      </div>
    </div>
    <section class="panel pong-room" data-pong-room hidden aria-label="Pong бөлмесі">
      <header class="pong-room-bar"><div class="pong-room-identity"><span class="pong-eyebrow">ЖЕКЕ БӨЛМЕ</span><strong data-pong-room-code>—</strong><button type="button" class="icon-btn" data-pong-action="copy-code" aria-label="Бөлме кодын көшіру" title="Кодты көшіру">${glyph('copy')}</button></div><div class="pong-room-actions"><button type="button" class="btn btn-quiet" data-pong-action="copy-link">${glyph('link')}Шақыру сілтемесі</button><button type="button" class="btn btn-outline" data-pong-action="leave">${glyph('log-out')}Шығу</button></div></header>
      <div class="pong-scoreboard"><div class="pong-player pong-player-left"><span class="pong-player-indicator"></span><div><strong data-pong-name-left>Ойыншы</strong><span data-pong-connection-left>Қосылуда</span></div><span class="pong-you" data-pong-you-left hidden>СЕН</span></div><div class="pong-score" aria-label="Ойын есебі"><strong data-pong-score-left>—</strong><span>:</span><strong data-pong-score-right>—</strong><small>${PONG_RULES.scoreToWin} ҰПАЙҒА ДЕЙІН</small></div><div class="pong-player pong-player-right"><span class="pong-you" data-pong-you-right hidden>СЕН</span><div><strong data-pong-name-right>Қарсылас күтілуде</strong><span data-pong-connection-right>Бос орын</span></div><span class="pong-player-indicator"></span></div></div>
      <div class="pong-court-wrap"><canvas class="pong-canvas" data-pong-canvas width="960" height="540" tabindex="0" aria-label="Pong ойын алаңы. Басқару үшін осы алаңды таңда, кейін W, S немесе жоғары, төмен пернелерін қолдан." aria-describedby="pong-controls-help"></canvas><div class="pong-court-overlay" data-pong-overlay><span class="pong-overlay-symbol" data-pong-overlay-symbol>↗</span><h3 data-pong-overlay-title>Бөлмеге қосылуда…</h3><p data-pong-overlay-text>Сервер жауабын күтеміз.</p></div><span class="pong-court-focus">Басқару үшін алаңды бас</span></div>
      <div class="pong-room-status"><span class="pong-status-dot" data-pong-status-dot></span><span data-pong-status role="status" aria-live="polite">Бөлмеге қосылуда…</span><span class="pong-side-label" data-pong-side></span></div>
      <div class="pong-network-error" data-pong-network-error role="status" aria-live="polite" hidden></div>
      <div class="pong-controls" id="pong-controls-help"><div class="pong-control-copy">${glyph('keyboard')}<span>Алаңды таңда, кейін <kbd>W</kbd> / <kbd>S</kbd> не <kbd>↑</kbd> / <kbd>↓</kbd><small>Сенің қалақшаң ғана басқарылады. Телефонда алаңды сүйреуге болады.</small></span></div><div class="pong-touch-buttons" aria-label="Қалақшаны басқару"><button type="button" class="btn btn-outline" data-pong-direction="-1" aria-label="Қалақшаны жоғары жылжыту">${glyph('arrow-up')}Жоғары</button><button type="button" class="btn btn-outline" data-pong-direction="1" aria-label="Қалақшаны төмен жылжыту">${glyph('arrow-down')}Төмен</button></div></div>
      <div class="pong-rematch" data-pong-rematch hidden><div><strong data-pong-result-title>Ойын аяқталды</strong><p data-pong-rematch-note>Екі ойыншы да дайын болса, жаңа ойын басталады.</p></div><button type="button" class="btn btn-primary" data-pong-action="rematch">${glyph('rotate-ccw')}Тағы ойнау</button></div>
    </section>
  </section>`;
}

export function mountPong(host, options = {}) {
  if (!host) return () => {};
  if (!host.matches('[data-pong-root]') && !host.querySelector('[data-pong-root]')) host.innerHTML = renderPongLobby();
  const root = host.matches('[data-pong-root]') ? host : host.querySelector('[data-pong-root]');
  const find = selector => root.querySelector(selector);
  const lobby = find('[data-pong-lobby]'), room = find('[data-pong-room]'), canvas = find('[data-pong-canvas]');
  const context = canvas.getContext('2d');
  const nameInput = find('[data-pong-name]'), codeInput = find('[data-pong-code]');
  const listeners = [], controllers = new Set(), pressedKeys = new Set();
  let session = null, snapshot = null, previousSnapshot = null, receivedAt = 0;
  let destroyed = false, busy = false, syncInFlight = false, pendingNeutral = false;
  let pollTimer = null, animation = null, lastSyncSent = 0, failures = 0, networkIssue = '';
  let roomNotice = '', noticeUntil = 0;
  let heldDirection = 0, dragTarget = null, desiredDirection = 0, directionChangedAt = 0;

  const setText = (selector, value) => { const element = find(selector); if (element && element.textContent !== String(value)) element.textContent = String(value); };
  const on = (target, type, listener, config) => { target.addEventListener(type, listener, config); listeners.push(() => target.removeEventListener(type, listener, config)); };
  const icons = () => globalThis.lucide?.createIcons({ attrs:{ 'stroke-width':1.65 } });
  const rules = () => ({ ...PONG_RULES, ...(snapshot?.rules || {}) });
  const visible = () => document.visibilityState !== 'hidden';

  function message(text, tone = 'error') {
    const element = find('[data-pong-message]');
    element.textContent = text;
    element.dataset.tone = tone;
    element.hidden = !text;
  }

  function saveSession() {
    if (!session) return;
    sessionValue(SESSION_PREFIX + session.code, JSON.stringify(session));
    sessionValue(ACTIVE_SESSION, session.code);
  }

  function clearSession() {
    if (session) sessionValue(SESSION_PREFIX + session.code, null);
    sessionValue(ACTIVE_SESSION, null);
    session = null;
  }

  function updateRoute(code = '') {
    const url = new URL(location.href);
    url.hash = code ? 'battles/' + code : 'battles';
    history.replaceState(history.state, '', url);
  }

  function showRoom() {
    lobby.hidden = true;
    room.hidden = false;
    setText('[data-pong-room-code]', session.code);
    setText('[data-pong-side]', session.side === 'left' ? 'Сен — сол жақта' : 'Сен — оң жақта');
    for (const side of ['left','right']) find('[data-pong-you-' + side + ']').hidden = side !== session.side;
    icons();
  }

  function setBusy(value) {
    busy = value;
    for (const button of root.querySelectorAll('[data-pong-create] button,[data-pong-join] button')) button.disabled = value;
  }

  function errorMessage(error) {
    if (error.name === 'AbortError') return 'Сервер жауабы кешікті. Интернет байланысын тексеріп, қайта байқап көр.';
    if (error.status === 401) return 'Бөлме сессиясы жарамсыз. Кодпен қайта қосыл.';
    if (error.status === 404 || error.status === 410) return 'Бөлме табылмады немесе оның уақыты аяқталған. Жаңа бөлме аш.';
    if (error.status === 429) return 'Сұраулар тым жиі жіберілді. Бір сәттен кейін қайта қосыламыз.';
    if (error.status === 503) return 'Онлайн ойын сервисі әзірге қолжетімсіз. Сәл кейін қайта байқап көр.';
    if (error.serverMessage) return error.serverMessage;
    return 'Серверге қосылу мүмкін болмады. Интернет байланысын тексер.';
  }

  async function request(path = '', body, authenticated = true, keepalive = false) {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const headers = { Accept:'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (authenticated && session) headers.Authorization = 'Bearer ' + session.token;
      const response = await fetch(API + path, { method:body === undefined ? 'GET' : 'POST', headers, body:body === undefined ? undefined : JSON.stringify(body), signal:controller.signal, cache:'no-store', credentials:'same-origin', keepalive });
      let result;
      try { result = await response.json(); } catch { throw Object.assign(new Error('Invalid server response'), { status:503 }); }
      if (!response.ok) throw Object.assign(new Error('Pong API error'), { status:response.status, code:result.code, serverMessage:typeof result.error === 'string' ? result.error : '' });
      return result;
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  function accept(result) {
    if (destroyed || !session) return;
    if (result?.code !== session.code || !['left','right'].includes(result.side) || !result.state || !result.players || !['waiting','playing','finished'].includes(result.state.phase) || !result.state.paddles || !result.state.ball) {
      throw Object.assign(new Error('Unexpected Pong state'), { status:503 });
    }
    session.side = result.side;
    if (Number.isSafeInteger(result.ackSeq)) session.seq = Math.max(session.seq, result.ackSeq);
    if (snapshot && result.round === snapshot.round && Number.isFinite(result.version) && result.version < snapshot.version) return;
    previousSnapshot = snapshot;
    snapshot = result;
    receivedAt = performance.now();
    failures = 0;
    networkIssue = '';
    saveSession();
    updateRoom();
  }

  function updateRoom() {
    if (!snapshot || !session) return;
    const { state, players } = snapshot;
    setText('[data-pong-side]', session.side === 'left' ? 'Сен — сол жақта' : 'Сен — оң жақта');
    for (const side of ['left','right']) {
      find('[data-pong-you-' + side + ']').hidden = side !== session.side;
      const player = players[side];
      setText('[data-pong-name-' + side + ']', player?.name || 'Қарсылас күтілуде');
      setText('[data-pong-connection-' + side + ']', !player ? 'Бос орын' : player.connected ? 'Байланыс бар' : 'Байланыс үзілді');
      setText('[data-pong-score-' + side + ']', state.score[side]);
      find('.pong-player-' + side).classList.toggle('is-connected', Boolean(player?.connected));
    }
    const finished = state.phase === 'finished';
    find('[data-pong-rematch]').hidden = !finished;
    const rematch = find('[data-pong-action="rematch"]');
    rematch.disabled = Boolean(players[session.side]?.ready);
    if (finished) {
      const winner = players[state.winner]?.name || 'Ойыншы';
      setText('[data-pong-result-title]', state.winner === session.side ? 'Жеңіс сенікі!' : winner + ' жеңді');
      setText('[data-pong-rematch-note]', players[session.side]?.ready ? 'Сен дайынсың. Қарсыластың жауабын күтеміз.' : 'Екеуің де «Тағы ойнау» батырмасын басқанда жаңа ойын басталады.');
    }
    updateStatus();
  }

  function updateStatus(now = performance.now()) {
    if (!session) return;
    const state = snapshot?.state;
    const stale = Boolean(snapshot && now - receivedAt > 2500);
    const issue = networkIssue || (stale ? 'Сервермен байланыс кешігіп жатыр. Қайта қосылуда…' : '');
    const error = find('[data-pong-network-error]');
    error.hidden = !issue;
    if (error.textContent !== issue) error.textContent = issue;
    const status = !snapshot ? 'Бөлмеге қосылуда…' : issue ? 'Байланыс қалпына келуде' : snapshot.paused ? 'Қарсыластың байланысын күтеміз' : state.phase === 'waiting' ? 'Қарсылас күтілуде' : state.phase === 'finished' ? 'Ойын аяқталды' : state.serveRemaining > 0 ? 'Доп ойынға қосылуда' : 'Ойын жүріп жатыр';
    setText('[data-pong-status]', !issue && now < noticeUntil ? roomNotice : status);
    find('[data-pong-status-dot]').dataset.tone = !snapshot || issue || snapshot.paused || state.phase === 'waiting' ? 'waiting' : 'live';
    let title = '', description = '', symbol = '';
    if (!snapshot) { title = 'Бөлмеге қосылуда…'; description = 'Сервер жауабын күтеміз.'; symbol = '↗'; }
    else if (issue) { title = 'Байланысты қалпына келтірудеміз'; description = 'Осы бетті ашық қалдыр. Байланыс автоматты тексеріледі.'; symbol = '↻'; }
    else if (state.phase === 'waiting') { title = 'Досыңды шақыр'; description = session.code + ' кодын жібер. Ол қосылғанда ойын басталады.'; symbol = '＋'; }
    else if (state.phase === 'finished') { title = state.winner === session.side ? 'Жеңіс сенікі!' : (snapshot.players[state.winner]?.name || 'Қарсылас') + ' жеңді'; description = 'Нәтиже: ' + state.score.left + ' : ' + state.score.right; symbol = state.winner === session.side ? '★' : '↗'; }
    else if (snapshot.paused) { title = 'Ойын уақытша тоқтады'; description = 'Қарсылас қайта қосылғанда жалғасады.'; symbol = 'Ⅱ'; }
    else if (state.serveRemaining > 0) { title = String(Math.max(1, Math.ceil(state.serveRemaining - Math.min(0.1, (now - receivedAt) / 1000)))); description = 'Дайын бол'; symbol = ''; }
    const overlay = find('[data-pong-overlay]');
    overlay.hidden = !title;
    overlay.classList.toggle('is-countdown', Boolean(state?.phase === 'playing' && !snapshot?.paused && !issue && state.serveRemaining > 0));
    setText('[data-pong-overlay-title]', title);
    setText('[data-pong-overlay-text]', description);
    setText('[data-pong-overlay-symbol]', symbol);
    find('[data-pong-overlay-symbol]').hidden = !symbol;
  }

  function currentDirection() {
    if (!visible() || snapshot?.state.phase !== 'playing' || snapshot.paused) return 0;
    let direction = heldDirection;
    if (dragTarget !== null) {
      const y = snapshot.state.paddles[session.side].y;
      direction = Math.abs(dragTarget - y) <= 12 ? 0 : dragTarget < y ? -1 : 1;
    } else if (pressedKeys.size) {
      const up = pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp');
      const down = pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown');
      direction = up === down ? 0 : up ? -1 : 1;
    }
    if (direction !== desiredDirection) { desiredDirection = direction; directionChangedAt = performance.now(); }
    return direction;
  }

  function queueSync(delay) {
    clearTimeout(pollTimer);
    if (destroyed || !session || !visible()) return;
    pollTimer = setTimeout(() => sync(), delay);
  }

  async function sync(forceNeutral = false) {
    if (destroyed || !session || (!visible() && !forceNeutral)) return;
    if (syncInFlight || busy) { if (forceNeutral) pendingNeutral = true; return; }
    if (!Number.isSafeInteger(session.seq + 1)) { returnToLobby('Бөлме сессиясын жаңарту керек. Кодпен қайта қосыл.'); return; }
    syncInFlight = true;
    lastSyncSent = performance.now();
    const activeCode = session.code;
    const direction = forceNeutral ? 0 : currentDirection();
    const seq = ++session.seq;
    saveSession();
    try {
      const result = await request('/' + activeCode + '/sync', { direction, seq }, true, forceNeutral);
      if (session?.code === activeCode) accept(result);
    } catch (error) {
      if (destroyed || session?.code !== activeCode) return;
      failures++;
      if ([401,404,410].includes(error.status)) {
        returnToLobby(errorMessage(error));
      } else {
        networkIssue = errorMessage(error);
        updateStatus();
      }
    } finally {
      syncInFlight = false;
      if (destroyed || !session) return;
      if (pendingNeutral) { pendingNeutral = false; sync(true); }
      else {
        const interval = failures ? Math.min(5000, 500 * 2 ** Math.min(failures - 1, 4)) : snapshot?.state.phase === 'playing' ? 100 : 400;
        queueSync(Math.max(0, interval - (performance.now() - lastSyncSent)));
      }
    }
  }

  function stopControls() {
    pressedKeys.clear();
    heldDirection = 0;
    dragTarget = null;
    desiredDirection = 0;
    root.classList.remove('pong-control-active');
    for (const button of root.querySelectorAll('[data-pong-direction]')) button.classList.remove('is-pressed');
  }

  function returnToLobby(text = '', tone = 'error') {
    stopControls();
    clearTimeout(pollTimer);
    clearSession();
    snapshot = null;
    previousSnapshot = null;
    networkIssue = '';
    lobby.hidden = false;
    room.hidden = true;
    updateRoute();
    message(text, tone);
  }

  async function enter(kind) {
    if (busy || session) return;
    const name = nameInput.value.trim();
    if ([...name].length < 1 || [...name].length > 20) { message('Атыңды 1–20 таңбамен жаз.'); nameInput.focus(); return; }
    const code = roomCode(codeInput.value.trim());
    if (kind === 'join' && !code) { message('6 әріптен не саннан тұратын бөлме кодын енгіз.'); codeInput.focus(); return; }
    setBusy(true);
    message(kind === 'create' ? 'Бөлме ашылып жатыр…' : 'Бөлмеге қосылып жатырмыз…', 'info');
    try {
      const result = await request(kind === 'create' ? '' : '/' + code + '/join', { name }, false);
      if (destroyed) return;
      if (!roomCode(result.code) || !['left','right'].includes(result.side) || typeof result.token !== 'string') throw Object.assign(new Error('Missing room session'), { status:503 });
      session = { code:result.code, side:result.side, token:result.token, name, seq:Number.isSafeInteger(result.ackSeq) ? result.ackSeq : 0 };
      snapshot = null;
      previousSnapshot = null;
      accept(result);
      showRoom();
      updateRoute(session.code);
      message('');
      canvas.focus({ preventScroll:true });
    } catch (error) {
      if (!destroyed) { if (session) clearSession(); message(errorMessage(error)); }
    } finally {
      setBusy(false);
      if (session && !destroyed) queueSync(100);
    }
  }

  async function resume(saved) {
    session = saved;
    showRoom();
    try {
      const result = await request('/' + session.code);
      accept(result);
      if (!destroyed) { updateRoute(session.code); queueSync(0); }
    } catch (error) {
      if (destroyed) return;
      if ([401,404,410].includes(error.status)) returnToLobby(errorMessage(error));
      else { networkIssue = errorMessage(error); updateStatus(); queueSync(600); }
    }
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      roomNotice = 'Көшірілді. Досыңа жіберуге болады.';
      noticeUntil = performance.now() + 2500;
      updateStatus();
    } catch {
      roomNotice = 'Көшіру қолжетімсіз. Бөлме коды: ' + session.code;
      noticeUntil = performance.now() + 5000;
      updateStatus();
      const range = document.createRange();
      range.selectNodeContents(find('[data-pong-room-code]'));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    }
  }

  on(find('[data-pong-create]'), 'submit', event => { event.preventDefault(); enter('create'); });
  on(find('[data-pong-join]'), 'submit', event => { event.preventDefault(); enter('join'); });
  on(codeInput, 'input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  on(root, 'click', async event => {
    const button = event.target.closest('[data-pong-action]');
    if (!button || !session || busy) return;
    const action = button.dataset.pongAction;
    if (action === 'copy-code') return copy(session.code);
    if (action === 'copy-link') { const url = new URL(location.href); url.hash = 'battles/' + session.code; return copy(url.href); }
    if (action === 'leave') {
      setBusy(true);
      stopControls();
      let leaveFailed = false;
      try { await request('/' + session.code + '/leave', {}); }
      catch { leaveFailed = true; }
      finally { if (!destroyed) { returnToLobby(leaveFailed ? 'Осы құрылғыдағы бөлме жабылды. Серверге шығу хабарын жеткізу мүмкін болмады.' : 'Бөлмеден шықтың. Жаңа ойынға қосыла аласың.', 'info'); setBusy(false); } }
    }
    if (action === 'rematch') {
      button.disabled = true;
      try { accept(await request('/' + session.code + '/rematch', {})); }
      catch (error) { if (!destroyed) { networkIssue = errorMessage(error); updateStatus(); button.disabled = false; } }
    }
  });

  on(canvas, 'keydown', event => {
    if (!['KeyW','KeyS','ArrowUp','ArrowDown'].includes(event.code) || !session) return;
    event.preventDefault();
    pressedKeys.add(event.code);
    currentDirection();
    root.classList.add('pong-control-active');
  });
  on(canvas, 'keyup', event => {
    if (!['KeyW','KeyS','ArrowUp','ArrowDown'].includes(event.code)) return;
    event.preventDefault();
    pressedKeys.delete(event.code);
    currentDirection();
  });
  on(canvas, 'blur', () => { stopControls(); if (session) sync(true); });
  on(window, 'blur', () => { stopControls(); if (session) sync(true); });
  on(document, 'visibilitychange', () => {
    stopControls();
    clearTimeout(pollTimer);
    if (!session) return;
    if (visible()) queueSync(0); else sync(true);
  });

  function moveDrag(event) {
    const bounds = canvas.getBoundingClientRect();
    dragTarget = clamp((event.clientY - bounds.top) / bounds.height * rules().height, 0, rules().height);
    currentDirection();
  }
  on(canvas, 'pointerdown', event => {
    if (!session || event.button > 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll:true });
    canvas.setPointerCapture(event.pointerId);
    moveDrag(event);
    root.classList.add('pong-control-active');
  });
  on(canvas, 'pointermove', event => { if (canvas.hasPointerCapture(event.pointerId)) moveDrag(event); });
  const endDrag = () => { dragTarget = null; currentDirection(); };
  on(canvas, 'pointerup', endDrag);
  on(canvas, 'pointercancel', endDrag);
  on(canvas, 'lostpointercapture', endDrag);
  for (const button of root.querySelectorAll('[data-pong-direction]')) {
    on(button, 'pointerdown', event => {
      if (!session || event.button > 0) return;
      event.preventDefault();
      heldDirection = Number(button.dataset.pongDirection);
      button.setPointerCapture(event.pointerId);
      button.classList.add('is-pressed');
      currentDirection();
    });
    const release = () => { heldDirection = 0; button.classList.remove('is-pressed'); currentDirection(); };
    on(button, 'pointerup', release); on(button, 'pointercancel', release); on(button, 'lostpointercapture', release);
    on(button, 'keydown', event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); heldDirection = Number(button.dataset.pongDirection); currentDirection(); button.classList.add('is-pressed'); } });
    on(button, 'keyup', event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); release(); } });
    on(button, 'blur', release);
  }

  function draw(now) {
    if (destroyed) return;
    if (!room.hidden && visible() && context) {
      const settings = rules(), bounds = canvas.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * ratio)), height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.setTransform(width / settings.width, 0, 0, height / settings.height, 0, 0);
      context.fillStyle = '#090f1c'; context.fillRect(0, 0, settings.width, settings.height);
      const background = context.createRadialGradient(settings.width / 2, settings.height / 2, 10, settings.width / 2, settings.height / 2, settings.width * 0.65);
      background.addColorStop(0, '#14213a'); background.addColorStop(1, '#090f1c');
      context.fillStyle = background; context.fillRect(0, 0, settings.width, settings.height);
      context.strokeStyle = '#263751'; context.lineWidth = 1.5; context.strokeRect(18, 18, settings.width - 36, settings.height - 36);
      context.setLineDash([7,12]); context.beginPath(); context.moveTo(settings.width / 2, 26); context.lineTo(settings.width / 2, settings.height - 26); context.stroke(); context.setLineDash([]);
      context.beginPath(); context.arc(settings.width / 2, settings.height / 2, 60, 0, Math.PI * 2); context.strokeStyle = '#26375170'; context.stroke();
      if (snapshot) {
        const { state } = snapshot;
        const elapsed = state.phase === 'playing' && !snapshot.paused && !networkIssue ? Math.min(0.1, Math.max(0, (now - receivedAt) / 1000)) : 0;
        for (const side of ['left','right']) {
          const paddle = state.paddles[side];
          let y = paddle.y;
          if (side === session.side && elapsed > 0) y += currentDirection() * settings.paddleSpeed * Math.min(elapsed, Math.max(0, (now - directionChangedAt) / 1000));
          else if (previousSnapshot?.round === snapshot.round && previousSnapshot.state.phase === state.phase && elapsed > 0) y = previousSnapshot.state.paddles[side].y + (paddle.y - previousSnapshot.state.paddles[side].y) * Math.min(1, elapsed / 0.075);
          y = clamp(y, settings.paddleHeight / 2, settings.height - settings.paddleHeight / 2);
          context.shadowColor = side === 'left' ? '#4a88ff' : '#49d9a6'; context.shadowBlur = 16;
          context.fillStyle = side === 'left' ? '#78a9ff' : '#6ae4bb';
          context.fillRect(paddle.x - settings.paddleWidth / 2, y - settings.paddleHeight / 2, settings.paddleWidth, settings.paddleHeight);
          context.shadowBlur = 0;
        }
        const ball = state.ball;
        // Presentation only: bounded extrapolation never bounces, scores or decides a winner.
        const travel = state.serveRemaining > 0 ? 0 : elapsed;
        const x = clamp(ball.x + ball.vx * travel, settings.ballRadius, settings.width - settings.ballRadius);
        const y = clamp(ball.y + ball.vy * travel, settings.ballRadius, settings.height - settings.ballRadius);
        context.shadowColor = '#c5d9ff'; context.shadowBlur = 20; context.fillStyle = '#edf5ff';
        context.beginPath(); context.arc(x, y, settings.ballRadius, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
      }
      updateStatus(now);
    }
    animation = requestAnimationFrame(draw);
  }

  nameInput.value = [...String(options.name || '')].slice(0, 20).join('');
  const requestedCode = roomCode(options.roomCode);
  if (requestedCode) codeInput.value = requestedCode;
  const savedCode = requestedCode || roomCode(sessionValue(ACTIVE_SESSION));
  const saved = savedCode ? readSession(savedCode) : null;
  if (saved) { nameInput.value = saved.name || nameInput.value; resume(saved); }
  else if (requestedCode) message('Шақыру коды дайын. Атыңды жазып, «Қосылу» батырмасын бас.', 'info');
  icons();
  animation = requestAnimationFrame(draw);

  return () => {
    if (destroyed) return;
    destroyed = true;
    stopControls();
    clearTimeout(pollTimer);
    cancelAnimationFrame(animation);
    for (const remove of listeners) remove();
    for (const controller of controllers) controller.abort();
    if (session && Number.isSafeInteger(session.seq + 1)) {
      const seq = ++session.seq;
      saveSession();
      // Stop a held paddle when routing away; retain the tab-local room for resume.
      fetch(API + '/' + session.code + '/sync', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + session.token }, body:JSON.stringify({ direction:0, seq }), keepalive:true }).catch(() => {});
    }
  };
}

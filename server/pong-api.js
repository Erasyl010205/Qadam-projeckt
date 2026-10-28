import { PONG_RULES, createPongState, startPong, advancePong } from '../public/pong-engine.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const ROOM_TTL = 30 * 60 * 1000;
const CONNECTED_FOR = 3000;
const MAX_BODY = 1024;
const MAX_CATCH_UP = 2000;

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Vary': 'Authorization'
  } });
}

async function bodyOf(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new ApiError(415, 'JSON_REQUIRED', 'Сұрау JSON форматында болуы керек.');
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY) {
    throw new ApiError(413, 'BODY_TOO_LARGE', 'Сұрау тым үлкен.');
  }
  const reader = request.body?.getReader();
  let text = '', bytes = 0;
  const decoder = new TextDecoder();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY) { await reader.cancel(); throw new ApiError(413, 'BODY_TOO_LARGE', 'Сұрау тым үлкен.'); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
  }
  let value;
  try { value = JSON.parse(text || '{}'); } catch { throw new ApiError(400, 'INVALID_JSON', 'Сұрау форматы қате.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'INVALID_JSON', 'Сұрау форматы қате.');
  return value;
}

function nameOf(value) {
  if (typeof value !== 'string') throw new ApiError(400, 'NAME_REQUIRED', 'Ойыншы атын жаз.');
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name || [...name].length > 20) throw new ApiError(400, 'INVALID_NAME', 'Атың 1–20 таңбадан тұрсын.');
  return name;
}

function randomHex(size = 24) {
  return Array.from(crypto.getRandomValues(new Uint8Array(size)), n => n.toString(16).padStart(2, '0')).join('');
}
function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), n => ALPHABET[n % ALPHABET.length]).join('');
}
async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
function seed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
function changes(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0); }
function connected(player, now) { return Boolean(player && now - player.lastSeen <= CONNECTED_FOR); }
function player(name, hash, now) { return { name, hash, lastSeen: now, direction: 0, seq: 0, ready: false }; }

function publicRoom(row, room, side, now, token) {
  const players = {};
  for (const key of ['left', 'right']) {
    const p = room.players[key];
    players[key] = p ? { name: p.name, connected: connected(p, now), ready: p.ready } : null;
  }
  return {
    code: row.code, side, ...(token ? { token } : {}), state: room.state, rules: PONG_RULES,
    players, paused: room.paused, simulationTime: room.updatedAt, serverTime: now,
    inputs: { left: room.players.left?.direction || 0, right: room.players.right?.direction || 0 },
    ackSeq: room.players[side].seq,
    version: row.version, round: room.round, expiresAt: row.expires_at
  };
}

async function createRoom(db, request, input, clock) {
  const name = nameOf(input.name);
  const identity = request.headers.get('cf-connecting-ip') || request.headers.get('oai-authenticated-user-id') || 'local';
  const creator = await digest(identity);
  const now = clock();
  const count = await db.prepare('SELECT COUNT(*) AS total FROM pong_rooms WHERE creator_key = ? AND created_at > ?').bind(creator, now - 60000).first();
  if (Number(count?.total) >= 6) throw new ApiError(429, 'CREATE_LIMIT', 'Бір минуттан кейін жаңа бөлме ашып көр.');
  await db.prepare('DELETE FROM pong_rooms WHERE code IN (SELECT code FROM pong_rooms WHERE expires_at < ? LIMIT 20)').bind(now).run();
  const token = randomHex();
  const hash = await digest(token);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const createdAt = clock();
    const expiresAt = createdAt + ROOM_TTL;
    const room = { state: createPongState(seed()), players: { left: player(name, hash, createdAt), right: null }, updatedAt: createdAt, paused: false, round: 1 };
    const result = await db.prepare('INSERT OR IGNORE INTO pong_rooms (code, version, data, created_at, expires_at, creator_key) VALUES (?, 0, ?, ?, ?, ?)')
      .bind(code, JSON.stringify(room), createdAt, expiresAt, creator).run();
    if (changes(result) === 1) return json(publicRoom({ code, version: 0, expires_at: expiresAt }, room, 'left', clock(), token), 201);
  }
  throw new ApiError(503, 'CREATE_BUSY', 'Бөлме ашылмады. Қайта көр.');
}

function resumeRoom(room, now) {
  room.state.serveRemaining = PONG_RULES.servePause;
  Object.assign(room.state.ball, {
    x: PONG_RULES.width / 2, y: PONG_RULES.height / 2,
    vx: 0, vy: 0, speed: PONG_RULES.ballSpeed
  });
  room.updatedAt = Math.max(now, room.updatedAt);
}

function advanceRoom(room, now) {
  const bothPresent = connected(room.players.left, now) && connected(room.players.right, now);
  const paused = room.state.phase === 'playing' && !bothPresent;
  if (room.state.phase === 'playing' && !paused) {
    if (room.paused) {
      resumeRoom(room, now);
    }
    let remaining = Math.min(MAX_CATCH_UP, Math.max(0, now - room.updatedAt));
    const simulatedUntil = room.updatedAt + remaining;
    const inputs = {
      left: room.players.left?.direction || 0,
      right: room.players.right?.direction || 0
    };
    // The engine caps each call at 250 ms. Consume the elapsed clock in chunks
    // instead of silently discarding everything after the first capped call.
    while (remaining > 0) {
      const milliseconds = Math.min(PONG_RULES.maxFrameTime * 1000, remaining);
      room.state = advancePong(room.state, inputs, milliseconds / 1000);
      remaining -= milliseconds;
    }
    // Carry any work beyond the per-request cap into the next request. This is
    // also the timestamp clients use to measure the true age of the snapshot.
    room.updatedAt = simulatedUntil;
  } else {
    // Waiting/finished games and a real disconnect intentionally freeze physics.
    room.updatedAt = Math.max(now, room.updatedAt);
  }
  room.paused = paused;
}

async function updateRoom(db, code, request, action, input, clock) {
  const isJoin = action === 'join';
  const joinName = isJoin ? nameOf(input.name) : null;
  const token = isJoin ? randomHex() : request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{48})$/)?.[1];
  if (!token) throw new ApiError(401, 'PLAYER_TOKEN_REQUIRED', 'Бөлмеге қайта қосыл.');
  const tokenHash = await digest(token);
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db.prepare('SELECT code, version, data, expires_at FROM pong_rooms WHERE code = ?').bind(code).first();
    const readTime = clock();
    if (!row) throw new ApiError(404, 'ROOM_NOT_FOUND', 'Бөлме табылмады. Кодты тексер.');
    if (row.expires_at < readTime) throw new ApiError(410, 'ROOM_EXPIRED', 'Бөлменің уақыты аяқталды. Жаңа бөлме аш.');
    const room = JSON.parse(row.data);
    // Sample after every D1 read, including CAS retries. Another request may
    // already have advanced this room beyond this request's arrival time.
    const now = Math.max(readTime, room.updatedAt, room.players.left?.lastSeen || 0, room.players.right?.lastSeen || 0);
    let side;
    if (isJoin) {
      if (room.players.right) throw new ApiError(409, 'ROOM_FULL', 'Бұл бөлмеде екі ойыншы бар.');
      side = 'right';
      room.players.right = player(joinName, tokenHash, now);
      room.state = startPong(createPongState(seed()));
      room.players.left.ready = false;
      room.paused = !connected(room.players.left, now);
      room.updatedAt = now;
    } else {
      side = ['left', 'right'].find(key => room.players[key]?.hash === tokenHash);
      if (!side) throw new ApiError(401, 'INVALID_PLAYER_TOKEN', 'Бөлмеге кіру рұқсаты жарамсыз. Қайта қосыл.');
      if (action === 'leave' && side === 'left') {
        const removed = await db.prepare('DELETE FROM pong_rooms WHERE code = ? AND version = ?').bind(code, row.version).run();
        if (changes(removed)) return json({ left: true });
        continue;
      }
      // Advance with the last accepted controls before applying the next input.
      // Long network gaps pause the match instead of deciding unseen goals.
      advanceRoom(room, now);
      const p = room.players[side];
      p.lastSeen = Math.max(p.lastSeen, now);
      if (action === 'sync') {
        if (!Number.isFinite(input.direction) || Math.abs(input.direction) > 1 || !Number.isSafeInteger(input.seq) || input.seq < 0) {
          throw new ApiError(400, 'INVALID_INPUT', 'Басқару дерегі жарамсыз.');
        }
        if (input.seq > p.seq) { p.direction = input.direction; p.seq = input.seq; }
      } else if (action === 'rematch') {
        if (room.state.phase !== 'finished') throw new ApiError(409, 'MATCH_NOT_FINISHED', 'Алдымен осы ойынды аяқта.');
        p.ready = true;
        if (room.players.left.ready && room.players.right?.ready) {
          room.state = startPong(createPongState(seed()));
          room.updatedAt = now;
          for (const entry of Object.values(room.players)) { entry.ready = false; entry.direction = 0; }
          room.round++;
          room.paused = false;
        }
      } else if (action === 'leave') {
        room.players.right = null;
        room.players.left.direction = 0;
        room.players.left.ready = false;
        room.state = createPongState(seed());
        room.updatedAt = now;
        room.paused = false;
        room.round++;
      }
      // A returning player triggers a fresh countdown on the next accepted sync.
      if (room.paused && connected(room.players.left, now) && connected(room.players.right, now)) {
        room.paused = false;
        resumeRoom(room, now);
      }
    }
    const expiresAt = Math.max(row.expires_at, now + ROOM_TTL);
    const saved = await db.prepare('UPDATE pong_rooms SET data = ?, version = version + 1, expires_at = ? WHERE code = ? AND version = ?')
      .bind(JSON.stringify(room), expiresAt, code, row.version).run();
    if (changes(saved)) {
      if (action === 'leave') return json({ left: true });
      return json(publicRoom({ code, version: row.version + 1, expires_at: expiresAt }, room, side, clock(), isJoin ? token : undefined));
    }
  }
  throw new ApiError(409, 'RETRY_SYNC', 'Бөлме жаңарып жатыр. Қайта көр.');
}

export async function handlePongRequest(request, binding, options = {}) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'api' || parts[1] !== 'pong' || parts[2] !== 'rooms' || parts.length > 5) {
      throw new ApiError(404, 'UNKNOWN_ROUTE', 'Ойын мекенжайы табылмады.');
    }
    if (!binding?.prepare) throw new ApiError(503, 'SERVER_NOT_READY', 'Ойын сервері әзір емес. Біраздан соң қайта көр.');
    const db = binding.withSession ? binding.withSession('first-primary') : binding;
    const clock = () => options.now?.() ?? Date.now();
    const code = parts[3];
    const action = parts[4] || 'state';
    if (request.method !== 'GET' && request.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Бұл сұрау түрі қолдау таппайды.');
    if (request.method === 'POST') {
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
        throw new ApiError(403, 'ORIGIN_REJECTED', 'Ойынды сайттың өзінен аш.');
      }
    }
    if (!code && request.method === 'POST') return await createRoom(db, request, await bodyOf(request), clock);
    if (!code || !ROOM_PATTERN.test(code)) throw new ApiError(400, 'INVALID_ROOM_CODE', 'Бөлме коды 6 әріп не саннан тұрсын.');
    if (request.method === 'GET' && action === 'state') return await updateRoom(db, code, request, 'state', {}, clock);
    if (request.method !== 'POST' || !['join', 'sync', 'rematch', 'leave'].includes(action)) {
      throw new ApiError(404, 'UNKNOWN_ROUTE', 'Ойын әрекеті табылмады.');
    }
    return await updateRoom(db, code, request, action, await bodyOf(request), clock);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status);
    // Storage errors must not expose SQL, player tokens, or infrastructure details.
    console.error('Pong storage operation failed:', error?.name || 'Error');
    return json({ error: 'Ойын серверімен байланыс үзілді. Қайта көр.', code: 'SERVER_ERROR' }, 503);
  }
}

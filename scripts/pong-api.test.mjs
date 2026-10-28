import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { openLocalD1 } from '../server/sqlite-d1.js';
import { handlePongRequest } from '../server/pong-api.js';

const schema = `CREATE TABLE pong_rooms (
  code TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL, creator_key TEXT NOT NULL
);`;
const origin = 'https://qadam.example';
const endpoint = `${origin}/api/pong/rooms`;

function fixture(t) {
  const db = openLocalD1(':memory:');
  db.exec(schema);
  t.after(() => db.close());
  return { db, now: 1000000 };
}

async function call(ctx, path = '', { method = 'POST', token, body = {}, headers = {}, binding } = {}) {
  const request = new Request(endpoint + path, {
    method,
    headers: { 'content-type': 'application/json', origin, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
  const response = await handlePongRequest(request, binding || ctx.db, { now: () => ctx.now });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

async function pair(ctx) {
  const host = await call(ctx, '', { body: { name: 'Айша' } });
  assert.equal(host.status, 201);
  const guest = await call(ctx, `/${host.body.code}/join`, { body: { name: 'Дана' } });
  assert.equal(guest.status, 200);
  return { host: host.body, guest: guest.body, code: host.body.code };
}

async function stored(ctx, code) {
  const row = await ctx.db.prepare('SELECT * FROM pong_rooms WHERE code = ?').bind(code).first();
  return row ? { row, room: JSON.parse(row.data) } : null;
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} should equal ${expected}`);
}

test('local adapter binds real SQLite values and reports D1 CAS change counts', async t => {
  const ctx = fixture(t);
  const inserted = await ctx.db.prepare('INSERT INTO pong_rooms VALUES (?, ?, ?, ?, ?, ?)').bind('ABCDEF', 0, '{}', 1, 2, 'creator').run();
  assert.equal(inserted.meta.changes, 1);
  assert.deepEqual(await ctx.db.prepare('SELECT version, data FROM pong_rooms WHERE code = ?').bind('ABCDEF').first(), { version: 0, data: '{}' });
  assert.equal(await ctx.db.prepare('SELECT version FROM pong_rooms WHERE code = ?').bind('ABCDEF').first('version'), 0);
  const update = ctx.db.prepare('UPDATE pong_rooms SET version = version + 1 WHERE code = ? AND version = ?');
  assert.equal((await update.bind('ABCDEF', 0).run()).meta.changes, 1);
  assert.equal((await update.bind('ABCDEF', 0).run()).meta.changes, 0, 'stale compare-and-swap must not overwrite a newer row');
  assert.equal(await ctx.db.prepare('SELECT version FROM pong_rooms WHERE code = ?').bind('MISSING').first(), null);
  assert.equal((await ctx.db.prepare('SELECT code FROM pong_rooms').all()).results.length, 1);
});

test('startup migrations follow the Drizzle journal and apply once transactionally', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'qadam-pong-migrations-'));
  const migrations = join(directory, 'migrations');
  mkdirSync(join(migrations, 'meta'), { recursive: true });
  writeFileSync(join(migrations, '0001_room.sql'), schema);
  writeFileSync(join(migrations, '0002_index.sql'), 'CREATE INDEX pong_expiry ON pong_rooms(expires_at);');
  writeFileSync(join(migrations, 'meta', '_journal.json'), JSON.stringify({ entries: [{ idx: 0, tag: '0001_room' }, { idx: 1, tag: '0002_index' }] }));
  const db = openLocalD1(':memory:', { migrationsDir: migrations });
  t.after(() => {
    db.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(directory).startsWith('qadam-pong-migrations-'));
    rmSync(directory, { recursive: true, force: true });
  });
  assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM __qadam_migrations').first()).total, 2);
  assert.deepEqual(db.applyMigrations(migrations), []);
  assert.ok(await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'pong_expiry'").first());

  writeFileSync(join(migrations, '0001_room.sql'), schema + '\n-- changed after being applied');
  assert.throws(() => db.applyMigrations(migrations), /Applied migration changed/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM __qadam_migrations').first()).total, 2);
});

test('room creation, joining and DTOs keep bearer tokens isolated and hashes private', async t => {
  const ctx = fixture(t);
  const { host, guest, code } = await pair(ctx);
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.match(host.token, /^[a-f0-9]{48}$/);
  assert.notEqual(host.token, guest.token);
  assert.equal(host.side, 'left');
  assert.equal(guest.side, 'right');
  assert.equal(host.state.phase, 'waiting');
  assert.equal(guest.state.phase, 'playing');
  assert.equal(guest.state.serveRemaining, 1);
  const full = await call(ctx, `/${code}/join`, { body: { name: 'Үшінші' } });
  assert.equal(full.status, 409);
  assert.equal(full.body.code, 'ROOM_FULL');
  assert.equal((await call(ctx, `/${code}`, { method: 'GET' })).status, 401);
  const another = await call(ctx, '', { body: { name: 'Басқа ойыншы' } });
  assert.equal((await call(ctx, `/${code}`, { method: 'GET', token: another.body.token })).status, 401);
  const current = await call(ctx, `/${code}`, { method: 'GET', token: host.token });
  assert.equal(current.status, 200);
  assert.equal(current.headers.get('cache-control'), 'no-store');
  assert.equal(current.body.token, undefined, 'normal sync/state replies must not repeat credentials');
  const { row, room } = await stored(ctx, code);
  assert.ok(room.players.left.hash && room.players.right.hash);
  assert.ok(!row.data.includes(host.token) && !row.data.includes(guest.token), 'storage contains hashes, not raw tokens');
  for (const dto of [host, guest, current.body]) {
    const json = JSON.stringify(dto);
    assert.ok(!json.includes(room.players.left.hash));
    assert.ok(!json.includes(room.players.right.hash));
    assert.ok(!json.includes('"hash"') && !json.includes('creator_key'));
  }
});

test('both clients share server paddle movement and stale input sequences cannot reverse it', async t => {
  const ctx = fixture(t);
  const { host, guest, code } = await pair(ctx);
  await call(ctx, `/${code}/sync`, { token: host.token, body: { direction: 1, seq: 1 } });
  await call(ctx, `/${code}/sync`, { token: guest.token, body: { direction: -1, seq: 1 } });
  ctx.now += 100;
  const leftView = await call(ctx, `/${code}/sync`, { token: host.token, body: { direction: 1, seq: 2 } });
  const rightView = await call(ctx, `/${code}/sync`, { token: guest.token, body: { direction: -1, seq: 2 } });
  near(leftView.body.state.paddles.left.y, 312);
  near(leftView.body.state.paddles.right.y, 228);
  assert.deepEqual(leftView.body.state, rightView.body.state);
  const stale = await call(ctx, `/${code}/sync`, { token: host.token, body: { direction: -1, seq: 1 } });
  assert.equal(stale.body.ackSeq, 2);
  ctx.now += 100;
  const continued = await call(ctx, `/${code}`, { method: 'GET', token: guest.token });
  near(continued.body.state.paddles.left.y, 354);
  near(continued.body.state.paddles.right.y, 186);
  assert.equal((await stored(ctx, code)).room.players.left.direction, 1);
});

test('input bounds and sequence validation reject changes and clients cannot author scores', async t => {
  const ctx = fixture(t);
  const { host, code } = await pair(ctx);
  const before = await stored(ctx, code);
  for (const body of [
    { direction: 1.01, seq: 1 }, { direction: -2, seq: 1 }, { direction: '1', seq: 1 },
    { direction: null, seq: 1 }, { direction: 0, seq: -1 }, { direction: 0, seq: 0.5 },
    { direction: 0, seq: Number.MAX_SAFE_INTEGER + 1 }, {},
  ]) {
    const response = await call(ctx, `/${code}/sync`, { token: host.token, body });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_INPUT');
  }
  assert.deepEqual(await stored(ctx, code), before, 'rejected requests must not persist partial mutations');
  const attemptedScore = await call(ctx, `/${code}/sync`, { token: host.token, body: { direction: 0, seq: 1, state: { phase: 'finished', score: { left: 7, right: 0 } } } });
  assert.deepEqual(attemptedScore.body.state.score, { left: 0, right: 0 });
  assert.equal(attemptedScore.body.state.phase, 'playing');
});

test('a three-second connection gap pauses shared physics and reconnecting resumes a countdown', async t => {
  const ctx = fixture(t);
  const { host, guest, code } = await pair(ctx);
  let snapshot;
  for (let i = 0; i < 5; i += 1) {
    ctx.now += 250;
    snapshot = await call(ctx, `/${code}`, { method: 'GET', token: host.token });
    await call(ctx, `/${code}`, { method: 'GET', token: guest.token });
  }
  assert.notEqual(snapshot.body.state.ball.x, 480, 'the match was moving before the network gap');
  ctx.now += 3001;
  const paused = await call(ctx, `/${code}`, { method: 'GET', token: host.token });
  assert.equal(paused.body.paused, true);
  assert.equal(paused.body.players.right.connected, false);
  assert.deepEqual(paused.body.state, snapshot.body.state, 'no unseen rally or score is simulated across the gap');
  const resumed = await call(ctx, `/${code}`, { method: 'GET', token: guest.token });
  assert.equal(resumed.body.paused, false);
  assert.equal(resumed.body.state.serveRemaining, 1);
  near(resumed.body.state.ball.x, 480);
  near(resumed.body.state.ball.y, 270);
  ctx.now += 250;
  const countdown = await call(ctx, `/${code}`, { method: 'GET', token: host.token });
  near(countdown.body.state.serveRemaining, 0.75);
  near(countdown.body.state.ball.x, 480);
  assert.deepEqual(countdown.body.state.score, snapshot.body.state.score);
});

test('guest leave returns the host to waiting and invalidates the old guest token before rejoin', async t => {
  const ctx = fixture(t);
  const { host, guest, code } = await pair(ctx);
  assert.equal((await call(ctx, `/${code}/leave`, { token: guest.token })).status, 200);
  const waiting = await call(ctx, `/${code}`, { method: 'GET', token: host.token });
  assert.equal(waiting.body.state.phase, 'waiting');
  assert.equal(waiting.body.players.right, null);
  assert.equal((await call(ctx, `/${code}`, { method: 'GET', token: guest.token })).status, 401);
  const rejoined = await call(ctx, `/${code}/join`, { body: { name: 'Жаңа қонақ' } });
  assert.equal(rejoined.status, 200);
  assert.equal(rejoined.body.state.phase, 'playing');
  assert.notEqual(rejoined.body.token, guest.token);
  assert.equal(rejoined.body.players.left.name, host.players.left.name);
});

test('host leave removes the room for both players', async t => {
  const ctx = fixture(t);
  const { host, guest, code } = await pair(ctx);
  assert.equal((await call(ctx, `/${code}/leave`, { token: host.token })).status, 200);
  assert.equal(await stored(ctx, code), null);
  const missing = await call(ctx, `/${code}`, { method: 'GET', token: guest.token });
  assert.ok([404, 410].includes(missing.status));
});

test('a rematch requires a finished state and both players consent before a fresh round', async t => {
  const ctx = fixture(t);
  const { host, guest, code } = await pair(ctx);
  const early = await call(ctx, `/${code}/rematch`, { token: host.token });
  assert.equal(early.status, 409);
  assert.equal(early.body.code, 'MATCH_NOT_FINISHED');
  // Direct trusted DB fixture: the public API never accepts a client score.
  const { room } = await stored(ctx, code);
  Object.assign(room.state, { phase: 'finished', winner: 'left', score: { left: 7, right: 3 }, serveRemaining: 0 });
  room.state.ball.vx = 0;
  room.state.ball.vy = 0;
  await ctx.db.prepare('UPDATE pong_rooms SET data = ?, version = version + 1 WHERE code = ?').bind(JSON.stringify(room), code).run();
  const firstReady = await call(ctx, `/${code}/rematch`, { token: host.token });
  assert.equal(firstReady.body.state.phase, 'finished');
  assert.equal(firstReady.body.players.left.ready, true);
  assert.equal(firstReady.body.players.right.ready, false);
  const restarted = await call(ctx, `/${code}/rematch`, { token: guest.token });
  assert.equal(restarted.body.state.phase, 'playing');
  assert.deepEqual(restarted.body.state.score, { left: 0, right: 0 });
  assert.equal(restarted.body.state.winner, null);
  assert.equal(restarted.body.state.serveRemaining, 1);
  assert.equal(restarted.body.round, 2);
  assert.equal(restarted.body.players.left.ready, false);
  assert.equal(restarted.body.players.right.ready, false);
});

test('idle TTL expires rooms while accepted activity extends it', async t => {
  const ctx = fixture(t);
  const created = await call(ctx, '', { body: { name: 'Айша' } });
  const host = created.body;
  ctx.now += 60000;
  const refreshed = await call(ctx, `/${host.code}`, { method: 'GET', token: host.token });
  assert.ok(refreshed.body.expiresAt > host.expiresAt);
  ctx.now = refreshed.body.expiresAt + 1;
  const expired = await call(ctx, `/${host.code}`, { method: 'GET', token: host.token });
  assert.equal(expired.status, 410);
  assert.equal(expired.body.code, 'ROOM_EXPIRED');
  await call(ctx, '', { body: { name: 'Жаңа бөлме' } });
  assert.equal((await call(ctx, `/${host.code}`, { method: 'GET', token: host.token })).status, 404);
});

test('two concurrent joins produce one guest via real SQL compare-and-swap', async t => {
  const ctx = fixture(t);
  const host = (await call(ctx, '', { body: { name: 'Айша' } })).body;
  let reads = 0;
  let release;
  const gate = new Promise(resolveGate => { release = resolveGate; });
  let rejectedCas = 0;
  const binding = {
    withSession() { return binding; },
    prepare(sql) {
      return { bind(...values) {
        const prepared = ctx.db.prepare(sql).bind(...values);
        return {
          async first() {
            const row = await prepared.first();
            if (sql.startsWith('SELECT code, version, data, expires_at') && reads < 2) {
              reads += 1;
              if (reads === 2) release();
              await gate;
            }
            return row;
          },
          async run() {
            const result = await prepared.run();
            if (sql.startsWith('UPDATE pong_rooms') && result.meta.changes === 0) rejectedCas += 1;
            return result;
          },
        };
      } };
    },
  };
  const results = await Promise.all([
    call(ctx, `/${host.code}/join`, { body: { name: 'Бірінші' }, binding }),
    call(ctx, `/${host.code}/join`, { body: { name: 'Екінші' }, binding }),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(results.find(result => result.status === 409).body.code, 'ROOM_FULL');
  assert.equal(rejectedCas, 1, 'one stale SQL update must be rejected, then the handler observes the full room');
  const winner = results.find(result => result.status === 200).body;
  const saved = await stored(ctx, host.code);
  assert.equal(saved.row.version, 1);
  assert.equal(saved.room.players.right.name, winner.players.right.name);
  assert.equal((await call(ctx, `/${host.code}`, { method: 'GET', token: winner.token })).status, 200);
});

test('request boundaries reject cross-site mutation, invalid room codes and oversized JSON', async t => {
  const ctx = fixture(t);
  assert.equal((await call(ctx, '', { body: { name: 'Айша' }, headers: { origin: 'https://elsewhere.example' } })).status, 403);
  assert.equal((await call(ctx, '/abcdef/join', { body: { name: 'Айша' } })).status, 400);
  assert.equal((await call(ctx, '', { body: { name: 'x'.repeat(2000) } })).status, 413);
  assert.equal((await ctx.db.prepare('SELECT COUNT(*) AS total FROM pong_rooms').first()).total, 0);
});

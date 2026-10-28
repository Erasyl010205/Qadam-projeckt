import test from 'node:test';
import assert from 'node:assert/strict';
import { createPongState, startPong, PONG_RULES } from '../public/pong-engine.js';
import { createPongRenderClock, acceptPongSnapshot, advancePongRender, MAX_PREDICTION_MS } from '../public/pong-render.js';

function dto(overrides = {}) {
  const state = startPong(createPongState(42));
  state.serveRemaining = 0;
  state.ball = { x:200, y:200, vx:100, vy:0, speed:100 };
  state.paddles.left.y = 60;
  return { state, side:'left', round:1, paused:false, inputs:{ left:0, right:0 }, ...overrides };
}
function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, received ${actual}`);
}
function snapshot(value, timing = {}) {
  return acceptPongSnapshot(createPongRenderClock(), value, { receivedAt:0, sentAt:0, side:'left', direction:0, ...timing });
}
function frames(clock, end, direction = 0, start = clock.frameAt) {
  for (let now = start + 1000 / 60; now < end - 1e-6; now += 1000 / 60) clock = advancePongRender(clock, { now, direction });
  return advancePongRender(clock, { now:end, direction });
}

test('a 500 ms response gap keeps ball and held local paddle moving every frame', () => {
  let clock = snapshot(dto(), { direction:1 });
  const xs = [], ys = [];
  for (let frame = 1; frame <= 30; frame++) {
    clock = advancePongRender(clock, { now:frame * 1000 / 60, direction:1 });
    xs.push(clock.visual.ball.x); ys.push(clock.visual.paddles.left.y);
  }
  assert.ok(xs.every((x,index) => index === 0 || x > xs[index - 1]), 'the ball must not stop at the old 100 ms limit');
  assert.ok(ys.every((y,index) => index === 0 || y > ys[index - 1]), 'held input must not stop after a short extrapolation');
  near(clock.visual.ball.x, 250);
  near(clock.visual.paddles.left.y, 270);
  assert.deepEqual(clock.visual.score, { left:0, right:0 });
});

test('ball prediction has a safety bound while the own paddle remains responsive past it', () => {
  const clock = frames(snapshot(dto(), { direction:1 }), 900, 1);
  near(clock.predictionMs, MAX_PREDICTION_MS);
  near(clock.visual.ball.x, 280);
  near(clock.visual.paddles.left.y, 438);
  const stopped = advancePongRender(clock, { now:950, direction:0 });
  near(stopped.visual.paddles.left.y, clock.visual.paddles.left.y);
  const reversed = advancePongRender(stopped, { now:1000, direction:-1 });
  assert.ok(reversed.visual.paddles.left.y < stopped.visual.paddles.left.y);
});

test('visual prediction reflects walls and paddle contacts using shared physics', () => {
  const wall = dto();
  wall.state.ball = { x:400, y:10, vx:50, vy:-200, speed:Math.hypot(50,200) };
  const wallClock = frames(snapshot(wall), 200);
  near(wallClock.visual.ball.y, 46);
  assert.ok(wallClock.visual.ball.vy > 0);
  const contact = dto();
  contact.state.paddles.left.y = 270;
  contact.state.ball = { x:60, y:270, vx:-340, vy:0, speed:340 };
  const paddleClock = frames(snapshot(contact), 60);
  assert.ok(paddleClock.visual.ball.vx > 0);
  assert.ok(paddleClock.visual.ball.x > 50);
  assert.deepEqual(paddleClock.visual.score, { left:0, right:0 });
});

test('a predicted deciding goal never awards score, announces a winner or starts a fake rally', () => {
  const value = dto();
  value.state.score.left = 6;
  value.state.ball = { x:958, y:100, vx:400, vy:0, speed:400 };
  const original = structuredClone(value);
  const clock = frames(snapshot(value), 600);
  assert.equal(clock.awaitingGoal, true);
  assert.deepEqual(clock.visual.score, { left:6, right:0 });
  assert.equal(clock.visual.phase, 'playing');
  assert.equal(clock.visual.winner, null);
  assert.ok(clock.visual.ball.x >= PONG_RULES.width, 'await the real score at the exit rather than invent a center serve');
  assert.equal(clock.visual.serveRemaining, 0);
  assert.deepEqual(value, original);
  assert.deepEqual(clock.authority, original.state);
});

test('RTT plus timestamp age catches the simulation up, with an older DTO fallback', () => {
  const value = dto({ serverTime:1200, simulationTime:1000 });
  const clock = snapshot(value, { receivedAt:400, sentAt:100 });
  near(clock.rttMs, 300);
  near(clock.predictionMs, 250);
  near(clock.visual.ball.x, 225);
  const legacy = snapshot(dto(), { receivedAt:400, sentAt:100 });
  near(legacy.predictionMs, 150);
  near(legacy.visual.ball.x, 215);
});

test('new snapshots reconcile without a hard jump and cannot reverse a held local input', () => {
  let clock = frames(snapshot(dto(), { direction:1 }), 300, 1);
  const before = clock.visual;
  const changed = dto({ simulationTime:1050, serverTime:1100 });
  changed.state.ball.x = 245;
  changed.state.paddles.left.y = 150;
  clock = acceptPongSnapshot(clock, changed, { receivedAt:300, sentAt:100, side:'left', direction:1 });
  near(clock.visual.ball.x, before.ball.x);
  near(clock.visual.paddles.left.y, before.paddles.left.y);
  const positions = [];
  for (let now = 316; now <= 500; now += 16) {
    clock = advancePongRender(clock, { now, direction:1 });
    positions.push(clock.visual.paddles.left.y);
    for (const number of [clock.visual.ball.x, clock.visual.ball.y, clock.visual.paddles.left.y, clock.visual.paddles.right.y]) assert.ok(Number.isFinite(number));
    assert.deepEqual(clock.visual.score, changed.state.score);
    assert.equal(clock.visual.winner, changed.state.winner);
  }
  assert.ok(positions.every((y,index) => index === 0 || y > positions[index - 1]));
});

test('authoritative round, scoring, pause and finish transitions reset presentation correctly', () => {
  let clock = frames(snapshot(dto()), 300);
  const scored = dto();
  scored.state.score.left = 1;
  scored.state.ball.x = 480; scored.state.ball.y = 270;
  scored.state.ball.vx = 0; scored.state.serveRemaining = 1;
  clock = acceptPongSnapshot(clock, scored, { receivedAt:300, sentAt:300 });
  near(clock.visual.ball.x, 480);
  assert.deepEqual(clock.visual.score, { left:1, right:0 });
  const paused = dto({ paused:true });
  clock = snapshot(paused);
  assert.deepEqual(frames(clock, 500, 1).visual, clock.visual);
  const finished = dto();
  finished.state.phase = 'finished'; finished.state.score.left = 7; finished.state.winner = 'left';
  clock = snapshot(finished);
  assert.equal(frames(clock, 500, 1).visual.winner, 'left');
  assert.deepEqual(frames(clock, 500, 1).visual.score, finished.state.score);
  const nextRound = dto({ round:2 });
  clock = acceptPongSnapshot(clock, nextRound, { receivedAt:600, sentAt:600 });
  assert.equal(clock.visual.winner, null);
  near(clock.visual.ball.x, 200);
});

test('reconciliation keeps the own visible paddle and its predicted collider together', () => {
  const initial = dto();
  initial.state.paddles.left.y = 270;
  let clock = frames(snapshot(initial), 300);
  const delayed = dto();
  delayed.state.ball = { x:60, y:270, vx:-340, vy:0, speed:340 };
  clock = acceptPongSnapshot(clock, delayed, { receivedAt:300, sentAt:300 });
  near(clock.predicted.paddles.left.y, clock.visual.paddles.left.y);
  clock = frames(clock, 360);
  assert.ok(clock.predicted.ball.vx > 0, 'bounce off the paddle the local player actually sees');
  assert.equal(clock.awaitingGoal, false);
  assert.deepEqual(clock.visual.score, { left:0, right:0 });
});

test('frozen source snapshots and invalid timing cannot corrupt the render state', () => {
  const value = dto();
  const original = structuredClone(value);
  for (const object of [value.state.score, value.state.ball, value.state.paddles.left, value.state.paddles.right, value.state.paddles, value.state, value]) Object.freeze(object);
  let clock = snapshot(value, { receivedAt:NaN, sentAt:Infinity, direction:NaN });
  for (const now of [16, 33, NaN, Infinity, -100, 500]) clock = advancePongRender(clock, { now, direction:NaN });
  for (const number of [clock.visual.ball.x, clock.visual.ball.y, clock.visual.paddles.left.y, clock.predictionMs, clock.rttMs]) assert.ok(Number.isFinite(number));
  assert.deepEqual(value, original);
  assert.deepEqual(clock.authority, original.state);
});

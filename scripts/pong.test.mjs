import test from 'node:test';
import assert from 'node:assert/strict';
import { PONG_RULES as rules, createPongState, startPong, advancePong } from '../public/pong-engine.js';

function playing(seed = 1) {
  const state = startPong(createPongState(seed));
  state.serveRemaining = 0;
  state.ball.vx = rules.ballSpeed;
  return state;
}

function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, received ${actual}`);
}

test('waiting, serve countdown, and finished states have explicit lifecycle', () => {
  const waiting = createPongState(42);
  assert.equal(waiting.phase, 'waiting');
  assert.deepEqual(advancePong(waiting, { left: 1, right: -1 }, 0.1), waiting);
  const started = startPong(waiting);
  assert.equal(waiting.phase, 'waiting');
  assert.equal(started.phase, 'playing');
  assert.equal(started.serveRemaining, 1);
  let state = advancePong(started, {}, 0.25);
  near(state.serveRemaining, 0.75);
  near(state.ball.x, rules.width / 2);
  assert.equal(state.ball.vx, 0);
  for (let i = 0; i < 3; i += 1) state = advancePong(state, {}, 0.25);
  assert.equal(state.serveRemaining, 0);
  near(Math.hypot(state.ball.vx, state.ball.vy), rules.ballSpeed);
  assert.ok(state.ball.vx > 0);
  assert.deepEqual(startPong(state), state, 'a second ready signal must not reset a live match');
});

test('paddle input is time-based, clamped, and isolated from the ball', () => {
  let state = startPong(createPongState());
  const moved = advancePong(state, { left: -1, right: 1 }, 0.1);
  near(moved.paddles.left.y, 270 - 42);
  near(moved.paddles.right.y, 270 + 42);
  near(state.paddles.left.y, 270);
  for (let i = 0; i < 10; i += 1) state = advancePong(state, { left: -1, right: 1 }, 0.25);
  assert.equal(state.paddles.left.y, rules.paddleHeight / 2);
  assert.equal(state.paddles.right.y, rules.height - rules.paddleHeight / 2);
  assert.equal(state.paddles.left.x, 36);
  assert.equal(state.paddles.right.x, 924);
});

test('paddle axes clamp oversized values and reject malformed or nonfinite values', () => {
  const state = startPong(createPongState());
  assert.deepEqual(advancePong(state, { left: -999, right: 999 }, 0.1), advancePong(state, { left: -1, right: 1 }, 0.1));
  for (const value of [NaN, Infinity, -Infinity, '1', true, {}, null]) {
    assert.deepEqual(advancePong(state, { left: value, right: value }, 0.1), advancePong(state, {}, 0.1));
  }
});

test('wall bounces preserve speed and reflect at the exact boundary', () => {
  for (const top of [true, false]) {
    const state = playing();
    state.ball = { x: 480, y: top ? 9 : 531, vx: 100, vy: top ? -300 : 300, speed: Math.hypot(100, 300) };
    const next = advancePong(state, {}, 0.02);
    near(next.ball.y, top ? 13 : 527);
    assert.equal(Math.sign(next.ball.vy), top ? 1 : -1);
    near(Math.hypot(next.ball.vx, next.ball.vy), Math.hypot(100, 300));
    assert.deepEqual(next.score, { left: 0, right: 0 });
  }
});

test('swept collision catches a maximum-speed ball at either thin paddle', () => {
  for (const side of ['left', 'right']) {
    const state = playing();
    const left = side === 'left';
    state.ball = { x: left ? 55 : 905, y: 270, vx: left ? -620 : 620, vy: 0, speed: 620 };
    const next = advancePong(state, {}, 0.04);
    assert.equal(Math.sign(next.ball.vx), left ? 1 : -1);
    assert.equal(next.ball.speed, 620);
    assert.ok(left ? next.ball.x > 50 : next.ball.x < 910);
    assert.deepEqual(next.score, { left: 0, right: 0 });
  }
});

test('paddle contact controls bounce angle and speed increases up to its cap', () => {
  const center = playing();
  center.ball = { x: 51, y: 270, vx: -340, vy: 0, speed: 340 };
  const centerHit = advancePong(center, {}, 0.01);
  near(centerHit.ball.vy, 0);
  near(centerHit.ball.speed, 364);
  const edge = playing();
  edge.ball = { x: 51, y: 230, vx: -340, vy: 0, speed: 340 };
  const edgeHit = advancePong(edge, {}, 0.01);
  assert.ok(edgeHit.ball.vx > 0 && edgeHit.ball.vy < 0);
  assert.ok(Math.abs(edgeHit.ball.vy) > 100);
  near(Math.hypot(edgeHit.ball.vx, edgeHit.ball.vy), edgeHit.ball.speed);
  const capped = playing();
  capped.ball = { x: 51, y: 270, vx: -610, vy: 0, speed: 610 };
  assert.equal(advancePong(capped, {}, 0.01).ball.speed, 620);
});

test('a missed paddle scores once and pauses the centered ball before serving', () => {
  for (const missedSide of ['left', 'right']) {
    const state = playing();
    const left = missedSide === 'left';
    state.ball = { x: left ? -7 : 967, y: 100, vx: left ? -340 : 340, vy: 0, speed: 340 };
    const next = advancePong(state, {}, 0.01);
    const scorer = left ? 'right' : 'left';
    assert.equal(next.score[scorer], 1);
    assert.equal(next.score[missedSide], 0);
    assert.equal(next.phase, 'playing');
    near(next.ball.x, 480);
    near(next.ball.y, 270);
    assert.equal(next.ball.vx, 0);
    assert.ok(next.serveRemaining > 0.98 && next.serveRemaining <= 1);
    const paused = advancePong(next, {}, 0.25);
    assert.equal(paused.score[scorer], 1);
    near(paused.ball.x, 480);
    assert.equal(paused.ball.speed, rules.ballSpeed);
    let served = paused;
    for (let i = 0; i < 4; i += 1) served = advancePong(served, {}, 0.25);
    assert.equal(served.serveRemaining, 0);
    assert.equal(Math.sign(served.ball.vx), left ? -1 : 1, 'the ball serves toward the player who missed');
  }
});

test('a ball passing behind a paddle cannot bounce off its back', () => {
  const state = playing();
  state.ball = { x: 20, y: 270, vx: -340, vy: 0, speed: 340 };
  const next = advancePong(state, {}, 0.1);
  assert.equal(next.score.right, 1);
  assert.equal(next.ball.vx, 0);
});

test('the seventh point finishes the match and further updates cannot change it', () => {
  for (const winner of ['left', 'right']) {
    const state = playing();
    state.score[winner] = 6;
    const leftWins = winner === 'left';
    state.ball = { x: leftWins ? 967 : -7, y: 100, vx: leftWins ? 340 : -340, vy: 0, speed: 340 };
    const finished = advancePong(state, {}, 0.02);
    assert.equal(finished.phase, 'finished');
    assert.equal(finished.winner, winner);
    assert.equal(finished.score[winner], 7);
    assert.equal(finished.serveRemaining, 0);
    assert.deepEqual(advancePong(finished, { left: 1, right: -1 }, 0.25), finished);
    assert.deepEqual(startPong(finished), finished);
  }
});

test('identical seeded inputs replay deterministically through JSON snapshots', () => {
  let first = startPong(createPongState(1907));
  let second = JSON.parse(JSON.stringify(first));
  for (let i = 0; i < 1200; i += 1) {
    const inputs = { left: Math.floor(i / 60) % 3 - 1, right: Math.floor(i / 37) % 3 - 1 };
    first = advancePong(first, inputs, 1 / 60);
    second = advancePong(second, inputs, 1 / 60);
    if (i % 100 === 0) second = JSON.parse(JSON.stringify(second));
  }
  assert.deepEqual(first, second);
  let other = startPong(createPongState(1908));
  for (let i = 0; i < 5; i += 1) other = advancePong(other, {}, 0.25);
  let initial = startPong(createPongState(1907));
  for (let i = 0; i < 5; i += 1) initial = advancePong(initial, {}, 0.25);
  assert.notEqual(other.ball.vy, initial.ball.vy);
});

test('all transitions leave nested input objects untouched', () => {
  const state = playing();
  const before = structuredClone(state);
  Object.freeze(state.ball);
  Object.freeze(state.score);
  Object.freeze(state.paddles.left);
  Object.freeze(state.paddles.right);
  Object.freeze(state.paddles);
  Object.freeze(state);
  const next = advancePong(state, { left: 1 }, 0.1);
  assert.deepEqual(state, before);
  assert.notStrictEqual(next.ball, state.ball);
  assert.notStrictEqual(next.score, state.score);
  assert.notStrictEqual(next.paddles.left, state.paddles.left);
});

test('time validation rejects nonfinite values, ignores negative dt, and caps long frames', () => {
  const state = playing();
  for (const seconds of [NaN, Infinity, -Infinity, '0.1', null]) {
    assert.throws(() => advancePong(state, {}, seconds), TypeError);
  }
  assert.deepEqual(advancePong(state, {}, -1), state);
  assert.deepEqual(advancePong(state, {}, 0), state);
  assert.deepEqual(advancePong(state, {}, 1000), advancePong(state, {}, rules.maxFrameTime));
  assert.throws(() => createPongState(Infinity), TypeError);
});

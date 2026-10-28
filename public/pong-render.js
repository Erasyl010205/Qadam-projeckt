import { PONG_RULES, advancePong } from './pong-engine.js';

// This clock owns presentation only. Room membership, phase, scores and winners
// always come from a server snapshot; none of these helpers sends game results.
export const MAX_PREDICTION_MS = 800;
const SIDES = ['left', 'right'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const axis = value => clamp(finite(value), -1, 1);
const copy = state => ({ ...state, score:{ ...state.score }, ball:{ ...state.ball }, paddles:{ left:{ ...state.paddles.left }, right:{ ...state.paddles.right } } });

export function createPongRenderClock() {
  return { authority:null, predicted:null, visual:null, side:'left', inputs:{ left:0, right:0 },
    acceptedAt:0, frameAt:0, predictionMs:0, rttMs:0, round:null, paused:false,
    awaitingGoal:false, localDirection:0, history:[], correction:{ x:0, y:0, left:0, right:0 } };
}

function authoritative(state, authority) {
  return { ...state, phase:authority.phase, score:{ ...authority.score }, winner:authority.winner };
}

// Use the same collision code in small steps. A predicted goal is deliberately
// discarded: hold the ball at the exit until the server confirms the new rally.
function simulate(state, inputs, seconds, authority, waiting = false) {
  let next = state;
  let remaining = Math.max(0, finite(seconds));
  while (remaining > 1e-8) {
    const step = Math.min(remaining, 1 / 60, PONG_RULES.maxFrameTime);
    const before = next;
    next = advancePong(next, inputs, step);
    if (SIDES.some(side => next.score[side] !== authority.score[side]) || next.phase !== authority.phase) {
      waiting = true;
      next.ball = { ...before.ball, x:before.ball.vx < 0 ? -PONG_RULES.ballRadius : PONG_RULES.width + PONG_RULES.ballRadius,
        y:clamp(before.ball.y + before.ball.vy * step, PONG_RULES.ballRadius, PONG_RULES.height - PONG_RULES.ballRadius), vx:0, vy:0 };
      next.serveRemaining = 0;
    }
    next = authoritative(next, authority);
    remaining -= step;
  }
  return { state:next, waiting };
}

function directionAt(history, time, fallback) {
  let value = fallback;
  for (const event of history) {
    if (event.at > time) break;
    value = event.direction;
  }
  return value;
}

function compose(clock) {
  if (!clock.predicted) return null;
  const result = copy(clock.predicted);
  result.ball.x += clock.correction.x;
  result.ball.y = clamp(result.ball.y + clock.correction.y, PONG_RULES.ballRadius, PONG_RULES.height - PONG_RULES.ballRadius);
  for (const side of SIDES) result.paddles[side].y = clamp(result.paddles[side].y + (side === clock.side ? 0 : clock.correction[side]), PONG_RULES.paddleHeight / 2, PONG_RULES.height - PONG_RULES.paddleHeight / 2);
  return authoritative(result, clock.authority);
}

export function acceptPongSnapshot(clock, dto, timing = {}) {
  const now = finite(timing.receivedAt, finite(clock.frameAt));
  const sampleRtt = clamp(now - finite(timing.sentAt, now), 0, 5000);
  const rttMs = clock.authority ? clock.rttMs * 0.75 + sampleRtt * 0.25 : sampleRtt;
  // simulationTime can lag behind response creation because of storage work.
  // Remove that known work from RTT before estimating the remaining downlink.
  const snapshotAge = Number.isFinite(dto.simulationTime) && Number.isFinite(dto.serverTime)
    ? Math.max(0, dto.serverTime - dto.simulationTime) : 0;
  const ageMs = clamp(snapshotAge + Math.max(0, rttMs - snapshotAge) / 2, 0, MAX_PREDICTION_MS);
  const side = SIDES.includes(timing.side) ? timing.side : clock.side;
  const direction = axis(timing.direction ?? clock.localDirection);
  const prior = clock.authority ? advancePongRender(clock, { now, direction, active:true }) : clock;
  const authority = copy(dto.state);
  const inputs = { left:axis(dto.inputs?.left), right:axis(dto.inputs?.right) };
  const history = prior.history.filter(event => event.at >= now - 3000);
  if (!history.length || history.at(-1).direction !== direction) history.push({ at:now, direction });
  let predicted = copy(authority), awaitingGoal = false;
  if (authority.phase === 'playing' && !dto.paused) {
    const start = now - ageMs;
    const changes = history.filter(event => event.at > start && event.at < now);
    let cursor = start;
    for (const end of [...changes.map(event => event.at), now]) {
      const controls = { ...inputs, [side]:directionAt(history, cursor, inputs[side]) };
      const advanced = simulate(predicted, controls, (end - cursor) / 1000, authority, awaitingGoal);
      predicted = advanced.state; awaitingGoal = advanced.waiting; cursor = end;
    }
  }
  const reset = !prior.visual || prior.round !== dto.round || prior.authority.phase !== authority.phase || prior.paused !== Boolean(dto.paused)
    || SIDES.some(key => prior.authority.score[key] !== authority.score[key]);
  const correction = reset ? { x:0, y:0, left:0, right:0 } : {
    x:prior.visual.ball.x - predicted.ball.x, y:prior.visual.ball.y - predicted.ball.y,
    left:prior.visual.paddles.left.y - predicted.paddles.left.y,
    right:prior.visual.paddles.right.y - predicted.paddles.right.y
  };
  if (!reset) {
    // Keep the actual predicted collider under the player's visible paddle.
    // Its server correction is integrated gently, rather than being only a
    // drawing offset that could make a ball pass through the visible paddle.
    correction[side] = predicted.paddles[side].y - prior.visual.paddles[side].y;
    predicted.paddles[side].y = prior.visual.paddles[side].y;
  }
  const next = { ...clock, authority, predicted, side, inputs, acceptedAt:now, frameAt:now, predictionMs:ageMs,
    rttMs, round:dto.round, paused:Boolean(dto.paused), awaitingGoal, localDirection:direction, history, correction };
  next.visual = compose(next);
  return next;
}

export function advancePongRender(clock, options = {}) {
  if (!clock.authority) return clock;
  const now = Math.max(clock.frameAt, finite(options.now, clock.frameAt));
  const elapsed = Math.max(0, (now - clock.frameAt) / 1000);
  const direction = options.active === false ? 0 : axis(options.direction ?? clock.localDirection);
  const history = clock.history.filter(event => event.at >= now - 3000);
  if (!history.length || direction !== clock.localDirection) history.push({ at:now, direction });
  const next = { ...clock, frameAt:now, history, localDirection:direction, correction:{ ...clock.correction } };
  if (clock.authority.phase !== 'playing' || clock.paused || options.active === false) return next;
  const controls = { ...clock.inputs, [clock.side]:direction };
  const budget = Math.max(0, MAX_PREDICTION_MS - clock.predictionMs);
  const ballSeconds = Math.min(elapsed, budget / 1000);
  const startingState = copy(clock.predicted);
  const adjustment = Math.sign(clock.correction[clock.side]) * Math.min(Math.abs(clock.correction[clock.side]), 80 * Math.min(elapsed, 0.1));
  startingState.paddles[clock.side].y = clamp(startingState.paddles[clock.side].y + adjustment, PONG_RULES.paddleHeight / 2, PONG_RULES.height - PONG_RULES.paddleHeight / 2);
  const advanced = simulate(startingState, controls, ballSeconds, clock.authority, clock.awaitingGoal);
  next.predicted = advanced.state;
  next.awaitingGoal = advanced.waiting;
  next.predictionMs = clock.predictionMs + ballSeconds * 1000;
  // Even when ball prediction reaches its safety limit, local controls must not
  // become an inert 100 ms extrapolation. Integrate the own paddle every frame.
  const localExtra = Math.max(0, Math.min(elapsed, 0.1) - ballSeconds);
  if (localExtra > 0) {
    next.predicted = copy(next.predicted);
    next.predicted.paddles[clock.side].y = clamp(next.predicted.paddles[clock.side].y + direction * PONG_RULES.paddleSpeed * localExtra,
      PONG_RULES.paddleHeight / 2, PONG_RULES.height - PONG_RULES.paddleHeight / 2);
  }
  const decay = Math.exp(-Math.min(elapsed, 0.25) / 0.1);
  next.correction.x *= decay; next.correction.y *= decay;
  for (const side of SIDES) {
    const old = next.correction[side];
    // Reconcile the local paddle more slowly than its movement speed so an old
    // snapshot cannot reverse a held key or repeatedly stop the paddle.
    next.correction[side] = side === clock.side ? old - adjustment : old * decay;
  }
  next.visual = compose(next);
  return next;
}

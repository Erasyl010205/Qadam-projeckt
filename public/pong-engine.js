// Shared deterministic Pong simulation. All exported transitions return a fresh
// JSON-serializable state; server code owns room membership and the match clock.
export const PONG_RULES = Object.freeze({
  width: 960,
  height: 540,
  leftPaddleX: 36,
  rightPaddleX: 924,
  paddleWidth: 12,
  paddleHeight: 90,
  paddleSpeed: 420,
  ballRadius: 8,
  ballSpeed: 340,
  ballSpeedStep: 24,
  maxBallSpeed: 620,
  maxBounceAngle: Math.PI / 3,
  scoreToWin: 7,
  servePause: 1,
  maxStep: 1 / 120,
  maxFrameTime: 0.25,
});

const EPSILON = 1e-9;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;

function cloneState(state) {
  return {
    ...state,
    score: { ...state.score },
    paddles: { left: { ...state.paddles.left }, right: { ...state.paddles.right } },
    ball: { ...state.ball },
  };
}

export function createPongState(seed = 1) {
  if (!Number.isFinite(seed)) throw new TypeError('Pong seed must be a finite number.');
  return {
    phase: 'waiting',
    score: { left: 0, right: 0 },
    winner: null,
    paddles: {
      left: { x: PONG_RULES.leftPaddleX, y: PONG_RULES.height / 2 },
      right: { x: PONG_RULES.rightPaddleX, y: PONG_RULES.height / 2 },
    },
    ball: { x: PONG_RULES.width / 2, y: PONG_RULES.height / 2, vx: 0, vy: 0, speed: PONG_RULES.ballSpeed },
    serveRemaining: 0,
    serveDirection: 1,
    rng: seed >>> 0,
    tick: 0,
  };
}

// A room starts the simulation once both players are present. Restarting a
// finished match requires createPongState(), so a stray start cannot erase scores.
export function startPong(state) {
  const next = cloneState(state);
  if (next.phase === 'waiting') {
    next.phase = 'playing';
    next.serveRemaining = PONG_RULES.servePause;
  }
  return next;
}

function random(state) {
  // LCG arithmetic stays in uint32 and works identically in Node and browsers.
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function serve(state) {
  const angle = (random(state) * 2 - 1) * Math.PI / 9;
  state.ball.vx = state.serveDirection * PONG_RULES.ballSpeed * Math.cos(angle);
  state.ball.vy = PONG_RULES.ballSpeed * Math.sin(angle);
  state.ball.speed = PONG_RULES.ballSpeed;
  state.serveRemaining = 0;
}

function awardPoint(state, side) {
  state.score[side] += 1;
  state.ball = { x: PONG_RULES.width / 2, y: PONG_RULES.height / 2, vx: 0, vy: 0, speed: PONG_RULES.ballSpeed };
  // Serve toward the player who missed, after a visible countdown.
  state.serveDirection = side === 'left' ? 1 : -1;
  if (state.score[side] >= PONG_RULES.scoreToWin) {
    state.phase = 'finished';
    state.winner = side;
    state.serveRemaining = 0;
  } else {
    state.serveRemaining = PONG_RULES.servePause;
  }
}

function paddleBounce(state, side) {
  const { ball, paddles } = state;
  const contact = clamp((ball.y - paddles[side].y) / (PONG_RULES.paddleHeight / 2), -1, 1);
  const angle = contact * PONG_RULES.maxBounceAngle;
  ball.speed = Math.min(PONG_RULES.maxBallSpeed, ball.speed + PONG_RULES.ballSpeedStep);
  ball.vx = (side === 'left' ? 1 : -1) * ball.speed * Math.cos(angle);
  ball.vy = ball.speed * Math.sin(angle);
}

function simulateStep(state, duration) {
  let remaining = duration;
  let events = 0;
  while (remaining > EPSILON && state.phase === 'playing') {
    if (state.serveRemaining > 0) {
      const pause = Math.min(remaining, state.serveRemaining);
      state.serveRemaining = Math.max(0, state.serveRemaining - pause);
      remaining -= pause;
      if (state.serveRemaining <= EPSILON) serve(state);
      continue;
    }

    const ball = state.ball;
    let collision = null;
    function consider(time, type, side) {
      if (time < -EPSILON || time > remaining + EPSILON) return;
      const safeTime = Math.max(0, Math.min(time, remaining));
      if (!collision || safeTime < collision.time) collision = { time: safeTime, type, side };
    }

    if (ball.vy < 0) consider((PONG_RULES.ballRadius - ball.y) / ball.vy, 'wall', 'top');
    if (ball.vy > 0) consider((PONG_RULES.height - PONG_RULES.ballRadius - ball.y) / ball.vy, 'wall', 'bottom');

    if (ball.vx !== 0) {
      const side = ball.vx < 0 ? 'left' : 'right';
      const paddle = state.paddles[side];
      const direction = side === 'left' ? 1 : -1;
      const face = paddle.x + direction * (PONG_RULES.paddleWidth / 2 + PONG_RULES.ballRadius);
      const impactTime = (face - ball.x) / ball.vx;
      const impactY = ball.y + ball.vy * impactTime;
      if (Math.abs(impactY - paddle.y) <= PONG_RULES.paddleHeight / 2 + PONG_RULES.ballRadius) {
        consider(impactTime, 'paddle', side);
      }
      const goal = side === 'left' ? -PONG_RULES.ballRadius : PONG_RULES.width + PONG_RULES.ballRadius;
      consider((goal - ball.x) / ball.vx, 'goal', side);
    }

    const elapsed = collision ? collision.time : remaining;
    ball.x += ball.vx * elapsed;
    ball.y += ball.vy * elapsed;
    remaining = Math.max(0, remaining - elapsed);
    if (!collision) break;

    if (collision.type === 'wall') {
      ball.y = collision.side === 'top' ? PONG_RULES.ballRadius : PONG_RULES.height - PONG_RULES.ballRadius;
      ball.vy = -ball.vy;
    } else if (collision.type === 'paddle') {
      paddleBounce(state, collision.side);
    } else {
      awardPoint(state, collision.side === 'left' ? 'right' : 'left');
    }
    // With a <=1/120 second step and the speed cap, ordinary play cannot reach
    // this guard; it prevents a malformed external state from looping forever.
    events += 1;
    if (events >= 8) break;
  }
}

// Inputs are vertical axes: -1 is up, +1 is down. Nonfinite/non-numeric axes
// become neutral. Nonfinite dt is rejected; negative dt is a no-op, and long
// frames are capped at 250 ms so a suspended tab cannot fast-forward a match.
export function advancePong(state, inputs = {}, seconds = 0) {
  if (!Number.isFinite(seconds)) throw new TypeError('Pong elapsed time must be a finite number.');
  const next = cloneState(state);
  if (next.phase !== 'playing') return next;
  const duration = clamp(seconds, 0, PONG_RULES.maxFrameTime);
  if (duration === 0) return next;
  const controls = { left: axis(inputs?.left), right: axis(inputs?.right) };
  const steps = Math.ceil(duration / PONG_RULES.maxStep);
  const step = duration / steps;
  const halfPaddle = PONG_RULES.paddleHeight / 2;
  for (let index = 0; index < steps && next.phase === 'playing'; index += 1) {
    for (const side of ['left', 'right']) {
      next.paddles[side].y = clamp(next.paddles[side].y + controls[side] * PONG_RULES.paddleSpeed * step, halfPaddle, PONG_RULES.height - halfPaddle);
    }
    simulateStep(next, step);
    next.tick += 1;
  }
  return next;
}

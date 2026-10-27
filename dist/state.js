const STORAGE_KEY = 'qadam-code:v1';

export const defaultState = Object.freeze({
  name: 'Досым', username: 'qadam_learner', completed: Object.freeze([]),
  xp: 0, goal: 3, drafts: Object.freeze({}), activities: Object.freeze([]), theme: 'dark'
});

const freshDefault = () => ({ ...defaultState, completed: [], drafts: {}, activities: [] });

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function normalize(value) {
  const result = freshDefault();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if (typeof value.name === 'string' && value.name.trim()) result.name = value.name.trim().slice(0, 60);
  if (typeof value.username === 'string' && /^[a-zA-Z0-9_.-]{2,30}$/.test(value.username)) result.username = value.username;
  if (Array.isArray(value.completed)) result.completed = [...new Set(value.completed.filter(item => typeof item === 'string' && item.length > 0 && item.length < 100))];
  if (Number.isFinite(value.xp) && value.xp >= 0) result.xp = Math.floor(value.xp);
  if (Number.isInteger(value.goal) && value.goal > 0 && value.goal <= 12) result.goal = value.goal;
  if (value.drafts && typeof value.drafts === 'object' && !Array.isArray(value.drafts)) {
    result.drafts = Object.fromEntries(Object.entries(value.drafts).filter(([key, code]) => key.length < 100 && typeof code === 'string' && code.length <= 50000));
  }
  if (Array.isArray(value.activities)) {
    result.activities = value.activities.filter(item => item && typeof item === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && typeof item.lessonId === 'string' && Number.isFinite(item.xp) && item.xp >= 0).map(item => ({ date: item.date, lessonId: item.lessonId, xp: Math.floor(item.xp) }));
  }
  if (value.theme === 'light' || value.theme === 'dark') result.theme = value.theme;
  return result;
}

export function loadState() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : freshDefault();
  } catch { return freshDefault(); }
}

export function saveState(state) {
  const next = normalize(state);
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Private mode and storage quota must not break the UI. */ }
  return next;
}

export function completeLesson(state, lessonId, xp) {
  const next = normalize(state);
  if (typeof lessonId !== 'string' || !lessonId || lessonId.length >= 100 || next.completed.includes(lessonId)) return next;
  const reward = Number.isFinite(xp) && xp >= 0 ? Math.floor(xp) : 0;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = name => parts.find(item => item.type === name).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  next.completed.push(lessonId);
  next.xp += reward;
  next.activities.push({ date, lessonId, xp: reward });
  return next;
}

export function resetState() {
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* The fresh in-memory state still works. */ }
  return freshDefault();
}

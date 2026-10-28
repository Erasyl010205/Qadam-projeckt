import test from 'node:test';
import assert from 'node:assert/strict';
import { courses, demoLeaders } from '../public/data.js';
import { defaultState, loadState, saveState, completeLesson, resetState } from '../public/state.js';

function fakeStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

test('new learners start with zero progress and independent state objects', () => {
  delete globalThis.localStorage;
  const first = loadState();
  const second = loadState();
  assert.equal(first.xp, 0);
  assert.deepEqual(first.completed, []);
  first.completed.push('temporary');
  assert.deepEqual(second.completed, []);
  assert.deepEqual(defaultState.completed, []);
});

test('quiz completion grants XP once and does not mutate input', () => {
  const initial = loadState();
  const first = completeLesson(initial, 'py-variables', 50);
  const duplicate = completeLesson(first, 'py-variables', 50);
  const next = completeLesson(duplicate, 'py-input', 50);
  assert.equal(initial.xp, 0);
  assert.deepEqual(initial.completed, []);
  assert.equal(first.xp, 50);
  assert.equal(duplicate.xp, 50);
  assert.equal(duplicate.activities.length, 1);
  assert.equal(next.xp, 100);
  assert.equal(next.completed.length, 2);
  assert.equal(next.activities.length, 2);
  const expectedDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  assert.equal(first.activities[0].date, expectedDay);
});

test('state persists name, progress, drafts and daily goal, then resets', () => {
  globalThis.localStorage = fakeStorage();
  let state = loadState();
  state = completeLesson(state, 'java-variables', 50);
  state.name = 'Дана';
  state.goal = 5;
  state.drafts['java-variables'] = 'public class Main {}';
  saveState(state);
  const restored = loadState();
  assert.equal(restored.name, 'Дана');
  assert.equal(restored.goal, 5);
  assert.equal(restored.xp, 50);
  assert.equal(restored.drafts['java-variables'], 'public class Main {}');
  assert.deepEqual(restored.completed, ['java-variables']);
  resetState();
  assert.deepEqual(loadState(), { ...defaultState, completed: [], drafts: {}, activities: [] });
});

test('corrupt or malformed storage recovers safe defaults', () => {
  globalThis.localStorage = fakeStorage();
  localStorage.setItem('qadam-code:v1', '{broken json');
  assert.equal(loadState().xp, 0);
  localStorage.setItem('qadam-code:v1', JSON.stringify({ name: '', xp: -100, completed: ['py-input', 'py-input', 7], goal: -1, drafts: [], activities: [{ date: 'broken' }], theme: 'unknown' }));
  const state = loadState();
  assert.equal(state.name, 'Досым');
  assert.equal(state.xp, 0);
  assert.equal(state.goal, 3);
  assert.equal(state.theme, 'dark');
  assert.deepEqual(state.completed, ['py-input']);
  assert.deepEqual(state.activities, []);
  assert.deepEqual(state.drafts, {});
});

test('unavailable browser storage and invalid awards do not crash or reduce XP', () => {
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  const initial = loadState();
  const result = completeLesson(initial, 'py-input', -20);
  assert.equal(result.xp, 0);
  assert.doesNotThrow(() => saveState(result));
  assert.doesNotThrow(() => resetState());
  delete globalThis.localStorage;
});

test('expanded courses have unique, valid knowledge checks and code tasks', () => {
  assert.deepEqual(courses.map(course => course.id), ['python', 'java']);
  const ids = new Set();
  for (const course of courses) {
    assert.equal(course.lessons.length, course.id === 'python' ? 8 : 13);
    for (const lesson of course.lessons) {
      assert.ok(!ids.has(lesson.id));
      ids.add(lesson.id);
      assert.ok(lesson.body.length >= 2);
      assert.equal(lesson.options.length, 4);
      assert.ok(Number.isInteger(lesson.answer) && lesson.answer >= 0 && lesson.answer < 4);
      assert.ok(lesson.starter && lesson.example && lesson.task && lesson.explanation);
      assert.ok(lesson.xp > 0);
    }
  }
  assert.equal(ids.size, 21);
  assert.ok(demoLeaders.every(leader => leader.id.startsWith('demo-')));
});

test('expanding Java preserves original completion, XP and drafts while new lessons award XP once', () => {
  const java = courses.find(course => course.id === 'java');
  const originalIds = ['java-variables', 'java-input', 'java-conditions', 'java-loops', 'java-arrays', 'java-methods', 'java-oop', 'java-algorithms'];
  const originalXp = originalIds.reduce((total, id) => total + java.lessons.find(lesson => lesson.id === id).xp, 0);
  const drafts = { 'java-oop': 'class Student {}', 'java-oop::practice-0': '// Менің бұрынғы шешімім' };
  globalThis.localStorage = fakeStorage();
  try {
    localStorage.setItem('qadam-code:v1', JSON.stringify({ completed: originalIds, xp: originalXp, drafts }));
    const restored = loadState();
    assert.deepEqual(restored.completed, originalIds);
    assert.equal(restored.xp, originalXp);
    assert.deepEqual(restored.drafts, drafts);
    assert.equal(java.lessons.length, 13);
    assert.equal(java.lessons.filter(lesson => restored.completed.includes(lesson.id)).length, 8, 'the learner retains eight completed lessons in the expanded course');

    const newLesson = java.lessons.find(lesson => lesson.id === 'java-encapsulation');
    assert.ok(newLesson, 'the next OOP topic must be available');
    const completed = completeLesson(restored, newLesson.id, newLesson.xp);
    assert.equal(restored.completed.length, 8, 'completion must not mutate the restored state');
    assert.equal(completed.completed.length, 9);
    assert.equal(completed.xp, originalXp + newLesson.xp);
    assert.deepEqual(completed.drafts, drafts);
    saveState(completed);

    const duplicate = completeLesson(loadState(), newLesson.id, newLesson.xp);
    assert.equal(duplicate.xp, originalXp + newLesson.xp);
    assert.equal(duplicate.completed.length, 9);
    assert.equal(duplicate.activities.length, 1);
    assert.deepEqual(duplicate.drafts, drafts);
  } finally {
    delete globalThis.localStorage;
  }
});

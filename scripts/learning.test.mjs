import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeLesson, lessonChecks, workspaceTask } from '../public/learning.js';

const lesson = {
  id: 'py-sample', title: 'Үлгі сабақ', task: 'Негізгі тапсырма', starter: '# негізгі код\n',
  question: 'Бұрынғы сұрақ', options: ['A', 'B', 'C'], answer: 2, explanation: 'Бұрынғы түсіндірме',
  checks: [
    { question: 'Бірінші сұрақ', options: ['A', 'B', 'C'], answer: 1, explanation: 'Бірінші түсіндірме' },
    { question: 'Екінші сұрақ', options: ['A', 'B', 'C', 'D'], answer: 3, explanation: 'Екінші түсіндірме' },
    { question: 'Үшінші сұрақ', options: ['A', 'B', 'C'], answer: 0, explanation: 'Үшінші түсіндірме' },
  ],
  practice: [
    { title: 'Екі санның қосындысы', description: 'Қосындыны есепте', hint: '+ қолдан', solution: 'print(42)', output: '42' },
    { title: 'Екі санның көбейтіндісі', description: 'Көбейтіндіні есепте', hint: '* қолдан', solution: 'print(60)', output: '60' },
    { title: 'Салыстыру', description: 'Мәндерді салыстыр', hint: '> қолдан', solution: 'print(True)', output: 'True' },
  ],
};

test('completion requires every expanded knowledge check to be correct', () => {
  const correct = gradeLesson(lesson, ['1', '3', '0']);
  assert.equal(correct.total, 3);
  assert.equal(correct.correct, 3);
  assert.equal(correct.allCorrect, true);
  assert.equal(correct.unanswered, 0);
  const partial = gradeLesson(lesson, ['1', '2', '0']);
  assert.equal(partial.correct, 2);
  assert.equal(partial.allCorrect, false);
  assert.equal(partial.results[1].explanation, 'Екінші түсіндірме');
  assert.equal(partial.results[1].selected, 2);
  assert.equal(partial.results[1].correct, false);
});

test('missing answers cannot accidentally select the first option', () => {
  for (const answers of [[], ['1'], ['1', '3'], ['1', '3', ''], ['1', '3', null], ['1', '3', undefined]]) {
    const result = gradeLesson(lesson, answers);
    assert.equal(result.allCorrect, false);
    assert.ok(result.unanswered >= 1);
    assert.equal(result.results[2].selected, null);
  }
});

test('out of range, fractional, negative and malformed answers fail safely', () => {
  for (const value of ['4', 99, -1, '-1', '0.5', 0.5, '0x0', '0abc', NaN, false, {}, []]) {
    const result = gradeLesson(lesson, ['1', '3', value]);
    assert.equal(result.allCorrect, false, `invalid answer ${String(value)}`);
    assert.equal(result.unanswered, 1);
    assert.equal(result.results[2].selected, null);
  }
});

test('grading does not mutate authored content or submitted answers', () => {
  const content = structuredClone(lesson);
  const answers = ['1', '3', '0'];
  const before = structuredClone(content);
  for (const check of content.checks) {
    Object.freeze(check.options);
    Object.freeze(check);
  }
  Object.freeze(content.checks);
  Object.freeze(content);
  Object.freeze(answers);
  assert.equal(gradeLesson(content, answers).allCorrect, true);
  assert.deepEqual(content, before);
  assert.deepEqual(answers, ['1', '3', '0']);
});

test('legacy lessons still use their original single completion question', () => {
  const legacy = { question: 'Дұрыс мән?', options: ['A', 'B', 'C'], answer: 2, explanation: 'C дұрыс' };
  assert.equal(lessonChecks(legacy).length, 1);
  assert.equal(gradeLesson(legacy, ['2']).allCorrect, true);
  assert.equal(gradeLesson({ ...legacy, checks: [] }, ['2']).allCorrect, true);
  assert.equal(gradeLesson(legacy, ['0']).allCorrect, false);
  assert.equal(gradeLesson(legacy, []).unanswered, 1);
});

test('each practice has an independent stable draft and matching instructions', () => {
  const tasks = ['0', '1', '2'].map(index => workspaceTask(lesson, { id: 'python' }, index));
  assert.equal(new Set(tasks.map(task => task.draftKey)).size, 3);
  assert.ok(tasks.every(task => task.draftKey !== lesson.id));
  tasks.forEach((task, index) => {
    assert.equal(task.index, index);
    assert.equal(task.description, lesson.practice[index].description);
    assert.equal(workspaceTask(lesson, { id: 'python' }, String(index)).draftKey, task.draftKey);
  });
  const other = workspaceTask({ ...lesson, id: 'py-other' }, { id: 'python' }, '0');
  assert.notEqual(other.draftKey, tasks[0].draftKey);
});

test('invalid or absent exercise links preserve the original lesson workspace', () => {
  for (const index of [undefined, null, '', 'bogus', '-1', '0.5', '999']) {
    const task = workspaceTask(lesson, { id: 'python' }, index);
    assert.equal(task.index, -1);
    assert.equal(task.draftKey, lesson.id);
    assert.equal(task.description, lesson.task);
    assert.equal(task.starter, lesson.starter);
  }
  assert.equal(workspaceTask({ ...lesson, practice: undefined }, { id: 'python' }, '0').draftKey, lesson.id);
});

test('Python and Java workspaces start with appropriate editable scaffolds', () => {
  const python = workspaceTask(lesson, { id: 'python' }, '0');
  assert.ok(python.starter.startsWith('# '));
  assert.ok(python.starter.includes(lesson.practice[0].title));
  assert.ok(!python.starter.includes(lesson.practice[0].solution));
  const java = workspaceTask({ ...lesson, id: 'java-sample' }, { id: 'java' }, '0');
  assert.match(java.starter, /public class Main\s*\{/);
  assert.match(java.starter, /public static void main\(String\[\] args\)/);
  assert.ok(java.starter.includes(lesson.practice[0].title));
  assert.ok(!java.starter.includes(lesson.practice[0].solution));
});

test('multiline practice titles remain comments in both starter languages', () => {
  const multiline = { ...lesson, practice: [{ ...lesson.practice[0], title: 'Бірінші жол\nЕкінші жол' }] };
  const python = workspaceTask(multiline, { id: 'python' }, '0');
  assert.ok(python.starter.split('\n')[0].includes('Бірінші жол Екінші жол'));
  const java = workspaceTask(multiline, { id: 'java' }, '0');
  assert.match(java.starter, /\/\/ Бірінші жол Екінші жол/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { courses } from '../dist/data.js';

const expectedIds = {
  python: ['py-variables', 'py-input', 'py-conditions', 'py-loops', 'py-lists', 'py-functions', 'py-dictionaries', 'py-algorithms'],
  java: ['java-variables', 'java-input', 'java-conditions', 'java-loops', 'java-arrays', 'java-methods', 'java-oop', 'java-algorithms'],
};

function text(value, label) {
  assert.equal(typeof value, 'string', `${label} must be text`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function list(value, minimum, label) {
  assert.ok(Array.isArray(value), `${label} must be a list`);
  assert.ok(value.length >= minimum, `${label} needs at least ${minimum} items`);
}

function question(value, label) {
  text(value.question, `${label} question`);
  list(value.options, 3, `${label} options`);
  value.options.forEach((option, index) => text(option, `${label} option ${index}`));
  assert.equal(new Set(value.options.map(option => option.trim())).size, value.options.length, `${label} options must be distinct`);
  assert.ok(Number.isInteger(value.answer) && value.answer >= 0 && value.answer < value.options.length, `${label} answer must identify an available option`);
  text(value.explanation, `${label} explanation`);
}

test('all original course and lesson links remain available', () => {
  assert.deepEqual(courses.map(course => course.id), ['python', 'java']);
  for (const course of courses) {
    assert.deepEqual(course.lessons.map(lesson => lesson.id), expectedIds[course.id]);
  }
});

for (const course of courses) {
  for (const lesson of course.lessons) {
    test(`${lesson.id}: a complete learning path from explanation to independent practice`, () => {
      assert.ok(Number.isFinite(lesson.minutes) && lesson.minutes >= 15, 'reading time must account for the expanded lesson');
      list(lesson.objectives, 3, 'learning objectives');
      lesson.objectives.forEach(objective => text(objective, 'objective'));
      text(lesson.prerequisites, 'prerequisites');
      text(lesson.introduction, 'introduction');
      list(lesson.sections, 4, 'theory sections');
      lesson.sections.forEach((section, index) => {
        text(section.title, `section ${index} title`);
        list(section.paragraphs, 1, `section ${index} explanation`);
        section.paragraphs.forEach(paragraph => text(paragraph, `section ${index} paragraph`));
        list(section.details, 1, `section ${index} detailed reading`);
        section.details.forEach(paragraph => text(paragraph, `section ${index} detailed paragraph`));
        if (section.code !== undefined) text(section.code, `section ${index} code`);
      });
      // Count both concise explanations and the optional detailed reading.
      const explanationLength = lesson.sections.flatMap(section => [...section.paragraphs, ...(section.details || [])]).join(' ').length;
      assert.ok(explanationLength >= 1000, 'theory needs at least 1,000 characters of explanatory prose');
      list(lesson.examples, 2, 'worked examples');
      lesson.examples.forEach((example, index) => {
        text(example.title, `example ${index} title`);
        text(example.description, `example ${index} context`);
        text(example.code, `example ${index} code`);
        text(example.output, `example ${index} expected output`);
        list(example.steps, 2, `example ${index} walkthrough`);
        example.steps.forEach(step => text(step, `example ${index} step`));
        if (example.input !== undefined) assert.equal(typeof example.input, 'string');
      });
      list(lesson.mistakes, 2, 'common mistakes');
      lesson.mistakes.forEach((mistake, index) => {
        text(mistake.title, `mistake ${index} title`);
        text(mistake.description, `mistake ${index} explanation`);
      });
      list(lesson.practice, 3, 'independent exercises');
      lesson.practice.forEach((exercise, index) => {
        text(exercise.title, `exercise ${index} title`);
        text(exercise.description, `exercise ${index} instructions`);
        text(exercise.hint, `exercise ${index} hint`);
        text(exercise.solution, `exercise ${index} reference solution`);
        text(exercise.output, `exercise ${index} expected output`);
        if (exercise.input !== undefined) assert.equal(typeof exercise.input, 'string');
      });
      list(lesson.summary, 3, 'lesson summary');
      lesson.summary.forEach(item => text(item, 'summary item'));
      list(lesson.checks, 3, 'knowledge checks');
      lesson.checks.forEach((check, index) => question(check, `check ${index}`));
      const normalized = lesson.checks.map(check => check.question.trim().toLocaleLowerCase());
      assert.equal(new Set(normalized).size, normalized.length, 'each knowledge check must ask a different question');
      list(lesson.resources, 1, 'official reading resources');
      const officialHosts = course.id === 'python'
        ? new Set(['docs.python.org'])
        : new Set(['dev.java', 'docs.oracle.com']);
      lesson.resources.forEach(resource => {
        text(resource.title, 'resource title');
        const url = new URL(resource.url);
        assert.equal(url.protocol, 'https:', 'resources must use HTTPS');
        assert.ok(officialHosts.has(url.hostname), `${url.hostname} is not official ${course.language} documentation`);
      });
      // Existing completion and XP flows must retain a valid final question.
      question(lesson, 'completion question');
    });
  }
}

test('knowledge checks do not repeat across lessons', () => {
  const questions = courses.flatMap(course => course.lessons.flatMap(lesson => (lesson.checks || []).map(check => check.question.trim().toLocaleLowerCase())));
  assert.equal(new Set(questions).size, questions.length, 'knowledge checks must not be duplicated across the curriculum');
});

// Executes only the trusted examples authored for this curriculum.
// Never use this script as an endpoint for arbitrary student submissions.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { courses } from '../dist/data.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratchParent = resolve(projectRoot, '../../work/example-verification');
mkdirSync(scratchParent, { recursive: true });
const scratch = mkdtempSync(resolve(scratchParent, 'run-'));
const python = process.env.QADAM_PYTHON || 'python';
const java = process.env.QADAM_JAVA || 'java';
const javac = process.env.QADAM_JAVAC || 'javac';
const timeout = 10000;

const normalizeOutput = value => String(value).replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[\t ]+$/g, '')).join('\n').replace(/\n+$/, '');

function execute(command, args, options, label) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 1024 * 1024, ...options });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}: exit ${result.status}\n${result.stderr || result.stdout}`);
  return result.stdout;
}

let passed = 0;
const failures = [];
for (const course of courses) {
  for (const lesson of course.lessons) {
    const programs = [
      ...(lesson.examples || []).map((program, index) => ({ ...program, label: `example-${index + 1}` })),
      ...(lesson.practice || []).map((program, index) => ({ ...program, code: program.solution, label: `practice-${index + 1}` })),
    ];
    if (programs.length < 5) failures.push(`${lesson.id}: expected at least 5 runnable examples/solutions, got ${programs.length}`);
    for (const program of programs) {
      const label = `${lesson.id}/${program.label}`;
      try {
        assert.equal(typeof program.code, 'string', `${label}: missing code`);
        assert.equal(typeof program.output, 'string', `${label}: missing expected output`);
        const programDir = resolve(scratch, `${lesson.id}-${program.label}`);
        mkdirSync(programDir, { recursive: true });
        const input = program.input || '';
        let actual;
        if (course.id === 'python') {
          const filename = resolve(programDir, 'main.py');
          writeFileSync(filename, program.code, 'utf8');
          actual = execute(python, ['-X', 'utf8', filename], { cwd: programDir, input, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } }, label);
        } else {
          const filename = resolve(programDir, 'Main.java');
          writeFileSync(filename, program.code, 'utf8');
          execute(javac, ['-encoding', 'UTF-8', filename], { cwd: programDir }, `${label} compilation`);
          actual = execute(java, ['-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8', '-cp', programDir, 'Main'], { cwd: programDir, input }, label);
        }
        assert.equal(normalizeOutput(actual), normalizeOutput(program.output), `${label}: output differs`);
        passed += 1;
      } catch (error) {
        failures.push(`${label}: ${error.message}`);
      }
    }
  }
}

console.log(`Verified ${passed} authored programs. Scratch: ${scratch}`);
if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exitCode = 1;
} else {
  console.log('All expected example and practice outputs match real language runtimes.');
}

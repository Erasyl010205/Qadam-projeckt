import { spawnSync } from 'node:child_process';
const files = ['app.js', 'data.js', 'state.js', 'learning.js', 'lesson-view.js', 'battle-view.js', 'battle-quiz.js', 'pong-view.js', 'pong-engine.js', 'content/python.js', 'content/java.js', 'content/java-oop.js'];
for (const file of [...files.map(name => 'public/' + name), 'server/pong-api.js', 'server/sqlite-d1.js', 'scripts/serve.mjs']) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
const result = spawnSync(process.execPath, ['--test', 'scripts/state.test.mjs', 'scripts/learning.test.mjs', 'scripts/content.test.mjs', 'scripts/pong.test.mjs', 'scripts/pong-api.test.mjs'], { stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);

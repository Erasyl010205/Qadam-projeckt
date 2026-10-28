// Local D1-compatible binding. Schema migration is a startup operation; request
// handlers only execute normal application queries against an existing schema.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

function statement(db, sql, values = []) {
  const prepared = db.prepare(sql);
  return {
    bind(...nextValues) { return statement(db, sql, nextValues); },
    async first(column) {
      const row = prepared.get(...values);
      if (!row) return null;
      return column === undefined ? { ...row } : (row[column] ?? null);
    },
    async all() {
      return { success: true, results: prepared.all(...values).map(row => ({ ...row })), meta: {} };
    },
    async run() {
      const result = prepared.run(...values);
      return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    },
  };
}

function migrationFiles(directory) {
  const journalFile = join(directory, 'meta', '_journal.json');
  if (!existsSync(journalFile)) return readdirSync(directory).filter(file => file.endsWith('.sql')).sort();
  const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
  if (!Array.isArray(journal.entries)) throw new Error('Invalid Drizzle migration journal.');
  return [...journal.entries].sort((a, b) => a.idx - b.idx).map(entry => {
    if (typeof entry.tag !== 'string' || !entry.tag || basename(entry.tag) !== entry.tag) {
      throw new Error('Invalid Drizzle migration tag.');
    }
    return `${entry.tag}.sql`;
  });
}

export function openLocalD1(filename, { migrationsDir } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  const binding = {
    prepare(sql) { return statement(db, sql); },
    withSession() { return binding; },
    exec(sql) { db.exec(sql); return { count: 1, duration: 0 }; },
    close() { db.close(); },
    applyMigrations(directory) {
      const files = migrationFiles(directory);
      const applied = [];
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec('CREATE TABLE IF NOT EXISTS __qadam_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
        for (const file of files) {
          const sql = readFileSync(join(directory, file), 'utf8');
          const checksum = createHash('sha256').update(sql).digest('hex');
          const previous = db.prepare('SELECT checksum FROM __qadam_migrations WHERE id = ?').get(file);
          if (previous) {
            if (previous.checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
            continue;
          }
          db.exec(sql);
          db.prepare('INSERT INTO __qadam_migrations (id, checksum, applied_at) VALUES (?, ?, ?)').run(file, checksum, Date.now());
          applied.push(file);
        }
        db.exec('COMMIT');
        return applied;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  if (migrationsDir) {
    try { binding.applyMigrations(migrationsDir); } catch (error) { binding.close(); throw error; }
  }
  return binding;
}

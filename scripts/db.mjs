#!/usr/bin/env node
/**
 * Database migration / seed / status tool for the Neon growth schema.
 *
 *   npm run db:migrate   apply scripts/schema.sql, then scripts/seed.sql
 *   npm run db:status    list tables and row counts
 *
 * Both SQL files are idempotent, so migrate is safe to re-run.
 *
 * Connection string is read from DATABASE_URL in the environment, falling back to
 * .env / .env.development.local for local use. It is never printed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, '..');

function resolveConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  for (const file of ['.env', '.env.development.local']) {
    const path = join(projectRoot, file);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }

  return null;
}

/**
 * Split a SQL file into individual statements. The Neon HTTP driver executes one
 * statement per round-trip, so the file cannot be sent as a single blob.
 * Quote- and comment-aware so semicolons inside string literals are not split on.
 */
function splitStatements(sqlText) {
  const statements = [];
  let current = '';
  let inString = false;
  let inLineComment = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const next = sqlText[i + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      current += char;
      continue;
    }

    if (!inString && char === '-' && next === '-') {
      inLineComment = true;
      current += char;
      continue;
    }

    if (char === "'") {
      // '' inside a string is an escaped quote, not a terminator.
      if (inString && next === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = !inString;
      current += char;
      continue;
    }

    if (char === ';' && !inString) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

/** Strip comments/whitespace to produce a short label for logging. */
function describe(statement) {
  const meaningful = statement
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return meaningful.slice(0, 68);
}

async function runFile(sql, filename) {
  const path = join(scriptDir, filename);
  const statements = splitStatements(readFileSync(path, 'utf8'));

  console.log(`\n${filename} — ${statements.length} statement(s)`);
  for (const statement of statements) {
    try {
      // sql.query() is the non-tagged form required by @neondatabase/serverless v1.
      await sql.query(statement);
      console.log(`  ok   ${describe(statement)}`);
    } catch (error) {
      console.error(`  FAIL ${describe(statement)}`);
      console.error(`       ${error.message}`);
      throw error;
    }
  }
}

async function status(sql) {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  if (tables.length === 0) {
    console.log('No tables in public schema. Run: npm run db:migrate');
    return;
  }

  console.log(`\n${tables.length} table(s) in public schema:`);
  for (const { table_name } of tables) {
    const [{ n }] = await sql.query(`SELECT COUNT(*)::int AS n FROM "${table_name}"`);
    console.log(`  ${String(n).padStart(6)}  ${table_name}`);
  }
}

/**
 * Conversions grouped by experiment arm and acquisition channel — the join the
 * scheduled analysis relies on, and a quick way to confirm attribution is landing.
 */
async function report(sql) {
  const byVariant = await sql`
    SELECT e.name          AS experiment,
           v.variant_name  AS variant,
           v.is_control    AS is_control,
           COUNT(u.id)::int AS signups
    FROM experiment_variants v
    JOIN experiments e ON e.id = v.experiment_id
    LEFT JOIN users u  ON u.variant_id = v.id
    GROUP BY e.name, v.variant_name, v.is_control
    ORDER BY v.is_control DESC
  `;

  console.log('\nSignups by experiment arm:');
  for (const row of byVariant) {
    const tag = row.is_control ? '[control]' : '[variant]';
    console.log(`  ${String(row.signups).padStart(4)}  ${tag} ${row.variant}`);
  }

  const byChannel = await sql`
    SELECT COALESCE(channel, 'unattributed') AS channel,
           COUNT(*)::int AS signups
    FROM users
    GROUP BY channel
    ORDER BY signups DESC
  `;

  console.log('\nSignups by acquisition channel:');
  for (const row of byChannel) {
    console.log(`  ${String(row.signups).padStart(4)}  ${row.channel}`);
  }
}

async function main() {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    console.error(
      'DATABASE_URL not found. Set it in the environment or in .env / .env.development.local'
    );
    process.exit(1);
  }

  const sql = neon(connectionString);
  const command = process.argv[2] ?? 'migrate';

  if (command === 'status') {
    await status(sql);
    return;
  }

  if (command === 'report') {
    await report(sql);
    return;
  }

  if (command === 'migrate') {
    await runFile(sql, 'schema.sql');
    await runFile(sql, 'seed.sql');
    await status(sql);
    console.log('\nMigration complete.');
    return;
  }

  console.error(`Unknown command: ${command}. Expected "migrate" or "status".`);
  process.exit(1);
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});

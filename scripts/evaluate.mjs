#!/usr/bin/env node
/**
 * Manual trigger for the evaluation agent (Mode A in
 * docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §2).
 *
 *   npm run eval-test                      evaluate every running experiment
 *   npm run eval-test -- --dry-run         compute and report, change nothing
 *   npm run eval-test -- --experiment 1    evaluate one experiment
 *   npm run eval-test -- --dry-run --fixture 3420,110,3580,172
 *
 * The fixture form feeds synthetic control/variant counts
 * (control_visitors,control_signups,variant_visitors,variant_signups) through the real
 * statistical gate, decision matrix and AI layer. It exists so the promote and kill
 * paths can be exercised before there is enough live traffic to reach them, and the
 * server refuses it outside a dry run — synthetic numbers can never move real traffic.
 *
 * Targets a running server (default http://localhost:4321). Set BASE_URL to point at a
 * deployment, and CRON_SECRET to authenticate when you have no admin cookie.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function fromEnvFile(key) {
  for (const file of ['.env', '.env.development.local']) {
    const path = join(projectRoot, file);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function parseFixture(raw) {
  if (!raw) return undefined;

  const parts = raw.split(',').map((value) => Number(value.trim()));
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    console.error(
      'Fixture must be four numbers: control_visitors,control_signups,variant_visitors,variant_signups'
    );
    process.exit(1);
  }

  const [controlVisitors, controlSignups, variantVisitors, variantSignups] = parts;
  return {
    control: { visitors: controlVisitors, signups: controlSignups },
    variant: { visitors: variantVisitors, signups: variantSignups },
  };
}

function pct(value) {
  return value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(2)}%`;
}

function report(run) {
  console.log(`\nTrigger: ${run.trigger}${run.dry_run ? ' (dry run)' : ''}`);
  console.log(`Evaluated ${run.evaluated} experiment(s)\n`);

  for (const result of run.results) {
    const test = result.verdict?.primary?.test;

    console.log(`── ${result.experiment_name} (${result.experiment_id})`);
    console.log(`   decision   ${result.decision}${result.executed ? ' — EXECUTED' : ''}`);
    console.log(`   source     ${result.metrics.source}`);

    if (test) {
      console.log(
        `   control    ${test.control.conversions}/${test.control.visitors} (${pct(test.control_cr)})`
      );
      console.log(
        `   variant    ${test.variant.conversions}/${test.variant.visitors} (${pct(test.variant_cr)})`
      );
      console.log(
        `   lift       ${test.relative_lift_pct === null ? 'n/a' : `${test.relative_lift_pct.toFixed(1)}%`}` +
          `   p=${test.p_value === null ? 'n/a' : test.p_value.toFixed(4)}` +
          `   z=${test.z_score === null ? 'n/a' : test.z_score.toFixed(3)}`
      );
      console.log(
        `   sample     target ${test.sample_target}/arm — ${
          test.is_underpowered ? `${test.remaining_visitors} short` : 'powered'
        }`
      );
    }

    console.log(`   rationale  ${result.rationale}`);
    console.log(
      `   diagnosis  ${result.diagnosis.narrative}` +
        (result.diagnosis.model ? ` [${result.diagnosis.model}]` : ' [deterministic]')
    );
    if (result.diagnosis.recommendation) {
      console.log(`   next       ${result.diagnosis.recommendation}`);
    }
    console.log(`   action     ${result.action_taken}`);

    for (const note of result.metrics.notes) console.log(`   note       ${note}`);
    console.log();
  }

  for (const skip of run.skipped) {
    console.log(`── ${skip.experiment_id}: skipped — ${skip.reason}`);
  }
}

async function main() {
  const baseUrl = (process.env.BASE_URL ?? 'http://localhost:4321').replace(/\/$/, '');
  const secret = process.env.CRON_SECRET ?? fromEnvFile('CRON_SECRET');

  const dryRun = flag('dry-run');
  const fixture = parseFixture(option('fixture'));

  if (fixture && !dryRun) {
    console.error('--fixture requires --dry-run: synthetic counts must never drive a real action.');
    process.exit(1);
  }

  const body = {
    ...(dryRun ? { dry_run: 'true' } : {}),
    ...(option('experiment') ? { experiment_id: option('experiment') } : {}),
    ...(option('window') ? { window_days: option('window') } : {}),
    ...(fixture ? { fixture: JSON.stringify(fixture) } : {}),
  };

  console.log(`POST ${baseUrl}/api/engine/evaluate`);

  const response = await fetch(`${baseUrl}/api/engine/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    console.error(
      '\nUnauthorized. Set CRON_SECRET in .env (and in the server environment) so the CLI can authenticate.'
    );
    process.exit(1);
  }

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    console.error(`\nEvaluation failed: ${payload.error ?? response.status}`);
    process.exit(1);
  }

  report(payload.data);
}

main().catch((error) => {
  console.error(`\nCould not reach the server: ${error.message}`);
  console.error('Is `npm run dev` running, or BASE_URL pointing at a deployment?');
  process.exit(1);
});

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const match = readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.+)$/m);
const sql = neon(match[1].trim().replace(/^["']|["']$/g, ''));

async function check() {
  const icps = await sql`SELECT id, slug, name, primary_emotion, target_keywords, core_pains, core_desires FROM icps`;
  console.log('=== ICPS ===');
  console.log(JSON.stringify(icps, null, 2));

  const experiments = await sql`SELECT id, icp_id, name, hypothesis, status, primary_metric, baseline_cr, target_cr FROM experiments`;
  console.log('\n=== EXPERIMENTS ===');
  console.log(JSON.stringify(experiments, null, 2));

  const variants = await sql`SELECT id, experiment_id, variant_key, variant_name, is_control, weight, active, copy_payload FROM experiment_variants ORDER BY experiment_id, is_control DESC`;
  console.log('\n=== VARIANTS ===');
  console.log(JSON.stringify(variants, null, 2));
}

check().catch(console.error);

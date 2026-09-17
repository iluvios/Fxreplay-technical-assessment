import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { COPY_DICTIONARY } from './copy-dictionary';
import {
  EXPERIMENTS,
  assignArm,
  type Assignment,
  type Experiment,
  type ExperimentArm,
} from './experiments';
import type { ExperimentVariantCopy } from './copy-dictionary';

/**
 * Experiment persistence and the runtime registry the landing pages resolve against.
 *
 * Why this layer exists at all: `src/lib/experiments.ts` holds a hard-coded registry,
 * which is fine for serving a fixed test but makes the admin console and the evaluation
 * agent decorative — pausing an experiment or killing a variant in the UI would change
 * nothing about what visitors see. Routing assignment through the database closes that
 * loop: `active = FALSE` on a variant genuinely reverts its traffic to control, which is
 * the entire premise of the agent's circuit breaker.
 *
 * Copy stays in `copy-dictionary.ts`, joined by `variant_key`. Copy is reviewed, typed
 * and shipped with the code; only *allocation* (status, weights, active flags) is data.
 * `copy_payload` in the database remains a queryable snapshot for the AI layer.
 *
 * Falls back to an in-memory store seeded from the static registry when DATABASE_URL is
 * absent or Neon is unreachable, matching the degradation strategy in `db.ts`.
 */

export type ExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'winner_promoted'
  | 'killed';

export const EXPERIMENT_STATUSES: ExperimentStatus[] = [
  'draft',
  'running',
  'paused',
  'completed',
  'winner_promoted',
  'killed',
];

export interface VariantRecord {
  id: string;
  experiment_id: string;
  /** Joins to COPY_DICTIONARY and to the arm the visitor was bucketed into. */
  variant_key: string;
  variant_name: string;
  is_control: boolean;
  weight: number;
  active: boolean;
  copy_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ExperimentRecord {
  /** Human-readable, and the value carried in ?lp=. */
  id: string;
  icp_id: string | null;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  primary_metric: string;
  baseline_cr: number | null;
  target_cr: number | null;
  winning_variant_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  evaluated_at: string | null;
}

export interface ExperimentWithVariants extends ExperimentRecord {
  variants: VariantRecord[];
}

export interface IcpRecord {
  id: string;
  slug: string;
  name: string;
  traffic_weight: number;
  primary_emotion: string;
  target_channel: string;
  target_keywords: string[];
  core_pains: string[];
  core_desires: string[];
}

export interface CreateExperimentInput {
  id: string;
  name: string;
  hypothesis: string;
  icp_id: string | null;
  status: ExperimentStatus;
  primary_metric: string;
  baseline_cr: number | null;
  target_cr: number | null;
}

export interface UpdateExperimentInput {
  name?: string;
  hypothesis?: string;
  icp_id?: string | null;
  status?: ExperimentStatus;
  primary_metric?: string;
  baseline_cr?: number | null;
  target_cr?: number | null;
}

export interface CreateVariantInput {
  variant_key: string;
  variant_name: string;
  is_control: boolean;
  weight: number;
  active?: boolean;
}

export interface UpdateVariantInput {
  variant_name?: string;
  weight?: number;
  active?: boolean;
  is_control?: boolean;
}

/** One agent evaluation, persisted for audit. See scripts/schema.sql §6. */
export interface DecisionRecord {
  id: string;
  experiment_id: string;
  variant_id: string | null;
  decision: 'PROMOTE' | 'KILL' | 'HUMAN_REVIEW' | 'CONTINUE';
  trigger_source: 'cron' | 'manual' | 'human';
  metrics_source: 'posthog' | 'database';
  control_visitors: number;
  control_signups: number;
  variant_visitors: number;
  variant_signups: number;
  control_cr: number | null;
  variant_cr: number | null;
  relative_lift_pct: number | null;
  z_score: number | null;
  p_value: number | null;
  confidence_pct: number | null;
  sample_target: number | null;
  is_significant: boolean;
  is_underpowered: boolean;
  rationale: string;
  ai_diagnosis: string | null;
  ai_model: string | null;
  action_taken: string | null;
  executed: boolean;
  created_at: string;
}

export type NewDecision = Omit<DecisionRecord, 'id' | 'created_at'>;

/** Aggregate signup counts per variant, straight from the `users` table. */
export interface VariantSignupCount {
  variant_id: string;
  signups: number;
}

export class ExperimentNotFoundError extends Error {
  constructor(id: string) {
    super(`Experiment ${id} not found`);
    this.name = 'ExperimentNotFoundError';
  }
}

export class DuplicateExperimentError extends Error {
  constructor(id: string) {
    super(`An experiment with the id "${id}" already exists`);
    this.name = 'DuplicateExperimentError';
  }
}

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: unknown): string | null {
  return value ? new Date(value as string).toISOString() : null;
}

function toExperiment(row: Record<string, any>): ExperimentRecord {
  return {
    id: row.id,
    icp_id: row.icp_id ?? null,
    name: row.name,
    hypothesis: row.hypothesis,
    status: row.status,
    primary_metric: row.primary_metric,
    baseline_cr: toNumber(row.baseline_cr),
    target_cr: toNumber(row.target_cr),
    winning_variant_id: row.winning_variant_id ?? null,
    created_at: new Date(row.created_at).toISOString(),
    started_at: toIso(row.started_at),
    ended_at: toIso(row.ended_at),
    evaluated_at: toIso(row.evaluated_at),
  };
}

function toVariant(row: Record<string, any>): VariantRecord {
  return {
    id: row.id,
    experiment_id: row.experiment_id,
    variant_key: row.variant_key,
    variant_name: row.variant_name,
    is_control: Boolean(row.is_control),
    weight: Number(row.weight),
    active: Boolean(row.active),
    copy_payload: row.copy_payload ?? null,
    created_at: new Date(row.created_at).toISOString(),
  };
}

function toDecision(row: Record<string, any>): DecisionRecord {
  return {
    id: row.id,
    experiment_id: row.experiment_id,
    variant_id: row.variant_id ?? null,
    decision: row.decision,
    trigger_source: row.trigger_source,
    metrics_source: row.metrics_source,
    control_visitors: Number(row.control_visitors),
    control_signups: Number(row.control_signups),
    variant_visitors: Number(row.variant_visitors),
    variant_signups: Number(row.variant_signups),
    control_cr: toNumber(row.control_cr),
    variant_cr: toNumber(row.variant_cr),
    relative_lift_pct: toNumber(row.relative_lift_pct),
    z_score: toNumber(row.z_score),
    p_value: toNumber(row.p_value),
    confidence_pct: toNumber(row.confidence_pct),
    sample_target: toNumber(row.sample_target),
    is_significant: Boolean(row.is_significant),
    is_underpowered: Boolean(row.is_underpowered),
    rationale: row.rationale,
    ai_diagnosis: row.ai_diagnosis ?? null,
    ai_model: row.ai_model ?? null,
    action_taken: row.action_taken ?? null,
    executed: Boolean(row.executed),
    created_at: new Date(row.created_at).toISOString(),
  };
}

export interface ExperimentRepository {
  list(): Promise<ExperimentWithVariants[]>;
  get(id: string): Promise<ExperimentWithVariants | null>;
  create(input: CreateExperimentInput, variants: CreateVariantInput[]): Promise<ExperimentWithVariants>;
  update(id: string, patch: UpdateExperimentInput): Promise<ExperimentWithVariants | null>;
  remove(id: string): Promise<boolean>;

  addVariant(experimentId: string, input: CreateVariantInput): Promise<VariantRecord | null>;
  updateVariant(variantId: string, patch: UpdateVariantInput): Promise<VariantRecord | null>;
  removeVariant(variantId: string): Promise<boolean>;

  /** Route 100% of the experiment's traffic to one arm and close the test. */
  promoteVariant(experimentId: string, variantId: string): Promise<ExperimentWithVariants | null>;
  /** Circuit breaker: deactivate one arm so its traffic reverts to control. */
  deactivateVariant(variantId: string): Promise<VariantRecord | null>;

  listIcps(): Promise<IcpRecord[]>;
  signupCountsByVariant(experimentId: string): Promise<VariantSignupCount[]>;
  recordDecision(decision: NewDecision): Promise<DecisionRecord>;
  listDecisions(experimentId?: string, limit?: number): Promise<DecisionRecord[]>;
  markEvaluated(experimentId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Neon-backed implementation
// ─────────────────────────────────────────────────────────────────────────────

class NeonExperimentRepository implements ExperimentRepository {
  constructor(private readonly sql: ReturnType<typeof neon>) {}

  async list(): Promise<ExperimentWithVariants[]> {
    const experiments = (await this.sql`
      SELECT * FROM experiments ORDER BY created_at DESC
    `) as any[];
    const variants = (await this.sql`
      SELECT * FROM experiment_variants ORDER BY is_control DESC, variant_key ASC
    `) as any[];

    // One query per table rather than per experiment: the variant set is small enough to
    // group in memory, and N+1 round-trips over the HTTP driver are the expensive part.
    const byExperiment = new Map<string, VariantRecord[]>();
    for (const row of variants) {
      const variant = toVariant(row);
      const bucket = byExperiment.get(variant.experiment_id);
      if (bucket) bucket.push(variant);
      else byExperiment.set(variant.experiment_id, [variant]);
    }

    return experiments.map((row) => ({
      ...toExperiment(row),
      variants: byExperiment.get(row.id) ?? [],
    }));
  }

  async get(id: string): Promise<ExperimentWithVariants | null> {
    const rows = (await this.sql`SELECT * FROM experiments WHERE id = ${id}`) as any[];
    if (rows.length === 0) return null;

    const variants = (await this.sql`
      SELECT * FROM experiment_variants
       WHERE experiment_id = ${id}
       ORDER BY is_control DESC, variant_key ASC
    `) as any[];

    return { ...toExperiment(rows[0]), variants: variants.map(toVariant) };
  }

  async create(input: CreateExperimentInput, variants: CreateVariantInput[]) {
    try {
      await this.sql`
        INSERT INTO experiments (
          id, icp_id, name, hypothesis, status, primary_metric,
          baseline_cr, target_cr, started_at
        ) VALUES (
          ${input.id}, ${input.icp_id}, ${input.name}, ${input.hypothesis},
          ${input.status}, ${input.primary_metric},
          ${input.baseline_cr}, ${input.target_cr},
          ${input.status === 'running' ? new Date().toISOString() : null}
        )
      `;
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateExperimentError(input.id);
      throw error;
    }

    for (const variant of variants) {
      await this.insertVariant(input.id, variant);
    }

    const created = await this.get(input.id);
    if (!created) throw new ExperimentNotFoundError(input.id);
    return created;
  }

  private async insertVariant(experimentId: string, input: CreateVariantInput) {
    // copy_payload mirrors the shipped dictionary entry so the AI layer can read the
    // actual wording without importing TypeScript. Unknown keys store null rather than
    // blocking the write — a variant can exist before its copy does.
    const copy = COPY_DICTIONARY[input.variant_key];
    const payload = copy
      ? JSON.stringify({
          eyebrow: copy.eyebrow,
          headline: copy.hero.headline,
          subheadline: copy.hero.subheadline,
          cta_text: copy.hero.cta_text,
          cta_subtext: copy.hero.cta_subtext,
        })
      : null;

    const rows = (await this.sql`
      INSERT INTO experiment_variants (
        experiment_id, variant_key, variant_name, is_control, weight, active, copy_payload
      ) VALUES (
        ${experimentId}, ${input.variant_key}, ${input.variant_name},
        ${input.is_control}, ${input.weight}, ${input.active ?? true},
        ${payload}::jsonb
      )
      ON CONFLICT (experiment_id, variant_key) DO UPDATE SET
        variant_name = EXCLUDED.variant_name,
        is_control   = EXCLUDED.is_control,
        weight       = EXCLUDED.weight,
        active       = EXCLUDED.active
      RETURNING *
    `) as any[];

    return toVariant(rows[0]);
  }

  async update(id: string, patch: UpdateExperimentInput) {
    // COALESCE keeps this a single statement without string-built SQL. `icp_id` is
    // deliberately not nullable through this path — clearing it is a separate action.
    const rows = (await this.sql`
      UPDATE experiments
         SET name           = COALESCE(${patch.name ?? null}, name),
             hypothesis     = COALESCE(${patch.hypothesis ?? null}, hypothesis),
             icp_id         = COALESCE(${patch.icp_id ?? null}, icp_id),
             status         = COALESCE(${patch.status ?? null}, status),
             primary_metric = COALESCE(${patch.primary_metric ?? null}, primary_metric),
             baseline_cr    = COALESCE(${patch.baseline_cr ?? null}, baseline_cr),
             target_cr      = COALESCE(${patch.target_cr ?? null}, target_cr),
             started_at     = CASE
                                WHEN ${patch.status ?? null} = 'running' AND started_at IS NULL
                                THEN NOW() ELSE started_at
                              END,
             ended_at       = CASE
                                WHEN ${patch.status ?? null} IN ('completed', 'killed', 'winner_promoted')
                                THEN NOW() ELSE ended_at
                              END
       WHERE id = ${id}
      RETURNING id
    `) as any[];

    return rows.length > 0 ? this.get(id) : null;
  }

  async remove(id: string) {
    const rows = (await this.sql`
      DELETE FROM experiments WHERE id = ${id} RETURNING id
    `) as any[];
    return rows.length > 0;
  }

  async addVariant(experimentId: string, input: CreateVariantInput) {
    const experiment = (await this.sql`
      SELECT id FROM experiments WHERE id = ${experimentId}
    `) as any[];
    if (experiment.length === 0) return null;
    return this.insertVariant(experimentId, input);
  }

  async updateVariant(variantId: string, patch: UpdateVariantInput) {
    const rows = (await this.sql`
      UPDATE experiment_variants
         SET variant_name = COALESCE(${patch.variant_name ?? null}, variant_name),
             weight       = COALESCE(${patch.weight ?? null}, weight),
             active       = COALESCE(${patch.active ?? null}, active),
             is_control   = COALESCE(${patch.is_control ?? null}, is_control)
       WHERE id = ${variantId}
      RETURNING *
    `) as any[];
    return rows.length > 0 ? toVariant(rows[0]) : null;
  }

  async removeVariant(variantId: string) {
    const rows = (await this.sql`
      DELETE FROM experiment_variants WHERE id = ${variantId} RETURNING id
    `) as any[];
    return rows.length > 0;
  }

  async promoteVariant(experimentId: string, variantId: string) {
    // The winner takes the whole allocation and the losing arms are switched off, so
    // every subsequent visitor resolves to the winning copy. The rows are kept rather
    // than deleted: the losing arm's history is what justifies the promotion.
    await this.sql`
      UPDATE experiment_variants
         SET weight = CASE WHEN id = ${variantId} THEN 100 ELSE 0 END,
             active = (id = ${variantId})
       WHERE experiment_id = ${experimentId}
    `;
    await this.sql`
      UPDATE experiments
         SET status = 'winner_promoted',
             winning_variant_id = ${variantId},
             ended_at = NOW(),
             evaluated_at = NOW()
       WHERE id = ${experimentId}
    `;
    return this.get(experimentId);
  }

  async deactivateVariant(variantId: string) {
    const rows = (await this.sql`
      UPDATE experiment_variants SET active = FALSE WHERE id = ${variantId} RETURNING *
    `) as any[];
    return rows.length > 0 ? toVariant(rows[0]) : null;
  }

  async listIcps(): Promise<IcpRecord[]> {
    const rows = (await this.sql`SELECT * FROM icps ORDER BY traffic_weight DESC`) as any[];
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      traffic_weight: Number(row.traffic_weight),
      primary_emotion: row.primary_emotion,
      target_channel: row.target_channel,
      target_keywords: row.target_keywords ?? [],
      core_pains: row.core_pains ?? [],
      core_desires: row.core_desires ?? [],
    }));
  }

  async signupCountsByVariant(experimentId: string) {
    const rows = (await this.sql`
      SELECT v.id AS variant_id, COUNT(u.id)::int AS signups
        FROM experiment_variants v
        LEFT JOIN users u ON u.variant_id = v.id
       WHERE v.experiment_id = ${experimentId}
       GROUP BY v.id
    `) as any[];
    return rows.map((row) => ({ variant_id: row.variant_id, signups: Number(row.signups) }));
  }

  async recordDecision(decision: NewDecision) {
    const rows = (await this.sql`
      INSERT INTO experiment_decisions (
        experiment_id, variant_id, decision, trigger_source, metrics_source,
        control_visitors, control_signups, variant_visitors, variant_signups,
        control_cr, variant_cr, relative_lift_pct, z_score, p_value, confidence_pct,
        sample_target, is_significant, is_underpowered,
        rationale, ai_diagnosis, ai_model, action_taken, executed
      ) VALUES (
        ${decision.experiment_id}, ${decision.variant_id}, ${decision.decision},
        ${decision.trigger_source}, ${decision.metrics_source},
        ${decision.control_visitors}, ${decision.control_signups},
        ${decision.variant_visitors}, ${decision.variant_signups},
        ${decision.control_cr}, ${decision.variant_cr}, ${decision.relative_lift_pct},
        ${decision.z_score}, ${decision.p_value}, ${decision.confidence_pct},
        ${decision.sample_target}, ${decision.is_significant}, ${decision.is_underpowered},
        ${decision.rationale}, ${decision.ai_diagnosis}, ${decision.ai_model},
        ${decision.action_taken}, ${decision.executed}
      )
      RETURNING *
    `) as any[];
    return toDecision(rows[0]);
  }

  async listDecisions(experimentId?: string, limit = 50) {
    const rows = experimentId
      ? ((await this.sql`
          SELECT * FROM experiment_decisions
           WHERE experiment_id = ${experimentId}
           ORDER BY created_at DESC LIMIT ${limit}
        `) as any[])
      : ((await this.sql`
          SELECT * FROM experiment_decisions ORDER BY created_at DESC LIMIT ${limit}
        `) as any[]);
    return rows.map(toDecision);
  }

  async markEvaluated(experimentId: string) {
    await this.sql`UPDATE experiments SET evaluated_at = NOW() WHERE id = ${experimentId}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory implementation
//
// Seeded from the static registry so `npm run dev` with no DATABASE_URL still
// presents a working admin console and a runnable agent.
// ─────────────────────────────────────────────────────────────────────────────

class InMemoryExperimentRepository implements ExperimentRepository {
  private experiments = new Map<string, ExperimentRecord>();
  private variants = new Map<string, VariantRecord>();
  private decisions: DecisionRecord[] = [];

  constructor() {
    for (const experiment of Object.values(EXPERIMENTS)) {
      const now = new Date().toISOString();
      this.experiments.set(experiment.id, {
        id: experiment.id,
        icp_id: experiment.icp_id,
        name: experiment.name,
        hypothesis: experiment.hypothesis,
        status: experiment.status,
        primary_metric: experiment.primary_metric,
        baseline_cr: 3.2,
        target_cr: 4.0,
        winning_variant_id: null,
        created_at: now,
        started_at: experiment.status === 'running' ? now : null,
        ended_at: null,
        evaluated_at: null,
      });

      for (const arm of experiment.arms) {
        const id = crypto.randomUUID();
        this.variants.set(id, {
          id,
          experiment_id: experiment.id,
          variant_key: arm.variant_key,
          variant_name: arm.is_control ? 'Control' : `Variant ${arm.variant_key}`,
          is_control: arm.is_control,
          weight: arm.weight,
          active: true,
          copy_payload: null,
          created_at: now,
        });
      }
    }
  }

  private variantsFor(experimentId: string): VariantRecord[] {
    return [...this.variants.values()]
      .filter((variant) => variant.experiment_id === experimentId)
      .sort((a, b) => Number(b.is_control) - Number(a.is_control));
  }

  private withVariants(record: ExperimentRecord): ExperimentWithVariants {
    return { ...record, variants: this.variantsFor(record.id) };
  }

  async list() {
    return [...this.experiments.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((record) => this.withVariants(record));
  }

  async get(id: string) {
    const record = this.experiments.get(id);
    return record ? this.withVariants(record) : null;
  }

  async create(input: CreateExperimentInput, variants: CreateVariantInput[]) {
    if (this.experiments.has(input.id)) throw new DuplicateExperimentError(input.id);

    const now = new Date().toISOString();
    this.experiments.set(input.id, {
      ...input,
      winning_variant_id: null,
      created_at: now,
      started_at: input.status === 'running' ? now : null,
      ended_at: null,
      evaluated_at: null,
    });

    for (const variant of variants) await this.addVariant(input.id, variant);
    return this.withVariants(this.experiments.get(input.id)!);
  }

  async update(id: string, patch: UpdateExperimentInput) {
    const existing = this.experiments.get(id);
    if (!existing) return null;

    const updated: ExperimentRecord = { ...existing };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (updated as any)[key] = value;
    }
    if (patch.status === 'running' && !updated.started_at) {
      updated.started_at = new Date().toISOString();
    }
    if (patch.status && ['completed', 'killed', 'winner_promoted'].includes(patch.status)) {
      updated.ended_at = new Date().toISOString();
    }

    this.experiments.set(id, updated);
    return this.withVariants(updated);
  }

  async remove(id: string) {
    for (const variant of this.variantsFor(id)) this.variants.delete(variant.id);
    this.decisions = this.decisions.filter((decision) => decision.experiment_id !== id);
    return this.experiments.delete(id);
  }

  async addVariant(experimentId: string, input: CreateVariantInput) {
    if (!this.experiments.has(experimentId)) return null;

    const existing = this.variantsFor(experimentId).find(
      (variant) => variant.variant_key === input.variant_key
    );
    if (existing) {
      return this.updateVariant(existing.id, {
        variant_name: input.variant_name,
        weight: input.weight,
        is_control: input.is_control,
        active: input.active ?? true,
      });
    }

    const variant: VariantRecord = {
      id: crypto.randomUUID(),
      experiment_id: experimentId,
      variant_key: input.variant_key,
      variant_name: input.variant_name,
      is_control: input.is_control,
      weight: input.weight,
      active: input.active ?? true,
      copy_payload: null,
      created_at: new Date().toISOString(),
    };
    this.variants.set(variant.id, variant);
    return variant;
  }

  async updateVariant(variantId: string, patch: UpdateVariantInput) {
    const existing = this.variants.get(variantId);
    if (!existing) return null;

    const updated = { ...existing };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (updated as any)[key] = value;
    }
    this.variants.set(variantId, updated);
    return updated;
  }

  async removeVariant(variantId: string) {
    return this.variants.delete(variantId);
  }

  async promoteVariant(experimentId: string, variantId: string) {
    for (const variant of this.variantsFor(experimentId)) {
      this.variants.set(variant.id, {
        ...variant,
        weight: variant.id === variantId ? 100 : 0,
        active: variant.id === variantId,
      });
    }
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const now = new Date().toISOString();
    this.experiments.set(experimentId, {
      ...experiment,
      status: 'winner_promoted',
      winning_variant_id: variantId,
      ended_at: now,
      evaluated_at: now,
    });
    return this.withVariants(this.experiments.get(experimentId)!);
  }

  async deactivateVariant(variantId: string) {
    return this.updateVariant(variantId, { active: false });
  }

  async listIcps(): Promise<IcpRecord[]> {
    // The personas are seed data, not user-authored, so the in-memory path returns an
    // empty directory rather than duplicating docs/ICP_PROFILES.md in code.
    return [];
  }

  async signupCountsByVariant(experimentId: string) {
    return this.variantsFor(experimentId).map((variant) => ({
      variant_id: variant.id,
      signups: 0,
    }));
  }

  async recordDecision(decision: NewDecision) {
    const record: DecisionRecord = {
      ...decision,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.decisions.unshift(record);
    return record;
  }

  async listDecisions(experimentId?: string, limit = 50) {
    const rows = experimentId
      ? this.decisions.filter((decision) => decision.experiment_id === experimentId)
      : this.decisions;
    return rows.slice(0, limit);
  }

  async markEvaluated(experimentId: string) {
    const existing = this.experiments.get(experimentId);
    if (existing) {
      this.experiments.set(experimentId, {
        ...existing,
        evaluated_at: new Date().toISOString(),
      });
    }
  }
}

/**
 * Degrades to the in-memory store on any Neon failure, so a database outage costs the
 * admin console its data rather than taking the public landing pages down with it.
 * Business-rule rejections (duplicate id, missing row) are re-thrown untouched.
 */
class ResilientExperimentRepository implements ExperimentRepository {
  private degraded = false;

  constructor(
    private readonly primary: ExperimentRepository,
    private readonly fallback: ExperimentRepository
  ) {}

  private async run<T>(operation: (repo: ExperimentRepository) => Promise<T>): Promise<T> {
    if (this.degraded) return operation(this.fallback);

    try {
      return await operation(this.primary);
    } catch (error) {
      if (
        error instanceof DuplicateExperimentError ||
        error instanceof ExperimentNotFoundError
      ) {
        throw error;
      }

      this.degraded = true;
      console.error(
        '[experiment-repo] Neon unavailable, falling back to in-memory store:',
        error instanceof Error ? error.message : error
      );
      return operation(this.fallback);
    }
  }

  list() {
    return this.run((repo) => repo.list());
  }
  get(id: string) {
    return this.run((repo) => repo.get(id));
  }
  create(input: CreateExperimentInput, variants: CreateVariantInput[]) {
    return this.run((repo) => repo.create(input, variants));
  }
  update(id: string, patch: UpdateExperimentInput) {
    return this.run((repo) => repo.update(id, patch));
  }
  remove(id: string) {
    return this.run((repo) => repo.remove(id));
  }
  addVariant(experimentId: string, input: CreateVariantInput) {
    return this.run((repo) => repo.addVariant(experimentId, input));
  }
  updateVariant(variantId: string, patch: UpdateVariantInput) {
    return this.run((repo) => repo.updateVariant(variantId, patch));
  }
  removeVariant(variantId: string) {
    return this.run((repo) => repo.removeVariant(variantId));
  }
  promoteVariant(experimentId: string, variantId: string) {
    return this.run((repo) => repo.promoteVariant(experimentId, variantId));
  }
  deactivateVariant(variantId: string) {
    return this.run((repo) => repo.deactivateVariant(variantId));
  }
  listIcps() {
    return this.run((repo) => repo.listIcps());
  }
  signupCountsByVariant(experimentId: string) {
    return this.run((repo) => repo.signupCountsByVariant(experimentId));
  }
  recordDecision(decision: NewDecision) {
    return this.run((repo) => repo.recordDecision(decision));
  }
  listDecisions(experimentId?: string, limit?: number) {
    return this.run((repo) => repo.listDecisions(experimentId, limit));
  }
  markEvaluated(experimentId: string) {
    return this.run((repo) => repo.markEvaluated(experimentId));
  }
}

function createRepository(): ExperimentRepository {
  const connectionString = process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL;

  if (!connectionString) {
    console.info('[experiment-repo] DATABASE_URL not set — using in-memory store.');
    return new InMemoryExperimentRepository();
  }

  return new ResilientExperimentRepository(
    new NeonExperimentRepository(neon(connectionString)),
    new InMemoryExperimentRepository()
  );
}

export const experimentDb: ExperimentRepository = createRepository();

// ─────────────────────────────────────────────────────────────────────────────
// Runtime registry — what /freetrial and /signup actually resolve against
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assignment reads run on every landing-page request, so they are cached briefly.
 *
 * The TTL is the lag between an admin pausing an experiment and traffic stopping.
 * 30s keeps that lag imperceptible while collapsing a burst of ad traffic into a
 * single query — an uncached read would put a database round-trip on the critical
 * path of the page whose LCP we spent the whole build protecting.
 */
const REGISTRY_TTL_MS = 30_000;

let registryCache: { registry: Record<string, Experiment>; expiresAt: number } | null = null;

/** Invalidate immediately after a write, so the admin sees its own change reflected. */
export function invalidateRegistryCache(): void {
  registryCache = null;
}

/**
 * Project stored rows onto the runtime `Experiment` shape.
 *
 * Only active arms are included. A killed arm therefore disappears from the weighted
 * draw entirely, and its visitors are re-bucketed across what remains — which, for a
 * two-arm test, means control. That is precisely the circuit-breaker behaviour in
 * docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §4.
 */
function toRuntimeExperiment(record: ExperimentWithVariants): Experiment | null {
  const arms: ExperimentArm[] = record.variants
    .filter((variant) => variant.active && variant.weight > 0)
    .map((variant) => ({
      variant_key: variant.variant_key,
      weight: variant.weight,
      is_control: variant.is_control,
    }));

  if (arms.length === 0) return null;

  return {
    id: record.id,
    name: record.name,
    hypothesis: record.hypothesis,
    // The runtime type models only the three states that affect serving; a promoted or
    // killed experiment is no longer splitting traffic, so it reads as completed.
    status:
      record.status === 'running'
        ? 'running'
        : record.status === 'paused'
          ? 'paused'
          : 'completed',
    primary_metric: record.primary_metric,
    icp_id: record.icp_id ?? '',
    arms,
  };
}

async function loadRegistry(): Promise<Record<string, Experiment>> {
  const now = Date.now();
  if (registryCache && registryCache.expiresAt > now) return registryCache.registry;

  try {
    const records = await experimentDb.list();
    const registry: Record<string, Experiment> = {};

    for (const record of records) {
      const runtime = toRuntimeExperiment(record);
      if (runtime) registry[record.id] = runtime;
    }

    // An empty table means the migration has not run yet, not that every experiment was
    // deliberately deleted — serving the static registry is the safer reading.
    const resolved = Object.keys(registry).length > 0 ? registry : EXPERIMENTS;
    registryCache = { registry: resolved, expiresAt: now + REGISTRY_TTL_MS };
    return resolved;
  } catch (error) {
    console.error(
      '[experiment-repo] registry load failed, serving static registry:',
      error instanceof Error ? error.message : error
    );
    return EXPERIMENTS;
  }
}

function copyFor(variantKey: string): ExperimentVariantCopy {
  return COPY_DICTIONARY[variantKey] ?? COPY_DICTIONARY.control;
}

/**
 * Database-backed counterpart to `resolveExperience` in `experiments.ts`.
 *
 * Same contract — pure bucketing, preview arms excluded from results — but the arm set
 * comes from live rows, so admin and agent actions take effect on the next request.
 */
export async function resolveLiveExperience(params: {
  lp: string | null | undefined;
  previewVariant?: string | null;
  visitorId: string;
}): Promise<{ copy: ExperimentVariantCopy; assignment: Assignment | null }> {
  const { lp, previewVariant, visitorId } = params;

  if (!lp) return { copy: COPY_DICTIONARY.control, assignment: null };

  const registry = await loadRegistry();
  const experiment = registry[lp];

  if (!experiment || experiment.status !== 'running') {
    return { copy: COPY_DICTIONARY.control, assignment: null };
  }

  const forced =
    previewVariant && experiment.arms.find((arm) => arm.variant_key === previewVariant);
  const arm = forced || assignArm(experiment, visitorId);
  const copy = copyFor(arm.variant_key);

  return {
    copy,
    assignment: {
      experiment_id: experiment.id,
      experiment_name: experiment.name,
      variant_key: arm.variant_key,
      variant_id: copy.variant_id,
      is_control: arm.is_control,
      is_preview: Boolean(forced),
    },
  };
}

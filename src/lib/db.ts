import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import type { CreateUserInput, UpdateUserInput, SignupContext, User } from './schemas';

/**
 * User persistence.
 *
 * Primary store is Neon Postgres over its HTTP driver, which suits serverless request
 * handlers: no connection pool to keep warm across cold starts.
 *
 * If DATABASE_URL is absent, or a query fails at runtime, the repository degrades to an
 * in-memory store. That keeps `npm run dev` working with zero setup for a reviewer, and
 * means a database outage costs us analytics fidelity rather than the signup itself —
 * the conversion is what matters most.
 */

/** Raised when the unique index on users.email rejects an insert. */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`A user with the email ${email} already exists`);
    this.name = 'DuplicateEmailError';
  }
}

/**
 * Filters for the admin user list. Every field is optional and null means "no filter",
 * so one query shape serves the unfiltered list and any combination of narrowing.
 */
export interface UserListFilters {
  /** Substring match against name or email. */
  search?: string | null;
  /** First-touch acquisition channel, as classified in attribution.ts. */
  channel?: string | null;
  /** Self-declared primary trading goal. */
  icp_focus?: string | null;
  /** Restrict to conversions attributed to one experiment. */
  experiment_id?: string | null;
}

export interface UserRepository {
  list(
    limit: number,
    offset: number,
    filters?: UserListFilters
  ): Promise<{ users: User[]; total: number }>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput, context: SignupContext): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User | null>;
  /** Distinct channels present in the data, for the admin filter control. */
  distinctChannels(): Promise<string[]>;
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

/** Normalise a database row (snake_case, Date objects) into the public User shape. */
function toUser(row: Record<string, any>): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    icp_focus: row.icp_focus,
    visitor_id: row.visitor_id ?? null,
    experiment_id: row.experiment_id ?? null,
    variant_id: row.variant_id ?? null,
    utm_source: row.utm_source ?? null,
    utm_medium: row.utm_medium ?? null,
    utm_campaign: row.utm_campaign ?? null,
    channel: row.channel ?? null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

class NeonUserRepository implements UserRepository {
  constructor(private readonly sql: ReturnType<typeof neon>) {}

  async list(limit: number, offset: number, filters: UserListFilters = {}) {
    // Each predicate short-circuits on a null parameter, so the filter combination is
    // expressed once rather than assembled as SQL strings. Values stay bound, so a
    // search term can contain anything without escaping concerns.
    const search = filters.search?.trim() || null;
    const channel = filters.channel || null;
    const icpFocus = filters.icp_focus || null;
    const experimentId = filters.experiment_id || null;

    const rows = await this.sql`
      SELECT * FROM users
       WHERE (${search}::text IS NULL
              OR email ILIKE '%' || ${search} || '%'
              OR name  ILIKE '%' || ${search} || '%')
         AND (${channel}::text IS NULL OR channel = ${channel})
         AND (${icpFocus}::text IS NULL OR icp_focus = ${icpFocus})
         AND (${experimentId}::text IS NULL OR experiment_id = ${experimentId})
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ count }] = (await this.sql`
      SELECT COUNT(*)::int AS count FROM users
       WHERE (${search}::text IS NULL
              OR email ILIKE '%' || ${search} || '%'
              OR name  ILIKE '%' || ${search} || '%')
         AND (${channel}::text IS NULL OR channel = ${channel})
         AND (${icpFocus}::text IS NULL OR icp_focus = ${icpFocus})
         AND (${experimentId}::text IS NULL OR experiment_id = ${experimentId})
    `) as any[];

    return { users: (rows as any[]).map(toUser), total: count };
  }

  async distinctChannels() {
    const rows = (await this.sql`
      SELECT DISTINCT channel FROM users WHERE channel IS NOT NULL ORDER BY channel
    `) as any[];
    return rows.map((row) => row.channel as string);
  }

  async findById(id: string) {
    const rows = (await this.sql`SELECT * FROM users WHERE id = ${id}`) as any[];
    return rows.length > 0 ? toUser(rows[0]) : null;
  }

  async create(input: CreateUserInput, context: SignupContext) {
    try {
      // variant_id is resolved in the same statement, so attribution costs no extra
      // round-trip. Relying on the unique index rather than a prior SELECT avoids the
      // race where two concurrent signups both pass a check-then-insert.
      const rows = (await this.sql`
        INSERT INTO users (
          name, email, password, icp_focus,
          visitor_id, experiment_id, variant_id,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          click_id, referrer, channel, landing_path
        ) VALUES (
          ${input.name}, ${input.email}, ${input.password}, ${input.icp_focus},
          ${context.visitor_id}, ${context.experiment_id},
          (SELECT id FROM experiment_variants
            WHERE experiment_id = ${context.experiment_id}
              AND variant_key = ${context.variant_key}
            LIMIT 1),
          ${context.utm_source}, ${context.utm_medium}, ${context.utm_campaign},
          ${context.utm_content}, ${context.utm_term},
          ${context.click_id}, ${context.referrer}, ${context.channel}, ${context.landing_path}
        )
        RETURNING *
      `) as any[];

      return toUser(rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateEmailError(input.email);
      throw error;
    }
  }

  async update(id: string, input: UpdateUserInput) {
    const rows = (await this.sql`
      UPDATE users
         SET name      = COALESCE(${input.name ?? null}, name),
             icp_focus = COALESCE(${input.icp_focus ?? null}, icp_focus),
             updated_at = NOW()
       WHERE id = ${id}
      RETURNING *
    `) as any[];
    return rows.length > 0 ? toUser(rows[0]) : null;
  }
}

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User & { password: string }>();

  async list(limit: number, offset: number, filters: UserListFilters = {}) {
    const search = filters.search?.trim().toLowerCase() ?? null;

    const all = [...this.users.values()]
      .filter((user) => {
        if (search && !`${user.name} ${user.email}`.toLowerCase().includes(search)) return false;
        if (filters.channel && user.channel !== filters.channel) return false;
        if (filters.icp_focus && user.icp_focus !== filters.icp_focus) return false;
        if (filters.experiment_id && user.experiment_id !== filters.experiment_id) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { users: all.slice(offset, offset + limit).map(stripPassword), total: all.length };
  }

  async distinctChannels() {
    const channels = new Set<string>();
    for (const user of this.users.values()) {
      if (user.channel) channels.add(user.channel);
    }
    return [...channels].sort();
  }

  async findById(id: string) {
    const user = this.users.get(id);
    return user ? stripPassword(user) : null;
  }

  async create(input: CreateUserInput, context: SignupContext) {
    for (const user of this.users.values()) {
      if (user.email === input.email) throw new DuplicateEmailError(input.email);
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      password: input.password,
      icp_focus: input.icp_focus,
      visitor_id: context.visitor_id,
      experiment_id: context.experiment_id,
      // No variant row to join against in memory; the key is enough to group by.
      variant_id: context.variant_key,
      utm_source: context.utm_source,
      utm_medium: context.utm_medium,
      utm_campaign: context.utm_campaign,
      channel: context.channel,
      created_at: now,
      updated_at: now,
    };

    this.users.set(user.id, user);
    return stripPassword(user);
  }

  async update(id: string, input: UpdateUserInput) {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icp_focus !== undefined ? { icp_focus: input.icp_focus } : {}),
      updated_at: new Date().toISOString(),
    };

    this.users.set(id, updated);
    return stripPassword(updated);
  }
}

function stripPassword(user: User & { password: string }): User {
  const { password: _password, ...rest } = user;
  return rest;
}

/**
 * Wraps the Neon repository so any runtime failure degrades to the in-memory store
 * instead of failing the signup. A duplicate-email rejection is a valid business
 * outcome, not an outage, so it is re-thrown rather than triggering fallback.
 */
class ResilientUserRepository implements UserRepository {
  private degraded = false;

  constructor(
    private readonly primary: UserRepository,
    private readonly fallback: UserRepository
  ) {}

  private async run<T>(operation: (repo: UserRepository) => Promise<T>): Promise<T> {
    if (this.degraded) return operation(this.fallback);

    try {
      return await operation(this.primary);
    } catch (error) {
      if (error instanceof DuplicateEmailError) throw error;

      this.degraded = true;
      console.error(
        '[db] Neon unavailable, falling back to in-memory store:',
        error instanceof Error ? error.message : error
      );
      return operation(this.fallback);
    }
  }

  list(limit: number, offset: number, filters?: UserListFilters) {
    return this.run((repo) => repo.list(limit, offset, filters));
  }
  findById(id: string) {
    return this.run((repo) => repo.findById(id));
  }
  distinctChannels() {
    return this.run((repo) => repo.distinctChannels());
  }
  create(input: CreateUserInput, context: SignupContext) {
    return this.run((repo) => repo.create(input, context));
  }
  update(id: string, input: UpdateUserInput) {
    return this.run((repo) => repo.update(id, input));
  }
}

function createRepository(): UserRepository {
  const connectionString = process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL;

  if (!connectionString) {
    console.info('[db] DATABASE_URL not set — using in-memory store.');
    return new InMemoryUserRepository();
  }

  return new ResilientUserRepository(
    new NeonUserRepository(neon(connectionString)),
    new InMemoryUserRepository()
  );
}

export const userDb: UserRepository = createRepository();

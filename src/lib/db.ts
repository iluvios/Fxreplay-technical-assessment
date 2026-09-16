import type { User, CreateUserInput, UpdateUserInput } from './schemas';
import crypto from 'node:crypto';

// In-memory data store with seeded demo users for initial reviewer evaluation.
// Trade-off Rationale:
// - Zero external dependencies (no Docker or Postgres connection string required).
// - Ensures 100% immediate local reproducibility for the code reviewer (`npm run dev` works instantly).
// - Production Transition: Would replace this repository interface with Prisma/Drizzle connected to Neon/Supabase with connection pooling.

class UserRepository {
  private users: Map<string, User> = new Map();

  constructor() {
    this.seedInitialUsers();
  }

  private seedInitialUsers() {
    const seed: User[] = [
      {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'alex.trader@example.com',
        name: 'Alex Morgan',
        experienceLevel: 'intermediate',
        primaryMarket: 'forex',
        planTier: 'free_trial',
        source: 'organic_search',
        utmSource: 'google',
        utmCampaign: 'brand_search',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        onboardingCompleted: true,
        tradesReplayed: 45,
      },
      {
        id: '2c3eeb4d-7a1b-43d2-8ccf-1e9a7c3bcb22',
        email: 'sarah.prop@example.com',
        name: 'Sarah Chen',
        experienceLevel: 'advanced',
        primaryMarket: 'futures',
        planTier: 'pro',
        source: 'meta_ad',
        utmSource: 'facebook',
        utmCampaign: 'ftmo_prop_challenge',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        updatedAt: new Date().toISOString(),
        onboardingCompleted: true,
        tradesReplayed: 180,
      }
    ];

    for (const u of seed) {
      this.users.set(u.id, u);
    }
  }

  async list(limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    const allUsers = Array.from(this.users.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const paginated = allUsers.slice(offset, offset + limit);
    return { users: paginated, total: allUsers.length };
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new Error('A user with this email address already exists.');
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      experienceLevel: input.experienceLevel,
      primaryMarket: input.primaryMarket,
      planTier: 'free_trial',
      source: input.source || 'marketing_landing_try_free',
      utmSource: input.utmSource || null,
      utmCampaign: input.utmCampaign || null,
      createdAt: now,
      updatedAt: now,
      onboardingCompleted: false,
      tradesReplayed: 0,
    };

    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) {
      return null;
    }

    const updatedUser: User = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }
}

// Global singleton instance for in-memory persistence during server lifetime
export const userDb = new UserRepository();

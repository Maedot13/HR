import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any;

const globalForPrisma = globalThis as unknown as {
  prisma?: AnyPrismaClient;
  pool?: pg.Pool;
  keepAliveInterval?: ReturnType<typeof setInterval>;
};

if (!globalForPrisma.pool) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Check your .env file.");
  globalForPrisma.pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 30000,
    // 60 s — long enough to survive Neon's cold-start wake-up time
    idleTimeoutMillis: 60000,
    max: 10,
    allowExitOnIdle: true,
  });

  // ── Keep-alive ping ────────────────────────────────────────────────────────
  // Neon free-tier pauses after ~5 min of inactivity.
  // Ping every 4 min with a lightweight query so the DB stays awake.
  if (!globalForPrisma.keepAliveInterval) {
    globalForPrisma.keepAliveInterval = setInterval(async () => {
      try {
        const client = await globalForPrisma.pool!.connect();
        await client.query("SELECT 1");
        client.release();
      } catch {
        // Silently swallow — the next real query will surface any real error.
      }
    }, 4 * 60 * 1000); // every 4 minutes

    // Don't block the process from exiting cleanly
    globalForPrisma.keepAliveInterval.unref?.();
  }
}

if (!globalForPrisma.prisma) {
  const adapter = new PrismaPg(globalForPrisma.pool);
  const base = new PrismaClient({ adapter });

  // ── Auto-UUID + Auto-updatedAt extension ──────────────────────────────────
  // Prisma v7 + pg driver adapter does not apply @default(uuid()) or
  // @updatedAt at the client level. $use() was removed in v5+; we use
  // $extends() query hooks instead to inject id/updatedAt automatically
  // before every create / createMany, so no service file needs to supply them.
  // Models that have an `updatedAt` column in schema.prisma.
  // All others (e.g. ActivityLog which only has `timestamp`) must NOT receive this field.
  const MODELS_WITH_UPDATED_AT = new Set([
    "campus", "clearancetask", "employee", "evaluation", "userrole",
  ]);

  globalForPrisma.prisma = base.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }: { model: string; args: { data: Record<string, unknown> }; query: (args: unknown) => unknown }) {
          if (!args.data.id) args.data.id = randomUUID();
          if (MODELS_WITH_UPDATED_AT.has(model.toLowerCase()) && args.data.updatedAt === undefined) {
            args.data.updatedAt = new Date();
          }
          return query(args);
        },
        async createMany({ model, args, query }: { model: string; args: { data: unknown }; query: (args: unknown) => unknown }) {
          if (Array.isArray(args.data)) {
            args.data = (args.data as Record<string, unknown>[]).map((row) => {
              if (!row.id) row.id = randomUUID();
              if (MODELS_WITH_UPDATED_AT.has(model.toLowerCase()) && row.updatedAt === undefined) {
                row.updatedAt = new Date();
              }
              return row;
            });
          }
          return query(args);
        },
        async upsert({ model, args, query }: { model: string; args: { create: Record<string, unknown>; update: Record<string, unknown> }; query: (args: unknown) => unknown }) {
          // Inject id + updatedAt into the CREATE branch of every upsert
          if (!args.create.id) args.create.id = randomUUID();
          if (MODELS_WITH_UPDATED_AT.has(model.toLowerCase())) {
            if (args.create.updatedAt === undefined) args.create.updatedAt = new Date();
            if (args.update.updatedAt === undefined) args.update.updatedAt = new Date();
          }
          return query(args);
        },
        async update({ model, args, query }: { model: string; args: { data: Record<string, unknown> }; query: (args: unknown) => unknown }) {
          if (MODELS_WITH_UPDATED_AT.has(model.toLowerCase()) && args.data.updatedAt === undefined) {
            args.data.updatedAt = new Date();
          }
          return query(args);
        },
      },
    },
  });
}

// ── Resilient Prisma export ────────────────────────────────────────────────
// Neon free-tier wakes on first query but that query itself times out (P1001 /
// ETIMEDOUT). This Proxy catches those codes, waits 3 s for the DB to fully
// wake, then retries the same call once — making it invisible to service code.
function withRetry(client: AnyPrismaClient): AnyPrismaClient {
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== "object" || value === null) return value;

      // Each model delegate (e.g. prisma.employee) is an object whose methods
      // we want to wrap.
      return new Proxy(value, {
        get(modelTarget, method) {
          const fn = modelTarget[method];
          if (typeof fn !== "function") return fn;

          return async (...args: unknown[]) => {
            try {
              return await fn.apply(modelTarget, args);
            } catch (err: unknown) {
              const code = (err as { code?: string })?.code;
              if (code === "ETIMEDOUT" || code === "P1001") {
                console.warn(
                  `[Prisma] DB connection timeout (${code}). Retrying in 3 s…`
                );
                await new Promise((r) => setTimeout(r, 3000));
                return fn.apply(modelTarget, args); // one retry
              }
              throw err;
            }
          };
        },
      });
    },
  });
}

export const prisma: PrismaClient = withRetry(globalForPrisma.prisma);

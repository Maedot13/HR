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
};

if (!globalForPrisma.pool) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Check your .env file.");
  globalForPrisma.pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 5000,
    max: 10,
    allowExitOnIdle: true,
  });
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
      },
    },
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma;

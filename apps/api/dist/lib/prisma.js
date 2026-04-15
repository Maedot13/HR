import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const globalForPrisma = globalThis;
if (!globalForPrisma.pool) {
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error("DATABASE_URL is not set. Check your .env file.");
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
    globalForPrisma.prisma = base.$extends({
        query: {
            $allModels: {
                async create({ args, query }) {
                    if (!args.data.id)
                        args.data.id = randomUUID();
                    if ("updatedAt" in args.data && args.data.updatedAt === undefined) {
                        args.data.updatedAt = new Date();
                    }
                    return query(args);
                },
                async createMany({ args, query }) {
                    if (Array.isArray(args.data)) {
                        args.data = args.data.map((row) => {
                            if (!row.id)
                                row.id = randomUUID();
                            if ("updatedAt" in row && row.updatedAt === undefined)
                                row.updatedAt = new Date();
                            return row;
                        });
                    }
                    return query(args);
                },
            },
        },
    });
}
export const prisma = globalForPrisma.prisma;
//# sourceMappingURL=prisma.js.map
import { PrismaClient } from "@prisma/client";

// Prisma client singleton for Next.js.
//
// In development, Next.js hot-reload re-imports this module on every code
// change. Creating `new PrismaClient()` each time would open a new connection
// pool per reload and exhaust the database's connection limit. To avoid that we
// cache one instance on `globalThis` (which persists across hot-reloads) and
// reuse it. In production the module is loaded once, so a single fresh client
// is fine and we deliberately don't touch the global.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

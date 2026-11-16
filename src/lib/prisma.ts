import { PrismaClient } from "@prisma/client";
import { IS_DEMO } from "@/lib/config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export class DemoReadOnlyError extends Error {
  constructor() {
    super("Read-only demo: changes are turned off.");
    this.name = "DemoReadOnlyError";
  }
}

const READS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "$queryRaw",
  "$queryRawUnsafe",
]);

const STORE_SECRETS = ["apiKey", "apiSecret", "accessToken", "refreshToken", "apiSignatureKey", "apiUsername"];

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (const item of value) scrub(item);
    return value;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    for (const key of Object.keys(row)) {
      if (STORE_SECRETS.includes(key)) row[key] = null;
      else scrub(row[key]);
    }
  }
  return value;
}

function create(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  if (!IS_DEMO) return base;
  return base.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        if (!READS.has(operation)) throw new DemoReadOnlyError();
        const result = await query(args);
        return scrub(result);
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

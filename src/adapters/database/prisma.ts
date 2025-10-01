import { PrismaClient } from "@prisma/client";
import { logger } from "../../utils/logger";

// Singleton pattern
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

    logger.info("Prisma client initialized");
  }

  return prismaInstance;
}

export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    logger.info("Prisma client disconnected");
  }
}

// Export singleton
export const prisma = getPrismaClient();

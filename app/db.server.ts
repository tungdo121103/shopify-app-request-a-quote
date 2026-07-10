import { PrismaClient } from "@prisma/client";
import path from "node:path";

const databaseUrl = `file:${path
  .resolve(process.cwd(), "prisma", "dev.sqlite")
  .replaceAll("\\", "/")}`;

const createPrismaClient = () =>
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL || databaseUrl,
  });

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

export default prisma;

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedSchema = path.join(
  projectRoot,
  "node_modules",
  ".prisma",
  "client",
  "schema.prisma",
);
const generatedClient = path.join(
  projectRoot,
  "node_modules",
  ".prisma",
  "client",
  "index.js",
);
const queryEngine = path.join(
  projectRoot,
  "node_modules",
  ".prisma",
  "client",
  "query_engine-windows.dll.node",
);

const clientIsReady =
  existsSync(generatedSchema) &&
  existsSync(generatedClient) &&
  (process.platform !== "win32" || existsSync(queryEngine)) &&
  readFileSync(generatedSchema, "utf8").includes("orderInvoiceUrl");

if (clientIsReady) {
  console.log("Prisma client is already generated; skipping regeneration.");
  process.exit(0);
}

const prismaCli = path.join(
  projectRoot,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  cwd: projectRoot,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

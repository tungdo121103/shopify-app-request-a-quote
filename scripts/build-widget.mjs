/* eslint-env node */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(process.cwd(), "extensions/request-a-quote");
const entries = [
  [[
    "src/widget/core.js",
    "src/widget/cart-and-customer.js",
    "src/widget/history.js",
    "src/widget/quote-detail-and-chat.js",
  ], "assets/quote-widget.js"],
  [[
    "src/styles/base.css",
    "src/styles/cart.css",
    "src/styles/history.css",
    "src/styles/responsive.css",
  ], "assets/quote-widget.css"],
];

for (const [sourceNames, assetName] of entries) {
  const assetPath = resolve(root, assetName);
  const chunks = await Promise.all(
    sourceNames.map((sourceName) => readFile(resolve(root, sourceName), "utf8")),
  );
  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, chunks.join(""), "utf8");
  process.stdout.write(`Built ${assetName} from ${sourceNames.length} source files\n`);
}

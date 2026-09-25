/**
 * Copy every Whitebox tool's `summary` into the English pack.
 *
 *   node scripts/sync-summaries.mjs <GeoLibre checkout>
 *
 * GeoLibre renders a tool's summary through `translateToolDescription`, which
 * looks up `processing.toolMeta.whitebox.<tool>.description` and falls back to
 * the English summary. A tool with no `description` in `en.json` therefore has
 * nothing a translator can target, and its summary stays English in every
 * locale — which was the case for the 730 tools in the Whitebox catalog
 * snapshot, as opposed to the 333 GeoLibre-authored ones that already carried
 * one.
 *
 * Summaries come from the WASM manifests (`geolibre-wasm`, which is what the
 * browser build shows), then from the desktop catalog snapshot for the few
 * sidecar-only tools the WASM build does not ship. The checkout must have run
 * `npm install` so `node_modules/geolibre-wasm` exists. The `description` key
 * is inserted right after `name`, the position the existing ones already use,
 * so the diff is additive. Afterwards run `scripts/extract.mjs` for each locale:
 * the new summaries are the only work it emits.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "./lib.mjs";

const checkout = process.argv[2];
if (!checkout) throw new Error("usage: node scripts/sync-summaries.mjs <GeoLibre checkout>");

const wasmDir = resolve(checkout, "node_modules/geolibre-wasm");
const snapshotFile = resolve(checkout, "apps/geolibre-desktop/public/whitebox-catalog-snapshot.json");
if (!existsSync(wasmDir)) throw new Error(`${wasmDir} not found; run npm install in the checkout`);

const tools = await import(pathToFileURL(resolve(wasmDir, "tools.mjs")).href);
await tools.initTools(readFileSync(resolve(wasmDir, "geolibre-cli.wasm")));
const summaries = new Map();
for (const manifest of await tools.listManifests()) {
  if (manifest.summary?.trim()) summaries.set(manifest.id, manifest.summary.trim());
}
if (existsSync(snapshotFile)) {
  for (const tool of JSON.parse(readFileSync(snapshotFile, "utf8")).tools) {
    if (!summaries.has(tool.id) && tool.summary?.trim()) summaries.set(tool.id, tool.summary.trim());
  }
}

const packFile = new URL("v1/whitebox/en.json", root);
const pack = JSON.parse(readFileSync(packFile, "utf8"));
const catalog = pack.translations.processing.toolMeta.whitebox;

let added = 0;
let changed = 0;
const without = [];
for (const [id, tool] of Object.entries(catalog)) {
  const summary = summaries.get(id);
  if (!summary) {
    if (tool.description === undefined) without.push(id);
    continue;
  }
  if (summary.includes("\t")) throw new Error(`${id}: summary contains a tab`);
  if (tool.description === summary) continue;
  if (tool.description === undefined) added += 1;
  else changed += 1;
  // Rebuild the object so `description` lands after `name`, not at the end.
  const { name, description: _previous, ...rest } = tool;
  catalog[id] = { name, description: summary, ...rest };
}

writeFileSync(packFile, JSON.stringify(pack, null, 2) + "\n");
console.log(
  `v1/whitebox/en.json: +${added} summaries` +
    (changed ? `, ${changed} updated` : "") +
    (without.length ? `; ${without.length} tools have none (${without.join(", ")})` : ""),
);

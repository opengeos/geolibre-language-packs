/**
 * Assemble `v1/whitebox/<locale>.json` from the English pack's shape plus
 * `translations/<locale>.json`.
 *
 *   node scripts/build.mjs <locale> [--partial]
 *
 * The English pack is the structural source of truth: keys, nesting, and order
 * all come from it, so a locale can never drift out of shape. Without
 * `--partial` an incomplete memory is an error. With it, untranslated leaves are
 * omitted — GeoLibre runs the pack through i18next with `fallbackLng: "en"`, so
 * those keys render in English, which makes a partial pack shippable but
 * visibly mixed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { root, buildPack, translationMemory } from "./lib.mjs";

const args = process.argv.slice(2);
const partial = args.includes("--partial");
const locale = args.find((arg) => !arg.startsWith("--"));
if (!locale) throw new Error("usage: node scripts/build.mjs <locale> [--partial]");

const locales = JSON.parse(readFileSync(new URL("translations/locales.json", root), "utf8"));
const meta = locales[locale];
if (!meta) throw new Error(`translations/locales.json has no entry for "${locale}"`);

const { processing, missing } = buildPack(translationMemory(locale));
if (missing.length && !partial) {
  const sample = missing.slice(0, 5).map((m) => `${m.role} @ ${m.path}: ${JSON.stringify(m.text.slice(0, 60))}`);
  throw new Error(
    `${locale}: ${missing.length} leaves untranslated. Run scripts/extract.mjs, or pass --partial.\n  ` +
      sample.join("\n  "),
  );
}
if (!processing) throw new Error(`${locale}: nothing translated yet`);

const pack = {
  format: "geolibre-language-pack",
  formatVersion: 1,
  scope: "whitebox",
  locale,
  name: meta.name,
  updatedAt: meta.updatedAt ?? new Date().toISOString(),
  translations: { processing },
};
const json = JSON.stringify(pack, null, 2) + "\n";
writeFileSync(new URL(`v1/whitebox/${locale}.json`, root), json);
console.log(
  `v1/whitebox/${locale}.json: ${Buffer.byteLength(json).toLocaleString("en")} bytes` +
    (missing.length ? `, ${missing.length} leaves left in English` : ", complete"),
);
console.log("Next: node scripts/reindex.mjs");

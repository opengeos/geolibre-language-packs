/**
 * Merge finished work chunks back into `translations/<locale>.json`.
 *
 *   node scripts/import.mjs <locale> [workDir] [--keep-identical] [--force]
 *
 * A line whose translation still equals its source is treated as untranslated
 * and skipped, because that is what a chunk looks like when it was never worked
 * on. A handful of strings really do stay identical in every language ("OBIA",
 * "SAR", "Atan2", "GeoLibre (WASM)"); pass `--keep-identical` for a chunk that
 * legitimately contains them. Existing translations are never overwritten
 * without `--force`, so re-importing a stale chunk cannot silently regress a
 * locale.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { root, sourceStrings, translationMemory, orderMemory } from "./lib.mjs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [locale, workDir = "work"] = args.filter((a) => !a.startsWith("--"));
if (!locale) throw new Error("usage: node scripts/import.mjs <locale> [workDir] [--keep-identical] [--force]");

const sources = new Set(sourceStrings().map((entry) => entry.text));
const memory = translationMemory(locale);
const dir = new URL(`${workDir}/${locale}/`, root);
if (!existsSync(dir)) throw new Error(`no work directory at ${workDir}/${locale}/`);

let added = 0;
let identical = 0;
let unchanged = 0;
for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsv")).sort()) {
  const lines = readFileSync(new URL(file, dir), "utf8").split("\n");
  lines.forEach((line, index) => {
    if (!line) return;
    const tab = line.indexOf("\t");
    if (tab < 1) throw new Error(`${file}:${index + 1}: expected "<source>\\t<translation>"`);
    const source = line.slice(0, tab);
    const translation = line.slice(tab + 1).trim();
    if (!sources.has(source)) throw new Error(`${file}:${index + 1}: not a string in en.json: ${JSON.stringify(source)}`);
    if (!translation) throw new Error(`${file}:${index + 1}: empty translation`);
    if (translation === source && !flags.has("--keep-identical")) {
      identical += 1;
      return;
    }
    if (memory[source] !== undefined && !flags.has("--force")) {
      unchanged += 1;
      return;
    }
    memory[source] = translation;
    added += 1;
  });
}

const ordered = orderMemory(memory);
writeFileSync(new URL(`translations/${locale}.json`, root), JSON.stringify(ordered, null, 2) + "\n");

const total = Object.keys(ordered).length;
const goal = sources.size;
console.log(
  `${locale}: +${added} translations (${total}/${goal}, ${((100 * total) / goal).toFixed(1)}%)` +
    (identical ? `; skipped ${identical} still equal to English` : "") +
    (unchanged ? `; kept ${unchanged} existing` : ""),
);

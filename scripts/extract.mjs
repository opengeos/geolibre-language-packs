/**
 * Emit the strings a locale still needs, as tab-separated work chunks.
 *
 *   node scripts/extract.mjs <locale> [outDir]
 *
 * Chunks contain only the strings still missing from `translations/<locale>.json`,
 * so re-running after a partial pass emits just the remaining work. Each line is
 * `<source>\t<source>`: fill in the second column and feed the file back through
 * `scripts/import.mjs`. `lib.mjs` asserts that no pack string contains a tab or
 * a newline, so the format stays unambiguous.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { root, sourceStrings, translationMemory } from "./lib.mjs";

const CHUNK_CHARS = 20_000;
const [locale, outDir = "work"] = process.argv.slice(2);
if (!locale) throw new Error("usage: node scripts/extract.mjs <locale> [outDir]");

const memory = translationMemory(locale);
const todo = sourceStrings().filter((entry) => !memory[entry.text]);
if (!todo.length) {
  console.log(`${locale}: nothing left to translate`);
  process.exit(0);
}

// Chunk within a role so every chunk holds one uniform kind of string: a bare
// "Dem" reads very differently as a parameter label than as a sentence.
const chunks = [];
let current = [];
let chars = 0;
let role = null;
for (const entry of todo) {
  // A line is `<source>\t<source>\n`, so it costs twice the string plus two.
  const lineChars = 2 * entry.text.length + 2;
  if (entry.role !== role || chars + lineChars > CHUNK_CHARS) {
    if (current.length) chunks.push(current);
    current = [];
    chars = 0;
    role = entry.role;
  }
  current.push(entry);
  chars += lineChars;
}
if (current.length) chunks.push(current);

const target = new URL(`${outDir}/${locale}/`, root);
mkdirSync(target, { recursive: true });
chunks.forEach((chunk, index) => {
  const name = `chunk-${String(index + 1).padStart(2, "0")}-${chunk[0].role}.tsv`;
  writeFileSync(new URL(name, target), chunk.map((e) => `${e.text}\t${e.text}`).join("\n") + "\n");
});
console.log(
  `${locale}: ${todo.length} strings left (${chunks.length} chunks) in ${outDir}/${locale}/`,
);

/**
 * Seed `translations/<locale>.json` from a pack that already exists.
 *
 *   node scripts/harvest.mjs <locale>
 *
 * Useful for recovering a translation memory from a published pack, and for
 * re-seeding after `en.json` changes. Where a pack rendered the same English
 * string two different ways (`zh` does, for 13 strings), the first rendering
 * wins and the rest are counted: a memory maps one source string to exactly one
 * translation, so those inconsistencies get normalised away.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { root, orderMemory } from "./lib.mjs";

const locale = process.argv[2];
if (!locale) throw new Error("usage: node scripts/harvest.mjs <locale>");

const read = (code) =>
  JSON.parse(readFileSync(new URL(`v1/whitebox/${code}.json`, root), "utf8")).translations.processing;
const en = read("en");
const target = read(locale);

const memory = {};
let conflicts = 0;
let absent = 0;
(function walk(source, translated, path) {
  if (typeof source === "string") {
    if (typeof translated !== "string" || !translated) {
      absent += 1;
      return;
    }
    if (memory[source] === undefined) memory[source] = translated;
    else if (memory[source] !== translated) conflicts += 1;
    return;
  }
  for (const key of Object.keys(source)) {
    walk(source[key], translated?.[key], [...path, key]);
  }
})(en, target, []);

const ordered = orderMemory(memory);
writeFileSync(new URL(`translations/${locale}.json`, root), JSON.stringify(ordered, null, 2) + "\n");
console.log(
  `translations/${locale}.json: ${Object.keys(ordered).length} translations` +
    (conflicts ? `; normalised ${conflicts} leaves that disagreed with an earlier rendering` : "") +
    (absent ? `; ${absent} leaves absent from the pack` : ""),
);

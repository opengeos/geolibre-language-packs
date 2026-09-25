/**
 * Shared helpers for the translation pipeline.
 *
 * `v1/whitebox/en.json` repeats the same English string many times: 1,066 tools
 * share ~1,800 distinct parameter labels, and `whitebox.menuTool` is a verbatim
 * copy of every `toolMeta.whitebox.<tool>.name`. Translating the file as-is
 * would mean translating 15,670 leaves; translating the distinct strings means
 * 7,913. A translation memory is therefore keyed by the English string itself,
 * and `buildPack` re-expands it, so one English string always renders the same
 * way everywhere it appears.
 *
 * Both the walk and the rebuild are generic over the English tree rather than
 * hard-coded to its current shape. That is not hypothetical tidiness: 1,065
 * tools carry a tool-level `description` (their summary) alongside `name` and
 * `params`, and an extractor written against the shape "name + params" silently
 * skips all of them.
 */
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);

/** Chunk grouping, in the order strings are handed to a translator. */
const ROLE_ORDER = ["category", "subcategory", "toolname", "label", "tooldesc", "description"];

function roleFor(path) {
  const [head, ...rest] = path;
  if (head === "whitebox") {
    if (rest[0] === "categories") return "category";
    if (rest[0] === "menuSubcategory") return "subcategory";
    if (rest[0] === "menuTool") return "toolname";
  }
  if (head === "toolMeta") {
    const leaf = path[path.length - 1];
    if (leaf === "name") return "toolname";
    if (leaf === "label") return "label";
    if (leaf === "description") return path.includes("params") ? "description" : "tooldesc";
  }
  return path[path.length - 1];
}

/** Every string leaf of the English pack, in document order, with its role. */
function walkEnglish() {
  const en = JSON.parse(
    readFileSync(new URL("v1/whitebox/en.json", root), "utf8"),
  ).translations.processing;
  const out = [];
  (function walk(value, path) {
    if (typeof value === "string") {
      // The work-chunk format is one tab-separated pair per line. Newlines are
      // escaped as a literal `\n` there (see `encodeCell`), so a source string
      // may contain one; a tab, a carriage return, or a literal backslash-n
      // would make the round trip ambiguous and silently corrupt a chunk.
      if (/[\t\r]|\\n/.test(value)) {
        throw new Error(`en.json: ${path.join(".")} contains a tab, carriage return or literal \\n`);
      }
      out.push({ role: roleFor(path), text: value });
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`en.json: ${path.join(".")} is neither a string nor an object`);
    }
    for (const key of Object.keys(value)) walk(value[key], [...path, key]);
  })(en, []);
  return out;
}

/**
 * A string as it appears in a work chunk. Ten Whitebox summaries run to several
 * paragraphs, and a raw newline would split their line in two, so newlines are
 * written as a literal `\n` and restored by `decodeCell` on import.
 */
export const encodeCell = (text) => text.replaceAll("\n", "\\n");

/** Inverse of `encodeCell`. */
export const decodeCell = (cell) => cell.replaceAll("\\n", "\n");

/**
 * The distinct translatable strings, grouped by role. Grouping matters for
 * translation quality as much as for tidiness: a bare "Dem" reads very
 * differently as a parameter label than as a sentence.
 */
export function sourceStrings() {
  const seen = new Map();
  for (const { role, text } of walkEnglish()) if (!seen.has(text)) seen.set(text, { role, text });
  const entries = [...seen.values()];
  const rank = (entry) => {
    const index = ROLE_ORDER.indexOf(entry.role);
    return index === -1 ? ROLE_ORDER.length : index;
  };
  return entries.map((entry, index) => ({ entry, index }))
    .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
    .map(({ entry }) => entry);
}

/**
 * Rebuild the English tree with each string leaf replaced by its translation.
 * Leaves with no translation are dropped and empty branches pruned: GeoLibre
 * runs packs through i18next with `fallbackLng: "en"`, so a missing key renders
 * in English rather than blank.
 */
export function buildPack(memory) {
  const en = JSON.parse(
    readFileSync(new URL("v1/whitebox/en.json", root), "utf8"),
  ).translations.processing;
  const missing = [];
  const translate = (value, path) => {
    if (typeof value === "string") {
      if (memory[value] === undefined) {
        missing.push({ path: path.join("."), role: roleFor(path), text: value });
        return undefined;
      }
      return memory[value];
    }
    const out = {};
    for (const key of Object.keys(value)) {
      const child = translate(value[key], [...path, key]);
      if (child !== undefined) out[key] = child;
    }
    return Object.keys(out).length ? out : undefined;
  };
  return { processing: translate(en, []), missing };
}

/** The translations recorded for `locale` so far, or an empty memory. */
export function translationMemory(locale) {
  const file = new URL(`translations/${locale}.json`, root);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

/** Serialise a memory in canonical order, so diffs stay stable as it fills in. */
export function orderMemory(memory) {
  const ordered = {};
  for (const entry of sourceStrings()) {
    if (memory[entry.text] !== undefined) ordered[entry.text] = memory[entry.text];
  }
  return ordered;
}

export { root };

/**
 * Rewrite `v1/index.json` and the download list in `index.html` from the packs
 * on disk.
 *
 * `bytes` in the index is the one field nobody can keep correct by hand — it
 * changes on every retranslated string — so the index is generated rather than
 * edited, and `npm test` fails if it disagrees with the directory.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const locales = JSON.parse(readFileSync(new URL("translations/locales.json", root), "utf8"));
const dir = new URL("v1/whitebox/", root);

const packs = readdirSync(dir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => {
    const bytes = readFileSync(new URL(name, dir));
    const pack = JSON.parse(bytes.toString("utf8"));
    return {
      locale: pack.locale,
      name: pack.name,
      scope: pack.scope,
      url: `https://languages.geolibre.app/v1/whitebox/${pack.locale}.json`,
      bytes: bytes.byteLength,
      updatedAt: pack.updatedAt,
    };
  })
  .sort((a, b) => {
    const nameOf = (entry) => locales[entry.locale]?.englishName ?? entry.locale;
    return nameOf(a).localeCompare(nameOf(b), "en");
  });

// The index leads with English because it is the pack format's reference
// document; the download page leads with the real translations and leaves the
// translator template at the bottom, where someone browsing for their own
// language will not trip over it.
const indexOrder = [...packs].sort((a, b) => (a.locale === "en" ? -1 : b.locale === "en" ? 1 : 0));
const pageOrder = [...packs].sort((a, b) => (a.locale === "en" ? 1 : b.locale === "en" ? -1 : 0));

writeFileSync(
  new URL("v1/index.json", root),
  JSON.stringify({ formatVersion: 1, packs: indexOrder }, null, 2) + "\n",
);

const label = (entry) =>
  entry.locale === "en"
    ? "English translator template"
    : (locales[entry.locale]?.nativeName ?? entry.locale);
const rows = pageOrder
  .map(
    (entry) =>
      `        <div class="pack"><a href="/v1/whitebox/${entry.locale}.json">${label(entry)}</a>` +
      `<span class="code">${entry.locale}</span></div>`,
  )
  .join("\n");

const page = readFileSync(new URL("index.html", root), "utf8");
const start = "<!-- packs:start -->";
const end = "<!-- packs:end -->";
if (!page.includes(start) || !page.includes(end)) {
  throw new Error(`index.html is missing the ${start} / ${end} markers`);
}
writeFileSync(
  new URL("index.html", root),
  page.replace(
    new RegExp(`${start}[\\s\\S]*${end}`),
    `${start}\n${rows}\n        ${end}`,
  ),
);

console.log(`v1/index.json + index.html: ${packs.length} packs`);

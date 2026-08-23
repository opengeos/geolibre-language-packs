import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LEAVES = 100_000;
const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);
const packDirectory = new URL("../v1/whitebox/", import.meta.url);

function stringLeaves(value, path) {
  if (typeof value === "string") return 1;
  assert(value && typeof value === "object" && !Array.isArray(value), `${path} must be an object`);
  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    assert(key && !dangerousKeys.has(key), `${path} contains an unsafe key`);
    count += stringLeaves(child, `${path}.${key}`);
  }
  return count;
}

function validatePack(pack, filename) {
  assert.equal(pack.format, "geolibre-language-pack", `${filename}: format`);
  assert.equal(pack.formatVersion, 1, `${filename}: formatVersion`);
  assert.equal(pack.scope, "whitebox", `${filename}: scope`);
  assert.match(pack.locale, /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, `${filename}: locale`);
  assert.equal(filename, `${pack.locale}.json`, `${filename}: locale must match filename`);
  assert.deepEqual(
    Object.keys(pack.translations ?? {}),
    ["processing"],
    `${filename}: translation root`,
  );
  const processing = pack.translations.processing;
  assert(
    Object.keys(processing).every((key) => key === "toolMeta" || key === "whitebox"),
    `${filename}: unsupported Processing subtree`,
  );
  if (processing.toolMeta) assert.deepEqual(Object.keys(processing.toolMeta), ["whitebox"]);
  if (processing.whitebox) {
    assert(
      Object.keys(processing.whitebox).every((key) =>
        ["categories", "menuTool", "menuSubcategory"].includes(key),
      ),
      `${filename}: unsupported Whitebox subtree`,
    );
  }
  const leaves = stringLeaves(processing, `${filename}.translations.processing`);
  assert(leaves > 0 && leaves <= MAX_LEAVES, `${filename}: invalid message count ${leaves}`);
  return leaves;
}

const index = JSON.parse(await readFile(new URL("../v1/index.json", import.meta.url), "utf8"));
const files = (await readdir(packDirectory)).filter((name) => name.endsWith(".json")).sort();
assert.deepEqual(
  index.packs.map((entry) => `${entry.locale}.json`).sort(),
  files,
  "v1/index.json must list every pack exactly once",
);

for (const filename of files) {
  const bytes = await readFile(new URL(filename, packDirectory));
  assert(bytes.byteLength <= MAX_BYTES, `${filename}: exceeds the 5 MB limit`);
  const pack = JSON.parse(bytes.toString("utf8"));
  const leaves = validatePack(pack, filename);
  console.log(`${filename}: ${leaves.toLocaleString("en")} messages, ${bytes.byteLength} bytes`);
}

# Translating a Whitebox pack

GeoLibre ships catalogs for 19 languages, and **all 19 now have a complete
Whitebox pack**. This document is the workflow that produced the seventeen —
`ar`, `de`, `es`, `fa`, `fr`, `hi`, `id`, `it`, `ja`, `ka`, `ko`, `nl`, `pt`,
`ru`, `th`, `tr`, `vi` — and the reference for re-running it when `en.json`
changes.

## Why there is a pipeline

`v1/whitebox/en.json` holds **14,938 message leaves**, but only **7,181 distinct
strings**. 1,066 tools share ~1,800 parameter labels between them, and
`whitebox.menuTool` is a verbatim copy of every `toolMeta.whitebox.<tool>.name`.
Translating the file directly means doing twice the work and getting a pack that
renders "Input raster file." three different ways.

So the unit of work is a **translation memory**: `translations/<locale>.json`,
keyed by the English string itself.

```json
{
  "Conversion": "Conversión",
  "Input raster file.": "Archivo ráster de entrada."
}
```

`scripts/build.mjs` re-expands a memory over the English pack's shape, so one
English string always renders the same way everywhere it appears, and a locale
can never drift structurally from `en`.

## The loop

```sh
node scripts/extract.mjs es      # write work/es/chunk-NN-<role>.tsv for what's still missing
#                                # ...translate the second column of each chunk...
node scripts/import.mjs es       # merge the chunks back into translations/es.json
node scripts/build.mjs es        # write v1/whitebox/es.json (add --partial to allow gaps)
node scripts/reindex.mjs         # refresh v1/index.json + index.html
npm test                         # the same validation CI runs
```

`work/` is gitignored; only `translations/*.json` and the built pack are
committed. `extract.mjs` only ever emits what is still missing, so the loop is
resumable — stop after any chunk, import what you have, and pick it up later.

Chunk files are `<source>\t<translation>`, pre-filled with the source on both
sides, ~20,000 characters each, and grouped so a chunk holds one **role** at a
time. The role matters: a bare `Dem` needs a different rendering as a parameter
label than as prose.

| Role | Strings | What it is |
| --- | --- | --- |
| `category` | 48 | Processing-panel categories, e.g. `Terrain - Derivatives` |
| `subcategory` | 45 | Menu subcategories |
| `toolname` | 1,060 | Tool display names (also used for the menu entries) |
| `label` | 1,792 | Parameter labels |
| `tooldesc` | 333 | Tool-level descriptions — one or two sentences |
| `description` | 3,903 | Parameter descriptions — the bulk of the work |

Roles are emitted in that order, so the strings that dominate the UI get
translated first and a locale is useful long before it is finished.

`import.mjs` skips any line whose translation still equals its source, because
that is exactly what an untranslated chunk looks like. A few strings genuinely
stay identical in every language (`OBIA`, `SAR`, `Atan2`, `GeoLibre (WASM)`);
pass `--keep-identical` for a chunk that contains them. Existing translations
are never overwritten without `--force`.

## Conventions

Translate display prose only. Leave unchanged:

- identifiers referenced in the text — `segment_id`, `class`, `output`
- format and standard names — `GeoTIFF`, `LAS`, `CSV`, `EPSG`, `WKT`, `GeoJSON`,
  `PMTiles`, `H3`, `COG`, `WMS`
- algorithm and person names — `Canny`, `Sobel`, `Kuwahara`, `Felzenszwalb`,
  `Getis-Ord`, `Voronoi`, `Savitzky-Golay`, `RANSAC`, `LiDAR`
- units, numbers, and defaults — `m`, `km`, `deg`, `%`, `(default 200)`
- the ` - ` separator in category names, and `I/O`

Keep the same term for the same concept across a locale — `raster`, `vector`,
`DEM`, `stream`, `watershed`, `kernel`, `overlay`, `buffer` recur constantly.
`translations/zh.json` is complete and is the best reference for how a finished
locale reads.

Pack display names live in `translations/locales.json`. Setting `updatedAt`
there pins it; leaving it out stamps the build date.

## Where each locale stands

All 19 locales are complete: 7,181 / 7,181 distinct source strings each, expanding
to 14,938 message leaves per pack. `v1/whitebox/` holds 19 packs and
`scripts/build.mjs <locale>` reports "complete" for every one without `--partial`.

| Locale | Translated | Notes |
| --- | --- | --- |
| `en` | — | the source pack; never edited |
| `zh` | 7,181 / 7,181 | harvested from the published pack, then normalised |
| `ar` `de` `es` `fa` `fr` `hi` `id` `it` `ja` `ka` `ko` `nl` `pt` `ru` `th` `tr` `vi` | 7,181 / 7,181 | translated through the loop above |

A handful of strings are deliberately identical to their English source in every
locale — bare acronyms (`OBIA`, `SAR`), math function names (`Cos`, `Ln`,
`Atan2`), Greek letters and single-letter parameter symbols (`K`, `N`, `X`,
`Dx`), and algorithm or product names (`LandTrendr`, `Fill-Spill-Merge`,
`GeoLibre (WASM)`). They were imported with `--keep-identical`. Locales that
share vocabulary with English legitimately have more of them — Dutch 119, French
104, Indonesian 100 — while Persian has 15 and Arabic 20.

`--partial` is therefore only needed while new work is in flight: it omits
untranslated leaves so i18next falls back to `en` per key, which is shippable but
visibly mixed. The final build of every pack must be run without it.

## Three things that are easy to get wrong

**333 tools carry a tool-level `description`** alongside `name` and `params`, and
only those 333 do. An extractor written against the shape "name + params" walks
right past them and loses 333 strings without erroring. `lib.mjs` therefore walks
the English tree generically rather than assuming its shape; keep it that way.

**Rebuilding `zh` normalises 31 leaves.** The published pack rendered 13 English
strings two different ways — `Zero Background` was both `零背景` and `背景为零`,
`Dst Epsg`'s description was `目标 Epsg` against a `目标 EPSG` label. A memory maps
one source string to one translation, so `harvest.mjs` keeps the first rendering
and reports the rest. The committed `zh` pack is the normalised rebuild; it is
otherwise leaf-for-leaf identical to what was published.

**`extract.mjs` renumbers chunks, so never run it while a chunk is checked out.**
It emits whatever is still missing, numbered from `chunk-01`. Run it while a
worker is partway through `chunk-13` and that worker's strings come back under a
new name — the same work, emitted twice. When several people or agents translate
one locale in parallel, extract once at the start, then use `ls work/<locale>/`
to see what is left; the chunk files themselves are the work queue, and
`import.mjs` is what retires an entry from it.

## Recovering a memory

`scripts/harvest.mjs <locale>` rebuilds `translations/<locale>.json` from a pack
that already exists in `v1/whitebox/`. Use it to recover a memory that was lost,
or to re-seed after `en.json` changes — new English strings then show up as the
only work `extract.mjs` emits.

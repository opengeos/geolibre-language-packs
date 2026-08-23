# GeoLibre language packs

Optional translations for the large Whitebox processing catalog used by
[GeoLibre](https://github.com/opengeos/GeoLibre). Keeping these packs outside the
application prevents hundreds of tool descriptions for every locale from being
embedded in every web, desktop, and mobile build.

GeoLibre can download an official pack from this repository or import the same
JSON format from a local file. The ordinary application interface translations
remain bundled with GeoLibre and work offline without a pack.

## Published files

- Pack schema: `https://languages.geolibre.app/schema/v1.json`
- Pack index: `https://languages.geolibre.app/v1/index.json`
- Whitebox pack: `https://languages.geolibre.app/v1/whitebox/<locale>.json`

Run `npm test` before publishing changes. Packs are untrusted input in the app,
but this repository applies the same scope and string-leaf validation early so
translation mistakes fail in CI.

## Add or update a translation

Packs are generated, not hand-edited. Each locale has a translation memory in
`translations/<locale>.json` keyed by the English string, and `scripts/build.mjs`
re-expands it over the English pack's shape:

```sh
node scripts/extract.mjs es      # chunk up whatever is still untranslated
node scripts/import.mjs es       # merge the finished chunks back in
node scripts/build.mjs es        # write v1/whitebox/es.json
node scripts/reindex.mjs         # refresh v1/index.json + index.html
npm test
```

See [TRANSLATING.md](TRANSLATING.md) for the conventions, the per-locale
progress, and the pitfalls. Keep identifiers, interpolation placeholders, enum
values, and technical units unchanged; translate display strings only.

The only accepted translation roots are:

- `processing.toolMeta.whitebox`
- `processing.whitebox.categories`
- `processing.whitebox.menuTool`
- `processing.whitebox.menuSubcategory`

## License

Language packs are released under the MIT License.

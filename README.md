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

1. Copy `v1/whitebox/en.json` to the target locale code.
2. Keep identifiers, interpolation placeholders, enum values, and technical
   units unchanged; translate display strings only.
3. Set `locale`, `name`, and `updatedAt` in the pack header.
4. Add the pack to `v1/index.json` and run `npm test`.

The only accepted translation roots are:

- `processing.toolMeta.whitebox`
- `processing.whitebox.categories`
- `processing.whitebox.menuTool`
- `processing.whitebox.menuSubcategory`

## License

Language packs are released under the MIT License.

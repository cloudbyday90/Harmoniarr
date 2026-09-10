# September 2026 dependency security update

Date: 2026-09-10

## Problem and boundary

Release validation identified installed and locked `sharp@0.35.3` as affected
by [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).
The maintainer identifies `0.35.4` as the patched release, with prebuilt
libheif `1.23.2`. The advisory describes possible code execution on glibc Linux
under specific conditions; this investigation establishes a vulnerable
dependency and reachable image parser, not a reproduced Harmoniarr exploit.

Provider response bodies, embedded covers, and sidecar images converge on
`src/server/artwork/artwork-ingestion-service.js`. Its native
`sharp(buffer).metadata()` call occurs before the JPEG/PNG/WebP allowlist.
The allowlist therefore does not establish that unsupported image formats
cannot reach the native parser. Valid artwork must retain its existing
orientation, encoding, size/dimension limits, storage identity, and dominant
color behavior.

## Selected change

Raise the manifest floor from `^0.35.3` to `^0.35.4` and regenerate only the
sharp lockfile dependency family using:

```powershell
npm install sharp@0.35.4 --save-prefix=^ --ignore-scripts
```

The [sharp 0.35.4 release](https://github.com/lovell/sharp/releases/tag/v0.35.4)
links the [sharp-libvips 1.3.3 bundle](https://github.com/lovell/sharp-libvips/releases/tag/v1.3.3),
which includes libvips `8.18.6` and libheif `1.23.2`. The published package
retains Node `>=20.9.0`, compatible with Harmoniarr's Node 24 policy. Keep all
optional platform entries, including Linux musl amd64/arm64 used by Docker.
No runtime API, image-format policy, or audit threshold change is needed.

## Related query-parser update

The same audit reported transitive `qs@6.15.3` through Express and body-parser.
The official [array-limit advisory](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)
and [isBuffer advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)
both identify `6.16.0` as patched. Select a targeted
`npm update qs --ignore-scripts`: `6.16.0` satisfies the existing
Express `^6.14.0` and body-parser `^6.15.2` ranges. Keep qs transitive; avoid
adding a direct dependency or override. The bounded advisory examples are
reproducible against the old package; endpoint exploitability is a separate
question from the dependency update.

Current HTTP wiring uses Express's simple query parser and the shared JSON
body parser, with no direct qs calls or URL-encoded-body middleware. The
advisory-specific paths are not demonstrated reachable in that configuration;
the dependency update removes the affected installed package without changing
request parsing behavior.

## Validation

- Inspect lockfile changes and platform dependency closure.
- Run existing artwork ingestion, runtime tuning, and PWA manifest tests.
- Exercise real JPEG/PNG/WebP ingestion and AVIF/malformed-input rejection.
- Re-run bounded qs advisory examples and a normal parse/stringify control.
- Confirm native sharp/libheif versions and run `npm run validate:security`.
- Record packaging checks and any untested architecture in the outcome.

Sources above were searched and inspected on 2026-09-10.

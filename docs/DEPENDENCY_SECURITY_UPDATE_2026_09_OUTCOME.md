# September 2026 dependency security update outcome

Date: 2026-09-10

## Delivered

The affected dependency versions were replaced with the compatible releases
selected in [the design](DEPENDENCY_SECURITY_UPDATE_2026_09_DESIGN.md):

- `package.json` raises sharp's floor to `^0.35.4`.
- `package-lock.json` locks sharp and its native packages to `0.35.4`, the
  sharp-libvips packages to `1.3.3`, and transitive qs to `6.16.0`.
- All optional platform entries remain present, including Linux musl x64
  and arm64. No unrelated package versions, runtime source, or audit policy
  changed.

The targeted commands were `npm install sharp@0.35.4 --save-prefix=^ --ignore-scripts`
and `npm update qs --ignore-scripts`. qs remains a shared
transitive dependency of Express and body-parser, with no added override.

## Validation evidence

| Check | Result |
| --- | --- |
| `node --test --test-reporter=spec test/server/artwork-ingestion-service.test.js test/server/runtime-resource-service.test.js test/scripts/pwa-manifest.test.js` | 19 passed; zero failed or skipped |
| `node --test --test-reporter=spec test/server/app.test.js` | 2 passed; zero failed or skipped |
| `npm run validate:security` | Passed, including image-tag and Compose topology policies |
| `npm audit --json` | Zero reported vulnerabilities at every severity |
| Lockfile scope and dependency-closure inspection | Only sharp's dependency family and qs changed; all platform entries retained |
| `git diff --check -- package.json package-lock.json` | Passed |

Real in-memory artwork controls on Windows x64 preserved JPEG, PNG, and WebP
ingestion, dimensions, and sanitization. Valid AVIF still receives the existing
unsupported-format response; truncated AVIF and malformed bytes are rejected.
The loaded native stack reports sharp `0.35.4`, libheif `1.23.2`, and libvips
`8.18.6`.

A disposable `node:24.19.0-alpine` Linux x64 container used npm `12.0.2` and
`npm ci --omit=dev --ignore-scripts` against the final manifest and lockfile.
It loaded the same fixed native versions and qs `6.16.0`, then successfully
encoded and inspected small JPEG/PNG/WebP/AVIF controls. The repository was
mounted read-only; the writable dependency workspace and container were
removed afterward. This is native-package compatibility evidence, not a
published-image deployment test.

Before the qs update, bounded examples reproduced both advisory behaviors:
bracket-key comma parsing exceeded a three-item array limit, and a parsed
`constructor.isBuffer` string caused a TypeError during serialization. On
`6.16.0`, the overflow throws the intended RangeError, including encoded
brackets, and serialization handles both `plainObjects` and `allowPrototypes`
variants without that exception. Normal parse/stringify controls pass.

Independent read-only reviews checked the image input boundary, lockfile
platform closure, and query-parser compatibility. The sharp finding is
verified through removal of the affected dependency, the maintainer's fixed
native version, native loading, and normal/rejected-image controls; an exploit
payload was not reproduced. Linux arm64 native execution and full published
image rollout were not performed in this dependency slice.

The current app's JSON body parsing and simple query parsing do not demonstrate
the advisory-specific qs paths. Removing the affected transitive package still
eliminates those dependency findings without changing HTTP parsing behavior.

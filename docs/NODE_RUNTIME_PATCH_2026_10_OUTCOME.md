# Node runtime patch outcome — October 2026

Executed October 3, 2026. The separate
[design](NODE_RUNTIME_PATCH_2026_10_DESIGN.md) records official research,
alternatives, scope, and the recommended stack.

## Maintained result

The application Docker builder and `.nvmrc` now select Node 24.21.0 LTS.
The Node 24 engine range and explicit npm 12.0.2 package-manager pin remain
compatible. The current security benchmark points to the patched target; the
August runtime policy links to this successor while retaining historical evidence.
The controlled-provider fixture successor has its own
[PR #40 outcome](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md).

The official [Node 24 archive](https://nodejs.org/en/download/archive/v24)
identified 24.21.0 as the latest LTS at consultation. The
[release notes](https://github.com/nodejs/node/releases/tag/v24.21.0) and actual
package probes agree on bundled Undici 7.29.1 and OpenSSL 3.5.8. This reaches
the maintainer's patched 7.x baseline for the conditional BalancedPool TLS issue.
[Undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3).
No application exploit was established, and npm audit does not measure Node's
bundled components.

## Packaged runtime verification

An ignored ESM harness reuses `validateDockerFreshInstall` to build the local
`harmoniarr-quality-fallback:local` image and run isolated disposable mounts,
generated fixture-only VAPID material and the existing container restrictions.
It exercises:

- Fresh embedded PostgreSQL startup, schema bootstrap, 104 applied migrations,
  zero pending migrations, health and read-only root.
- Existing-data restart and a persisted database probe.
- Delegated request ownership and lifecycle, backup/restore preview and apply,
  maintenance-lock refusal, and restoration completion.
- Refusal of intentionally invalid bootstrap configuration.
- Actual Node/npm/component versions and native Sharp PNG encode/decode both
  before and after restart.
- Twelve actual ffmpeg/ffprobe quality controls using generated MP3, PCM WAV,
  and Vorbis/Ogg, including lossy files renamed with a lossless extension.
- Strict removal of task-owned containers, networks, volumes and temporary data.

Both runtime phases reported Node 24.21.0, Undici 7.29.1, OpenSSL 3.5.8,
npm 12.0.2, Sharp 0.35.4 and libvips 8.18.6. Six explicit native/version
assertions passed per phase. The host remains Node 24.18.1; no global runtime
was changed. This is actual Linux amd64 packaged execution rather than a mocked
image-pin check.

Local commands and evidence:

```powershell
node .tmp/node-runtime-2026-10/validate.mjs
node scripts/verify-docker-smoke-evidence.js --evidence-path .tmp/node-runtime-2026-10/fresh-install-evidence.json
```

The harness and sanitized runtime/fresh-install evidence are retained under
ignored `.tmp/node-runtime-2026-10`. The initial smoke and final rebuilt execution
both passed. The final package contains the reviewed runtime source; its timestamp
is `2026-10-03T16:58:44.331Z` and local image ID is
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
The existing smoke-evidence verifier accepted the final artifact. The media
controls use the actual shipped inspection service and quality gate, with an
injected passing spectral invocation control; no FFT-classification or physical
library-add claim follows from those controls. Final artifact hashes and detailed
case scope are recorded in the [quality fallback outcome](MISSING_MUSIC_QUALITY_FALLBACK_OUTCOME.md).

## Recommendation and limits

Adopt this compatible Node 24 LTS patch with npm 12.0.2 and the existing ESM,
Vue, Express, PostgreSQL 18, media-inspection and container architecture. It
reduces runtime drift and refreshes a bundled component without a major migration;
the cost is a rebuild and package/native verification.

Review Node 26 after its October 28 LTS transition with a separate compatibility
lane. These local checks do not close arm64, full container/SBOM vulnerability
review, registry provenance, or published-image acceptance. No image publication,
release, tag, hosted workflow dispatch, or PR merge was performed.

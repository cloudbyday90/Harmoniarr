# Node 24 baseline design

Date: 2026-10-19. Follow the [reporter outcome](TEST_REPORTER_OWNERSHIP_OUTCOME.md).
The opening host is 24.18.1; .nvmrc and Dockerfile use 24.21.0. CI already selects
.nvmrc, while package floors still allow 24.15.0. Qualify published 24.22.0 as a
common canonical development/build baseline. The announced October 21 security
release is not available as of this consultation; it remains a required follow-up.

## Ownership and behavior

.nvmrc owns the exact validation version. Package engines and devEngines retain
a Node 24 support range beginning at that baseline. Docker pins the matching
Node version and explicit Alpine minor plus multi-platform index digest. Pin
the final Alpine base's index digest too. Its
copied Node binary and final Alpine runtime must share the same minor family.
Retain current non-root runtime, npm 12.0.2, PostgreSQL 18 and application APIs.

A small ESM policy module reads the three existing configuration owners and
validates the active Node process before canonical validation. A thin CLI uses
the existing script reporter. Refuse floating/prerelease/multiple pins, package
floor disagreement, ambiguous Docker defaults, missing digest, mismatched Alpine
and a different active runtime. The exact validation pin is deliberately narrower
than the published package support range. New patched runtimes need pin updates
and qualification; the check is not an application-startup lock or installer.

Invoke the check first in validate/validate:fast and in the shared CI setup action.
Keep existing setup-node action SHA, .nvmrc consumption, release dispatch boundary,
serial integration scheduling, warning limits and resource ownership. This checks
canonical defaults, not arbitrary build-arg overrides or every Dockerfile grammar.

## Qualification

Use official release metadata/checksum for a project-scoped Windows Node binary
and reuse installed npm 12.0.2. Scope PATH to validation commands; do not replace
the shared Windows installation or silently claim it changed. Record original
and actual executable versions. CI configuration is locally reviewed, not a
completed hosted-CI run.

Run focused adverse policy/reporter tests, then the fast gate on frozen source.
Run selected real PostgreSQL/TLS and built Chromium journeys with the same source
and lock bytes. Build the actual Linux/amd64 application image from the new pin,
verify packaged Node/npm and run disposable packaged startup/database/HTTP checks.
Retain a failed candidate's evidence; do not label another architecture qualified.

Random PR 50 is an independent local Router candidate. Apply its immutable JSON
delta while preserving this slice's engine/scripts metadata. Run its native
Chromium composition/control under Node 24.22.0. Restore both package files and
installation if it still fails; no PR merge or vendor/application workaround.
The [research](NODE_24_BASELINE_RESEARCH_2026_10.md) and
[outcome](NODE_24_BASELINE_OUTCOME.md) record decisions, limits and actual results.

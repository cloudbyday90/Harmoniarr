# Apple credential-save outcome

October 28, 2026. Follows the [signing outcome](APPLE_SIGNING_OUTCOME.md).
See the separate [design](APPLE_CREDENTIALS_DESIGN.md),
[official research and alternatives](APPLE_CREDENTIALS_RESEARCH_2026_10.md) and
[Docker outcome](LOCAL_DOCKER_APPLE_CREDENTIALS_OUTCOME.md).

## Delivered

The protected settings save now validates a submitted Apple private-key
replacement before encryption or writes. Native key admission is extracted from
the existing signing policy and reused by a small ESM credential normalizer.
It checks the raw UTF-8 input against the shared 16 KiB bound, then trims and
requires a native private EC/prime256v1 PEM. PKCS8/SEC1 are admitted. Malformed,
encrypted, oversized, RSA, other curves, Ed25519, public and non-string material
refuse with a static 400 validation_error and no native cause or key echo.

Submitted Team ID/key ID fields now accept empty reset values or exactly ten
ASCII letters/digits, trimming surrounding whitespace while preserving case.
The character allowlist is project policy; Apple documents ten-character IDs.
No tuple-completeness requirement or live account check is added. Omitted
legacy fields are not retroactively validated. Blank/omitted key input retains
the saved key; valid replacement plus clear=true still conflicts. Explicit clear
removes stored material and retains existing environment fallback. Key-only
rotation and independent ID edits remain supported.

The provider secret extractor has one optional normalizer; other provider secret
behavior is unchanged. The existing route/session/CSRF guards, settings transaction,
encryption, audit ownership and presence-status shape remain. Secrets stay out of
ordinary settings values, returned settings/updates and audit details. Runtime
key admission and one-hour/five-minute signer/cache policy remain unchanged.

## Evidence and limits

Focused server qualification passed 97 tests across the new credential cases,
existing signer/client, settings validator/service and provider resolver. The new
tests cover accepted formats, refusal privacy, mutation capture, clear/blank
semantics and submitted ID types/shape. The frozen fourteen-stage fast gate passed
6,385 server, 4,504 client and 703 script/policy tests: 11,592 total, with no
failures, skips or cancellations. Lint, ESM, copyright, migration/snapshot/anchor,
image/compose checks, test hygiene and build passed. Production dependency audit
found zero vulnerabilities. The successful guarded preflight uses the
real application route, native PostgreSQL and encrypted owner; final immutable
image and full-gate evidence are recorded in the [Docker outcome](LOCAL_DOCKER_APPLE_CREDENTIALS_OUTCOME.md).

Benefits are early useful rejection, shared algorithm/key policy and unchanged
partial-edit behavior. Costs are local parsing on replacement and stricter
submitted values: previously saved invalid fields must be corrected if resubmitted.
No extra network, dependency, credential persistence, migration or deployed app
is introduced. A valid local key/ID shape does not prove Apple ownership,
capabilities, revocation state, key-ID correspondence or live provider acceptance.
Existing stored/environment credentials are not rewritten or certified by a save
of unrelated settings. Runtime admission remains the final defense before dispatch.

The first native preflight failed because its fallback assertion expected a
trailing newline that the existing resolver trims. The fixture expectation was
corrected; production behavior was preserved. The failed run and its verified
container retirement are retained separately from successful preflight/final
qualification. Prior unexplained linked-login evidence remains separate and is
not diagnosed by this change. No UI changed; manual AT/device checks remain deferred.

GitHub MCP initially found zero open PRs, so no random selection was available
and no stale Dependabot PR needed cleanup or rebase. A repeat search at
2026-10-28 10:32:05 UTC again returned zero open PRs. Work stays directly on main without a release,
tag, PR merge or separate application branch.

## Next recommended item

This item is now implemented in the [local status design](APPLE_STATUS_DESIGN.md)
and [outcome](APPLE_STATUS_OUTCOME.md), preserving presence semantics while
adding a separate bounded local signing summary.

Make the existing read-only Apple status service distinguish configured presence
from local signing validity. It currently treats any nonempty IDs/key as configured,
including older saved or environment values. Reuse shared admission without
returning secrets or contacting Apple, preserve authorization and no-store HTTP
behavior, and label local validation separately from provider connection acceptance.

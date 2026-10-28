# Apple Music owned HTTP outcome

October 28, 2026. Implements the next item from the
[preceding provider HTTP outcome](PROVIDER_HTTP_OUTCOME.md). Separate documents
cover [official research, pros/cons and stack](APPLE_HTTP_RESEARCH_2026_10.md),
[design](APPLE_HTTP_DESIGN.md) and [Docker outcome](LOCAL_DOCKER_APPLE_HTTP_OUTCOME.md).

## Delivered

Apple Music now receives the same application-owned HTTP service as Spotify and
YouTube. Their collective active limit stays four; preparation, cancellation and
retirement occupy those slots. Successful results wait for actual request,
response, socket, codec and issued-DNS retirement. Existing shutdown owns Apple
work too. No extra deployed service or global singleton was added.

Only the existing Apple API origin was added to provider policy. Normal native
TLS identity, connection-time public DNS validation, redirect/proxy refusal,
wire/decoded byte limits, single-codec streaming and sanitized error projection
now apply to Apple. The obsolete separate fetch adapter is removed. Explicit
fetch injection remains an owned compatibility seam; its cancellation promises
do not establish native socket or wire-byte proof.

Signing and per-client caching live in a separate ESM token service. The client
retains all six catalogue methods and re-exports the existing signing helper.
ES256/P1363 signatures, issuer/key claims, 180-day lifetime, 30-day renewal buffer,
storefronts, includes, offsets and existing configuration errors are preserved.
The default application collection check uses its real resolver and encrypted
saved key through the native owner. Invalid stored signing material refuses
before network dispatch. No subscriber scope, credential delivery to browsers,
SQL/schema, UI, dependency graph or version change was introduced.

## Validation and compatibility

The frozen fourteen-stage gate passed 6,347 server, 4,504 client and 703 script/
policy tests: 11,554 total, with no failures, skips or cancellations. Lint, ESM,
copyright, schema/migration/anchor, image/compose checks, hygiene and build passed.
Production dependency audit reported zero vulnerabilities. Focused checks verify
real signatures, cache renewal edges, all catalogue methods, safe signing failure
and shared admission held beyond a result promise.

The [Docker outcome](LOCAL_DOCKER_APPLE_HTTP_OUTCOME.md) records 22 Apple native
scenarios, 35 repeated provider HTTP scenarios, exact packaged parity, cleanup
and live walkthrough. These establish actual native TLS/resource ownership and
saved-key wiring using controlled public fixtures, not live Apple acceptance.
The older eight-case HTTPS cohort explicitly tests bundled fetch for all three
providers. It does not stand in for their production default-native evidence.

Apple now refuses configured HTTP(S)/ALL_PROXY, even with NO_PROXY. Its calls
share capacity with other provider API/OAuth work and can fail unavailable when
busy. Fresh connections add setup cost. Response caps remain at most 2,000,000
bytes in both encoded/decoded forms, subject to smaller caller limits; error
bodies cap at 4,096. Unknown/layered coding and invalid successful JSON fail.
There are no new automatic retries.

Byte caps and admission reduce retained work but do not prove heap/RSS ceilings,
real-time cancellation or a deployment memory minimum. Other metadata clients
keep their own established transports; this does not put every application HTTP
call under this owner. Human screen-reader/physical-device checks remain deferred.

Initial native preflight used an incorrect private resolver property; the fixture
was corrected to exercise the public default collection service and real resolver.
Initial lint found an import/re-export duplication and an unused test import;
both were corrected before freeze. Failed candidates remain separate and are
not counted as passing evidence. The preceding linked-login failure remains
unexplained; this Apple-only change does not claim to fix it or rerun that lane.

Random PR #60 was applied locally as a separate SHA-pinned CI change and tested
without release dispatch; its [design](DEPENDABOT_ORAS_DESIGN.md) and
[outcome](DEPENDABOT_ORAS_OUTCOME.md) own details. Work stays on main, with no
release, tag, PR merge or new application branch.

## Next recommended item

Review explicit P-256 private-key admission and developer-token lifetime policy
in the extracted service. The current generic signing call can accept other key
types, while Apple requires ES256; retain sanitized failure before dispatch.
Consider shorter bounded token validity with compatible cache renewal rather
than treating Apple's six-month maximum as the preferred lifetime. Keep that
policy decision separate from this compatibility-preserving transport adoption.

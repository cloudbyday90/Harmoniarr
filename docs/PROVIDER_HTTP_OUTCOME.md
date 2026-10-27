# Spotify and YouTube HTTP ownership outcome

October 27, 2026. Implements the next item from the
[OAuth outcome](OAUTH_LINK_OUTCOME.md). Separate documents contain the
[official research, pros/cons and recommendation stack](PROVIDER_HTTP_RESEARCH_2026_10.md),
[design](PROVIDER_HTTP_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md).

## Delivered

One application-owned ESM factory now limits Spotify and YouTube API, token
exchange/refresh and Google revocation to four active requests collectively.
Request preparation and native retirement count against admission. A deadline
can return failure while actual work drains, but cannot release capacity early.
Success waits for request, response, socket, codec and every issued DNS callback.
Uncertain retirement refuses success, seals admission and fails shutdown.
Worker producers close before this owner.

The default transport is direct native HTTPS with normal certificate/hostname
verification, original Host/SNI, fixed existing origins, complete public DNS
validation, fresh non-keepalive agents and no redirect or automatic retry.
Gzip, zlib-deflate and Brotli are decoded through single-use streaming pipelines
with independent encoded/output counters, 16 KiB codec chunks, strict completion,
trailing-data refusal and nonstandard large-window Brotli disabled. JSON must be
strict UTF-8 and an object. Existing smaller token budgets and sanitized HTTP
status/reason/Retry-After behavior remain. Unreadable HTTP error bodies do not
erase a known HTTP failure status.

The thin adapter, capture policy, admission owner, native transport, bounded
response reader and injected-fetch compatibility seam are separate modules.
Plex reuses the extracted native core while retaining its own response policy.
Existing local OAuth authority checks, atomic token/state/revision/required-audit
publication, stale-refresh fences and automatic maintenance remain. Google
revocation still follows committed local clear and is best effort.

## Evidence

The final frozen fourteen-stage gate passed 6,341 server, 4,504 client and 703
script/policy tests: 11,548 total, zero failures/skips/cancellations. Lint, ESM,
copyright, migration/snapshot/anchors, image/compose checks, hygiene and build
passed. Production dependency audit found zero vulnerabilities. Focused lifecycle
checks hold drain/cancellation promises to prove that caller completion cannot
release admission or finish shutdown; actual transport proof is separate.

The [Docker outcome](LOCAL_DOCKER_PROVIDER_HTTP_OUTCOME.md) records the immutable
image, 35 new native scenarios, repeated affected PostgreSQL/Plex entries, both
controlled Chromium OAuth flows, live walkthrough and verified resource cleanup.
The retained eight-case provider HTTPS cohort now explicitly injects bundled
fetch for Spotify/YouTube and keeps Apple Music on its original implementation.
Its fetch/proxy controls do not substitute for the new default-native evidence.

An earlier complete server run had two failed assertions expecting the old exact
YouTube header object. Authentication was correct; the new owner adds JSON and
compression headers. Assertions now test API-key/bearer credential selection.
That failed candidate is retained separately; only the later frozen gate is
counted above. Initial focused fixture/header/error-classification failures were
corrected before the final code freeze and are not counted as passes.

The first final-image linked-login entry failed at a controlled PIN request with
`plex_request_unavailable`. A separate diagnostic run and unchanged original
repeat passed all 23 scenarios; the diagnostic observed zero pool checkouts at
every provider call. The original failure is retained, unreproduced and unexplained.
No production policy/assertion was weakened. The Docker outcome records the
separate failed and passing invocations; later passes do not establish a cause.

## Compatibility and limits

Proxy environment configuration now refuses default Spotify/YouTube dispatch,
including NO_PROXY exemptions. Fresh connections add setup cost and do not reuse
HTTP/2 or persistent sockets. Capacity exhaustion returns the existing bounded
unavailable error instead of accumulating a queue. API response limits are
2,000,000 bytes for each representation; token responses remain at most 65,536
bytes, and error/revocation bodies at most 4,096. Smaller caller limits apply.
Unknown/layered coding, malformed UTF-8/JSON and trailing compressed data fail.

Byte counts and four slots reduce retained work, but do not establish total
heap/RSS bounds or a deployment memory minimum. Cancellation delivery depends on
scheduling; issued DNS callbacks can outlive caller failure. Explicit injected
fetch waits for its settlement/cancellation but offers no native socket proof.
Apple Music deliberately retains its original fetch implementation separately.

Remote token/code effects cannot be rolled back by local PostgreSQL. Controlled
retry fixtures do not prove reuse of a remotely consumed code or rotated token.
Clearing credentials does not cancel unrelated already-admitted remote work.
No live provider account acceptance or manual screen-reader/physical-device
acceptance is claimed. No UI, SQL/schema, dependency, release or version change
is included; no additional deployed service or manual schema refresh is needed.

GitHub MCP initial and final searches found no open PRs, including Dependabot.
There was no random PR to apply locally or stale Dependabot PR to rebase/close.
No PR was merged. Work remains on main without a release or separate branch.

## Next recommended item

Extend the same owned native HTTP service to Apple Music, preserving developer
JWT signing/cache and API contracts. Qualify real TLS identity, compressed-body
bounds, cancellation, shared admission and retirement for that caller before
removing the legacy fetch adapter. This closes the remaining provider transport
gap without another application or deployed service.

# Schema diagnostic deadline outcome

October 27, 2026 implementation and validation record for the frozen candidate.

## Delivered behavior

Schema diagnostics now use a single-use, startup-bounded connection and a shared
inspection deadline. Timeout or disconnect returns unavailable, suppresses late
results, closes the owned connection and holds admission through drainage. The
browser stops waiting after its request deadline and supports explicit retry.

All new code is ESM in narrow modules. Database history, snapshot, reviewed anchor
contract, repair and release behavior remain unchanged.

## Validation

- Focused owner/task/service/route/client checks: 26 passed, including Error/null,
  late startup delivery, uncooperative preparation, uncertain-close admission
  fencing, actual response disconnect and browser timeout/retry state.
- Full fast gate: 6,212 server, 4,502 client and 703 script tests passed, with zero
  failed/skipped/cancelled tests. Lint, ESM, copyright, migration/snapshot/contract,
  image-tag/topology, hygiene and build checks passed. npm audit: zero advisories.
- Packaged PostgreSQL drift/lifecycle: all 16 cases passed. These include the
  existing restricted-role/current/drift/lineage/no-repair controls, both
  preparation-lock orders, lock timeout, forbidden writes and killed backend,
  plus saturated-pool bypass, cancellation/deadline query interruption and a
  controlled startup stall. Backend and preparation-lock retirement were observed;
  both owned databases and the restricted role were removed.
- Packaged administrator HTTP checks passed with fresh authorization before and
  after scans, no-store, safe projection, revocation, busy/unavailable and rate
  refusal. Ordinary observation/backup regression and six preparation-serialization
  scenarios passed. All four guarded containers exited and their absence was
  verified after removal.
- Three real Chromium scenarios passed. Schema checks use the actual current
  endpoint first, then controlled pending/failure states. The 25-second browser
  clock expiry clears counts, keeps focus and enables explicit retry; nine total
  explicit requests were observed. Light desktop/dark mobile screenshots and the
  live administrator's desktop/mobile current-result screenshots were reviewed.
- Fresh no-cache Docker image, unchanged native identities, live CLI/current
  checks, owned data-bind backup probe and preserved administrator/mounts passed;
  see the [Docker outcome](LOCAL_DOCKER_SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md).

Frozen source: 3,688 files, SHA-256
`85d9c2ad06c5f8294f2c51e9ea97c767774747bb0ffda592522e9e107c9a5569`.
All 14 changed code/test files were compared with their frozen hashes after
validation. The new server modules remain separate from route and SQL ownership.

Retained evidence, not reruns: 17 atomic-snapshot, 18 container-replacement and
seven entrypoint-preparation cases from the earlier qualified chain. Their owning
source/tests, immutable artifacts, dependencies and relevant packaged runtime
remain unchanged; the current preparation serialization lane was rerun.

## Pull request work

GitHub MCP found two open Dependabot PRs on October 27: #57 (slskd 0.26.2) and
#58 (Node 26.12.1 controlled-provider fixture). Both were created that day, based
on the current main commit and mergeable; no stale PR needed rebasing or removal.
`crypto.randomInt(2)` selected [PR #58](https://github.com/cloudbyday90/Harmoniarr/pull/58).
Its one-line fixture update is applied locally, without merging. The actual
fixture ran as Node 26.12.1 in a disposable, network-isolated, read-only container:
health passed, missing credentials received 401 and authenticated application
response passed. Its file secret and exact container were removed. This is fixture
startup/authentication coverage, not a rerun of the full media/provider pipeline.
The locally applied change supersedes PR #58 when published on main; PR #57
remains independent of this diagnostic change. No release, tag or branch is created.

## Next item

Qualify application-wide pool admission and session-query deadlines under
connection exhaustion. This change isolates diagnostic observation; initial and
publication authorization still use the ordinary pool. Preserve fresh-session
authorization and primary errors while bounding those waits, rather than letting
diagnostic policy silently change all database consumers.

Manual screen-reader speech and physical-device checks remain deferred under the
earlier acceptance decision. Browser assertions do not establish those results.

See [research](SCHEMA_DIAGNOSTIC_DEADLINES_RESEARCH.md) and
[design](SCHEMA_DIAGNOSTIC_DEADLINES_DESIGN.md).

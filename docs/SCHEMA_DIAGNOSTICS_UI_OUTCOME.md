# Administrator schema diagnostics UI outcome — October 26, 2026

## Delivered behavior

Settings → Recovery → Recovery diagnostics now includes an independent Database
schema section. Refresh schema checks is explicit: opening the page/disclosure or
running general diagnostics does not start a schema scan. Current, attention,
busy, unavailable, lost administrator access and request-limit feedback remain
distinct. Previous facts/timestamps clear on refresh and failure.

The new administrator-only GET sets no-store before authentication and checks
authority again before publishing. Rate admission uses the existing request-key
policy at 12/minute; a process-local service admits one active scan with no queue
or cached result. It reuses the established read-only observer and returns only
state, completion time and selected counts. No schema repair, audit mutation,
background poll, dependency, database object or second application is added.

The permanent polite/atomic status node sits outside the busy result region.
The native button survives loading and remains focusable; its handler suppresses
duplicate Enter/Space/click activation. Completion retains focus and respects a
user's move elsewhere. Disposal aborts transport and ignores late results without
claiming SQL cancellation. Client/server projection keeps private SQL, definitions,
anchor identities, stored errors and unexpected values out of this summary.

## Validation

The focused route/service/composition/client cohort passed 60 tests. The complete
fast gate passed 6,205 server, 4,501 client and 703 script tests without failures,
skips or cancellations, plus static checks, lint and build. npm audit reported
zero vulnerabilities. The frozen source fingerprint covers 3,685 files and all
17 changed code files. Historical 115-file migration SQL, raw snapshot and
expected anchor contract bytes remain unchanged.

The three selected browser tests passed: new schema interaction plus sibling
readiness and artwork diagnostics. The new browser journey used a real current
endpoint response, then controlled pending/attention/unavailable/busy/error/
forbidden/retry states. It proved no eager scan, seven explicit requests,
duplicate suppression, persistent status outside busy, stale clearing, focus
retention and respect for user focus. Light desktop and dark 390px layouts had
no overflow, a 44px button target and no private marker; screenshots were visually
reviewed. DOM/keyboard evidence is not speech or physical-device acceptance.

Immutable image
`sha256:4d5147e24382811bf606af94563a81ceff11825341b3b322d617c7ae4ad9bbe1`
passed native HTTP proof with real sessions, the actual observer and database:

| Boundary | Result |
| --- | --- |
| Anonymous/requester | Refused before scan; no-store |
| Administrator demoted during held work | Recheck refused publication; no summary returned |
| Valid current scan | 164 critical checks, explicit selected counts |
| Real missing index | Attention with current lineage; no repair; private identity omitted |
| Preparation contention / reader failure | Busy / fixed unavailable representation |
| Concurrent requests | At most one active scan; no queued scan |
| Burst beyond quota | Actual 429 with no-store |
| Read-only boundary | Ledger/catalog fingerprints preserved around observation |

The underlying 12-case drift fixture and concurrent observation fixture also
passed on this image. The latter retained 20 reads and three encrypted artifacts.
All three native fixture containers retired with absence verified. The existing
administrator's actual browser login to the rebuilt walkthrough passed; opening
the section made zero requests and one refresh returned current/164/no-store,
retained focus and fit mobile width. Existing data and all five mounts survived.

## Recommendation and limits

Adopt explicit control → authorization → admission limits → existing read-only
observer → selected-count projection → authorization recheck → no-store → polite
feedback/fresh result. Benefit: useful investigation with bounded work admission,
private output and clear loading/failure ownership. Costs: manual refresh and
possible busy/rate refusal; the check still covers selected schema properties.

Connection/filesystem/transport time is outside SQL transaction limits. Aborting
the client does not stop an admitted SQL scan. The quota follows the existing
request-key policy and is not a new distributed/per-identity security boundary.
External SQL that ignores the preparation key remains outside cooperative scan
coherence. Repair and startup admission are unchanged. Manual AT/device checks
remain deferred under the earlier acceptance decision.

GitHub MCP found no open repository or Dependabot PRs; random local application
and stale cleanup/rebase were inapplicable. No PR was merged. Work stays on main
without a new branch, release or tag.

Next: qualify and bound connection/end-to-end observation admission separately
from the existing server transaction limits, preserving bounded unavailable
feedback and actual resource retirement. See [research/pros and cons](SCHEMA_DIAGNOSTICS_UI_RESEARCH.md),
[design](SCHEMA_DIAGNOSTICS_UI_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SCHEMA_DIAGNOSTICS_UI_OUTCOME.md).

October 27 follow-up: connection ownership, inspection/caller deadlines and
drainage fencing are implemented in the
[deadline design](SCHEMA_DIAGNOSTIC_DEADLINES_DESIGN.md) and
[outcome](SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md). The connection/transport limits
above describe this document's original October 26 candidate.

October 27 automatic maintenance follow-up: the manual schema control and
request-owned inspection described here are superseded by the
[automatic maintenance design](AUTO_SCHEMA_MAINTENANCE_DESIGN.md) and
[outcome](AUTO_SCHEMA_MAINTENANCE_OUTCOME.md). The UI loads maintained status on
opening; startup/hourly observation, recovery pauses, bounded retry and shutdown
drainage belong to application maintenance. The earlier evidence remains a
historical record of the explicit-check candidate.

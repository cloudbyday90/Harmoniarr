# Organize mutation ownership research

Read-only research, 9 October 2026 local and UTC. Root reports clean main
5b52135f8bce389a284e6c01b8996df7cbf029dc. Scope is the existing organizer's
post-preview file movement, canonical database path and success notification.
No generic filesystem redesign, provider upgrade or release is inferred.

## Primary discovery and versions

MCP search was recorded at 22:28:18 UTC. Official direct reads/navigation
continued through 22:34:14. Local commands observed Node 24.18.1/npm 12.0.2 at
22:28:18. PostgreSQL 18 is the consulted documentation version; no running database
or deployed container version was probed.

The initial Node search returned [v24.20.0 filesystem documentation](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html).
That is a later minor than the observed local runtime. To establish the matching
contract, GitHub MCP rediscovered nodejs/node, expanded its returned Git-ref
template with the observed v24.18.1, and followed tag→commit→tree→doc/api/fs.md.
The tag resolves to commit 9623d9ad85d37d2f0610ec4a82b48182cf2c6061; the actual
[file](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/fs.md)
was read at 22:30:45, blob 60c46c69f64730eab5b796dbe2e88920e71684e7.
This establishes tagged API documentation, not a verified runtime binary hash
or release publication date.

| Primary source | Authority | Applicable guidance |
| --- | --- | --- |
| [PostgreSQL 18 locks](https://www.postgresql.org/docs/18/explicit-locking.html) and [consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned official database guidance | Locks protect cooperating returned rows while held. Current checks need appropriate snapshot timing and consistent object order. |
| [PostgreSQL 18 clock](https://www.postgresql.org/docs/18/functions-datetime.html) and [UPDATE](https://www.postgresql.org/docs/18/sql-update.html) | Versioned official documentation | Refresh expiry after waits; transaction-start now() is not a final wall clock. Check affected/returned rows: a zero-row update is not automatically an error. |
| [Node 24.18.1 fs documentation](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/fs.md) | Official versioned API guidance | Rename can replace an existing destination. COPYFILE_EXCL refuses an existing copy destination, but copying has no atomicity guarantee. Access-before-use races and Windows drive-relative path behavior matter. |
| [OWASP workflow](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) and [authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Informative mutable guidance | Enforce current authority and workflow state at execution, with checked conditional writes. Local transactions do not make external effects atomic. |
| [WCAG 2.2](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) and [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Normative Recommendation 12 December 2024; informative explanation updated 11 May 2026 | Expose relevant progress/results without requiring focus. Lease loss must not be presented as successful completion. |

Mutable guidance has no invented publication date. Search-engine dates are not
publisher release evidence. The relevant Node methods and limitations were read
from the exact installed-version tag; no later-version feature is recommended.

## Current owner trace and bounded recommendation

The following source observations are not executed race reproductions.
The [worker](../src/server/library/library-organize-apply-worker.js) awaits preview,
then calls file mutation and canonical-path update before a later progress
lifecycle write can report lost ownership. The current
[catalog writer](../src/server/library/library-catalog-store.js) updates by file ID
and deleted-at state. The shared
[filesystem owner](../src/server/media/media-filesystem-service.js) awaits path
inspection, mkdir and destination checks, uses link followed by source removal,
and falls back to copyFile with COPYFILE_EXCL. It does not use rename for this
transport; preserve existing collision behavior.

As an application-specific inference, carry the immutable acquired token through
the actual mutation owner. Recheck active run/acquisition, cancellation and
applicable maintenance after awaited preview/preparation and immediately before
new mutating steps. Include directory creation, destination creation and source
removal where they remain future steps. An earlier worker check or eventual
markRunStarted false cannot authorize those effects.

The canonical-path owner needs a short transaction that verifies the same current
acquisition and expected existing file path before its conditional update.
Check its result and stop further work on lost authority. Do not reread a newer
token to give the old body replacement ownership. Success notifications/Activity
must follow successful current-owned outcomes, not a stale preview or moved
counter alone.

Keep database locks out of long filesystem I/O. These guards prevent new effects
at their checked boundaries; they cannot undo a link/copy already in flight.
Losing ownership between a filesystem step and catalog persistence can leave a
partial result requiring existing reconciliation. Do not claim filesystem/database
rollback or external exactly-once. Token checks do not serialize unrelated
filesystem writers or guarantee unchanged bytes since preview. Path checks must
use resolved server-selected paths; lexical normalization alone does not reserve
a path or remove access-time races.

| Option | Benefit | Gap | Assessment |
| --- | --- | --- | --- |
| Detect lease loss in later progress/lifecycle writes | Reuses existing token protection | File/catalog effects may already have occurred | Insufficient mutation boundary |
| Add a captured-token check after preview only | Covers one common delay | Awaited path work and later catalog/removal steps can still drift | Useful but incomplete |
| Guard actual filesystem steps and owning catalog update | Stops newly stale work at each owned boundary | Preserves partial/in-flight effect limitations | Preferred bounded option |

## Minimum evidence and limits

Hold old acquisition A after preview and inside awaited path preparation, acquire B,
then release the old body: zero new filesystem mutations, catalog updates and
notifications; B can complete. Exercise same-PID/token replacement, expiry after
wait, cancellation, catalog path drift, multiple files, source/destination failure
and collision controls. Separately lose ownership after an effect begins and
assert only the bounded refusal of subsequent steps; do not assert rollback.

Real PostgreSQL owns current-acquisition/catalog CAS and concurrent writer proof.
Actual temporary-file operations own transport, collision and partial-result
claims. Injected calls prove wiring/order only. Existing visible status remains
truthful; no new UI interaction is proposed and DOM evidence is not actual
assistive-technology speech or whole-platform conformance.

Raw source/owner/version evidence:
.tmp/organize-mutation-2026-10/official-source-discovery-and-reads.json,
SHA-256 a3aa38342abc5f3157a904952b6c5d8c8cdab5e0f72825cc7cec3b814be7f1de.
Exact tagged Node discovery/document:
.tmp/organize-mutation-2026-10/node-24.18.1-immutable-fs-docs.json,
SHA-256 7c9c81169c399253c36386fbcb093f90bc9801c46624267cba7d3b8dfb1361f9.

No source/test edit, runtime test, PostgreSQL operation, Git mutation, provider
mutation, external message, branch, release or merge occurred. Local application
owner reads were limited to this mutation path. Fresh PR assessment is separate:
[design](OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_ORGANIZE_MUTATION_2026_10_OUTCOME.md).

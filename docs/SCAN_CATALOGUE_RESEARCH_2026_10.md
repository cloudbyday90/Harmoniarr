# Scan catalogue ownership research

Read-only primary-source research, 9 October 2026 local and UTC. Root reports
clean main 041458d. Consultation began 23:43:49 UTC; the host clock reported
2026-10-09T19:43:49.0314780-04:00. Local commands observed Node 24.18.1/npm 12.0.2.
These are host observations, not deployed-container or running PostgreSQL proof.

The [shipped organizer outcome](ORGANIZE_MUTATION_OUTCOME.md) identifies the scan
worker's post-walk catalogue writer as the next boundary: root/file upserts and
missing-file state can receive an old acquisition's observations. This research
reads that finding and official guidance; it does not independently inspect or
execute the current scan runtime.

## Fresh official ledger

GitHub/MCP web discovery supplied official URLs. PostgreSQL navigation selected
canonical version 18 pages; W3C history selected the frozen Recommendation.
Detailed source reads continued through 23:46:15 UTC.

| Primary source | Authority/version | Applicable guidance |
| --- | --- | --- |
| [PostgreSQL 18 locks](https://www.postgresql.org/docs/18/explicit-locking.html) and [consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned official documentation | Returned-row locks serialize cooperating writers; consistent object order and fresh post-wait checks matter. Separate Read Committed checks are not automatically a coherent authorization decision. |
| [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) | Versioned official documentation | Group local database changes in one transaction and roll them back on failure. Uncommitted intermediate changes are not visible to other transactions. |
| [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and [UPDATE](https://www.postgresql.org/docs/18/sql-update.html) | Versioned official API guidance | RETURNING describes actual inserted/updated rows. A locked ON CONFLICT DO UPDATE row failing its WHERE condition is not returned. UPDATE count 0 is not itself an error. |
| [PostgreSQL 18 clock functions](https://www.postgresql.org/docs/18/functions-datetime.html) | Versioned official documentation | now()/transaction_timestamp() retain transaction-start time; clock_timestamp() advances. Expiry checks after waits need a refreshed instant. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) and [workflow](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Informative mutable guidance | Validate current authority at execution, enforce server-owned transitions, and check conditional-write results. Financial examples do not require new MFA here. |
| [WCAG 2.2](https://www.w3.org/TR/2024/REC-WCAG22-20241212/) and [status explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Normative Recommendation 12 December 2024; informative explanation | Programmatically expose relevant waiting/results without forcing focus. Status must describe the owned result, not merely attempted work. |

PostgreSQL 18 is the consulted documentation version; no running database version
was probed. No publication date is invented for mutable guidance. The existing
ESM architecture is inherited; no new loader behavior, Node feature, provider
contract, upgrade or deployment is proposed.

## Bounded recommendation

These are application-specific inferences, not executed scan or transaction proof.

Carry the original acquired key/owner/UUID receipt and trusted root identity
through the awaited walk to the actual catalogue owner. Do not acquire a newer
token by rereading a row, or let a missing scan token select an unguarded fallback.
Retain ordinary command authorization and current maintenance/cancellation gates.

Use a short current-owned transaction for root metadata, observed-file upserts
and missing-file tombstones. Keep walk/metadata/filesystem I/O outside its locks.
Align run/key/lease and root-before-file ordering with the relevant existing
producers; the preceding organizer work already demonstrated why lock order
must be checked through actual store calls, not join/alias ordering assumptions.
Recheck current run/acquisition/root after blocking locks and use fresh expiry
checks at the chosen write/final decision boundaries.

Guarding only ON CONFLICT DO UPDATE's WHERE clause leaves the INSERT branch
unprotected. It also leaves root metadata and missing-file changes outside that
guard. Check expected returned rows/cardinality under the writer's defined
contract and throw/roll back when its current-authority or required write fails.
Do not count attempted upserts as confirmed catalogue writes. Conversely, a
genuinely current empty scan can legitimately change zero rows; zero is not
independent proof of either success or stale ownership.

Freeze/copy the completed observation frame before awaiting persistence, including
its root/path identity and completion meaning. Preserve existing traversal error
semantics: incomplete/failed reading cannot silently become an empty-success
snapshot that tombstones the library. Current empty scans must remain supported.

Stale old acquisition A must change no root/file/missing state after acquisition B
owns the operation; B must be able to persist and complete. Use the same current
ownership for subsequent lifecycle success and notifications. A catalogue
transaction committed before later lease loss is a committed local result;
do not claim it was undone or that a filesystem walk is an atomic snapshot.

| Option | Benefit | Gap | Assessment |
| --- | --- | --- | --- |
| Worker check before walk/persist only | Small patch | Awaited walk and lock waits can outlive ownership | Insufficient writer boundary |
| Guard conflict updates only | Protects one SQL branch | New inserts, root metadata and tombstones remain exposed | Incomplete |
| Guard complete catalogue transaction after the walk | Preserves one local atomic decision | Requires captured ownership, consistent locks and checked results | Preferred bounded option |
| Hold database locks through filesystem walk | Delays competing workers | Long I/O transaction; does not make the filesystem a database snapshot | Reject |

## Minimum evidence and limits

Hold scan A after a completed walk, replace it with B and persist B's files, then
resume A. Assert zero old catalogue changes and correct B completion. Cover
same-PID/token replacement, active/expired lease and cancellation, root drift,
fresh expiry after lock waits, new/existing file branches, tombstone rollback,
mid-batch failure and malformed ownership. Separately prove current empty scan
success and that failed/incomplete traversal cannot delete missing-file state.
Include organizer-versus-scan root/file interleaving to verify deadlock-free order.

Real PostgreSQL owns transaction, affected-row, CAS and concurrency claims.
Injected store calls prove propagation/order only. Existing job-status checks
should distinguish observed, persisted, refused and completed work without new
UI controls. No actual assistive-technology speech, universal filesystem snapshot
consistency or whole-platform conformance is established by this research.

Raw discovery/reads, host versions/clock and prior-outcome excerpts:
.tmp/scan-catalogue-2026-10/official-source-discovery-and-reads.json,
SHA-256 8d3f0096ae3b00c41136b67d05f97545485898ff23bdca0ee4bad5909ce9a6ea.

No runtime/source/test edit, runtime test, PostgreSQL operation, Git mutation,
provider mutation, external message, branch, release or merge occurred.
Fresh PR applicability is separate:
[design](OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_OUTCOME.md).

## Node path clarification, 10 October UTC / 9 October local

Fresh GitHub MCP API-tree navigation at 00:09:56 UTC discovered doc/api/path.md
within the previously verified Node v24.18.1 commit
9623d9ad85d37d2f0610ec4a82b48182cf2c6061. Its
[official tagged path documentation](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/path.md)
was read at the same UTC time; blob c072c85ee59d5f574fda8f0482a48b0b023ea372.
Local clock: 2026-10-09T20:10:34.7501592-04:00. Tag/commit identity is inherited
from the organizer ledger; this was a fresh tree and document read.

The API guidance defines relative paths and explicit `posix`/`win32` implementations.
`sep` is `/` on POSIX and backslash on Windows; normalization resolves the exact
parent component `..`. As an application inference, a containment check must
distinguish that component and its separator-prefixed descendants from contained
names such as `..track.flac` or `..Archive`. Converting relative separators with
`split(pathModule.sep).join('/')` preserves a POSIX filename's literal backslash;
replacing every backslash would change its identity.

Raw source evidence:
.tmp/scan-catalogue-2026-10/node-24.18.1-path-semantics.json,
SHA-256 fac6fb28e749fc43e51540b11586f1e6de87a1b3ce71df91ad586d31db78241e.
This confirms documented lexical semantics; no runtime/path test, PostgreSQL
operation, symlink-safety or filesystem snapshot proof was performed.

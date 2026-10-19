# Official practices by boundary

October 19 default-CSRF guidance uses docs/CSRF_DEFAULT_PROTECTION_RESEARCH_2026_10.md.
OWASP session-bound token validation and explicit Strict/HttpOnly cookie practices
own different boundaries. W3C Fetch Metadata is a Working Draft, not a mandate to
replace existing tokens. Trace current route exceptions, saved/environment
precedence and load-failure caches before changing defaults; do not label a
cookie-bearing direct HTTP request as a demonstrated foreign-site browser attack.

October 19 runtime guidance uses docs/RUNTIME_DEPENDENCY_RESEARCH_2026_10.md.
OWASP recommends server CSRF validation; W3C Fetch Metadata remains a Working
Draft and provides additional request context. Neither makes disabled token
enforcement secure. W3C WCAG Understanding is informative: focused-link Enter
activation is narrower than sequential focus-order conformance. Vendor lazy
route guidance differs from async-setup/Suspense composition; reproduce the
reported router trigger separately from actual built application navigation.

October 19 TLS identity guidance uses docs/POSTGRES_TLS_IDENTITY_RESEARCH_2026_10.md.
Node default verification, RFC 9525 SAN identity and PostgreSQL key permissions
own distinct boundaries. Testcontainers withSSL handles key setup; retain
rejectUnauthorized=true even though its general example disables it. W3C draft
monotonic guidance informs durations; browser Secure Contexts does not establish
database identity. pg queues local startup on sslconnect before secureConnect:
do not turn that buffered dispatch into certificate/authentication success.

October 19 dependency guidance uses
docs/POSTGRES_DRIVER_8231_RESEARCH_2026_10.md. Public FIFO/release documentation
does not promise internal PendingItem identity. Compare published package bytes
and immutable upstream source, review transitive serializer owners and retain
exact-version/method refusal. W3C draft monotonic guidance and OWASP bounded
logging inform diagnostics; neither certifies the dependency or platform.
Vendor TypeScript migration guidance and real LSP initialization support keeping
6.0.3 when a direct 7.0.2 replacement breaks the installed tooling consumer.

October 19 prerequisite guidance uses
docs/LIBRARY_ADD_PROBE_OWNERSHIP_RESEARCH_2026_10.md. Node close includes stdio;
timeout/abort and killed do not prove completion. Docker create acknowledgement
and verified ID/configuration own remote retirement. Keep cleanup uncancelled,
unknown artifacts retained, original Error/null and OWASP-minimized records.
Changed probe work cannot claim an equal-work or whole-CI speed improvement.

October 17 setup timing uses docs/LIBRARY_ADD_SETUP_TIMING_RESEARCH_2026_10.md.
Use actual returned command/runtime completion and process-relative durations;
do not sum nested phases or infer causes from residual wall time. Node signal
delivery and Docker client completion do not certify remote retirement. Keep
OWASP-minimized records and distinguish unavailable returns from thrown failure.

October 17 automatic library-add guidance uses
docs/AUTOMATIC_LIBRARY_ADD_MEDIA_RESEARCH_2026_10.md. Docker root read-only and
mount read-only are separate controls; local daemon authority remains privileged.
Use Node close/stdio completion, unchanged ffprobe output interpretation, W3C
draft monotonic elapsed measurements and OWASP-minimized aggregate reporting.
Reuse reviewed scenario/inspection owners and preserve every native assertion;
counterbalanced equal-work evidence is local, not whole-CI or hosted-Ubuntu proof.

October 16 HTTP phase guidance uses docs/FIXTURE_HTTP_PHASE_RESEARCH_2026_10.md.
Node AsyncLocalStorage.run restores synchronous context but retains async
descendants; retire the owned request scope explicitly at response finish/close.
Native body events need request/response dispatch ownership beyond server handler
entry. W3C Trace Context Recommendation privacy/security guidance does not require
adding headers to this internal fixture or establish protocol conformance.
Follow OWASP minimization: approved UUID/phase only, no URL/body/cookie/trace input.

October 16 startup-write guidance uses
docs/POSTGRES_STARTUP_WRITE_RESEARCH_2026_10.md. Node socket return and callback
are local flow/completion boundaries; PostgreSQL AuthenticationOk and ReadyForQuery
are distinct protocol evidence. Do not infer receipt or TCP acknowledgement from
local success. Apply W3C draft monotonic offsets within one clock domain and
OWASP data minimization before output. Native method/stream and plain packet
guards keep auth/query writes and accessor-triggered traffic outside observation.
Capture diagnostic scalar fields once before validation/emission: a changing
getter must not replace an approved enum, boolean or opaque ID after approval.

October 16 queued-checkout guidance uses
docs/POSTGRES_QUEUED_CHECKOUT_RESEARCH_2026_10.md. The public Pool API documents
next-tick idle handoff and FIFO waiting; neither counters nor the releasing async
context identifies a pending caller. Use exact reviewed pending-item ownership,
bounded OWASP-minimized records and W3C draft-inspired monotonic offsets. Driver
internal entry, callback delivery and PostgreSQL readiness are different stages.
Keep unsupported/malformed mappings unknown and historic failures separate.

October 16 root-lane guidance uses docs/WANTED_ROOT_TEST_LANES_RESEARCH_2026_10.md.
Node selection/timeouts do not prove I/O drainage. Preserve PostgreSQL rollback
and resource owners, fixed CLI options and private equality/work proof before
bounded summaries. W3C draft monotonic timing is descriptive; moving repetitions
between lanes is not an algorithmic or whole-CI speed claim.
The same research includes current node-postgres Pool API guidance: total/idle/
waiting metrics and FIFO/release semantics do not identify a stalled caller or
justify a pool increase from one snapshot. Keep later healthy probes distinct
from original queued/startup evidence and report clipped/unassociated records.

October 15 Linux canonical guidance uses
docs/LINUX_CANONICAL_MEDIA_RESEARCH_2026_10.md. Node TestsStream has per-file and
cumulative summaries; require the latter plus complete current inspection/owner
records, not a zero exit or textual pass line. Use actual daemon-host paths for
nested binds and treat the trusted socket runner as privileged. Keep manual CI,
W3C draft elapsed timing and OWASP fixed output distinct from hosted-platform
certification. Drain after evidence failure; inherited eval flags are not cleared
by an empty execArgv option. Keep successful media cleanup separate from an
unverified database-stop error path.

October 15 media rollout guidance uses
docs/LIBRARY_ADD_MEDIA_ROLLOUT_RESEARCH_2026_10.md. Node native module hooks can
prove a test-only dependency boundary in a fresh process; retain compatible
exports and actual media/cleanup behavior while separating SQL fixtures. W3C
draft elapsed timing and OWASP fixed output do not turn module counts or a loaded
host's command-time difference into whole-CI performance evidence. Docker API
compatibility and Linux canonical proof remain separate adoption requirements.

October 15 canonical media guidance uses
docs/LIBRARY_ADD_MEDIA_PILOT_RESEARCH_2026_10.md. Docker read-only media mounts
and reviewed local API reads apply at the scenario's actual directory owner.
Node reported test completion is not resource drainage; await app work, canonical
executor close and the returned database tail. W3C draft monotonic timing and
OWASP aggregate output guide measurements, not cache authority or a global
rollout. Bootstrap/lifecycle costs can outweigh four short inspections. Keep
explicit cohort selection, reversed-order evidence and all current-byte checks.

October 15 reusable cleanup guidance uses
docs/REUSABLE_WORKSPACE_CLEANUP_RESEARCH_2026_10.md. Node unique directories,
canonical paths and exact stat identity inform current filesystem ownership;
OWASP controlled-name/storage guidance applies by analogy to fixture labels.
Keep child and parent authority separate, await actual returned resource/database
completion and preserve Error/null through failed release. W3C draft timing
measures elapsed work; a fixed delay is not quiescence. A successful later
predicate cannot clear an earlier retained child. Directory checks are not an
atomic OS deletion handle against arbitrary host writers.

October 14 scale/socket guidance uses docs/MEDIA_API_SCALE_RESEARCH_2026_10.md.
Docker bind sources belong to the daemon host; a read-only socket mount does
not create GET-only daemon authorization. Keep this privileged access in a
trusted explicit proof runner with a minimal bundle, matched private daemon and
owned stop/removal. Node test isolation and W3C draft monotonic timing inform
separate native/selected/fast scopes; a completed largest selection neither
diagnoses old failures nor replaces Linux filesystem/lifecycle coverage. Verify
annotated action tags through their target commit and retain full SHA pins.

October 14 local API guidance uses docs/MEDIA_INSPECTION_API_RESEARCH_2026_10.md.
Docker context precedence and privileged daemon access require target pinning
and private CLI/API daemon/capability matching before container creation. Node
HTTP requires actual response consumption and owned keep-alive disposal; a timer
notification alone is not termination. Keep local-only allowlisted versioned GETs,
bounded complete JSON and original Error/null through socket/agent close. W3C
draft timing and OWASP output minimization inform evidence, not daemon-side
read-only credentials or current ownership authority. Count hybrid operations
separately from spawned CLI calls and keep platform/default promotion explicit.

October 14 transport-phase guidance uses
docs/MEDIA_TRANSPORT_PHASE_RESEARCH_2026_10.md. Node process-relative timing and
W3C draft monotonic durations support returned-work windows; OWASP data minimization
supports fixed bounded aggregates and failure tests. Docker CLI/control reads map
to Engine API work, but control elapsed time is not wholly avoidable host startup.
Preserve every current inspection, original failure and cleanup owner. A proposed
local read adapter requires acknowledged context/daemon/version and bounded HTTP/
agent disposal before promotion; do not infer permission to expose a daemon.

October 14 inspection-owner guidance uses
docs/OWNED_MEDIA_EXECUTOR_RESEARCH_2026_10.md. Docker exec lifetime belongs to its
container; a killed host CLI cannot certify stopped work. Admit the canonical
two-file preview within a bounded serial executor, verify acknowledged identity
and effective read-only/no-network configuration, disable inherited app health
checks, then stop/verify/remove before workspace disposal. OWASP approved output
and W3C draft monotonic timing remain evidence rules, not inspection-cache authority.

October 13 seed-phase guidance uses docs/WANTED_SEED_PHASE_RESEARCH_2026_10.md.
W3C draft/Node monotonic observation supports nested timing; OWASP data
minimization supports fixed labels, numeric spans and bounded artifact tails.
Await returned observation, preserve primary Error/null and keep operation
payloads private. The current worker preview can replace redundant preparation,
not its own current inspection or byte/publication guards. FFmpeg multi-output
guidance is a deferred media-shape candidate; no cache or batching follows from
source guidance alone. Verify actual installed tool/runtime versions separately.

October 13 guarded-workload replay guidance uses
docs/WANTED_WORKLOAD_REPLAY_RESEARCH_2026_10.md. W3C draft timing and Node
monotonic measurements inform separate service/runner scopes; OWASP logging
informs fixed failure frames and private payload exclusion. Explicit selections
must record their dimensions and cannot replace a full matrix. PostgreSQL/driver
ownership preserves original private comparisons and cleanup. Verify media
prerequisites, retain failed collections and use approved phase checkpoints
before changing resource policy or skipping production publication guards.

October 12 negative-scan guidance uses docs/SCAN_RECEIPT_INVALIDATION_RESEARCH_2026_10.md.
PostgreSQL statement snapshots and ordered cooperating locks inform pre-walk
revision capture and atomic catalogue/negative/event publication. OWASP significant
transaction data binds run, acquisition, current private root and exact receipt;
Node filesystem observations can race and grant no positive availability. W3C
timing remains a September 1 Working Draft, separate from lease authority.
Retain current bytes, existing maintenance pause and current acquisition-only
event correlation. A SQL prefix/index or old negative marker is not permission.

October 12 receipt guidance uses docs/OPERATOR_TRACK_RECEIPT_LEDGER_RESEARCH_2026_10.md.
PostgreSQL multicolumn indexes and EXPLAIN inform owner/release selection and
measured plan/buffer evidence. Trigger-maintained historical projections share
the source transaction, but grant no current object authority. Preserve OWASP
current resource checks and private byte verification. Node performance timings
and W3C draft guidance require explicit SQL/process/whole-work scope and cache,
order and instrumentation limits; a synthetic lookup result is not an app speedup.

October 12 recovery guidance uses docs/OPERATOR_TRACK_RECOVERY_RESEARCH_2026_10.md.
OWASP transaction authorization informs current recipient/root/plan checks at
mutation and final publication. PostgreSQL cooperating locks protect checkpoint,
receipt, source state and required events on one client; Node filesystem APIs do
not make a copy atomic with SQL. RFC 9110 retry semantics do not grant another
provider POST after a private copy failure. A historical receipt and a current
byte-backed availability result are different claims. W3C timing remains draft
measurement guidance, separate from lease authority or accessibility proof.

October 12 shared-pilot guidance uses
docs/WANTED_RECOVERY_SHARED_POSTGRES_RESEARCH_2026_10.md. Node 24 documents default
process isolation; Testcontainers lifecycle and PostgreSQL source-connection
rules support serial subprocesses, a newly owned server and sealed private
templates. Ownership follows acknowledged CREATE/OID identity, not a name prefix.
Driver disposal follows actual returned work, not release observation. OWASP
logging guidance keeps parent snapshots bounded and secret-free; close admission
before observing failure, and retain original child Error/null. W3C timing is a
September 1, 2026 Working Draft: label command/adapter scope, overlapping spans
and single-pair/cache/order variance instead of claiming a universal speedup.

October 12 fixture-reset guidance uses
docs/POSTGRES_FIXTURE_RESET_RESEARCH_2026_10.md. Driver documentation supplies
pool bounds/client drainage; Docker documents targeted container inspection.
Apply explicit fixture policy across direct/app/template entrypoints and retain
acknowledged connection ownership. OWASP logging guidance informs bounded
boolean/integer records and secret exclusion; diagnostic failure cannot replace
the original Error/null. W3C High Resolution Time is a September 1, 2026 Working
Draft and supports monotonic observation only. Readiness, a successful independent
query and current container state do not explain a previous reset. No raw log
capture, retries, larger pools or longer deadlines are justified by this guidance.

October 12 two-owner guidance uses docs/OPERATOR_TRACK_UNION_RESEARCH_2026_10.md.
OWASP resource-specific authorization separates provider work from recipient
delivery. Protected transaction data includes the complete accepted participant
set; recapturing or dropping a peer after delayed work is not authorization.
PostgreSQL/node-postgres ownership protects separate receipt publication on one
client; each filesystem mutation still needs its recipient root and actual media
checks. W3C status semantics preserve queued versus delivered/review outcomes;
backend evidence is not rendered-accessibility certification.

October 12 single-track guidance uses
docs/OPERATOR_TRACK_SUBSET_RESEARCH_2026_10.md. Picard 3.0 distinguishes Vorbis
recording tags from release-track tags; check the actual probe format and edition,
not a familiar tag name in isolation. OWASP protected transaction data informs
exact provider manifests and current consent. SQL single-client ownership and
required-event rollback protect receipt publication. Actual media inspection and
unchanged destination fingerprints protect a separate filesystem evidence claim.
WCAG status semantics remain relevant to future rendered feedback; backend
receipts do not prove accessibility or acoustic identification. General subset
unions and per-owner delivery need their own positive evidence.

October 12 catalog requirement guidance uses
docs/OPERATOR_TRACK_CATALOG_RESEARCH_2026_10.md. MusicBrainz distinguishes a
recording from its appearances as tracks on particular media; recording identity
alone cannot prove edition/position membership. OWASP server-owned transaction
data and business-logic verification inform exact current-catalog requirements
and conservative refusal of unsupported subset work. PostgreSQL cooperation and
node-postgres single-client ownership protect the SQL proof, distinct from file
identity verification. WCAG status/label guidance informs bounded review reasons;
no backend result establishes rendered accessibility conformance. Track-MBID
persistence and subset acquisition need their own positive evidence and migration
design rather than assuming the current catalog or filename scores support them.

October 12 track-consent guidance uses
docs/OPERATOR_TRACK_CONSENT_RESEARCH_2026_10.md. OWASP least privilege/default
denial and server-owned significant transaction data inform deriving exceptions
from saved positive polarity, declared resolved remap state and current target.
Do not trust a caller's eligibility/explicit flags or unrelated override counts.
Retain PostgreSQL cooperative locks and node-postgres single-client ownership;
these protect a different invariant from the consent predicate. WCAG 2.2 labels
and programmatic status inform future rendered explanations of desired,
suppressed and review-needed state, not backend certification. Null group scope
is an existing project contract, not a rule from a standard. Live catalog
membership and downstream per-track scope need their own evidence.

October 12 monitoring opt-out guidance uses
docs/OPERATOR_MONITORING_OPT_OUT_RESEARCH_2026_10.md. OWASP default denial and
per-operation checks inform positive broad-policy consent at both planning and
the protected write. PostgreSQL 18 Read Committed and cooperative transaction
locks remain separate from the planner's decision; node-postgres requires the
same client. WCAG 2.2 is a December 12, 2024 W3C Recommendation: predictable
input/context and programmatic status feedback apply to a future rendered
opt-out explanation, not a backend conformance claim. Keep saved monitoring,
explicit intent and existing requests distinct. Native tests own durability;
pure policy probes cannot establish whole-flow behavior or cancellation.

Consulted October 3, 2026. URLs were discovered through web search, official
navigation, and GitHub MCP and opened for review. Revalidate changing guidance
when applying this reference. Read only the rows relevant to the requested work.
This is an applicability map, not a compliance catalog.
Authorization, business-logic, PostgreSQL transaction and status-message guidance
was freshly discovered/opened October 8 for scoped recovery. Other rows retain
their earlier consultation date; consultation is not publication.

## Browser controls and feedback

| Source | Status | Decision it informs |
| --- | --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) | Normative W3C Recommendations | Consult the applicable criterion/role/state for precise requirements; busy state can defer updates and status implies polite/atomic semantics. These URLs were independently opened during the skill trial. |
| [WHATWG HTML form elements](https://html.spec.whatwg.org/multipage/form-elements.html) | Living specification | Specify button types: ordinary commands use `button`; intentional form confirmation can use `submit` with its owning submit handler. Avoid accidental submission or custom keyboard emulation. |
| [WHATWG dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Normative living specification and informative APG; refreshed October 3 for Add to library | Native modal behavior makes outside content inert. Select where pending feedback remains exposed: inside an open modal or outside after closure. Deliberate initial/return focus and Tab/Escape behavior need browser evidence; timing is a product choice. |
| [W3C keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) and [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) | Informative explanation of WCAG criteria | Test actual keyboard activation and the rendered focus indicator. |
| [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Informative explanation of WCAG 2.2 AA | Test controls/focus destinations in the actual scrolling shell, including sticky chrome and narrow layouts. |
| [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) and [ARIA22 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22) | Informative explanation/optional sufficient technique; status explanation refreshed October 8 | Establish a status container before updates; explicit atomic semantics are useful. Require truthful current work evidence; pending matches alone do not establish queued/running work. A DOM role alone does not prove announcement. |
| [W3C button pattern, official mirror](https://w3c.github.io/wai-website/ARIA/apg/patterns/button/) | Informative APG | Enter/Space activation, accessible names/descriptions, and action-appropriate focus. The mirror was readable when the canonical host rate-limited. |
| [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Informative explanation of WCAG 2.2 AA | The criterion uses 24 CSS pixels with exceptions. Harmoniarr's 44-pixel mobile target is a stronger local convention, not the AA requirement. |
| [Vue accessibility](https://vuejs.org/guide/best-practices/accessibility) | Framework guidance | Use semantic structure and deliberate focus across rendered route/state changes. |
| [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) | Testing guidance | Combine automation with manual/inclusive checks; do not infer full conformance from an automated pass. |

WCAG Understanding pages, techniques, and APG are guidance, not the normative
standard themselves. Follow their official links to the applicable normative
criterion/specification when a precise conformance interpretation is needed.
Do not require every documented technique or attach a full conformance claim to
a small feature's passing tests.

## HTTP, authority, and durable work

| Source | Status | Decision it informs |
| --- | --- | --- |
| [IETF RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) | Standards-track RFC | Separate reads from commands; do not assume a non-idempotent method can be retried safely. Application durable replay and response shapes are explicit project contracts. |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html) | Security practice guidance; refreshed October 8 | Authorize the selected object/recipient using current server-side relationship authority; UI visibility or an old delayed intent is insufficient. |
| [OWASP business logic security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) | Security practice guidance; consulted October 8 | Keep workflow state server-owned and coordinate authoritative check/write decisions. A database transaction does not make provider work atomic; preserve uncertain dispatch and conditionally retire known-undispatched refused intent. |
| [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Security practice guidance | Preserve session-bound mutation protections; a new UI command does not justify bypassing CSRF. |
| [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html) | Versioned database guidance; refreshed October 8 | Row/advisory locks, short transactions, fresh reads after locks and consistent acquisition order support transaction-owned concurrency. All relevant writers must participate; avoid provider/media IO while holding locks. |
| [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html) | Versioned database guidance | Queue-oriented skipping has a different consistency purpose from an authoritative command read. |
| [Node 24 ESM](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html) | Versioned runtime guidance | Keep explicit imports/exports and module-compatible file specifiers; third-party examples may use a different module format. |

These sources do not require a new queue, database isolation migration, UI
framework, idempotency-header protocol, or security-scanner installation. Choose
the narrow existing boundary that satisfies the requested behavior. General
security review and dependency hygiene complement these practices but do not
constitute a security certification.

## Provider receipt contract maintenance, October 8 local / October 9 UTC

RFC 9110, OWASP business logic, PostgreSQL 18 locking/application consistency,
normative WCAG 2.2 and its informative status explanation were freshly
discovered/opened for attempt-owned confirmation. Provider-specific source is
separate from those standards: the checked-in slskd 0.25.1 legacy POST and
slskd 0.26.0 caller-ID batch API have different attribution contracts. Inspect
the exact supported release and per-file evidence rather than applying a blanket
claim that a provider has no caller-ID API. The repository's
`docs/SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md` records immutable source
URLs, admission/retention/restart limits and the batch alternative. Its saved
links are starting points for future fresh research.

## Batch and operator decision maintenance, October 9

Fresh MCP discovery/opening covered RFC 9110, OWASP business-logic and
[transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html),
PostgreSQL 18 locking/application consistency, WCAG 2.2/status messages,
[H102 native dialog guidance](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
and WHATWG dialog for this follow-up. H102 is an informative technique, not
a separate normative requirement. Preserve whole reviewed transaction data,
reauthorize after awaited reads and keep provider I/O outside row locks.

The [Idempotency-Key document status](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
was also freshly opened: revision 07 is an expired/archived Internet-Draft,
not an RFC as consulted. Keep Harmoniarr's existing durable command contract
separate from a provider's supported key. The inspected slskd 0.26.0 provider
uses a request-body UUID; an invented header is no replay guarantee.

The repository's `docs/SLSKD_BATCH_HANDOFF_RESEARCH_2026_10.md` records fresh
immutable release, wire schema, enum and startup/shutdown evidence. A batch
record has no complete-admission marker; local queue persistence precedes
scheduled work. Restart may create new IDs without batch ownership. Apply
exact manifest/ID/peer/size/direction/BatchId and positive state checks, rather
than generalizing from record existence or timestamps. Explicit operator
adoption is a new consent decision with separate provenance; it must preserve
original dispatch uncertainty and refuse automatic recovery based on absence.

## Origin resolution maintenance, October 9

Fresh MCP discovery/opening for `docs/ORIGIN_RESOLUTION_RESEARCH_2026_10.md`
rechecked OWASP authorization/transaction/business logic, RFC 9110, PostgreSQL 18
locking/consistency, W3C publication history/status/H102 and WHATWG dialog. The
[frozen WCAG 2.2 Recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/)
was reached through W3C history. Earlier provider research is explicitly inherited,
not a new certification of changing provider versions.

An explicit ownership resolution is an application inference from these sources.
A row lock on existing work does not reserve an absent future allocation; its
creation/association must participate in the same parent fence. A cancelled run
may already have dispatched. Keep the exact locally proved unused job separate
from older positive provider evidence, preserve paired authority across all
writers/readers and recheck current significant data before commit. Verify native
sequential modal focus and expose pending results after closure; a DOM pass is
not evidence of assistive-technology speech.

## Explicit refusal maintenance, October 9

Fresh MCP research in `docs/PRE_PROVIDER_REFUSAL_RESEARCH_2026_10.md` rechecked
OWASP authority/transaction/business logic, RFC 9110, PostgreSQL 18 locking and
consistency, the frozen WCAG Recommendation/status/H102 and WHATWG dialog.
Provider contracts remain explicitly inherited from prior immutable release
ledgers; this is no new upgrade/capability certification.

The application inference is an explicit future-only local preparation protocol.
Refusal proof must come from its exact conditional pre-dispatch state; provider
absence, an old version-read failure or a missing historical checkpoint cannot
substitute. After the irreversible crossing, even commit-ack loss or zero-POST
local failure remains unknown. Keep complete state comparisons, required audits,
current lease and bounded public feedback at their actual owners, and validate
real transaction races rather than source wording.

## Abandoned preparation maintenance, October 9

The root's fresh primary-source ledger in
`docs/ABANDONED_PREPARATION_RESEARCH_2026_10.md` records PostgreSQL 18
locking/consistency and time functions, OWASP authority/workflow, RFC 9110 and
W3C/WHATWG feedback guidance. Documentation version and consultation are
separate from the running database/provider version; earlier provider ledgers
remain inherited. This maintenance does not independently re-verify those URLs.

The application inference is a distinct system closure owner for an exact idle
future preparing epoch, followed separately by any authorized restoration.
Cancellation requests and cancelled status do not certify non-dispatch or cancel
a remote transfer. Recheck current state and fresh authoritative time after lock
waits; transaction-start NOW is not a final expiry clock. Preserve the original
captured lease and require reciprocal parent/epoch closure plus permanent writer
fences. Closure-first must stop the old final native callback; crossing-first
retains uncertainty. Required audit failure rolls back closure. A public closed
flag can inhibit retry without exposing the private proof or granting permission
to restore. These are bounded project decisions, not a standardized lease
algorithm, new operator screen or whole-platform conformance claim.

## Lease acquisition maintenance, October 9

The root's fresh ledger in `docs/LEASE_ACQUISITION_RESEARCH_2026_10.md` records
official locking, conditional-update, UUID/time/migration and workflow guidance.
The exact captured-token contract is an application inference. Preserve the
stable diagnostic row ID while minting a private UUID for each successful
acquisition; same-owner live reacquisition and timestamp-only comparison are
insufficient. A stale callback must use its original captured identity, never
the newest token read from storage. Compare current ownership and fresh time
under the owning locks; treat a missing renewal or false lifecycle write as
ownership loss rather than successful work.

Rollout requires all producers, bridges, heartbeats, finalizers and cleanup SQL
to participate. Historical captured frames remain evidence and receive no
retroactive authority from migration backfill. Additive default/backfill work
still takes a migration lock; stop old key-only worker processes before rollout.
Keep tokens out of public diagnostics and nested records. Existing final
side-effect guards remain necessary: a local token cannot atomically cancel
provider or filesystem work already in progress. This reference maintenance
does not independently re-open the ledger's URLs or certify distributed
exactly-once behavior.

## Organize mutation maintenance, October 9

The root's fresh ledger in `docs/ORGANIZE_MUTATION_RESEARCH_2026_10.md` records
official PostgreSQL locking, clock and conditional-update guidance, the exact
local Node 24.18.1 tagged filesystem documentation, and workflow/status sources.
The callback placement and captured-token contract are application inferences;
this reference maintenance does not independently re-open the ledger's URLs.

An earlier ownership check cannot authorize a mutation after awaited path or
destination inspection. Recheck the immutable prepared file and original
acquisition immediately before each new mkdir, destination copy/link and source
removal, with fresh authoritative time after lock waits. Preserve the guard
through transport fallback and propagate pause/cancellation to their worker
owners. Exclusive copy and verified source removal do not make filesystem and
catalogue state atomic: a separate current-owned old-path/root CAS must affect a
row before counting success or notifying. Keep locks out of long filesystem I/O,
retain partial bytes on later refusal, and preserve unrelated transport defaults.
Compare lock acquisition against existing writers, including ordinary catalogue
upserts: explicitly lock the root before its files. A joined row-lock query can
create reciprocal waits despite short transactions; prove coexistence with real
blocked writers rather than assuming row-mark order.
Injected callback tests establish order and refusal; actual PostgreSQL and
test-owned files establish the claimed race and transport evidence. No new UI,
in-flight cancellation, symlink-race immunity or content-hash proof is implied.

## Scan catalogue maintenance, October 9

The separate `docs/SCAN_CATALOGUE_RESEARCH_2026_10.md` ledger owns current
primary-source discovery. Applying database transaction, lock-order and fresh
clock guidance to the observed scan writer is a project inference; this
maintenance does not independently re-open those sources or add a UI standard.

A completed filesystem walk is an observation, not current write authority or
a filesystem snapshot. Capture the original acquisition and immutable scalar
observations, keeping the requested root distinct from its resolved root. Use
one current-owned catalogue transaction and the same client for maintenance,
parent/lease checks, root, batches and tombstones. Await each write guard and
recheck fresh time after waits and at the final boundary; a late refusal rolls
back provisional catalogue changes. A legitimate empty successful observation
can tombstone old files, whereas stale work must not. Preserve standalone writer
transactions and batching. Focused callback tests establish orchestration;
actual PostgreSQL owns locking, rollback and one-connection evidence. A guarded
catalogue commit does not fence later tag, artwork or reconciliation work, make
the filesystem walk atomic, or guarantee ownership through commit acknowledgement.
Validate actual parent path components using the selected platform's separator,
preserving legitimate contained double-dot names and literal POSIX backslashes.
Include positive filename cases beside traversal refusals; a broad prefix or
cross-platform separator rewrite can incorrectly reject a successful walk.

## Tag snapshot maintenance, October 9 local / October 10 UTC

The separate `docs/TAG_SNAPSHOT_RESEARCH_2026_10.md` ledger owns current
primary-source discovery. Applying transaction, conditional-write and current
workflow guidance to tag persistence is a project inference; this maintenance
does not independently re-open those sources or add a browser requirement.

An accepted size/mtime stamp is evidence about parser input, not current write
authority. Capture immutable source and acquisition before parsing, then persist
history and the current file together under maintenance, run/lease/root/file
ownership with the same transaction client. Compare path, root, size, nullable
mtime and observed/nondeleted state at the guarded source CAS. Check exact
returned identities and refresh time after waits and at the final boundary;
zero-row writes and later refusal roll back both changes. Distinguish genuine
parser failure from ownership/source/database failure instead of converting all
errors into a second failed snapshot. Artwork follows successful persistence as
a separate owner. Preserve actual platform filename semantics and source stamps
on current parser failure. Focused doubles establish orchestration; actual SQL
and native parser fixtures establish database/media evidence. Same-size/same-mtime
physical changes, later artwork and commit acknowledgement remain bounded limits.

## File match maintenance, October 9 local / October 10 UTC

The separate `docs/FILE_MATCH_RESEARCH_2026_10.md` ledger owns current primary
source consultation. Applying current-state transactions and structured-value
comparison to file matching is a project inference; this maintenance does not
independently re-open those sources or require a new UI audit.

Capture source, tags and decision-relevant scope before awaited metadata lookup.
Preserve SQL NULL versus an empty JSON object; ignore object key order while
retaining array order and scalar distinctions. Current tag stamps cannot replace
comparison of the actual tag payload. Derive relevant scope from the saved run
hint without treating unrelated summary edits as a different match intent. Use
one client and compatible locks for an atomic match batch, then recheck source,
authority and fresh time before SQL and before commit. Returned identities and
source/tag predicates must cover both inserts and conflict updates; one stale
sibling or missing row refuses the batch. Preserve matching strategies rather
than converting a refusal into unmatched success. Database ownership does not
freeze physical bytes or metadata candidates, undo earlier tag/artwork work, or
grant later reconciliation authority. Focused doubles and actual PostgreSQL
evidence remain separate from structural skill validation and UI conformance.

## Release reconciliation maintenance, October 10, America/New_York

The saved `docs/RELEASE_RECONCILIATION_RESEARCH_2026_10.md` ledger owns fresh
primary-source discovery. Choosing serialized projection replacement with
repeated READ COMMITTED aggregate comparison is a bounded project decision;
this maintenance does not independently re-open the ledger's sources.

Capture original scan authority before awaiting admission, then compute global
coverage inside the owning transaction after waits. Set snapshot semantics
explicitly: a lock acquired after an older snapshot does not refresh that
snapshot. Recheck the full mapped aggregate, authority and fresh time before
DELETE, bulk upsert and the final boundary; source drift or incomplete returned
identities rolls back all projection writes. Keep valid empty cleanup and existing
coverage/status calculations. Use the same advisory admission key in standalone
and owning replacers, with one transaction client and no cached aggregate replay.

The key serializes participating projection writers, not metadata/file/match
producers. Other-root inserts and new metadata rows belong in freshness proof,
but changes after the final query can await another pass. Do not claim strict
commit-fresh state, phantom prevention, or universal deadlock freedom. A broader
stable-input barrier needs a coordinated producer/snapshot/lock-order design and
actual interleaving evidence. Focused doubles establish orchestration; PostgreSQL
owns waits, rollback and query-snapshot claims. No UI change, media-byte or
external atomicity guarantee follows from this derived read-model boundary.

## Wanted replacement maintenance, October 10, America/New_York

The saved `docs/WANTED_RELEASE_RECONCILIATION_RESEARCH_2026_10.md` ledger owns
current primary-source consultation. Optional worker ownership, source-frame
comparison and shared parent/link admission are bounded project choices; this
maintenance does not independently re-open the ledger's sources.

One raw persistence helper can serve callers with different authority. Preserve
original scan, discovery and metadata acquisitions, explicit internal direct
rebuilds, scoped-recovery exclusion and authorized restore under maintenance.
Presence of a malformed worker context must not silently become direct authority.
Bind every nested reader to the owning client, copy inputs before later awaits,
and compare decision source as well as derived rows. Exclude only verified unused
housekeeping; identical output does not make a changed saved profile equivalent.
Only an exact missing-artist result at that boundary can yield its accepted
empty projection; other reader/persistence errors must escape.

The ownership key is a user/release pair. Multi-array bulk input must come from
the same validated rows, with complete unique returned and deleted pairs. Required
discovery-link synchronization belongs in the same transaction and rollback.
Acquire shared publisher admission before parent mutations when both writers
change those links. This coordinates participating publishers, not every source
or manual writer. Several READ COMMITTED component snapshots do not form one
global instant or guarantee latest state at commit. Disabled/history projection
semantics and later acquisition authority remain separate; no new UI or universal
deadlock/remote atomicity claim follows from the local replacement guard.

The root's October 10 UUID consultation, recorded at 12:31:43 UTC, discovered the
17 page and followed its official navigation to
[PostgreSQL 18 UUID type](https://www.postgresql.org/docs/18/datatype-uuid.html).
The raw response is retained in
`.tmp/wanted-release-reconciliation-2026-10/uuid-restore-identity-source.json`.
The database accepts alternate UUID spellings and emits canonical text. For raw
restore identity/deduplication and returned-pair checks, use that value identity
before constructing JavaScript maps or sets; valid aliases must not become
different owners or falsely expected deletions. Preserve strict live-source and
acquisition validation separately. The reproduced unit uses canonical SQL-return
doubles; it is not an additional PostgreSQL execution by the skill maintainer.

The completed application gate exposed a PostgreSQL client query-overlap
deprecation despite successful transaction identity tests. Same-client ownership
and safe scheduling are separate obligations. The project reader now awaits
artist and policy reads serially on its transaction client, including release
groups/releases in the actual narrow metadata method. A delayed nonreentrant
client reproduced both overlapping layers, then passed after correction. Keep
source capture immediately after each read; do not infer that Promise.all is safe
for a transaction client merely because it is suitable for independent pool work.
These are observed application/driver controls, not a fresh official-source lookup
or proof of every database caller's scheduling behavior.

## Fixture evidence maintenance, October 10, America/New_York

The fresh `docs/TEST_FIXTURE_OBSERVABILITY_RESEARCH_2026_10.md` ledger owns
Node/pg/Testcontainers/W3C/OWASP consultation. Emit bounded approved diagnostics
on runner failure events, preserving failure exits; do not dump arbitrary error
messages, causes, expected/actual data or environment values. Native output is a
separate stream, and event arrival is not proof of throw-time flushing.

Measure setup, schema, fixture, work and cleanup through monotonic phase evidence.
Do not label unreadable counts or timed-out drains successful. Cancellation is a
request: release cooperative dependencies and drain actual tracked work before
reusing resources. Preserve the first cause when cleanup also fails. Parent/child
spans overlap, so their sums are not gate wall time. Acknowledged creation owns
database teardown; failed creation cannot authorize deleting an existing database.
Check pre-aborted startup and establish completion ownership before launching
detached work. A refused late registration must not launch a worker, and startup
failure must settle its already-registered completion. The scan-fixture controls
map these local ownership rules separately from the original timeout's trigger.
These are testing/evidence boundaries, not frontend conformance or universal
I/O cancellation claims.

## Prepared test database maintenance, October 10, America/New_York

The fresh `docs/POSTGRES_TEST_TEMPLATES_RESEARCH_2026_10.md` ledger owns
PostgreSQL 18/pg/OWASP consultation. Connection sealing prevents new source
sessions; it does not terminate existing sessions or constrain another privileged
administrator. Verify quiescence before publishing a private source, retain fresh
scenario databases and refuse observed source/identity drift. Database-level
settings/GRANTs are not assumed copied. Creation acknowledgement owns cleanup;
unknown OID must produce incomplete evidence rather than destructive guessing.
These are testing/resource boundaries, not a new frontend conformance claim.

## Parent-owned test launcher maintenance, October 10, America/New_York

The MCP-discovered exact Node, PostgreSQL, Testcontainers and Microsoft sources
are recorded in `docs/POSTGRES_TEST_LAUNCHER_RESEARCH_2026_10.md`. For resource
sharing, distinguish runner events, process exit, actual close, output drainage
and database identity. Reserve only an observed-absent generated name; acknowledge
successful CREATE with current role/OID before scenario use. A lost acknowledgement
requires the same identity, not another reservation. Revoke scope admission before
owned-tree cancellation and require known-worker absence before reconciliation.
Never derive ownership from a database prefix, stdout or reported PID. Report
uncertain identities and incomplete termination truthfully, preserving the primary
failure. Loopback alone is not authorization: use per-scope capabilities, bounded
structured records and fixed diagnostics without credentials. Native test output
has separate disclosure limits. This applies to trusted development fixtures,
not arbitrary hostile privileged code, POSIX runtime proof or WCAG conformance.

For audited cohort adoption, the fresh
`docs/SHARED_POSTGRES_COHORT_ADOPTION_RESEARCH_2026_10.md` maps actual worker
drainage and the documented pg client-discard API. Defer SQL lease finalizers
until controlled holds release and transactions settle; an early release may
wait on its own held rows. A paused client's observer must refuse new reads after
abort and finish its current read before that owner's rollback. Distinguish
fixture-hook failures from native parser errors at the owning write boundary.
Node also aborts a test signal after normal completion; signal state alone is
not an outcome or quiescence certificate. These are fixture ownership practices,
not new UI behavior or permission to broaden a database cohort automatically.

PostgreSQL activity monitoring has a transaction-held session snapshot separate
from READ COMMITTED row snapshots. The same-case reproduced failure is recorded
in the cohort-adoption outcome: a new contender can be absent from a paused
transaction's cached activity view. Refresh with a separately awaited
`pg_stat_clear_snapshot()` before polling statistics, retaining serial ownership,
abort checks and the original bounds. This refreshes monitoring evidence; it
does not reset counters, advance domain authority or justify a longer deadline.

Measured library template adoption follows
`docs/LIBRARY_TEST_SCHEMA_TEMPLATES_RESEARCH_2026_10.md`: bind schema work to the
scenario pool, preserve fresh seeds after clone admission, and distinguish complete
source lineage from per-clone filename idempotence. Source sealing requires actual
zero sessions and captured OID/role; settings/GRANTs are not assumed copied.
Report preparation/check/validation/copy costs separately and keep nested spans
out of wall-time sums. Explicit suite defaults don't authorize global template
selection, migration/bootstrap/recovery replacement or a new conformance claim.

Catalogue lifetime assessment follows the fresh
`docs/CATALOGUE_TEST_LIFECYCLE_RESEARCH_2026_10.md`. A finally-released marker
is not observed worker completion: acquisition refusal and release failures need
their own settled outcomes. Race held readiness against that outcome, register
direct work before launch and drain current borrowed-client reads before rollback.
Close observer admission before drainage; refresh monitoring snapshots within
paused transactions. Assess template preparation only after these owners are
sound, retaining independent sources/clones and unchanged domain assertions.

Docker/DOM contract maintenance uses the verified
`docs/LOCAL_DOCKER_REBUILD_RESEARCH_2026_10.md` ledger: no-cache layers differ
from persistent npm mounts/base pulls; health differs from provider acceptance;
configured readiness signs in and may read provider status. Keep existing state
and conditional walkthrough branches. This reference update inherits the
ledger's vendor sources and version limits; it does not certify a new deployment.

The clean W3C status explanation above was reopened October 10 for the observed
delayed filter count. Keep a current user-action result in its existing polite
region without focus movement or periodic-poll noise. Validator readiness waits
establish that validator's mounted snapshot; they do not repair the app's stale
announcement or prove actual screen-reader speech. Scope assertions to rendered
native panels and exercise real current-quality owners rather than forcing a
fixture past an earlier refusal. No blanket pre-interaction wait or conformance
claim follows from this seam maintenance.

October 11 Downloader maintenance follows the fresh MCP-discovered W3C/Vue/OWASP
ledger in `docs/DOWNLOADER_FILTER_ANNOUNCEMENT_RESEARCH_2026_10.md`. A post-render
watcher owns publication timing; scope disposal and immediate simple-boolean
failure/context cancellation own invalidation. These are application lifecycle
choices, not a new ARIA role or universal rule to block controls while loading.
Preserve plain-text interpolation and distinguish actual Vue/DOM evidence from
assistive-technology speech. Polling carries no new filter-announcement intent.

October 11 first-checkout maintenance follows the fresh MCP-discovered
`docs/APP_FIXTURE_CHECKOUT_DIAGNOSTICS_RESEARCH_2026_10.md` ledger. W3C/Node elapsed
clock principles, pg/PostgreSQL code/counter contracts and OWASP bounded logging
apply at different boundaries. A timed-out wait can be uncoded in the installed
driver; do not recover a classification from private prose. Preserve original
errors and distinguish first checkout from subsequent schema SQL, safe records
from native streams, and last admitted phase from fresh server health. Observer
failures cannot take over operation results; driver flags remain version-specific.

October 11 pool-lifecycle maintenance uses the fresh MCP ledger in
`docs/DATABASE_POOL_SHUTDOWN_RESEARCH_2026_10.md`: pg end waits for returned clients,
while Node HTTP close owns sockets rather than arbitrary application promises.
Use a synchronous admission fence and one observed end outcome for each pool
generation. A failure leaves that generation unavailable; success permits the
existing serial restart contract. This project choice does not replace actual
worker ownership, justify a fixed delay, or establish the historical failure's
cause. Keep OWASP-sensitive data out of new refusal messages; existing native
reporters and idle-client logging have separate contracts.

October 11 apply-worker maintenance follows
`docs/APPLY_WORKER_LIFETIME_RESEARCH_2026_10.md`. Register actual completion before
launch, close admission before drain, observe every task even after a sibling
fails, and retain Error/null identity. A terminal database status or cleared timer
does not drain advisory writes, active renewal or lease release. Keep best-effort
domain outcomes separate from completion, and primary errors separate from cleanup
fallout. New fixed refusals and approved phase records add no private inputs or
connection data. The W3C timing draft informs elapsed spans, not a new UI claim.

October 11 owned-server evidence follows
docs/POSTGRES_FAILURE_EVIDENCE_RESEARCH_2026_10.md. PostgreSQL readiness does not
authenticate a role; Docker CLI errors can overlap native readiness codes.
Use an independent authenticated pg client and retain CLI failures conservatively.
OWASP guidance supports approved immutable fields without credentials, SQL,
names or error prose. W3C monotonic timing describes observation spans; a later
successful probe cannot certify the original failure window. Await actual
diagnostic completion before owned teardown and preserve the original error.

October 11 dispatcher guidance uses docs/DISPATCHER_LIFETIME_RESEARCH_2026_10.md:
timer cancellation does not drain admitted SQL/promises. Register ticks and
launches before execution, seal new claims synchronously, finish a committed
in-flight claim handoff and then drain returned completion. PostgreSQL queue
locking does not replace authorization or worker lease fencing. Monotonic spans
measure drain boundaries; a queued acknowledgement is an earlier event. Fixed
refusals add no private inputs, and no UI conformance claim follows.

October 11 scan ownership uses docs/LIBRARY_SCAN_LIFETIME_RESEARCH_2026_10.md.
A queued handle preserves acceptance timing while owning returned execution
through finalizers. Timer stop is earlier than renewal drainage; lease release
must still be attempted after drain failure. Capture concrete owners and drain
apply before scan, retaining primary failures while finishing cleanup. OWASP
guidance applies to fixed refusals and approved diagnostics; W3C timing informs
actual elapsed drains without changing domain timestamps or certifying UI.

October 11 execution ownership uses
docs/IMPORT_EXECUTION_LIFETIME_RESEARCH_2026_10.md. Rechecked ECMAScript 2026,
Node 24.18.1 timers, driver pooling, OWASP logging, RFC 9110 and the September 1
W3C timing Working Draft through MCP. Await returned provider/confirmation work
without interpreting local completion as remote download completion. RFC 9110
does not authorize a second non-idempotent request after unknown acceptance.
Drain returned Activity under its existing best-effort policy; required audit
remains transactional. Concrete execution/apply/scan ownership protects known
finalizers, while remaining workers and hidden work need separate proof.

October 11 media-inspection maintenance follows
docs/MEDIA_INSPECTION_LIFETIME_RESEARCH_2026_10.md. Official Node 24.18.1 child
process navigation confirms that process exit and closed stdio differ. Retain
shell-free argv and existing command limits; trace returned inspection to normal
command closure before treating worker completion as a drain. Error/reporter and
unreturned descendant contracts need separate proof. OWASP keeps diagnostic
Activity best-effort while actual returned work is owned. W3C timing remains a
Working Draft source for elapsed observations, not a browser certification.

October 11 transcode guidance uses docs/TRANSCODE_LIFETIME_RESEARCH_2026_10.md.
Official FFmpeg formats describe the null muxer; the actual wired execution
service uses that preflight-only boundary. Trace current source before assuming
file mutation or a downstream handoff from an operation name. Node normal stdio
close, returned promises and driver teardown are separate lifetimes. Snapshot
concrete ordered cleanup owners before awaiting and retain first Error/null while
attempting all selected cleanup. W3C timing remains draft observation guidance;
controlled native process checks do not certify codecs or browser conformance.

October 11 organize guidance uses docs/ORGANIZE_APPLY_LIFETIME_RESEARCH_2026_10.md.
Official Node filesystem guidance distinguishes exclusive destination creation
from copy atomicity; preserve verified movement and current-authority guards.
Returned notification/Activity lifetime is separate from best-effort outcome and
remote delivery. OWASP diagnostic policy does not weaken required mutation or
persistence. W3C timing remains draft observation guidance. In fixtures, assert
lifetime checkpoints from the parent test: a failure inside a swallowed callback
can otherwise disappear. These checks establish the selected boundary, not global
atomicity or whole-app/security conformance.

October 11 discovery guidance uses docs/DISCOVERY_DISPATCH_LIFETIME_RESEARCH_2026_10.md.
Returned reconciliation, artwork/provider and queue-producing work have a local
completion boundary separate from remote search and persisted terminal status.
Preserve scoped consent/membership and non-idempotent uncertainty policy from
RFC 9110. Drain renewal and release before original eligible pruning; no extra
ledger work follows thrown cleanup failure or lost/refused authority. W3C timing
is still draft observation guidance. Explicit selected test paths must be verified
before claiming coverage; this host's Node run ignored an unmatched selector.

October 11 external-intake guidance uses docs/EXTERNAL_INTAKE_LIFETIME_RESEARCH_2026_10.md.
WHATWG defines URL parsing; OWASP destination policy requires tracing actual
clients, redirects and connection-time enforcement. A parsed allowlisted provider
descriptor alone is not full SSRF proof. Keep stored active-request checks and
normalized source forwarding at their existing owners. Await the local durable
queue handoff and renewal/release completion without inferring child provider
execution or remote completion. Node timer timing does not establish drainage;
explicit completion replaces guessed unit waits. TC39 permits null rejection;
preserve it through cleanup. W3C timing remains draft observation guidance, and
RFC 9110 uncertainty rules still apply to non-idempotent transport retries.

October 11 provider-ingest guidance uses docs/PROVIDER_INGEST_LIFETIME_RESEARCH_2026_10.md.
Official Spotify album and YouTube playlistItems references define catalog GETs;
trace the actual identifier-based client rather than inferring arbitrary URL
fetching. Preserve explicit origins, refused redirects and response/deadline
bounds at the transport owner. A returned promise can end before hidden injected
work after abort; normal-response lifetime evidence does not certify that path.
Keep active target/cancellation checks and transactional collection publication.
TC39 completion and driver cleanup support shared ownership; one bounded batch or
a handled row failure can finish local execution without proving the collection
or remote work complete. W3C timing remains draft measurement guidance and IETF
uncertainty policy does not authorize replay during shutdown.

October 12 external-request discovery guidance uses
docs/EXTERNAL_REQUEST_DISCOVERY_LIFETIME_RESEARCH_2026_10.md. OWASP object/relationship
authorization stays at the service and actual transaction-owned publication;
queued acceptance, ownership IDs or worker completion do not grant target authority.
Retain approved intent, current eligibility, sanitized failure and explicit
no-candidate retry. TC39 completion preserves Error/null while driver drainage
requires the local worker to finish before pool disposal. Preserve distinct
acquired-unavailable lease status during this lifetime change. RFC 9110 uncertainty
does not authorize search POST replay or automatic download. W3C timing is still
draft observation guidance; a 15-second owned dispatch deadline replaces status
polling without treating timeout/cancellation as proof that remote work stopped.

October 12 metadata-refresh guidance uses
docs/METADATA_ARTIST_REFRESH_LIFETIME_RESEARCH_2026_10.md. MusicBrainz FAQ identifies
its own unreviewed status; its navigation supplies rate-limit guidance referring
to 2012 rules that may change. Keep source status/access limits explicit and retain
existing identification, per-instance request queue and jitter policy without
claiming whole-egress compliance. OWASP authority stays at the mutation owner;
captured/cloned worker context is separate from mere queued acceptance. Retain
returned catalog, wanted/queue/detection and scheduler work through lease cleanup.
W3C timing remains draft observation guidance, not a schedule-policy mandate.
TC39 permits null rejection; preserve original failures while finishing cleanup.

October 12 metadata-source writer guidance uses
docs/METADATA_SOURCE_WRITER_COORDINATION_RESEARCH_2026_10.md. PostgreSQL advisory
locks require application participation; transaction-level admission and UUID
scope locks must precede source rows. Use shared admission for scoped policy
writes/publication and exclusive admission at catalog/bulk entry. Do not upgrade
an already shared/scoped transaction or infer that raw SQL/migrations cooperate.
One owned or borrowed transaction client must cover replacement and canonical
clearing/setting. A transaction-only assertion refuses autocommit before mutation;
capture mutable DTOs before admission waits. W3C timing remains draft measurement
guidance, separate from SQL lease authority. Native blocked-backend evidence uses
an independent owned-config observer; keep application pool bounds, cancellation
queryable forwarding, rollback and actual worker drainage intact.

October 12 operator publication authority guidance uses
docs/OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_RESEARCH_2026_10.md. PostgreSQL
18 locks and READ COMMITTED inform ordered scope/run/acquisition checks and
fresh source/clock verification after contention and before commit. Existing
canonical saves share the scope lock; scoped read identity alone is insufficient.
Preserve normalized nullable consent and catalog iteration order when capturing
the accepted plan. Driver transactions share one sequential client; a falsey
rollback rejection must still evict an uncertain client because release uses a
truthy destroy argument. TC39 allows arbitrary rejection, so preserve the primary
Error/null and retain rollback cause separately. W3C timing is draft observation
guidance, not lease expiry authority. Immediate production renewal can override
a short test lease: isolate that renewal in controlled expiry evidence rather
than widening a test or production deadline. Do not infer coordinated phantom/
global source writers or full authorization coverage from this scoped protocol.

October 12 operator-reconciliation guidance uses
docs/OPERATOR_ARTIST_RECONCILIATION_LIFETIME_RESEARCH_2026_10.md. TC39 allSettled
owns returned parallel tasks through sibling failures; preserve first observed
rejection, including null, and ordered successful values. Trace nested batches
at the actual called read paths; changing an outer Promise.all alone cannot own
hidden sibling work. Driver transactions still require one client and sequential
request/event publication. Pool end does not own future worker queries. OWASP
relationship checks apply at their owning boundary: actor-scoped snapshot lookup
and revision validation do not establish mutation-time policy or lease authority.
Keep those security claims distinct from lifecycle completion. W3C timing remains
draft observation guidance; retain its source status and avoid speedup claims
from unmatched or overlapping gates.

October 12 Wanted verification guidance uses
docs/WANTED_RECEIPT_VERIFICATION_RESEARCH_2026_10.md. Node process-relative timing
owns runtime durations; W3C High Resolution Time remains a Working Draft.
OWASP minimizes paths, identities and raw failures before output and requires
logging-failure controls. OpenTelemetry's stable cardinality guidance supports
fixed dimensions, without implying an OTel SDK or exporter. Actual streamed-byte
counts distinguish performed work from receipt size. A positive historical hash
or stat observation cannot replace fresh current bytes at a protected write/event
boundary. Retain required audit semantics separately from optional diagnostics.

Wanted root lookup applies docs/WANTED_ROOT_LOOKUP_RESEARCH_2026_10.md: driver
same-client/bound-value contracts and PostgreSQL left-join semantics support one
fresh context statement. Missing settings and JSON null are different inputs.
Vendor measurement caveats require query-count/result/byte proof alongside local
timings; fewer queries alone do not promise a whole-projection speedup. W3C remains
draft timing guidance and OWASP keeps identifiers/SQL/errors out of diagnostics.

October 13 fingerprint guidance uses docs/TRACK_FINGERPRINT_STREAM_RESEARCH_2026_10.md.
Node read-buffer thresholds do not establish process-memory caps. Sample RSS,
heap, external and ArrayBuffers separately; ArrayBuffers are already included in
external memory. Pair timing with actual hashes/bytes and owned completion/close.
Preserve primary Error/null through cleanup, and keep W3C draft timing and OWASP
data-minimized diagnostics separate from domain authority or required audit.

Reusable fingerprint guidance uses docs/TRACK_FINGERPRINT_REUSABLE_RESEARCH_2026_10.md.
Stable Node FileHandle reads return actual counts into caller-owned buffers; hash
only filled bytes, handle short reads and bound work by captured size. Close the
owned handle explicitly and preserve primary Error/null. Compare descriptor and
pathname evidence before/after current bytes without claiming atomic directory
confinement. Memory/timing observations remain qualified and data-minimized.

October 13 checkout capture uses docs/POSTGRES_CHECKOUT_CAPTURE_RESEARCH_2026_10.md.
Maintainer promise/callback and counter contracts require query acquisition
observation too; stable Node context isolates admission phases. PostgreSQL readiness,
authenticated query and counters remain separate observations. Apply OWASP field
minimization/failure isolation and W3C draft monotonic-duration guidance; record
before probes, own restoration and preserve original failure. Do not infer
historical causality or log SQL/options/messages for apparent visibility.

Guarded workload guidance uses docs/WANTED_GUARDED_WORKLOAD_RESEARCH_2026_10.md.
Maintainer same-client transactions and PostgreSQL rollback contracts support
matched pre-commit measurements, not commit durability claims. Node sampled-memory
fields overlap and sampling costs work; W3C timing remains draft guidance applied
to private monotonic durations. OWASP minimization excludes projection digests and
domain identities from summaries. Preserve real fresh guards and individual
receipt authority before evaluating grouping, even when duplicate work is large.

Bounded-root guidance uses docs/WANTED_BOUNDED_ROOT_READ_RESEARCH_2026_10.md.
Transaction identity differs from connection identity; enabled triggers can still
have a condition. Verify actual held authority, unconditional guard/function
contract and current origin/isolation before reducing reads. Bind ephemeral
invocation authority and retain fresh opening/closing roots and full bytes.
Private fixed metrics and exact paired results support qualified performance
claims; neither SQL locks nor W3C draft timing establish immutable host files.

Root-authority guidance uses docs/WANTED_ROOT_AUTHORITY_COORDINATION_RESEARCH_2026_10.md.
PostgreSQL statement admission joins ordinary writers to transaction authority
before tuple mutation, including missing settings/upserts. Reuse existing lock
order and distinguish queued revocation from cancelling admitted work. Broad
settings contention is a declared tradeoff; enabled trigger/function anchors
and real commit/rollback tests establish coverage. SQL coordination does not
freeze host bytes or grant a reduction in current root reads.

Root-cost guidance uses docs/WANTED_ROOT_COST_PROFILE_RESEARCH_2026_10.md.
PostgreSQL Read Committed statement snapshots can observe later committed
revocation; Repeatable Read is not a shortcut to current authorization. Keep
same-client transactions, fixed private numeric observations and matched
diagnostics-off/on controls. Signed process-memory changes include GC and
unrelated work; W3C draft timing does not supply allocation attribution.

Closed-group guidance uses docs/WANTED_CLOSED_RECEIPT_GROUP_RESEARCH_2026_10.md.
Node mtime mutation and filesystem races defeat timestamp-based positive reuse;
two actual full reads close a bounded exact binding with current per-member
authority. OWASP authorization/logging require current owning checks and fixed
private metrics; maintainer transaction ownership does not freeze host bytes.
Keep W3C draft timing separate from conformance and candidate measurements from
later reviewed code. More root queries and higher heap are costs, not hidden gains.

October 13 connection-boundary guidance uses
docs/POSTGRES_CONNECTION_BOUNDARY_RESEARCH_2026_10.md. Maintainer public connect
events follow successful startup; reviewed installed source locates cold client
construction and protocol stages. Node TLS secureConnect differs from pg stream
creation and certificate authorization. Privately compare resolved target scalars
with acknowledged fixture config, never emit config/payloads, and refuse internal
adapters after an unreviewed version upgrade. W3C draft duration principles and
OWASP failure-isolated fixed fields support evidence, not retrospective causality.

October 13 distinct-binding guidance uses
docs/WANTED_DISTINCT_BINDING_PROFILE_RESEARCH_2026_10.md. Maintainer same-client
transactions and PostgreSQL rollback support matched guarded service samples.
State actual physical binding, saved requirement, owner, context and historical
receipt cardinalities separately. Node memory fields overlap and sampled growth
does not identify allocation owners; W3C monotonic timing is still draft guidance.
OWASP fixed private output and preserved failures do not authorize caching or
removing guards. Count per-source full projections when evaluating scaling.

October 13 source-noop guidance uses
docs/WANTED_SOURCE_NOOP_RESEARCH_2026_10.md. A snapshot alone cannot prove that a
later conditional UPDATE will remain a no-op. Lock the exact existing owned row
in the same live transaction, bind its original source before awaiting, and
retain locks through final publication. NOWAIT plus savepoint recovery can
decline an optional busy-row proof; it does not remove table waits or existing
fallback contention. Preserve actual-write/required-event and final authority
checks, both hashes per retained verification boundary, and conservative missing/
negative/custom fallback. W3C draft duration guidance is separate from SQL proof.

October 13 server-startup guidance uses
docs/POSTGRES_STARTUP_SERVER_RESEARCH_2026_10.md. PostgreSQL structured logs and
reviewed source locations separate receipt, authentication, authorization and
ready/setup. A random private startup marker can correlate authorization to a
PID/session, while pre-authentication receipt and NAT tuples can remain unknown.
Preserve explicit application names, original startup outcomes and owned failure
completion. OWASP data minimization requires fixed output, not raw log rows,
identities, query text or markers. Read/output limits do not bound temporary log
disk growth. W3C monotonic durations are distinct from server wall-clock components.

October 15 runtime-cleanup guidance uses
docs/POSTGRES_RUNTIME_CLEANUP_RESEARCH_2026_10.md. Node test completion is not
resource quiescence; Testcontainers bounded stop promises must be awaited and
their rejection retained in either schema mode. ECMAScript permits null throws;
preserve the primary value through later release errors. Apply W3C Privacy
Principles (Statement) and OWASP minimization to evidence, without claiming
fixture-specific mandates or WCAG conformance. Failure propagation and permission
to remove independently owned storage require separate evidence.

October 15 strict database-release guidance uses
docs/POSTGRES_DATABASE_RELEASE_RESEARCH_2026_10.md. PostgreSQL owner permission
and active sessions can refuse DROP; awaiting node-postgres end/query operations
must not turn that failure into success. Select existing strict policy at the
owning entrypoint while preserving original Error/null and direct-tool scope.
W3C's Privacy Principles Statement and OWASP exclusions guide minimized evidence;
they do not prescribe the project's fixture cleanup policy or grant authority
over a borrowed server, unrelated database or uncertain workspace.

October 15 shared-runtime lifetime guidance uses
docs/POSTGRES_RUNTIME_LIFETIME_RESEARCH_2026_10.md. Node reporter completion and
abort signals do not prove work stopped. ECMAScript allSettled waits for every
outcome without cancelling inputs; await full PostgreSQL delegate tails before
the existing bounded Testcontainers stop. Preserve separate scenario/cleanup
failures, borrowed ownership and W3C/OWASP minimized evidence. A lifecycle barrier
does not establish quiescence for hidden detached work or self-awaiting cleanup.

October 15 post-start ownership guidance uses
docs/POSTGRES_STARTUP_GUARD_RESEARCH_2026_10.md. Testcontainers metadata access
follows acknowledged start, so place it under the existing cleanup owner. Await
bounded stop and catch synchronous as well as asynchronous fallout, preserving
the original ECMAScript thrown value including null. W3C/OWASP minimized evidence
does not require raw connection metadata. A failed start or borrowed connection
does not grant authority over unacknowledged or unrelated containers.

October 15 startup-cancellation guidance uses
docs/POSTGRES_STARTUP_CANCELLATION_RESEARCH_2026_10.md. WHATWG DOM's checkpoints
and Node AbortSignal reasons support cooperative cancellation around awaited
operations without signal support. Await actual acquisition, check before
publication, and release only acknowledged resources through their current
owner. Preserve actual setup failure over simultaneous cancellation and exact
Error/null over cleanup fallout. This project policy does not imply that abort
stops Testcontainers I/O. W3C's Statement and informative OWASP guidance still
require scoped applicability; avoid recording raw connection or abort payloads.

October 15 complete-cohort measurement guidance uses
docs/POSTGRES_COHORT_COMPARISON_RESEARCH_2026_10.md. Node's native final summaries
and process isolation own case/result evidence; custom reporters must be checked
on the installed Node version. W3C High Resolution Time 3 is a 2026-09-01 Working
Draft: use monotonic durations without adding nested spans or comparing absolute
timestamps from separate processes. The fixed counterbalanced comparison is a
project method, not a W3C mandate or statistically established speedup. OWASP
exclusions apply to public artifacts; ignored native logs are not access control.

October 15 recovery schema guidance uses
docs/RECOVERY_SCHEMA_TEMPLATE_RESEARCH_2026_10.md. PostgreSQL 18 cloning requires
an idle source and does not inherit database-level settings/permissions. Reuse
the current sealed identity owner and configured clone pools; copy migration
state, not scenario users/runs/events. Keep Node's actual completion and primary
Error/null, W3C's Working Draft timing limits and informative OWASP exclusions
separate from a project-specific template-adoption decision. An extra template
CREATE is intentional work, not an unmatched-case failure or a security grant.

October 15 recovery execution guidance uses
docs/RECOVERY_EXECUTION_SCHEMA_RESEARCH_2026_10.md. Node test-result reporting
does not await extraneous asynchronous work. Trace the actual returned worker
handle and directly awaited service before changing fixture disposal. Prove
provider/release ordering at parent-visible checkpoints, including a live
database after terminal status and released lease. PostgreSQL cloning and W3C
monotonic timing do not grant drainage authority; keep those separate from
the scoped template choice and OWASP-minimized published evidence.

October 15 recovery discovery guidance uses
docs/RECOVERY_DISCOVERY_SCHEMA_RESEARCH_2026_10.md. Keep domain wall-clock/delay
semantics distinct from monotonic performance spans. Node's actual returned work
must include ingestion and post-release pruning; reporting, terminal status and
lease release are earlier boundaries. Prove held stages at the parent and retain
Error/null cancellation until actual drain before reusing database resources.
PostgreSQL's source/clone constraints and informative OWASP exclusions apply
independently; this project fixture policy is not W3C certification.

October 15 seven-file shared-cohort guidance uses
docs/RECOVERY_SHARED_COHORT_RESEARCH_2026_10.md. Node's child close covers process
end and stdio closure; retain separate output-callback drainage and registered
worker-absence checks before parent reconciliation. Neither exit nor a signal
acknowledgement authorizes database reuse. Keep PostgreSQL name/OID ownership,
sealed source and explicit clone configuration, W3C draft duration limits and
OWASP credential exclusions distinct from the reviewed allowlist decision.
Docker's resource constraints distinguish consumption ceilings from capacity:
CPU shares do not reserve CPU. Disposable test containers isolate test state,
while host contention remains a separate operational concern. Avoid attributing
a startup stall to load or changing resource bounds inside a matched comparison.

October 15 complete-coordinator guidance uses
docs/INTEGRATION_COORDINATOR_RESEARCH_2026_10.md. Built-in Node filesystem glob,
canonical path checks and pinned shell-free argument arrays establish the local
selection boundary; OWASP argument-injection guidance still requires validation.
Reuse actual child close and output drainage. W3C draft monotonic durations are
local observations, not evidence of complete coverage or reserved host capacity.

October 15 capability-preflight guidance uses
docs/INTEGRATION_PREFLIGHT_RESEARCH_2026_10.md. Docker create acknowledges an
unstarted owner; validate its current command/configuration before start and
retirement. Separate immutable image identity from executed binary capability
and reviewed PostgreSQL source policy. OWASP validation applies to argument
injection even without a shell. Avoid daemon/socket authority for version-only
probes. CLI close/timeout is not proof that the remote container has stopped;
await current-owner stopped/exec checks and removal before database admission.

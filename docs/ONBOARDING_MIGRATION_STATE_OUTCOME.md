# Onboarding migration state and refresh outcome

October 26, 2026. Implements the next item from
[migration observation](MIGRATION_OBSERVATION_OUTCOME.md).
See separate [research/tradeoffs](ONBOARDING_MIGRATION_STATE_RESEARCH.md),
[design](ONBOARDING_MIGRATION_STATE_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_ONBOARDING_MIGRATION_STATE_OUTCOME.md).

The database checklist now distinguishes unavailable observation from known
pending/current migrations. A small pure server projector consumes the settled
read result. Rejected Error/null and malformed data produce fixed unavailable
guidance, without raw messages, codes, filenames or paths. Known pending counts
remain real counts. The step heading is Check database migrations and the label
is Unavailable for an unknown observation. Unavailable counts as an open issue,
reduces the ready count and cannot produce an all-ready aggregate. Singular
migration/setup messages now use the matching verb.

The step-status vocabulary now includes unavailable; clients interpreting individual
steps must handle it as non-ready. The aggregate status remains attention for this
case, and known pending/current migration semantics remain intact.

Refresh keeps its native button, name and focus while busy. A stable polite atomic
status paragraph reports initial load, refresh, completion, partial unavailability
and failure outside the busy results region. Vue useId connects Refresh to its
results. The activation guard and the composable's one active read prevent overlap;
poll/focus callers share that completion. Retained successful data remains rendered
after a failed refresh and the feedback identifies it as the last successful
checklist. Transport failures use fixed text. The view disposes its workflow on
unmount; timers/listeners stop, new admission closes and late UI updates are ignored.
This does not cancel an admitted HTTP/database operation.

All 56 focused checks passed. The frozen complete gate passed 6,134 server, 4,497
client and 700 script tests, plus lint, copyright, migration/schema, ESM, image-tag,
Compose and build checks. No dependencies changed; runtime npm audit reported
zero vulnerabilities. Pure projection tests cover current/pending/unavailable and
private-text exclusion. A service control starts with all checks ready and proves
that one failed migration observation becomes exactly one issue. Deferred-fetch
tests prove coalescing, retained results, retry and disposal behavior.

Two real-browser scenarios passed in the authenticated app shell. Held initial
and refresh replies prove a stable status node outside the busy region, guarded
Enter/Space activation, one request while held, unavailable versus actual pending
wording, preserved Refresh focus and preservation of a user's move to Hide setup
mode. Initial failure can retry; failed refresh retains the checklist and hides
private transport text. Navigation during a held refresh does not resurrect the
panel. The 390 px width check passed and the controlled screenshot was inspected.
These are DOM/keyboard/presentation checks with controlled HTTP replies; they do
not establish screen-reader speech. Manual assistive-technology and physical-device
checks remain deferred.

The packaged PostgreSQL preflight separately exercised the real missing-table
case. Its onboarding response had unavailable status, fixed guidance and exactly
one additional issue, without a synthetic pending migration or private SQL text.
The existing DDL guard, read-only transaction, concurrent reads, authorization,
CSRF, idempotency, encrypted backup/hash checks and actual restore apply also passed.
This connects the new projection to real service composition rather than treating
browser fixtures as database evidence.

The final immutable no-cache image passed the complete migration-observation entry
without source overlays, followed by the normal startup/recovery regression with
background services enabled. Both owned native containers were removed and absence
verified. The configured backup-root probe passed required directory/file readiness,
publication/sync and deletion checks, then removed its owned files.

The live packaged page delivered a real current database step and no-store. Separate
controlled replies in the same packaged client exercised unavailable state and a
failed refresh retaining that checklist. Focus, stable status identity, private-text
exclusion and 390 px width checks passed. Screenshots were inspected. These controls
did not alter the preserved deployment's schema or create/restore real backups.

Runtime comparison verified the new migration-step module, changed onboarding
service and rebuilt client against frozen source/build hashes. Other server modules,
shared files, runtime npm/OS packages and six mapped native binary hashes matched
the preceding image. Unchanged readiness-fault, filesystem/SQL/container-crash,
worker-interruption and media qualification retain preceding evidence; they were
not rerun as new results. The existing Windows directory-fsync limitation remains
outside this UI/state change, as documented in the preceding migration outcome.

GitHub MCP searches found no open PRs in cloudbyday90/Harmoniarr. Random local PR
implementation and stale-PR cleanup were therefore inapplicable. Work remains on
main; no release, tag, branch creation or PR merge is part of this change.

Recommended stack: prepared-state reader → pure migration step → explicit issue
accounting → one active fetch with retained data → stable status feedback and
focusable guarded Refresh. It reuses existing services, accepts clearly marked
historical data after a refresh failure and keeps required startup validation fatal.

Next recommended item: audit CLI migration diagnostic readers for schema-preparation
side effects. The remaining legacy status/checksum/state helpers still call
ensureSchemaTable; separate diagnostic observation from explicit preparation while
preserving bootstrap behavior and fatal startup checks. Qualify missing-schema and
concurrent diagnostic execution before changing those contracts.

Implemented in the [migration CLI readers outcome](MIGRATION_CLI_READERS_OUTCOME.md).
That follow-up separates diagnostic SELECTs from explicit preparation and records
restricted-role, missing-ledger and concurrent-command qualification.

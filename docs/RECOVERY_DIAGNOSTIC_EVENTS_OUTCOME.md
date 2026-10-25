# Recovery diagnostic events outcome

October 25, 2026. Completes the next step in the
[admission diagnostics outcome](ARTWORK_ADMISSION_DIAGNOSTICS_OUTCOME.md). See
[design](RECOVERY_DIAGNOSTIC_EVENTS_DESIGN.md),
[official research/tradeoffs](RECOVERY_DIAGNOSTIC_EVENTS_RESEARCH.md) and
[no-cache Docker outcome](LOCAL_DOCKER_RECOVERY_DIAGNOSTIC_EVENTS_OUTCOME.md).

## Delivered behavior

Recent failures now show the current service's finishedAt and redacted
errorMessage with a known background-job label. Recent privileged actions use
eventType/occurredAt and fixed readable labels for all five current recovery event
types. Stable record IDs replace collision-prone type/time keys. Unsupported
aggregate failure counts and actor attribution were removed; none are inferred.

A pure ESM presenter and small Vue component replace the two long workspace
templates. Each section inspects at most five records, rejects missing/duplicate
IDs, bounds messages to 1000 code units plus an ellipsis, and treats unknown types
with generic labels. Missing/invalid timestamps are explicitly unavailable.
Empty arrays differ from unavailable/malformed records; partial invalid records
produce an availability notice rather than a fabricated empty history.

Messages use Vue text escaping, never HTML rendering. Audit summary/details and
actor fields are not projected. Server authorization, redaction, schema, query,
API, export and ingestion behavior are unchanged. This preserves the existing
confidentiality policy, not an exhaustive free-text secrecy guarantee: the server
redactor recognizes selected path roots and credential/email patterns.

The component uses named sections, headings, semantic lists and time elements.
It reuses the existing disclosure, request lifecycle, quiet status/error feedback
and focus-preserving refresh. Record lists are not additional live regions.
No polling, request, lookup, mutation or persistent service was added.

Recommended stack: administrator/redaction boundary → current service fields →
bounded stable-ID projection → escaped semantic rows with truthful fallbacks →
existing refresh/status lifecycle → service-derived contract and browser proof.
The benefit is meaningful, bounded diagnostics without a backend contract change;
the limit is that absent facts stay unavailable and existing redaction remains
heuristic. No aggregate history count or actor identity is established by this UI.

## Validation and evidence scope

- Eight focused tests passed: four new presentation checks, two existing refresh
  composable checks and two real-service checks. Coverage includes service-produced
  redacted payloads, matching type/time with distinct IDs, all five action labels,
  missing/obsolete fields, invalid dates, detached projections, malformed/duplicate
  records and strict row/message bounds.
- One stable fast gate passed 11,188 tests: 6,003 server, 4,485 client and 700 scripts,
  plus required lint, ESM, copyright, schema/migration, topology, hygiene and builds.
- Eleven browser tests passed: the new Recovery event scenario, the existing
  admission diagnostics scenario and nine settings authority checks. Real-service
  fixtures verify messages/times, duplicate-type/time rows, row replacement after
  refresh, missing/malformed/empty/error/retry states, redaction and HTML-as-text.
  No injected image element or script executed. Audit summaries/credentials were
  absent from the display, refresh retained focus and no duplicate-key warning
  occurred. A 390-pixel layout remained within the viewport; its captured mobile
  failure section was visually inspected.

The browser uses real authentication/app/database fixtures and controlled responses
produced by the unchanged Recovery diagnostics service with injected stores. This
does not establish a new SQL query/plan or live recovery mutation. Existing native
settings/session barriers, anonymous/operator/requester refusal, legacy URLs and
cached revocation remain correct. Human screen-reader/physical-device acceptance
remains deferred; automation is not a claim of full accessibility conformance.

The preceding 43 artwork/mixed native checks, one native HTTP/PostgreSQL check,
42 SQL and nine unrelated review browser checks, controlled-provider and file-backed
chains are retained evidence, not fresh executions. Exact comparison found all
production backend/shared/schema/dependency files and validation drivers unchanged;
all 938 server and 12 shared packaged modules and six mapped native binaries match.
Only the relevant client presentation and browser tests changed. Repeating native
allocation matrices would not validate additional changed runtime behavior here.

A preflight fixture initially expected an arbitrary /private path to be masked,
which lies outside the current root-based policy. It was corrected to use an
application-owned /app/data path; the limitation remains documented and is the next
hardening recommendation below. A browser preflight also caught a fixture wait at
the earlier loading/unmount boundary; it now waits for the replacement row before
counting it. Failed logs remain private and are excluded from passing counts.

Private reproducible evidence lives in `.tmp/recovery-diagnostic-events-2026-10-25/`.
The stable 3,517-file source fingerprint is
`e5aa7cc03590d5d8bd63c4d5f4511870b9990bfb7c88abb17acce4a526e977aa`.
No code changed after the stable gate or rebuild. GitHub MCP searches at task start
and final review found no open PRs to apply, rebase or clean up. All project changes
are committed/pushed on main without a branch or release.

## Next recommendation

Extend and qualify server-side free-text path redaction for operator-configured
roots outside the current recognized list. An arbitrary /private root remained
literal during preflight; current API access is administrator-only, and this is
a minimization gap rather than proof of unauthorized access. Prefer explicit
configured-root/context handling and regression cases for Windows/POSIX paths,
URLs, public API paths and Unicode over a blanket slash-matching expression.
Keep that policy at the shared server boundary used by diagnostics and exports;
do not substitute client-only masking or claim arbitrary-secret detection.

# Two-owner track delivery outcome

Implementation date: October 12, 2026.
The [design](OPERATOR_TRACK_UNION_DESIGN.md) and
[research](OPERATOR_TRACK_UNION_RESEARCH_2026_10.md) define the bounded slice.

Two recipients now retain separate typed requests and Wanted scopes while sharing
one release discovery row and one exact download manifest. The supported union
contains two distinct disc-one tracks, each owned by one person. Private delivery
plans derive current app-user roots, and actual filesystem containment uses each
recipient root. Copies retain shared downloaded input. Version-two receipt
envelopes hold separate owner/request/scope/file-byte receipts; the single-owner
version-one form remains supported.

Applied status alone cannot fulfill either person. Request reads find their own
receipt, and Wanted verifies the current bytes for their scope. Replacing one
delivered file restores only that person's requirement. Current roots, consent,
request identities and the accepted complete participant set remain protected
at selection, delayed work, file mutations and receipt publication.

## Retained diagnostics

The initial native catalog file passed six existing cases and failed the new
union case because no second owned request existed. Scoped duplicate lookup alone
was insufficient: global active-request and shared-discovery planner blockers
also suppressed the second person's request. Typed subsets now retain recipient
publication, while their own active request still blocks duplicates and legacy
whole-release deduplication stays shared.

The next native case reached successful imports but exposed unconditional move
staging, which removed the shared download input. Shared staging now copies and
retains that input; per-recipient finalization has its own root. The corrected
targeted case passed before stronger missing-owner, reversed-primary and late
disable assertions were added. These pre-review logs are separate from final
proof. A duplicate test import and a wrong ignored helper path were corrected;
neither weakened runtime checks. Unit root expectations were corrected to the
existing `music/users/<managed-root>` contract.

The first frozen broad native candidate was 140/142. Two preparation-closure
cases reported `ECONNRESET`, one during worker cleanup and one while the next
scenario applied migrations. Owned host diagnostics failed a connection once
and later queried a ready PostgreSQL 18.3 host. The isolated seven-case closure
file then passed with phase diagnostics and successful cleanup, without code,
pool, deadline or assertion changes. These resets remain unconfirmed, not a
claimed fix from this feature. The same frozen affected cohort is rerun for the
final evidence below; the failed broad and isolated diagnostic logs are retained.
The second broad run was again 140 passing, with one preparation-closure timeout
after a connection reset and one interrupted reconciliation-lifetime case with
another reset. The new union case passed both broad runs. An unchanged-source,
phase-enabled isolated check of the two affected files passed 15/15 with no
failures, cancellations or skips. The other 17 files contain 127 cases, all
passing on the same frozen source in the second broad run. This accounts for
passing evidence for every one of the 142 selected cases, not one clean broad
run. A passing retry does not establish why broader runs reset their connections.

## Final evidence

| Gate | Result | Scope / duration |
| --- | --- | --- |
| Focused consumers | 221/221; zero failures, cancellations or skips | 16 verified literal files; TAP 61.041 seconds |
| Complete `validate:fast` | 9,963/9,963 and both builds | 5,027 server + 4,384 client + 552 scripts; wrapper 132.913 seconds |
| Broad PostgreSQL candidates | First: 140/142; second: 140 passing, one failure and one cancellation | Same 19 serial files; second TAP 410.383 seconds; resets/timeouts retained |
| Final isolated PostgreSQL evidence | 15/15; zero failures, cancellations or skips | Two affected files, phase diagnostics; TAP 30.102 seconds; source/bounds unchanged |
| Remaining PostgreSQL evidence | 127/127 | Other 17 files in the second broad run; together all 142 selected cases have passing evidence |
| Dependency audit / skills | Zero reported npm vulnerabilities; five validators pass; seven installed files match source hashes | No new blind trial or whole-system certification |

Twenty-two JavaScript files are frozen: 19 runtime and three test/fixture files.
The working tree and Git index match the candidate hashes; no production changes
followed the final fast gate. Logs/manifests are in ignored
`.tmp/operator-track-union-2026-10-12/`. Native media uses the acknowledged image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
with network-disabled ffprobe 8.0.1. The execution-worker fixture owns actual
completion and close and proves one provider call containing two files; it does
not contact an external provider.

## Recommendation and next item

Use current intent/catalog → complete owned participants → exact union manifest
→ guarded dispatch → distinct current destinations → media/path/quality checks
→ atomic separate receipts → owner-specific current Wanted outcome.

Advantages: shared acquisition without implicit cross-user delivery and concrete
per-person outcomes. Costs: strict tags/naming, extra current-state/root reads,
streamed file-byte checks and JSON receipt scans. Recommend this bounded slice;
arbitrary unions, multi-disc or same-file two-recipient delivery need separate
proof. Import restart with partial shared plans stays blocked. Existing download
adoption/origin checks are retained without new shared-recovery certification.

Next: investigate the repeated native PostgreSQL connection resets during
longer cohorts before expanding native scheduling or declaring it reliable.
Then support partial delivery recovery and the owner-intent lifecycle: safely
recognize an already verified delivery, retry only unresolved recipients, retire
fulfilled acquisition sources and reopen them when owned media is missing.
Keep per-person receipts/audit and current consent separate from candidate-wide
status. An indexed durable receipt store with scan-owned invalidation belongs in
that design. Files and SQL are not one atomic transaction; late refusal can leave
copies without published fulfillment. Embedded tags do not prove acoustic
identity. No exhaustive-native, deployment or WCAG certification is claimed.

The [PR assessment](OPEN_PR_APPLICABILITY_TRACK_UNION_2026_10_OUTCOME.md) records
unchanged previously replayed revisions. Work stays on main without a new branch,
release, tag or PR merge.
All repository code, documentation and skill-reference changes are committed and
pushed together on main. No new Docker deployment is part of this slice.

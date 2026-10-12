# Exact single-track acquisition outcome

Implementation date: October 12, 2026. See the
[design](OPERATOR_TRACK_SUBSET_DESIGN.md) and
[official research](OPERATOR_TRACK_SUBSET_RESEARCH_2026_10.md).

One requested track from a two-track release now has a filtered selection,
preview and download manifest, fresh import-media checks, a durable source-owner
receipt and owner-specific fulfillment. Extra/ambiguous or contradictory files,
wrong recording/edition/position, changed consent and incompatible recipients
refuse. Other subset shapes remain blocked. Legacy candidates need typed scope.

The receipt uses a verified destination SHA-256/size. Wanted compares current
library bytes; replacement/missing files restore the requirement. Request status
is historical delivery evidence for its recipient, while Wanted reflects current
desired availability. Existing quality and path checks remain separate.
Global complete/duplicate counts cannot satisfy a typed subset for this person;
the new native case begins with global complete counts and still requires the
owned import receipt.

## Retained diagnostics

The initial focused candidate was 140/143: three former blanket-subset-refusal
expectations needed updating after the supported single-track slice. It also
used nonexistent literal selectors, which Node ignored; that run is diagnostic
evidence only. Final selectors must all be checked for existence. The new focused
policy/worker cases and first native candidate passed. Further review added raw
path consistency, destination probe/fingerprint stability, mutation-time consent
refusal and receipt/event rollback; pre-review gates are not final proof.

Local manifests, logs and frozen hashes belong to ignored
`.tmp/operator-track-subset-2026-10-12/`. No deadline, pool bound, assertion or
native skip was relaxed to obtain a passing result.

A later 48/49 focused candidate exposed an unnecessary receipt query for artists
without positive track overrides; receipt reads are now limited to artists that
need that evidence. Final review also required a source request/recipient before
subset work and removed global complete/duplicate counts as a subset fulfillment
shortcut. Complete fast gates were repeated after those production changes.
The extended 19-file native candidate completed 141/141 while the coarse
availability review changed inputs; it remains pre-freeze evidence. Final native
selection covers the changed planner/projection, their publication/worker/read
consumers, actual file/receipt case, and delayed recovery. This scope choice is
not a matched benchmark or evidence that omitted native suites cannot fail.

## Final evidence

| Gate | Result | Scope / duration |
| --- | --- | --- |
| Focused policies/worker/readers | 52/52; zero failures, cancellations or skips | Four verified literal files; TAP 0.295 seconds |
| Complete `validate:fast` | 9,950/9,950 and both builds | 5,014 server + 4,384 client + 552 scripts; wrapper 99.637 seconds |
| Affected PostgreSQL | 87/87; zero failures, cancellations or skips | 11 verified serial files, 10 suites; TAP 225.946 seconds, wrapper 226.072 seconds |
| Dependency audit | Zero reported vulnerabilities | Repository npm audit wrapper; not whole-system certification |
| Skills | Five structural validators pass; seven installed files match source hashes | Reference maintenance; no new blind trial |

Twenty-three JavaScript files are frozen: 20 runtime and three test files.
Working files and Git index match the frozen hashes. No code changes followed
the final passing fast gate. The native media fixture acknowledged
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
and network-disabled ffprobe 8.0.1. The final native case uses actual saved intent,
global complete counts, guarded publication, persisted candidate files, actual
ffprobe and exclusive file apply, mutation-time refusal, required-event rollback,
owner receipt and replaced-file Wanted restoration. The execution-worker fixture
owns actual completion and close and proves its provider call receives one file;
no real external provider was contacted for that proof.

## Recommendation and next work

Recommend the stack: current positive intent/catalog → complete participants →
exact file manifest → provider admission → fresh media/path/quality checks →
verified destination bytes → atomic owner receipt → current Wanted outcome.
Advantages: useful partial acquisition without implicit sibling permission and
inspectable owner evidence. Costs: strict tags/naming, extra probes and streamed
hash reads, JSON receipt scans and conservative recovery support.

Next: design and prove two owners requesting different tracks from one release,
with an exact union manifest and separate delivery/fulfillment receipts. Include
multi-track/disc occurrence identity and recovery/adoption before enabling those
shapes. Track-MBID persistence and acoustic identification remain distinct design
decisions. File/SQL operations are not one atomic transaction; late refusal may
leave files without publishing fulfillment. No W3C/WCAG certification, acoustic
content identification, exhaustive PostgreSQL gate or new deployment is claimed.

The [PR assessment](OPEN_PR_APPLICABILITY_TRACK_SUBSET_2026_10_OUTCOME.md) records
the previously replayed revisions. Work stays on main without a release, tag,
separate branch or PR merge.
All tracked code, documentation and skill-reference changes are committed and
pushed together on main after these checks. The historical no-cache Docker
walkthrough was completed in its earlier round; this slice introduces no new
deployment.

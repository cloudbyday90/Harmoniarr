# Library-add setup timing outcome

Date: 2026-10-17. See the separate
[design](LIBRARY_ADD_SETUP_TIMING_DESIGN.md) and
[official research](LIBRARY_ADD_SETUP_TIMING_RESEARCH_2026_10.md).

## Implemented result

The automatic suite now supplies one existing fixture observer to its original
tooling verification and runtime. Five fixed diagnostic phases distinguish image
inspection, version-command completion, outer tooling verification, returned
runtime creation and final runtime cleanup. The runtime's container/workspace
observations share the root correlation, while scenarios retain child identities.

The narrow ESM library-add-media-tooling module contains the extracted original
prerequisite commands. Command order, arguments, legacy version log, null or
unavailable return, local/image paths and async completion are unchanged. No
probe, cache, resource increase, dependency, schema, production or image change
was introduced. Per-command remains default; owned-api stays explicit.

All eight automatic native test bodies are byte-equivalent after newline
normalization to the opening commit a936b7b, with no body substitutions. Their
digest remains
`b670366e4ba31de3727c077f072c97a4aaa3afa8e58a190a22ce0ef0d254d927`.
The aggregate cohort schema remains version one with the same required rows;
these new phases are optional raw diagnostics, not new completion evidence.

## Final-source native observations

| Observation, seconds | Per-command | Owned API |
| --- | ---: | ---: |
| Parent file wall time | 139.696 | 88.831 |
| Sum of returned scenario durations | 129.548 | 79.265 |
| Image inspection | 0.226 | 0.229 |
| Original version command | 1.053 | 1.055 |
| Outer tooling verification | 1.279 | 1.285 |
| Returned runtime setup | 4.300 | 3.965 |
| Final runtime cleanup | 1.492 | 1.233 |

Both automatic runs passed all eight cases with zero failures, cancellations,
skips or TODOs. Each retained **18 generations and 59 inspections**, with ordered
scenario work **1/4, 0/0, 0/0, 0/0, 9/30, 3/12, 5/13, 0/0**. Each emitted exactly
one of all five setup records, with the same root correlation and ordered
completion. Runtime setup included the actual container-start duration; outer
tooling included both sequential commands. All eight schema scenarios still ran.

The owned run completed all 59 inspection commands and created/removed four
native owners. All eight workspace predicates were true; transport had no
failed, pending, untimed or clipped records. Per-command has no retained-owner
transport record, which does not mean it performed no native cleanup.

Returned runtime setup covers workspace/PostgreSQL construction, not per-scenario
schema/application readiness. Outer tooling includes its nested image/version
durations; do not add those again. Scenario time includes its own setup and
database tail. The parent measurement also contains module/process/reporting
work outside these owners; an arithmetic residual cannot identify that work's
cause. A passed tooling phase only means the helper resolved: its unavailable
reason is a resolved result, and complete zero-skip native evidence proves actual
availability here.

This is one descriptive sample per mode under current host load, not a new
counterbalanced speed experiment. The earlier
[four-sample comparison](AUTOMATIC_LIBRARY_ADD_MEDIA_OUTCOME.md) remains separate
and variable. These new observations do not diagnose its larger historical gaps,
establish a causal speedup, qualify hosted Ubuntu or justify a default change.

The unchanged six-case missing-music-add-to-library cohort also passed in 61.367
seconds, exercising default callers of the extracted helper. This is **14
distinct native cases across two paths**, with the automatic eight repeated in
the second mode; it is not 22 distinct cases or a complete integration invocation.

## Validation and source identity

All **40 focused cases** passed across tooling, media tools/scenario, fixture
observer and app runtime. New held-command controls prove that the second command
and final return wait for the original first/second completions. Error/null at
either command preserves unavailable semantics and stops later admission. Tests
also cover disabled clock/sink, failed optional sinks, invalid clocks, minimized
records and rejection of invalid injected dependencies. Existing tests retain
real child output, import isolation, returned database tail and unsafe-workspace
retention. Focused ESLint passes with zero warnings.

Opening and closing native fingerprints match: **3,022 source files**,
`9f842ed3e6b7a74372c1a9ceed0679a8415b0285e78cdee94efb6d199290a5cd`.
The automatic native case digest is equal across both final-source runs:
`dee105421f3dd712796412ff91b5a26ad24f088b316098f77c301cb027da9c8d`.
That digest includes source locations; the independent body digest above proves
preservation across the newly inserted import/setup lines. Private complete
logs, counts, setup records and code/body/source freezes remain under
.tmp/library-add-setup-2026-10-17 and are excluded from Git.

Preflight retained the existing local immutable images: PostgreSQL 18.3,
ffmpeg/ffprobe 8.0.1 and trusted reader Node 24.21.0/Docker CLI 29.9.0. Host Node
was 24.18.1 and Docker Engine was 29.8.2/API 1.56. The selected image identities
match the [previous outcome](AUTOMATIC_LIBRARY_ADD_MEDIA_OUTCOME.md); no image
pull/build or installed runtime upgrade was needed.

The fast gate passed in **145.330 seconds**: 5,442 server, 4,384 client and 671
script cases, **10,497 total**, with no failures/cancellations/skips/TODOs. Both
builds, copyright, migration/schema, ESM, image/Compose, lint and test-hygiene
checks passed. The existing testing and web-standards skills now describe setup
ownership, unavailable semantics and raw-versus-aggregate evidence; their
repository copies and installed standards copy validate. The installed four-file
standards copy matches, all 450 checked local Markdown links resolve, and the six
changed code files and complete source fingerprint remain equal to native proof.
The other 125 integration paths were not freshly rerun. Previous complete-gate
evidence and historical failures remain separate; no underlying connection
failure or existing Vue/TestsStream warning is repaired by these diagnostics.

## Recommendation and next work

Retain the design's stack: existing optional monotonic observer, narrow tooling
module, original returned completion, correlated runtime phases, complete native
assertions and minimized evidence. Setup did not dominate these two samples;
caching verification, enlarging deadlines or changing execution defaults is not
supported. Browser accessibility standards do not apply to this fixture-only
change, and no WCAG or W3C conformance claim is made.

Next, give the prerequisite version probe acknowledged ownership and verified
retirement before introducing a timeout. Evaluate reuse of integration-tool-probe
for immutable image-backed commands, with actual command/stdio completion and
remote stopped-state/removal proof after cancellation or failure. Local-tool
commands need their own actual close boundary. Preserve unavailable semantics,
original Error/null within owners and no unverified cleanup. This changes probe
work, so qualify it separately with native adverse controls rather than label it
an equal-work optimization. Keep the present timing records as the baseline.

The subsequent [prerequisite ownership outcome](LIBRARY_ADD_PROBE_OWNERSHIP_OUTCOME.md)
records that implementation and its changed command work separately.

Opening GitHub MCP repository/PR discovery and a fresh closing collection read
both returned zero open PRs to apply, close or rebase. Work remains on main; no release,
tag, branch, merge or deployment-image rebuild is created.

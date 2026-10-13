# Wanted workload replay outcome

This document records the separately owned replay and command change described
in the [design](WANTED_WORKLOAD_REPLAY_DESIGN.md) and
[official research](WANTED_WORKLOAD_REPLAY_RESEARCH_2026_10.md). The historical
source-no-op matrix remains incomplete; its cold-start failure is not diagnosed
by a successful new workload or a later healthy server observation.

## Preserved prerequisite failures

The first fresh full invocation exited one after 38.420 runner seconds with
zero samples. A separate two-sample selection stopped at media tooling setup.
Safe source frames located `operator-track-delivery-recovery-fixture.js:36` and
`wanted-distinct-binding-fixture.js:20`; local ffmpeg/ffprobe was unavailable.
The independent PostgreSQL query passed against 18.3; this failure was a fixture
prerequisite failure, not evidence of a database startup timeout.

The existing local media image was verified as
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`, with
ffprobe 8.0.1. The configured replay scopes/restores only its media image variable;
pool max two, checkout ten seconds, scenario ninety seconds and reuse-off policy
remain. The unconfigured failure and its bounded diagnosis are separate artifacts.

## Code boundary

Two narrow ESM modules own command selection and awaited measurement/reporting.
The original CLI delegates to the same benchmark functions. The full command
retains two profiles, three dimensions and two alternating pairs (24 samples).
Selected commands expose explicit profiles/bindings/pairs within existing limits,
record `scope`, dimensions and expected sample count, and reject ambiguity before
creating fixtures. Version-two completion requires every selected profile,
dimension, pair and comparator variant exactly once; early return, duplicates
and foreign dimensions refuse a green result.

The original Error/null remains private in the runner result. Public failure
records reuse bounded class/code and real project-relative frames; messages,
assertion values, causes, SQL, credentials and absolute paths are excluded.
Partial verified samples remain. Timing spans awaited benchmark work and cleanup,
excluding artifact writing; the unchanged nested service timings have their
original scope. The CLI still exits one on measurement failure.

Distinct-binding phase checkpoints are awaited outside service measurement;
an optional sink failure settles before work continues. Fixed phase/dimension
fields locate the current operation, while unknown metadata is omitted. The
failure formatter now recognizes the fixed TimeoutError class without its
message. Cancellation before admission or during returned cleanup cannot turn
an otherwise complete sample set green.

## Full replay and selected native evidence

The configured full replay exited one after **373.305 runner seconds**, retaining
**20/24 verified samples**: both alternating pairs for sine B=2/4/8 and noise
B=2/4. Noise B=8 did not publish a verified pair. Every retained pair passed
complete private result, durable request/event/link and projection-digest equality
through the original comparators. This is an incomplete collection, not a passing
matrix. Its cancelled scenario did not capture a cold checkout failure; independent
probes were unavailable after cancellation. It does not diagnose the old timeout.

| Media/B | Projections compatibility / locked | Hashes | Queries | Median service ms per mode |
| --- | --- | --- | --- | --- |
| Sine/2 | 7 / 5 | 28 / 20 | 160 / 122 | 272.803 / 234.167 |
| Sine/4 | 9 / 5 | 72 / 40 | 384 / 228 | 535.303 / 306.722 |
| Sine/8 | 13 / 5 | 208 / 80 | 1072 / 440 | 1453.012 / 608.307 |
| Noise/2 | 7 / 5 | 28 / 20 | 160 / 122 | 688.193 / 528.935 |
| Noise/4 | 9 / 5 | 72 / 40 | 384 / 228 | 1947.241 / 1045.168 |

Each median is two observations per mode. This is warm-media work after real
canonical delivery; elapsed work excludes setup, explicit GC, comparison and
rollback. Local speed/memory observations do not establish whole-app or CI
improvement. The complete sample/hash guards are unchanged.

On final frozen command code, a separately owned `--profiles noise --bindings 8
--pairs 1` invocation exited one after **118.388 runner seconds** / **115,280.852
measurement ms**, with zero verified samples. Version-two evidence reports
`TimeoutError` and the last approved checkpoint **seed**, before measured work.
This locates the failing operation within the unchanged ninety-second scenario;
the elapsed window also includes startup and cleanup. It does not identify which
nested media/delivery/query step or external resource caused the delay.

A separate final `--profiles sine --bindings 2 --pairs 1` CLI run passes two
verified samples and returned cleanup in **30.099 runner seconds** / **27,980.401
measurement ms**. Its artifact explicitly says selected, expected samples two,
completed true, no failure and final server-cleanup checkpoint. This smaller
success does not fill the missing full-matrix samples.

The focused policy/runner/formatter/profile cohort passes **32/32 cases**, zero
failures/cancellations/skips. It proves reviewed selection, private failure
minimization, held cleanup, Error/null, timeout classification, early/duplicate/
foreign samples, cancellation, CLI refusal and missing-GC partial artifact wiring.
The frozen `npm run validate:fast` passes static/copyright/schema/ESM/image/
topology/lint/hygiene checks, **10,125 tests** (5,176 server, 4,384 client, 565
script) and both builds in **193.561 runner seconds**. Every test layer reports
zero failures/cancellations/skips. Dependency audit reports zero known
vulnerabilities; this is not a whole-application security scan or a matched
whole-suite speed comparison.

Six changed JavaScript files were frozen before the final selected noise/sine
invocations and stable gate. All source/staged hashes match, 34 retained baseline
files are unchanged, and 759 local links in 14 changed Markdown documents resolve.
Three skill folders pass structural validation; all four installed standards
files match versioned sources. No new blind skill trial is claimed.

## Recommendation and remaining work

GitHub MCP repository discovery/metadata supplied the pulls collection. Initial
and final refreshes found **zero open PRs**, so no random local replay, PR merge,
rebase, closure or other PR mutation applies in this slice.

Ignored artifacts under `.tmp/wanted-source-replay-2026-10-13/` retain the first
unconfigured replay and bounded diagnosis, configured incomplete replay, separate
selected noise failure and sine success, analysis, frozen source hashes,
focused/fast/audit logs and skill/repository checks. Every collection has its own
result file; failed evidence was not overwritten. No production source, schema,
dependency, deployment, branch, release or tag changed. The entire integration
suite and browser/assistive-technology checks were not run.

Adopt verified prerequisites, explicit reviewed selection, original guarded
comparisons/cleanup and safe partial failure records. This improves focused
diagnostic scope and evidence, not the cost of an identical full matrix. The
[next publication proposal](WANTED_PUBLICATION_NO_CHANGE_PROPOSAL.md) remains
behind the demonstrated seed-phase failure. First split/profile fixture seeding
into media generation, canonical delivery and receipt validation, retain actual
returned work/cleanup and remove only measured redundant preparation. Keep the
same scenario/resource limits and retry-free refusal. Do not assume media or CPU
is the cause merely from the outer seed checkpoint. Then establish all-writer/
absent-row authority before an empty DELETE or unchanged link path can skip a
projection; retain real writes/events, clocks and final byte/job authority.

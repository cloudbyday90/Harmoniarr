# Automatic library-add media fixture design

Date: 2026-10-17. Follow-up to the
[HTTP phase outcome](FIXTURE_HTTP_PHASE_OUTCOME.md).

The previous complete invocation identified the automatic library-add file as
the slowest: eight cases in 94.285 seconds, with 79.511 seconds observed in
scenario work. That historical timing motivates a fresh comparison; it does not
establish media execution as the entire cause or prove an optimization.

## Implementation boundary

Reuse createLibraryAddMediaScenario and its pure option policy. Replace the
file's mutable fixtureRoot binding with stable media adapters scoped to the
runtime's actual child workspace. All eight test callbacks and assertions stay
unchanged apart from invoking the scenario wrapper. Existing helper imports
remain ESM; no new executor, global singleton or application worker is needed.

Per-command remains the default, including local tooling without an image.
Explicit owned-api mode requires the configured media image before PostgreSQL
startup. Only ffprobe delegates to the existing inspection executor; ffmpeg
generation stays writable and per-command. Every inspection still reads current
bytes, and all quality, ownership, replay, rollback, consent, collision, staging,
reuse and malformed-authority guards remain real native assertions.

Each scenario has its own lazy inspection owner. Preserve private-root/path
checks, reviewed Engine reads, image identity, network isolation and read-only
inspection mounts. Await canonical close after app/worker drainage and before
child deletion; retain uncertain workspaces and original Error/null. The returned
database tail must settle before the adapters can serve another scenario.
Trusted local daemon access remains privileged and is not general network access.

## Comparison and validation

First run the unchanged eight-case file as a fresh baseline. On the final adapted
source, collect two counterbalanced pairs in per-command/owned-api then
owned-api/per-command order, in separate serial test processes. Keep image/tool,
database, assertion, pool, deadline and input-work contracts fixed.

Require complete native root evidence with eight passed cases and zero skips.
Compare every scenario's generated-file and inspection counts. Owned transport
observations must have no failed/pending/clipped/untimed records and verified
cleanup. Compare original test bodies privately with only the explicit wrapper
substitution permitted. Command and scenario times are distinct observations;
neither alone establishes whole-CI improvement or an isolated causal speedup.

The selected comparison uses the existing createIntegrationTestEnvironment,
preflightIntegrationTests and runIntegrationTestFile services, with only the
literal automatic-library-add file selected. Sanitize inherited PostgreSQL and
Node execution settings, acknowledge the local immutable images, then scope mode,
diagnostics and phase timing to each child environment. Drain both the returned
test process and its private output stream before accepting a sample. Freeze
source hashes before and after the complete comparison. The complete integration
CLI keeps its existing all-files contract; this experiment adds no selection or
skip switch to that command.
The counterbalanced experiment is explicit investigation evidence, not a new
mandatory repeated benchmark in routine validation or CI.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep per-command only | Simple, portable baseline | Repeats Docker startup for image-backed inspections | Retain as default/comparator |
| Existing scenario-owned API executor | Can amortize inspection startup; already has root and lifecycle guards | Two modes, trusted daemon capability and cleanup ownership to maintain | Add explicit option to this file |
| Share one mutable container/root across scenarios | Fewer starts | Cross-scenario authority and deletion risks | Reject |
| New fixture-specific executor | Tailored implementation | Duplicates reviewed policy and transport owners | Reject |
| Cache/remove inspections or enlarge bounds | May shorten a run | Changes current-byte proof or workload behavior | Reject |

Recommended stack: pure option policy, narrow media tools, existing scenario
adapter, existing owned executor, guarded app/database/workspace lifetime,
unchanged assertions, bounded aggregate evidence. Keep defaults conservative;
local benchmark evidence does not establish hosted-runner capability. See
[official research](AUTOMATIC_LIBRARY_ADD_MEDIA_RESEARCH_2026_10.md) and
[outcome](AUTOMATIC_LIBRARY_ADD_MEDIA_OUTCOME.md).

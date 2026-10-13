# Wanted workload replay and command design

The next slice replays the full guarded source-no-op workload under the owned
server startup diagnostics. The original failed matrix remains separate. A
successful new replay cannot diagnose or replace its historical failure.

The first new invocation stopped before sampling; the follow-up bounded source
location capture identified missing media tooling at fixture setup. The command
currently emits only a generic failure sentence. Improve that command boundary
before pursuing another production optimization.

## Module boundaries and behavior

Keep the existing guarded algorithms, same-client rollback ownership, exact
private result/durable/digest comparisons and resource limits. Introduce a pure
ESM command policy for reviewed dimensions and an ESM measurement runner for
partial evidence, completion checks and safe failure records. The executable
only selects the existing benchmark, owns cancellation handlers and writes the
local artifact. Reuse the existing bounded failure formatter; do not dump Error
messages, assertion payloads, causes, SQL, credentials or absolute paths.

The existing unqualified command retains the full matrix. Add explicit
`--profiles`, `--bindings` (distinct/source modes only) and `--pairs` selection
within existing fixture limits. Record the selected dimensions and expected
sample count in version-two artifacts. A selected run cannot silently stand in
for a full matrix. A runner that returns early cannot report completion while
missing required samples. Measurement duration includes the awaited benchmark
cleanup; service timings continue to exclude setup/GC/rollback. Artifact writing
is outside that duration. No benchmark is added to ordinary test discovery.

The distinct-binding benchmark also awaits optional phase checkpoints before
server/scenario startup, seed, client acquisition, each sample, comparison and
cleanup. Only approved labels/dimensions survive capture, and an optional sink
failure is ignored after settling. The runner retains the failure's last phase;
it cannot identify which nested seed operation or external resource caused a
timeout. The existing formatter recognizes Node's fixed TimeoutError class.

## Evidence plan

Keep unconfigured failure, bounded diagnosis and configured full replay artifacts
separate. Verify the existing local media image identity and tools, scope/restore
its environment setting, and retain failures without changing assertions,
checkout bounds or scheduling. Test command refusal and selection without
launching containers; test real failure minimization, partial output, completion
and Error/null retention at the runner boundary. Execute a selected native CLI
run once on the final code to verify wiring; keep its evidence distinct from
the full replay made before the command change.

## Recommendation

Prefer explicit guarded selection with safe failure evidence. It reduces the
work needed for a focused diagnostic and makes incomplete scope visible, but
does not make the same full matrix cheaper. Keep full workload collection an
explicit milestone. The production Wanted/link no-change proposal still needs
all-writer and absent-row coordination proof before a guard can be skipped.
See the separate [research](WANTED_WORKLOAD_REPLAY_RESEARCH_2026_10.md) and
[outcome](WANTED_WORKLOAD_REPLAY_OUTCOME.md).

# Manual session cancellation outcome

Completed October 21, 2026: stop input now applies during manual-fixture startup,
with admitted command drainage and exact owned cleanup retained. Actual manual
screen-reader/device acceptance remains deferred.

## Behavior and scope

The baseline CLI accepted `quit` before readiness but still printed its bootstrap
URL after setup. The new input owner observes quit/EOF immediately, seals buffered
command admission, and propagates one abort signal through session/database
startup. Other commands are refused while starting. Ready-state terminal controls
continue to work. Listener disposal preserves unrelated signal listeners/output.

Pre-aborted database setup admits no Docker command. Stop during an admitted run
waits for its actual returned completion boundary before exact container
inspection/removal. The readiness delay is cancellable and retains the original
Error/null reason. Expected cancellation cannot hide a failed container removal.
An ordinary setup/body failure keeps its original identity.

On Windows, the CLI additionally releases its owned stdin reference after
cleanup. It exits normally while the parent's input pipe remains open; it uses
no forced process exit. The reusable input owner leaves caller streams usable.
Native child fixtures register stdin release and actual close drainage before
waiting, including test cancellation.

All first-party code remains modular ESM. Existing loopback bindings, random
credentials, resource limits, server route restrictions and provider refusal
remain. No production endpoint, application component, SQL migration, dependency
version or application version changed. No release or tag is created.

## Executed evidence

Frozen source: 3,223 non-Markdown files, SHA-256
`2bd2f2423c5e911ac653558bc3c35b93eabcdda0a9bf0d6cc29d277eafd89c69`;
eight changed/new code or configuration files. Private artifacts are under
`.tmp/manual-session-cancellation-2026-10-21/`.

| Selection | Result / boundary |
| --- | --- |
| Focused input, database cancellation, controller and native HTTP guard | 15/15 pass, including pre-ended input, buffered lines, listener ownership, held commands, original Error/null and failed removal |
| Explicit manual-fixture native lane | 3/3 pass: actual early-quit/EOF child close, a held return of a completed native Docker run with exact removal after stop, and the existing real PostgreSQL/Chromium history/loading/failure/retry/held-read teardown journey |
| Ready-state CLI controls | Native quit and EOF both exit with owned container retirement; deployment-target arguments remain refused |
| `validate:fast` | 10,766/10,766: 5,613 server, 4,456 client, 697 scripts; static checks/lint/hygiene/builds pass; 225 existing Vue warnings remain |
| Skill validation | Updated standards reference and testing skill pass the bundled validator |

All 155 client artifacts used by the browser fixture match the subsequent fast
build. Final source and staged files were checked against the frozen manifest.
There are no skipped/cancelled tests or loosened deadlines/workers. Only eight
lightweight tests join routine server feedback. Native Docker/browser work stays
in the explicit lane; the unchanged engine/zoom matrix and exhaustive database
suite were not repeated for this fixture-lifetime change. No whole-suite speed
or complete application quiescence claim is made.

The native Docker ordering test holds the adapter's return after the real Docker
run command completes. It proves acknowledgement/cleanup order, not that a
Docker subprocess was still executing during the hold. Signal events are covered
with an owned EventEmitter; actual OS-delivered SIGINT/SIGTERM was not qualified
on this Windows host. Hard-kill cleanup remains outside the claim.

## Retained failure and correction

`baseline.json`/`baseline.log` record readiness published after early quit. The
first native cancellation candidate reported retirement but retained a pipe
reference. An independent input probe recorded active PipeWrap resources and
exited after its parent ended stdin. The exact owned stalled test child was
stopped to drain that failed run; its nonzero exit remains in
`native-candidate.log`. That run is not passing evidence.

The corrected CLI pauses/unreferences its own stdin after resource cleanup.
`native-pipe-fixed.log` records the initial passing two-case control; the final
three-case native run and ready-state CLI checks passed on the frozen source.
Failed and passing logs remain separate. This correction does not diagnose
unrelated historical host-load/PostgreSQL failures.

## Research, publication and next work

The [design](MANUAL_SESSION_CANCELLATION_DESIGN.md) records ownership and failure
policy. The [research document](MANUAL_SESSION_CANCELLATION_RESEARCH_2026_10.md)
maps WHATWG/Node, Docker, OWASP and W3C/WebKit sources to decisions, pros/cons and
the recommended stack. A global viewport-fit change was deferred because the
default and cover modes differ and physical-device evidence is unavailable.

MCP GitHub searches returned zero open PRs, so no random PR was available to
implement, rebase or close. Changes stay on main. The separate preserved
[Docker rebuild outcome](LOCAL_DOCKER_MANUAL_CANCELLATION_OUTCOME.md) records the
no-cache walkthrough and readiness check.

Next: perform the [prepared manual acceptance](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
when a screen-reader operator is available, followed by actual nonzero safe-area
and on-screen-keyboard checks on an owned device. Separately qualify native
OS-signal delivery on a suitable host if that operational guarantee is needed.

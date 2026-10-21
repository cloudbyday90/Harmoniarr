# Manual session signal qualification outcome

Completed October 21, 2026 on main. The existing CLI body now belongs to
`testing/manual/manual-session-runner.js`; real session/database construction
stays in its current owners. The entrypoint retains argument refusal. Input is
observed during setup, commands close on stop, cleanup precedes retirement and
the CLI releases its own stdin reference without process.exit.

## Executed evidence

Frozen non-Markdown source: 3,229 files, SHA-256
`6bd0d62a295f0b9284537022005ab65dbe1a54f1ee7aa983c6a5a3ab8a24e198`.
Private records are in `.tmp/manual-session-signals-2026-10-21/`.

| Check | Result and scope |
| --- | --- |
| `validate:manual-session-signals` | Six passing cases on actual Linux Node 24.22.0: SIGINT/SIGTERM during startup/ready, plus cleanup Error/null identity. Each child reaches its checkpoint, receives a real OS signal, seals commands, holds cleanup until release and actually closes with the expected status. |
| Focused input/controller/HTTP/Docker policy | 18 passed; pre-aborted work, uncertain create, foreign acknowledged ID, deferred command drainage and failed removal stay observable. |
| `validate:metadata-history-manual-fixture` | Three passed: real CLI startup quit/EOF, owned database acknowledgement/removal and authenticated Chromium history/loading/failure/retry/final states with held-read retirement. |
| `validate:fast` | 10,769 passed: 5,616 server, 4,456 client, 697 script tests; static policy, lint, hygiene and both builds passed. The 225 existing Vue warnings remain visible. |
| Skills | Both updated project skills passed quick validation. Signal guidance remains conditional and separate from manual accessibility acceptance. |

The isolated signal container used the Dockerfile's immutable Node digest, UID
1000, read-only root and five read-only files, network none, no published ports,
dropped capabilities, no-new-privileges, 128 MiB memory, one CPU and 64 PIDs.
Effective configuration, actual exit and exact owned removal were checked. The
parent launcher drains admitted Docker work before cancellation cleanup and
refuses unknown identities. It never mounts the daemon socket or app data.

No native signal cases join routine fast feedback. Three lightweight policy
tests do. The existing native consumer and new native lane ran once on the final
frozen source, followed by one complete stable fast gate. Browser-built client
artifacts match that final build. No skips, cancellations, relaxed existing
deadlines or global worker changes were used. This is not a whole-suite speed
benchmark; unchanged engine/zoom and exhaustive PostgreSQL suites were not rerun.

## Limits, recommendations and next work

The Linux child uses the real input/runner with a controlled session dependency.
This is not full HTTP/PostgreSQL shutdown under a signal, interactive terminal
Ctrl+C, container PID 1 forwarding or hard-kill recovery proof. Real database/UI
consumer coverage comes from the separate quit/EOF/native fixture cases. Actual
screen-reader speech and physical-device safe areas/keyboard checks remain
deferred as requested; no manual accessibility pass is inferred.

MCP GitHub searches found no open PRs, so there was no applicable random PR,
rebase or stale-PR closure. No branch, dependency/application version change,
release or tag was created. The separate [Docker outcome](LOCAL_DOCKER_MANUAL_SIGNALS_OUTCOME.md)
records the preserved no-cache walkthrough.

The [research](MANUAL_SESSION_SIGNALS_RESEARCH_2026_10.md) records primary
Node/Docker, OWASP and W3C guidance, source status, pros/cons and the stack:
small ESM owners, AbortSignal cancellation, focused fast controls, explicit
isolated Linux qualification, existing native consumers and actual operator
acceptance. The [design](MANUAL_SESSION_SIGNALS_DESIGN.md) records ownership.

Next recommended work: execute the [prepared manual acceptance](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
with a screen-reader operator, then owned physical-device checks, and fix the
first reproduced product issue. Additional fixture expansion should follow a
concrete operational need; it should not substitute for those observations.

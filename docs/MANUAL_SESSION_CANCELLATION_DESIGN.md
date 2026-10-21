# Manual session startup cancellation design

Decision: October 21, 2026. Make the prepared manual accessibility fixture
cooperate with stop input during startup, preserving actual resource retirement.
Real screen-reader/device acceptance remains deferred by the operator.

## Reproduced problem

With the previous CLI, sending `quit` before readiness still produced a bootstrap
URL after creating the database/app. Input was consumed by the command loop only
after setup finished. EOF had the same late admission boundary. This wasted work
and made stop handling misleading while preparing a disposable test session.

The selected fix observes input eagerly, closes new admission at a single abort
signal, and checks that signal between setup stages. It keeps the existing
resource owners and their actual completion/cleanup promises.

## Owners and sequence

| Owner | Change |
| --- | --- |
| `testing/manual/manual-session-input.js` | Owns readline/signal listeners and the stopped promise from initial construction; handles quit/EOF before readiness; refuses already-buffered lines after stop; starts command forwarding only when ready |
| `scripts/run-manual-metadata-history.js` | Passes the input signal to the session, waits for actual stop, disposes listeners, and releases its own piped stdin reference before normal process exit |
| `testing/manual/metadata-history-session.js` | Checks cancellation before client preparation, app admission and operator callback; separates expected cancellation from failures that must keep a failing outcome |
| `testing/manual/manual-postgres-runtime.js` | Checks cancellation before Docker work and between startup observations, aborts the readiness timer, and drains an admitted command before inspecting/removing its exact owned container |

Other commands received during startup are refused with a bounded explanation;
they are not queued for later execution. `quit`, EOF, SIGINT and SIGTERM listener
events close admission once with one stop reason. The input owner removes only
its own listeners and leaves the caller's output stream usable. The CLI owns
its stdin reference; the reusable input owner does not destroy caller streams.

Cancellation is cooperative. An already-admitted Docker CLI command is awaited,
then exact name/label/ID ownership is re-established before removal. There is no
Promise race that abandons a potentially successful `docker run`. A failed run
can still have created the named container, so the existing recovery lookup
remains. Pre-aborted setup admits no Docker command. The readiness polling delay
uses the same signal and preserves its original Error/null reason.

An ordinary setup/body failure retains its original identity. Expected stop is
kept separate so it cannot turn a failed removal into a successful quit. A
genuine removal failure still fails, including a `null` failure value. Existing
HTTP/controller/worker/database teardown remains responsible for its resources.
This change does not certify invisible worker completion or hard-kill recovery.

## Security and scope

Keep the manual fixture's loopback-only HTTP/PostgreSQL bindings, random password,
resource limits, route allowlist and terminal-only fault controls. No domain
mutation, production endpoint, migration, dependency or release is added. All
first-party modules remain ESM. New code stays in small fixture services.

Do not infer physical safe-area behavior from desktop checks. Research confirmed
that default viewport fitting and edge-to-edge cover have different layout
consequences; adding cover would require a whole-shell inset review and actual
device acceptance. No viewport/CSS change is included in this fix.

## Verification

Use lightweight controlled tests for early input, listener ownership, exact stop
reasons, held command drainage and cleanup failures. Keep native CLI/Docker/app
checks in the explicit manual-fixture lane. A held return of a completed native
Docker run checks acknowledgement/cleanup ordering; it is not evidence that the
Docker subprocess itself was still running.

Native child-process tests register stdin release and actual close drainage
before waiting. They do not promote a test timeout into proof of process
retirement. The complete fast gate remains separate from manual accessibility
acceptance. See the [research and options](MANUAL_SESSION_CANCELLATION_RESEARCH_2026_10.md)
and [executed outcome](MANUAL_SESSION_CANCELLATION_OUTCOME.md).

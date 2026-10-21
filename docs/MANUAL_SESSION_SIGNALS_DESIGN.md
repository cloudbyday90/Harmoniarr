# Manual session signal qualification

## Decision

Qualify actual Linux SIGINT/SIGTERM delivery for the manual input owner and CLI
lifecycle. Extract the existing CLI body into a small ESM runner; leave real
HTTP/PostgreSQL construction in its current service. The script still rejects
arguments and passes the real session owner. No application behavior, database
schema, dependency, version or release changes are intended.

## Ownership and evidence

An explicit Docker lane runs Node's native test runner in the repository's pinned
Node image. It mounts only the five required source/test files read-only, runs as
UID 1000 with no network, ports, capabilities or Docker socket, and bounds CPU,
memory and PIDs. The host checks the local Docker endpoint, acknowledges the full
container ID, verifies name/nonce and configuration, waits for actual container
exit and verifies removal of that invocation's exact container.

Inside Linux, a test parent spawns an owned Node child and waits for its checkpoint
before sending a real OS signal with child.kill. The child uses the same runner
and input owner as the CLI, with a controlled session dependency. Startup and
ready-state cases require cancellation, closed command admission, cleanup held
until explicit release, actual child/stdio close and successful retirement only
after cleanup. Cleanup Error/null cases must preserve identity and fail. Test
failure releases the gate and retires only the owned child before test return.

The controlled session is deliberately smaller than the real database fixture.
This proves Linux input/runner behavior, not SIGINT/SIGTERM through the complete
HTTP/PostgreSQL stack, terminal Ctrl+C behavior, hard-kill recovery or assistive
technology acceptance. The existing native manual lane remains the consumer
check for real CLI startup quit/EOF and database/browser retirement.

## Efficient validation

`npm run validate:manual-session-signals` is explicit and accepts no selectors.
No container or subprocess cases join routine fast tests. Run the affected fast
input/controller checks, this signal lane and the existing manual native lane,
then one complete stable fast gate. Keep failure logs separate; no skipped tests,
deadline increases or forced successful exits. Rebuild the preserved walkthrough
without cache after qualification as requested.

See [research and tradeoffs](MANUAL_SESSION_SIGNALS_RESEARCH_2026_10.md) and the
[outcome](MANUAL_SESSION_SIGNALS_OUTCOME.md) for executed evidence and limits.

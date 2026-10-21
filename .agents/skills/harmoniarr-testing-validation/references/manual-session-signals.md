# Native manual-session signals

Use when changing terminal/input lifetime or claiming OS signal handling.
Run `npm run validate:manual-session-signals` explicitly. It uses the reviewed
Node digest from Dockerfile, five read-only files and a non-root, network-free
container. Its native Linux children use the real manual input/runner and a
controlled session dependency. Nothing from this lane joins routine fast globs.

Wait for installed-listener readiness before an actual child.kill SIGINT/SIGTERM.
Require aborted admission, held cleanup, no premature retirement, original cleanup
Error/null and actual close with its expected exit code. A successful kill call,
EventEmitter event or Windows forceful termination is not Linux handler proof.
Release gates and drain the exact spawned child on failure before returning.

Inspect the acknowledged container's full ID, name/nonce, effective isolation and
exit; verify exact removal. Never mount the Docker socket or whole workspace to
make this small lane work. Parent cancellation drains admitted Docker commands
before owned removal; keep the original failure, including null, observable.

This lane does not run the actual PostgreSQL/HTTP owner under a signal. After
runner changes, include `validate:metadata-history-manual-fixture` for that real
consumer's existing quit/EOF/database/browser coverage. Neither lane proves
interactive terminal Ctrl+C, hard-kill recovery, speech or physical safe areas.
See [design](../../../../docs/MANUAL_SESSION_SIGNALS_DESIGN.md) and
[outcome](../../../../docs/MANUAL_SESSION_SIGNALS_OUTCOME.md).

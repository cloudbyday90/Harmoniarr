# One-time CLI result delivery

Use for a privileged CLI that returns recovery material or another non-repeatable
result. The [design](../../../../docs/RECOVERY_CLI_DELIVERY_DESIGN.md) and
[outcome](../../../../docs/RECOVERY_CLI_DELIVERY_OUTCOME.md) describe the local
implementation; consult current official sources for a changed runtime.

Trace service commit, stream handoff, cleanup and process close independently.
An error after commit does not authorize retry, rollback or invalidation. Status
may confirm current state without recovering plaintext; make that distinction
visible. Preserve existing explicit operator decisions.

For Node output, await the chunk's write callback and observe error/premature
close. Keep a listener through callback-before-error emission. Remove only your
listeners; stdout/stderr are borrowed and must not be ended or destroyed by a
record writer. A false write return controls subsequent admission; neither that
return nor a callback proves human receipt. Prefer graceful exit status to
immediate exit, and verify actual process/stdio close.

Keep one service execution, one result attempt and one cleanup attempt. A
secondary stderr diagnostic must be bounded, carry no secret/raw Error/stack,
and stop if its own destination fails. Retain primary Error/null privately with
an explicit failure flag/stage; truthiness cannot represent `throw null`. Project
status fields explicitly. Do not persist plaintext or replay an output record to
make a failed delivery look successful.

Select proofs for the owner: controlled pending/error ordering; actual Writable
backpressure and listener retirement; actual child pipe bytes/exit and broken
destination; disposable PostgreSQL committed-state and CLI entrypoint. Platform
pipe behavior differs. Record a non-reproduced truncation probe accurately.
Injected post-commit service failure is not a native lost-COMMIT proof. A packaged
Linux stream test is not database recovery acceptance. Existing W3C web feedback
checks do not establish speech or physical-device acceptance.

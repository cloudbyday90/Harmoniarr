# Recovery CLI result delivery design

The October 21, 2026 round follows the operator lifecycle outcome. Database
commit, local stream handoff, pool shutdown and human receipt are different
boundaries. A committed arm must not be retried because later output or cleanup
failed. The code exists in plaintext only in the one arm result and its intended
output; status cannot reproduce it.

## Design and tradeoffs

| Choice | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Await the one write callback, set `process.exitCode`, let owned cleanup finish | Avoids forced-exit truncation; supports native pipe failures | A stalled destination or unreleased native handle can hold the CLI open; callback completion cannot prove human receipt | Adopt |
| Deliver the committed result before closing the pool | Cleanup failure cannot suppress the only code | A delivered success record can be followed by cleanup diagnostics and a nonzero exit | Adopt and document |
| Execute once, keep ordered private failures, bounded stderr diagnostics | Primary Error/null survives secondary output/cleanup failures; no secret replay | Internal callers must inspect the returned outcome; closed stderr cannot receive guidance | Adopt |
| Persist or replay plaintext codes, automatically re-arm | Convenient retry | Extends secret retention and can invalidate material after an uncertain outcome | Reject |
| Add a durable encrypted delivery protocol | Could support explicit resumable receipt | New storage/key/acknowledgement lifecycle and larger attack surface | Defer without a demonstrated need |

The final stack is native Node Writable callbacks and graceful exit policy;
small ESM command runtime and presentation modules; existing transactional
recovery services/PostgreSQL uniqueness; bounded OWASP-oriented diagnostics;
and boundary-specific native tests. No new framework or production dependency.

## Owners and behavior

`cli-output.js` owns one borrowed stream write. It observes callback failure,
error and premature close, including an already closed destination. It retains
its own error listener through Node's callback-before-error ordering and removes
only its listeners. It neither ends nor destroys stdout/stderr. A single record
needs callback completion; `drain` controls admission of additional records and
is not a receipt acknowledgement.

`cli-runtime.js` preserves existing exit codes 0–4 and JSON envelope shape.
Expected error codes select fixed messages; unexpected failures become a bounded
uncertain-outcome message. It never publishes raw Error messages/stacks or arbitrary
codes. The writer awaits handoff and uses graceful exit status. CLI dispatch
awaits help/refusal output and refuses inherited object-property command names.

`recovery-command-runtime.js` calls the service once, attempts one result record,
then attempts cleanup exactly once, even if output failed. A failed write is not
followed by a second stdout envelope. Secondary failure receives one bounded
stderr diagnostic; failure of that diagnostic is retained privately without
another attempt. The outcome reports operation success, output handoff, exit code
and ordered `{stage, error}` failures, retaining exact Error/null identities.
It does not return the service result or recovery material again.

`recovery-command-output.js` owns text/JSON presentation. Status uses an explicit
field projection so a future service field cannot accidentally publish secrets.
The command adapter parses options inside the managed lifetime; malformed TTL,
unsafe integer and unexpected positional/option input refuse before service work.
Existing numeric TTL clamping to 5–30 minutes remains service policy.

If the service returned success but output failed, the diagnostic says the
command completed and delivery may be incomplete. Cleanup failure after success
retains that success record and adds stderr guidance; exit is 1. An existing
business refusal retains its exit code through secondary failures. Unexpected
service failure is conservatively unconfirmed, including a possible commit
acknowledgement loss. No rollback, cancel, replay or automatic retry is inferred.

## Acceptance and limits

Qualify held callback/backpressure, Error/null, native error-event order, premature
close, exactly-once execution/cleanup, bounded diagnostics and actual child-process
stdio closure/exit. Use disposable PostgreSQL for committed state and actual CLI
entrypoint proof. A simulated post-commit service acknowledgement failure is
distinct from a real lost PostgreSQL COMMIT acknowledgement.

Preserved Docker validation rebuilds without cache, compares packaged bytes and
keeps the existing admin/data. It must not arm recovery there. Re-run only the
owning native consumers and one stable fast gate; no exhaustive unchanged UI
matrix, release or timing-policy change is needed. Human receipt, crash during
commit, failed native pool shutdown, indefinitely stalled streams and physical assistive technology remain
outside this qualification. See [research](RECOVERY_CLI_DELIVERY_RESEARCH_2026_10.md)
and the [outcome](RECOVERY_CLI_DELIVERY_OUTCOME.md).

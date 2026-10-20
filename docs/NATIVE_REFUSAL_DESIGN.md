# Native retry exhaustion and size refusal design

October 20, 2026. Add a separate opt-in refusal lane around actual slskd 0.26.1,
using unchanged native defaults. Keep application admission, native attempts,
terminal failure, task retirement and final files as distinct evidence.

For exhaustion, send an EOF one byte before the declared end. Admit two more
native requests with fresh one-use tokens, verify their offsets against the
actual incomplete prefix, and close without sending the missing byte. Require
three total attempts and a failed receipt; do not permit a fourth invocation.

For changed size, first terminate a real partial payload with TCP reset. On the
second request advertise a size one byte larger than the original declaration.
Require native size-mismatch evidence, two total attempts and no second file
connection. The released client checks the new size before opening that
connection, and the provider excludes this exception from retries.

Keep one application POST per scenario, stable batch/receipt identity and
GET-only recovery after a controlled completed-response loss. Existing failure
classification must remain failed, with no progressed-success evidence.
Record observed states without requiring every transient state to be polled.

Bound tokens and request counts per declared file; admit the next request only
after the previous send and actual socket close. Split policy, peer, send,
application client and final inspection into narrow ESM modules. Preserve
original cancellation Error/null through admitted prefix reads and EOF callbacks.

Retire native tasks and acknowledge the exact stopped provider before checking
empty completed storage and exactly two bounded hashed prefixes in incomplete
storage. Retain separate read-only inspector mounts, two 4 MiB tmpfs volumes,
internal networking, no ports, non-root/read-only execution and strict cleanup.

Run focused capability/offset/cancellation controls, the actual refusal lane,
affected native regressions and one frozen fast gate. This is not same-size
remote-content authentication, music decoding, library import or every possible
retry-failure combination. No release, PR merge or new application branch.

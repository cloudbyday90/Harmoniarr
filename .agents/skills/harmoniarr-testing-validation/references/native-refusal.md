# Native exhaustion and changed-size refusal

Use validate:native-slskd-refusal with the reviewed provider image. Read
docs/NATIVE_REFUSAL_DESIGN.md and its outcome. Successful resume and single-fault
isolation retain their own lanes.

- Discover the released exception and retry owners, then verify effective native
  options. A default attempt cap is not an instruction to retry every exception.
  Size-mismatch refusal before file connection differs from repeated EOF.
- Bound requests and one-use tokens per declared file. Require previous send and
  actual socket close before subsequent requests. Failed size negotiation must
  never grant a file capability; refuse extra attempts, replays and wrong offsets.
- Verify the actual incomplete prefix before a repeated EOF. Sending none of the
  missing byte is intentional failure, not a successful zero-byte range send.
  Preserve Error/null while draining admitted reads and EOF callbacks.
- Require actual attempt counts, exact receipt identity, failed classification,
  exception evidence and no progressed-success recovery. Lose a completed HTTP
  response and use GET without another application POST.
- Record observed transient states without requiring every state to be polled.
  Retire native tasks and acknowledge provider shutdown before empty completed
  storage and exact hashed incomplete prefixes with stable filesystem identity.
- Keep native lanes opt-in and validate affected owners once on frozen code.
  Current proof does not authenticate same-size changed remote content or
  establish music decoding, library import or all possible retry failures.

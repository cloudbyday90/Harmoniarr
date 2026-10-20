# Native retry and resume design

October 20, 2026. Extend the isolated native fixture with a separate opt-in
resume lane, preserving the existing zero-offset refusal in other modes.
Use actual slskd 0.26.1 defaults: three total attempts, resume partial files,
5,000 ms configured base delay and 60,000 ms configured maximum. Do not override
these values. The released first-retry calculation has zero fixed delay plus
0..4,999 ms jitter; a five-second minimum is not part of the contract.
Require success on the second native invocation after a one-byte-short EOF or
TCP reset; reject an unexpected third invocation at the fixture boundary.

Keep one application POST and the same durable attempt/batch/receipt identity.
Lose the completed HTTP response in the reset scenario and reconcile through
GET only. Record native local requeue when polling observes it without requiring
every transient state to remain visible. Two native attempts, the verified
nonzero offset and final hashes establish retry; do not turn an intermediate
state into terminal failure or issue another application command.

Give each negotiated token one transfer connection. A second request for the
same declared file requires the first send and actual socket close; reject old
tokens, extra attempts, malformed offsets and offsets outside the declared
partial prefix. On the second connection inspect the actual incomplete prefix
through the read-only mount, require its size to equal the requested offset,
then send only deterministic bytes from that offset to the declared end.

Retire native tasks, stop and acknowledge the provider, then verify exact final
trees: both full files in completed storage, no incomplete payloads, stable
descriptor/path identity, complete hashes and actual bounded tmpfs capacity.
Retain internal networking, no ports, non-root/read-only execution and strict
disposable resource cleanup. Split policy, peer, sender, application client and
inspection into small ESM modules.

Use focused parser/capability/range/cancellation controls before native execution,
then one frozen fast gate and affected existing native regressions. This proves
controlled unchanged-source retry/resume, not adversarial remote content identity,
music decoding, library import or every default retry/exhaustion combination.

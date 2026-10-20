# Native default retries and resume

Use validate:native-slskd-resume for unchanged-source EOF/RST recovery with actual
provider defaults. Read docs/NATIVE_RESUME_DESIGN.md and its outcome. Single-fault
isolation remains in native-partial-transfer.md.

- Discover the released retry loop and effective native options. Total attempts,
  native transfer retries and application POST retries have different owners.
  Keep provider defaults unchanged when claiming default qualification.
- Bound per-file invocations and token capabilities. Require the first send and
  actual socket close before admitting the second request; refuse replay, extra
  attempts and nonzero offsets outside the explicit resume mode.
- Inspect the actual incomplete prefix before sending a suffix. Require exact
  offset/length and hash evidence, then send deterministic bytes only from that
  offset. A local callback or unchanged declared size cannot authenticate the
  original remote source.
- Record local requeue when observed and require final success with stable
  batch/receipt identity. Released jitter can make intermediate states too brief
  to poll; native attempts and verified offsets own retry proof.
  Normalize optional API fields at their owning boundary; a raw omitted exception
  is not a normalized bound-transfer null. Retain failed harness evidence.
- Lose one completed HTTP response and recover through GET. Provider retry
  success must not cause a second application POST.
- Keep scenario commands within the existing command lifetime bound. Retire
  native tasks and acknowledge stopped provider identity before exact final
  complete/incomplete trees, descriptor/path identities and full hashes.
- Report default configuration and second-attempt success separately from retry
  exhaustion, hostile source changes, music decoding and library import. Select
  affected native lanes and one frozen fast gate; avoid unrelated long suites.

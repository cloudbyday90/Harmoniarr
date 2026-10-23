# Artwork rewrite phase deadline outcome

Completed October 23, 2026. See separate [design](ARTWORK_REWRITE_DEADLINE_DESIGN.md),
[official research](MEDIA_COMMAND_ADMISSION_RESEARCH.md) and
[combined qualification](MEDIA_COMMAND_ADMISSION_OUTCOME.md).

The rewrite phase now allows ten seconds instead of three. The parent-owned
15-second whole-child deadline, three-second best-effort statistics phase,
single-thread Sharp, disabled native cache, 1 GiB DATA allocation limit and all
count/reservation/input/output/pixel controls remain unchanged. No operator setting
or second deployed service was added. More CPU can be spent rewriting before
phase refusal, while the existing whole-child kill/close boundary still applies.

The first combined 3 GiB qualification passed three of four cases; the concurrent
case failed with a generic artwork worker error. A selected diagnostic repetition
also failed and recorded one exit-1 child with 114 output bytes, another normal
child, and zero OOM kills. A separate private instrumented control reproduced a
native rewrite timeout at **3,238 ms**, also with zero OOM kills. That observation
classifies the control; it does not establish the exact cause of every earlier
generic failure. Failed logs and exact container retirement records were retained.
No production raw vendor errors, paths or stderr dumps were added.

After the runtime correction, complete fast validation passed again. The final
no-cache image is
`sha256:2cf5917edef018c3b4629b39d9ce7427a2bc5b84a4817515e003c294f4e3ad36`.
Against it:

- Seven native lifecycle cases passed, including maximum input/pixels, real
  cancellation/hang/crash retirement and parent publication ownership.
- Seven corpus cases passed under the separate one-CPU/1 GiB profile.
- Four allocation/reservation cases passed under the separate two-CPU/3 GiB
  profile, including actual native allocation refusal, exact hashes and held
  publication. Neither allowance nor a kill request releases capacity early.

These overlapping scopes are not unique tests to sum with other lanes. Owned
containers were removed with absence verified. Final shared-container results and
remaining deployment-sizing limits belong to the combined outcome. This correction
does not guarantee every maximum image finishes under arbitrary CPU contention.

# Mixed review/media resource qualification

Use for review-request memory/latency measurements alongside media work. Read
active-repo docs/DEPLOYMENT_REVIEW_MEMORY_DESIGN.md, research and outcome. Reuse
the existing deployment/media memory owners rather than introducing another app.

1. Require the declared disposable native profile before acquiring a pool. Verify
   finite cgroup memory/swap/CPU/PID controls, tmpfs data, no published ports/network
   and PostgreSQL/process cgroup identity. Use a fresh container per profile.
2. `createApp` returns a composition wrapper: bind its `application.app` Express
   listener. Prepare actual authentication and bounded synthetic review state
   before media launch. Synthetic stop evidence is not measured provider audio.
3. Use real detail GET, CSRF restart POST, queue claims, lease ownership and current
   completion. Only the owned pending run's retry timestamp is a fixture control.
   Verify corpus counts, checking → queued, one intent/audit and final lease release.
4. Prove a completed detail response overlaps scan and a spawned encoder's lifetime.
   Adjacent tasks/probe activity do not certify it. Keep actual media arguments,
   artwork admission, source-hash preservation and real process/stdio retirement.
5. Record bounded fixed-label operation durations separately from cgroup current/
   lifetime peak, process RSS/heap/external/ArrayBuffers and logical reservations.
   Kernel peak includes initialization/setup; v1 usage is approximate. Do not add
   overlapping categories or infer an SLO, causal increment or deployment minimum.
6. Drain both concurrent owners after first failure; retain Error/null through
   timing/cleanup errors and attempt every cleanup. Close the actual HTTP listener,
   log out, drain workers/native children and verify exact container retirement.
   Keep evidence numeric and omit session/credential/path/metadata/process dumps.
7. Run focused observer/concurrency/memory checks and the native entry on fresh
   2/3 GiB profiles. Keep it outside the fast gate. Retain unrelated native/browser/
   SQL evidence only after exact source/test/runtime comparison. Current fixture
   profiles establish selected workload evidence, not the entire periodic app.

Use the measurements to choose a specific next control only when they demonstrate
a problem. Otherwise retain built-in limits and broaden the workload deliberately.

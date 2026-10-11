# Import execution lifetime design

October 11, 2026. The execution worker currently clears its active marker before
awaiting lease release and launches an unobserved microtask. Terminal run status
and provider acceptance are earlier boundaries than actual local completion.

## Selected design

Reuse the existing ESM worker task lifecycle, cleanup precedence, advisory task
owner and lease drainage. Start remains a queued acknowledgement containing a
`completion` promise. Duplicate run IDs share it through every finalizer. Terminal
`close()` seals admission synchronously, drains admitted runs and retains escaped
failures, including null. Expected lease-unavailable and lease-lost outcomes retain
their existing policy; unexpected acquisition failures become observable.

Own returned provider preparation, enqueue, confirmation and persistence promises
through the existing awaited execution body. Own returned best-effort Activity
fanout without promoting its failures to domain failure. Drain admitted heartbeat
renewals before releasing the captured lease; attempt release even if drainage
fails. Preserve an escaped work failure over cleanup fallout.

Application and both app fixtures capture the concrete execution, apply and scan
owners before awaiting. Drain execution, then apply, then scan, attempting all
three even after failure. Only apply has a verified direct child-scan launch;
execution ordering is conservative and does not assert a direct apply launch.
HTTP closure and dispatcher drainage retain their existing upstream ordering.

Standalone handoff/recovery fixtures register actual execution completion before
launch, await it beyond callback observation and preserve callback-observer error
policy. The pre-provider native helper awaits the real handle directly. No polling
or longer sleeps establish execution completion.

## Alternatives and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Reuse existing lifecycle and captured owners | Consistent failure/coalescing policy; small services | Close can wait for a genuinely unfinished dependency; selected |
| Await queued start until the job ends | Simpler caller shape | Breaks acceptance semantics and dispatcher scheduling; rejected |
| Delay teardown or clear markers at terminal status | Small edit | Cannot prove completion or prevent cleanup overlap; rejected |
| Abort provider requests during close | Potentially shorter wait | Does not establish whether a POST was applied; separate protocol design required |
| Replace every platform worker at once | Wider ownership | Large unverified surface; defer to evidence-driven slices |

## Validation and limits

First retain a controlled duplicate-run failure while release is held. Gate
provider, Activity, heartbeat and release separately; verify canonical handles,
late admission, expected skips and Error/null precedence. Exercise both app fixture
entrypoints with real PostgreSQL and held finalization, plus existing handoff,
refusal and recovery suites. Run the complete fast gate and affected native scope
once source is frozen. Keep original timeouts and assertions.

Completion covers local returned work, not remote download completion, hidden
callbacks or other platform workers. Retain the residual app-fixture delay. This
does not diagnose historical SQL resets, certify security/WCAG conformance or claim
an exhaustive-test speedup. No schema, route, provider retry, branch or release
change is intended. See [official research](IMPORT_EXECUTION_LIFETIME_RESEARCH_2026_10.md).

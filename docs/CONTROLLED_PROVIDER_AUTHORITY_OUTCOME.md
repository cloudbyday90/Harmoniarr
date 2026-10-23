# Controlled provider authority outcome

Date: 2026-10-23. Implements the next item from [candidate reputation](CANDIDATE_REPUTATION_OUTCOME.md).
See the separate [design](CONTROLLED_PROVIDER_AUTHORITY_DESIGN.md), [official-source research and tradeoffs](CONTROLLED_PROVIDER_AUTHORITY_RESEARCH.md) and [local Docker outcome](LOCAL_DOCKER_CONTROLLED_AUTHORITY_OUTCOME.md).

## Result

Restored the complete controlled-provider pipeline with current application-derived acquisition authority. Small ESM modules now create metadata inputs, save explicit operator preferences/monitoring, derive wanted releases and links through real reconciliation, drive saved worker scopes and qualify changed-source quality checks. The pipeline verifier shrank by roughly 250 lines. Production ownership and media-quality guards remain enabled.

The repaired fixture exposed a runtime gap at the saved rediscovery cap. Scoped recovery now saves blocked/download_recovery_exhausted in the same transaction as terminal history, attempt count, reputation and episode publication. A narrow exhaustion store requires the current search identity and cap. Rollback and replay retain coherent state; an already scheduled future search is preserved. Shared owners see the terminal stop and race through the existing single manual-restart command.

Strict preflight refusal and fresh worker refusal are separate evidence. Genuine limited-bandwidth FLAC first allocates no apply run. Valid disposable bytes then pass actual queue acceptance; rejected bytes are restored before the worker runs. The worker blocks them and exercises fallback or durable quality exhaustion. Source disappearance requires both import_blocked and source_path_unavailable. Strict shared discovery retains the lossless requirement and the sibling's 320 kbps floor; the search-exhaustion scenario uses two high-quality owners to avoid conflating search and lossless-review states.

## Executed validation

- Preserved the original first-download refusal on unchanged main 571a96b669d6ccd9b098e0d541db37c1f90bab78 and image bfd440e0ca5ae5e629d842f95853a36264e16f5cd2eee66a01c93cd92252b90b. The baseline verifier hash was b32636a6ec575578f0a3394814513f19fad728c316fe0a162d43917b7ec5e36b. Retained intermediate failures rather than converting them into passes.
- Focused driver/evidence tests: 11 passed. They preserve saved trigger, candidate/search scope, apply scope/safety mode, owned completion and Error/null refusal; incomplete/duplicated authority facts cannot qualify. Explicit final .mjs and affected-code lint passed.
- Full fast gate: 11,059 passed (5,889 server, 4,470 client, 700 script), with no failures, cancellations or skips; policy checks, lint and both builds passed. Later fixture refinements received explicit lint and packaged qualification; the final integration-local variable cleanup received lint and its 12-case transaction rerun.
- Affected PostgreSQL cohort: 39 passed across wanted reconciliation, scoped transactions, execution and discovery using one shared server. All 72 fixture registrations were released, none reaped. The final transaction file passed all 12 cases after its lint cleanup. Evidence covers exhaustion/replay, update and late-episode rollback, retained future reservations, changed recipients and current source/origin checks.
- Packaged PostgreSQL 18.6: 35 existing candidate/spectral reputation cases passed on final image 3525bafee1ec19d35e3b05db232252f63b3862e7a759ea03b5e9bad6ca3e7a03. Its disposable constrained container was retired.
- The complete controlled-provider pipeline passed all 12 aggregate facts on that final no-cache image: 17 catalog fixtures/20 catalog candidates, genuine add, failed-transfer and missing-source recovery, strict quality recovery/exhaustion, shared discovery/recovery/stop/restart and current authority. Three additional independently derived authority cases each first accepted real ingestion/download/apply queueing, then refused the actual apply worker after missing wanted ownership, account disablement or saved monitoring revocation. All applied counts and further transfer deltas were zero; library filenames and SHA-256 content inventories were unchanged.
- The separate packaged file-backed Music Queue verifier also passed on the same image, with its workspace and project resources absent afterward.

The controlled projects' containers, networks and volumes were absent after retirement. Final source fingerprint: 3,389 cohort files, 2e2cce2a04d0e771375260685af890ea7be2577e855e42b7813dd811891b2a5e. A separate manifest captures changed .mjs and script bytes because the cohort fingerprint does not cover every fixture extension. Private logs/manifests remain under .tmp/controlled-authority-2026-10-23/.

## Recommendation and limits

Adopt saved operator inputs, canonical reconciliation, preserved durable worker inputs, current transactional authority and distinct preflight/worker evidence. The benefit is realistic qualification and a coherent bounded stop without another application or runtime service. The cost is more deliberate fixture setup and one extra guarded exhaustion write under existing locks. The research document records alternatives and the final stack; the web-standards AI skill now routes to a practical fixture-authority reference, and the testing skill selects the relevant validation lanes.

These cases prove controlled HTTP/application composition and post-download apply refusal. Existing scoped execution PostgreSQL cases separately establish pre-provider refusal. They do not prove public-network discovery, native Soulseek wire behavior, general authorization completeness, accessibility conformance or a new memory-sizing result. SQL rollback cannot reverse completed file copies or remote transfers. Historical provenance cannot grant current authority.

GitHub MCP returned zero open PRs at initial selection and pre-publication recheck, so none was applicable for local implementation or stale-PR cleanup. Work stays on main, with no release, Git tag or version change.

Next: make initial preflight quality refusal a durable release-owned review outcome and expose it through Missing Music. Current code returns still_needs_review before an apply run exists; qualify the public projection and recovery action without weakening quality or inventing fallback consent. Afterward, measure trust snapshot rewrite cost/contention before choosing per-source persistence.

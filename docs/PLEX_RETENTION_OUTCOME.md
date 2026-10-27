# Automatic Plex callback retention outcome

October 27, 2026. Eligible abandoned Plex callback state is now removed
automatically by the existing application's maintenance infrastructure. No user
refresh, new endpoint, deployed service, dependency or schema artifact is added.
Work is on main using narrow ESM factories. See the separate
[official research and tradeoffs](PLEX_RETENTION_RESEARCH_2026_10.md) and
[implementation design](PLEX_RETENTION_DESIGN.md).

## Delivered behavior

The startup supervisor runs one bounded pass immediately and every five minutes.
The maintenance guard stabilizes the absence of a blocking maintenance lock
through the same transaction; a nonwaiting transaction advisory claim coordinates
retention owners. At most 100 canonical pending records are row-locked with
SKIP LOCKED. Only ciphertext up to 16 KiB is returned/decrypted. Other namespaces,
secret types and the persistent Plex client identifier remain excluded.

Database time and decrypted version-1 expiry govern ordinary eligibility, not
public metadata or row age. Unexpired payloads survive even with old timestamps
or misleading metadata. Legacy/malformed plaintext waits 24 hours after the later
of creation/update. Unknown explicit versions, unreadable/oversized ciphertext
and unusable row timestamps are retained. Decryption failure or unavailable key
material is not evidence of expiry.

Deletion rechecks every chosen threshold against database time, requires exact
cardinality and shares its bounded transaction/client with a required aggregate
audit. No state ID, browser verifier/hash, PIN, ciphertext, subject or token enters
the event or returned summary. Suppressed deletion or required audit rolls the
whole batch back. Concurrent replacement waits for the owned obsolete row, then
survives as new state. A valid prepared provider callback remains available for
its own existing single-use completion.

The private keyset cursor passes retained records and wraps after a short batch;
it advances only after acknowledged commit. There is no automatic catch-up loop
or automatic retry of a failed/uncertain commit. Busy/skipped rows are revisited
on later sweeps. Result expiry is distinct from actual connection retirement:
heartbeat admission and shutdown await `drained`, and uncertain retirement seals
future admission and refuses successful shutdown. The application drain helper
owns this component before shared pool consumers retire. Existing background-
disable controls apply to it.

## Frozen source and fast validation

Source fingerprint: **3,758 files**, SHA-256
`3242315a825672da932a1cea5f438309ff69c7090e37a45b814e697a20335ad9`.
Ten production/test files were frozen before final validation. Only documentation
was completed afterward; seven intended production paths comprise the change.

The focused command below passed **25 tests**, covering policy, SQL handoff,
progress, privacy, failure, drain and runtime composition alongside affected
callback-state/system/worker regressions:

```text
node --test test/server/plex-callback-retention.test.js test/server/plex-callback-state.test.js test/server/startup-runtime.test.js test/server/system-module.test.js test/server/worker-owner-drain.test.js
```

The final fourteen-stage fast gate passed: **6,306 server + 4,504 client + 703
script = 11,513 tests**, with zero failures/cancellations/skips. Server concurrency
was eight. Pinned local Node 24.22.1/npm 12.0.2 were used. Executed stages:

```text
npm run check:node-baseline
npm run check-copyright
npm run migration:check
npm run check:schema-snapshot
npm run check:schema-anchor-contract
npm run check:esm
npm run check:image-tags
npm run check:compose-topology
npm run lint
npm run check:test-hygiene
node --test --test-concurrency=8 test/server/**/*.test.js
node --test test/client/**/*.test.js
node --test test/scripts/**/*.test.js test/compose-image-tag-policy.test.js
npm run build
```

`npm audit` reported zero vulnerabilities. CRLF-aware whitespace checks passed.
An initial startup-unit expectation put shutdown entries in registration order;
it was corrected to match reverse supervisor shutdown. The first native preflight
reached the bootstrap step but omitted its required request metadata; that fixture
was corrected and its exact failed container retired. No production deadline or
security policy was relaxed.

## Packaged PostgreSQL qualification

The immutable-image retention entry passed **14 scenarios**: namespace/type and
client-identifier isolation; payload expiry versus conflicting metadata; legacy
grace; unknown/unreadable/oversized retention; private required audit; bounded
keyset progress/wrap; locked-row skip/revisit; nonwaiting competing claim; active
maintenance refusal; maintenance INSERT exclusion until delete/audit commit;
audit rollback and explicit retry; suppressed DELETE/audit; concurrent replacement
survival; real commit with controlled acknowledgement loss; timed rollback with
actual backend absence; active prepared provider completion; and actual runtime
registration, automatic start and owned shutdown. These are fourteen grouped
scenarios, with several assertions per scenario.

Affected callback and linked-login native entries passed their **19 and 23**
scenarios respectively: **56 scenario executions** across three fresh entries.
Each used the immutable packaged implementation at 3 GiB and exited zero, then
was removed with absence verified. No final run overlaid application binaries.
The [Docker outcome](LOCAL_DOCKER_PLEX_RETENTION_OUTCOME.md) records exact image,
runtime parity, preserved mounts/admin, live browser checks and cleanup.

## Recommendation and limits

Use the implemented stack: existing runner/supervisor, maintenance guard, bounded
transaction and nonwaiting owner claim, bounded encrypted-envelope classification,
threshold-checked deletion and required aggregate audit, with actual drainage.
It reduces obsolete retained login material and preserves tested active flows.
The cost is bounded SQL/crypto per tick and gradual catch-up rather than immediate
full-table disposal. It intentionally retains formats it cannot safely interpret.

The batch limit bounds returned/decrypted rows, not physical scan pages. Existing
SQL deadlines bound an expensive scan; backlog, downtime, maintenance locks,
continuous updates or restart can delay disposal. Cursor progress is process-local
and resets on restart. Unknown versions/unreadable ciphertext need a separately
reviewed policy. This is not secure erasure of historical backups or old audit
records, a hard maximum-retention SLA, or privileged database-tampering protection.
Provider HTTP resource limits and callback-time expiry remain separate boundaries.

GitHub MCP checks returned no open PRs, including Dependabot PRs. None could be
randomly selected/applied, rebased or closed, and none was merged. No release,
tag or separate branch is created. The
[Docker outcome](LOCAL_DOCKER_PLEX_RETENTION_OUTCOME.md) owns packaged regression,
deployment, retained evidence and cleanup details.

**Next item:** bound Plex provider HTTP elapsed time and response body size, retain
ownership through actual completion/drain, and qualify slow/oversized/truncated
responses. State expiry and SQL admission alone do not bound provider work.

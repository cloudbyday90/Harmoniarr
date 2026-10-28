# Provider callback feedback Docker outcome

October 28, 2026. See [qualification design](LOCAL_DOCKER_PROVIDER_CALLBACK_FEEDBACK_DESIGN.md)
and [implementation outcome](PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).

## Packaged candidate and preserved state

The healthy walkthrough at http://127.0.0.1:47956 runs immutable image
`sha256:f520e5512f14a5eef24925191e47659942fae88558d6935fad1ad98ba0b92fca`.
Its disposable pull/no-cache builder was removed. Existing administrator and all
five actual bind sources were preserved. Read-only Linux x64 UID 1000, health and
the packaged readiness command passed. Bootstrap was retired and temporary
password material removed. Startup verified 115 applied migrations, zero pending
and zero newly applied. No schema refresh or additional deployed service.

Compared with prior image
`sha256:5aad74f6fe9808a34fdb38d127bc9e8d67ad9ff157fe2a0f57445c17f4729de9`,
all 1,059 server and 13 shared files retain byte/mode identity. The new client
build has 157 files; 57 differ through the new component and hashed chunk links.
Every packaged client file matches the local production build. Root metadata,
all 110 npm and 151 OS package entries and Node binary identity are unchanged:
Node 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and Undici 7.30.1. No release artifacts.

Final qualification freezes 3,828 source files at
`7e8b85322812915f7607e0cf8f0e4380260949ba17b2f17bbdcf66cc08693393`.
The eight changed code files include four production client files and four test/
browser-support files. No server, shared, native test, schema or dependency files
changed. Documentation edits do not alter the frozen code fingerprint.

## Evidence and limits

Private evidence is under `.tmp/provider-callback-feedback-2026-10-28/`:

| Evidence | Result |
| --- | --- |
| `fast-final/gate-result.json` | All 14 stages passed, 11,684 tests with zero skips. |
| `focused-final.log` | 76 focused tests passed; these are a subset, not additional full-gate totals. |
| `browser-final.log` | Four canonical browser tests passed, zero skips, covering callback feedback and existing Connections admission. |
| `browser-result.json`, six PNGs | Thirteen walkthrough groups, including three actual callbacks/fresh reads and nine controlled groups; no mutation, unchanged settings/secret status, preserved focus/guards, safe query cleanup and no overflow/page errors. Six images visually checked. |
| `runtime-comparison.json`, before/after inventories | Exact unchanged backend/dependency identity and current client/build comparison. |
| `retained-native.json` | Existing 30 callback-output, 80 OAuth-owner and 33 Plex-owner groups retained from the prior image; three test files match committed source hashes and prior helper retirement records. |
| `before-mounts.json`, `after-mounts.json`, `walkthrough-result.json` | Five bind identities preserved, existing administrator, final healthy image, read-only UID 1000 and readiness. |
| `entrypoint-identity.json` | Before/after entrypoint matches current source/mode; helpers retired. |
| `data-bind-probe.json` | Packaged data-bind creation/sync/publication, collision preservation and owned probe cleanup passed. |

The canonical browser uses disposable app/PostgreSQL fixtures and current built
assets. Status failures and saved present/absent/unavailable outcomes are controlled
browser replies. The walkthrough separately exercises actual missing-binding
callback redirects, fresh saved-status responses, no-store/no-referrer and normal
Connections navigation. No live provider authorization code or account flow is
used. No operator configuration is saved or cleared, and no linking POST is sent.

The earlier browser preflight exited normally with zero skips, with a delay
between scenario/suite completion and overall exit. The final canonical command
also exited normally. These timings do not establish their cause or complete
application drainage. The initial partial fast gate stopped at a helper promise
lint rule; its log remains alongside the later complete frozen passing gate.
Only final evidence qualifies the implementation.

Native callback/state/session/PKCE/transaction/publication behavior is unchanged
and retained after exact server/shared/package/test comparison. The prior 143
groups were not rerun and are not counted as fresh tests for this client change.
Unchanged SQL/media/memory/provider-transport matrices also retain earlier scope;
no memory minimum, live-provider success, full quiescence or complete conformance
claim follows. Spoken assistive-technology and physical-device acceptance remain
user-deferred. The next item is guarded pending ownership for existing connection
mutations, as described in the [implementation outcome](PROVIDER_CALLBACK_FEEDBACK_OUTCOME.md).

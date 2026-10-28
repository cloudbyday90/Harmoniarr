# Provider callback error Docker outcome

October 28, 2026. See the separate [qualification design](LOCAL_DOCKER_PROVIDER_CALLBACK_ERRORS_DESIGN.md)
and [implementation outcome](PROVIDER_CALLBACK_ERRORS_OUTCOME.md).

## Packaged runtime

The preserved walkthrough at http://127.0.0.1:47956 is healthy on immutable image
`sha256:5aad74f6fe9808a34fdb38d127bc9e8d67ad9ff157fe2a0f57445c17f4729de9`.
The disposable pull/no-cache builder was removed. Existing administrator and all
five bind sources were preserved. Read-only Linux x64 UID 1000, health and the
packaged readiness command passed; bootstrap was retired and temporary password
material removed. Startup verified 115 applied migrations, zero pending and zero
newly applied. There is no schema refresh, release or additional deployed service.

Compared with prior image
`sha256:2cc06bb8d11a3875b586dbd7d1db8deafee4ea7171d85b4cf677c29880ccfd96`,
only the callback policy and provider route adapter differ in packaged server
files. All other server/shared files and modes retain identity. All 156 client
files are byte-identical and match the local production build. The inventory has
1,059 server and 13 shared files. Root metadata, all 110 npm and 151 OS package
entries and the Node binary hash are unchanged: Node 24.22.1, npm 12.0.2,
OpenSSL 3.5.9, Undici 7.30.1. No dependency changes or release artifacts are added.

## Executed evidence

Private evidence is under `.tmp/provider-callback-errors-2026-10-28/`:

| Evidence | Result |
| --- | --- |
| `fast/gate-result.json`, `focused-final.log` | All 14 fast stages passed, 11,668 tests; 62 focused tests are a subset, not additional totals. Zero skips. |
| `verified-callbacks-result.json` | One native test, 30 callback-output groups, zero private diagnostic reads, exact redirect policies and unchanged settings/secrets/settings audit/operations. |
| `final-oauth-result.json`, `final-plex-result.json` | Two native tests, 80 OAuth and 33 Plex ownership groups using real stores and controlled providers. |
| Matching retirement records | All three final native helpers removed and absence verified. |
| `runtime-comparison.json`, before/after inventories | Exact runtime/source/build/package comparison described above. |
| `before-mounts.json`, `after-mounts.json`, `walkthrough-result.json` | Five bind identities and existing administrator preserved; read-only UID, readiness and healthy final image verified. |
| `entrypoint-identity.json` | Before/after entrypoint bytes/mode match current source; helpers retired. |
| `data-bind-probe.json` | Packaged data-bind directory/file creation, sync, publication, collision preservation and owned cleanup passed. |
| `browser-result.json` | Chromium 156.0.8078.4: six actual callback navigation groups, bounded same-origin settings landing, no-store/no-referrer, unchanged operator settings, no mutation requests or page errors. |
| `retained-runtime.json` | Exact post-gate native-fixture header correction; unchanged production/fast-gate-test hashes and passing current native entry. |

All final native entries ran on the exact immutable image, with no server/client
overlays, no external network or published ports, fresh database/media tmpfs,
read-only UID 1000, two CPUs and 3 GiB memory with equal swap. Tests are mounted
read-only; the packaged implementation is imported from server-dist. The callback
fault test injects completion failures through existing provider module composition
and does not attempt actual token publication. Existing OAuth/Plex entries
separately qualify real state/session/expiry checks and atomic credential writes.
Their provider responses are controlled, not live account acceptance.

The full fast gate froze 3,821 source files at
`bc95131987f8a6cd50541dce85be68f0c9cc959c1fd3a88e4657c80478b32aad`.
The first callback native fixture failed on the existing API Accept admission
before reaching completion. Correcting only its Accept header to match browser
negotiation yields qualified fingerprint
`1680d0d12eb16aced1e63eb65ba44d1d9da21201d0850ca3ad4ad69f478bad89`.
Reversing that single header change reproduces its original frozen file hash;
all other four changed code files remain byte-identical. Corrected native tests,
lint and hygiene passed. The unchanged full fast gate and runtime are retained.
The failed native log and exact helper absence record remain private and are not
passing evidence or a PostgreSQL outage diagnosis.

Unchanged SQL/media/provider transport evidence is retained after exact source,
test and package comparison; those matrices were not rerun. This qualification
does not establish minimum RAM, a complete native matrix, full application
quiescence, live provider success or manual assistive-technology/device acceptance.
The next item is safe callback recovery feedback in the existing settings UI,
as detailed in the [implementation outcome](PROVIDER_CALLBACK_ERRORS_OUTCOME.md).

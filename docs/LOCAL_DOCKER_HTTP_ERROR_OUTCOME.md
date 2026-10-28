# HTTP error Docker qualification outcome

October 28, 2026. See the separate [Docker design](LOCAL_DOCKER_HTTP_ERROR_DESIGN.md)
and [implementation outcome](HTTP_ERROR_OUTCOME.md).

## Current local image

Fresh pull/no-cache build through a disposable BuildKit builder:

```text
before sha256:9d0076654a1b32bbd4b7aefbe749d38eb41c0e68b6f172a6aed84b02ed5bfe10
after  sha256:6ba2e8c275b5dd0f4822eecd2858e9b9f2617c4a378392bc73bef15835799f5f
```

The existing walkthrough is healthy at http://127.0.0.1:47956 with its administrator
and all five actual bind sources preserved, including the downloads override.
The root remains read-only; the app runs as UID 1000. Startup applied zero
migrations and verified 115 applied, zero pending. Readiness passed; the
disposable bootstrap helper and temporary password file were removed.

Packaged comparison found exactly the 27 intended server changes: API factory,
app adapter, new response module and 24 legacy-constructor files. All other server
bytes and every client/shared byte match the preceding image. Final counts are
1,057 server, 156 client and 13 shared files. All 110 npm and 151 OS packages
match. Node binary/runtime remains 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and Undici
7.30.1. Image root metadata and local build/source match.

## Executed scope

Frozen source contains 3,812 files, SHA-256:

```text
52ca83e91f796dae6637cb30270dd8afa8fb2ed8bc1540a918ce910692f4c761
```

One complete fast gate passed 11,639 tests across all 14 selected check/test/build
stages. Three final native entries use immutable packaged application code
without a server/client overlay: HTTP errors (20 scenario groups), provider status
(14) and encrypted credential saves (11). Each is one Node test, not an additional
test per scenario group. All pass with zero failures/skips/cancellations.

Every native entry uses fresh disposable database/media tmpfs, no external
network or published ports, read-only UID 1000, two CPUs, 3 GiB memory and equal
memory/swap limits. Exact containers were removed and absence verified. The
native HTTP entry observes its own terminated PostgreSQL backend's real query
failure, end and absence before returning a bounded response. It does not stop
the database server or interfere with unrelated containers. See the implementation
outcome for attribution, rejected-write and earlier failed-fixture limits.

Five browser groups passed on Chromium 156.0.8078.4. Actual field validation
returned its useful 400/no-store response. Browser-local generic 500 overlays
exercised settings-load and saved-status feedback; actual reload/refresh recovered.
Settings/secret-status snapshots stayed equal, no settings mutation was attempted,
and no page errors occurred. Four desktop/mobile screenshots were visually
checked; status refresh retained focus and neither view overflowed. These
controlled responses are not claims of actual production/provider faults.

Automatic schema diagnostics loaded once when opened, reported 164 current
anchors with no-store and exposed no manual schema-refresh button. Focus/mobile
checks passed. Packaged entrypoint identity and owned data-bind publication/
directory-sync checks passed; probe files were removed. Build/inspection helpers
were retired. No additional deployed app was created.

Existing domain/worker tests ran in the fast gate. Unchanged SQL, worker/media and
provider transport qualification is retained after reviewing the constructor-only
changes and exact unchanged stores, policies, runtime dependencies and packaging.
The shared Error return and internal fields remain compatible; this does not
constitute a new complete worker/native/database matrix. No memory minimum,
live account, spoken assistive-technology or physical-device result is inferred.
Earlier unexplained linked-login evidence and user-deferred manual checks remain
separate.

Private hashes, logs, native retirement records and screenshots stay under
`.tmp/http-errors-2026-10-28/`. The final audit binds reviewed file bytes to the
source gate and image. Main is the implementation branch; no release/tag, PR
merge or release-workflow dispatch is included.

# Provider status Docker qualification outcome

October 28, 2026. See the separate [Docker design](LOCAL_DOCKER_PROVIDER_STATUS_DESIGN.md)
and [implementation outcome](PROVIDER_STATUS_OUTCOME.md).

## Current local image

Fresh pull/no-cache build through a disposable BuildKit builder:

```text
before sha256:478590cadb1a2bed1dd4354e486877f6b5a6e4c374aa9dd86966b4e3c3f02ef1
after  sha256:9d0076654a1b32bbd4b7aefbe749d38eb41c0e68b6f172a6aed84b02ed5bfe10
```

The existing walkthrough is healthy at http://127.0.0.1:47956. Its administrator
and all five actual bind sources are preserved, including the downloads override.
The root remains read-only and the app runs as UID 1000. Startup verified 115
applied migrations and zero pending, applying zero changes. Readiness passed;
the disposable bootstrap helper and temporary password file were removed.

Exact packaged comparison found only four server changes: the new aggregate,
provider module, provider route adapter and system overview service. All other
server/shared bytes and all client bytes match the preceding image. Final counts:
1,056 server, 156 client and 13 shared files. All 110 npm packages and 151 OS
packages match; Node binary/runtime remains 24.22.1, npm 12.0.2, OpenSSL 3.5.9 and
Undici 7.30.1. Image root metadata and current local build/source match.

## Executed scope

The frozen source manifest contains 3,808 files, SHA-256:

```text
5bf917b248444923ebf50c0fd2aea1468601478fdc91a30e314861cab15c8ec7
```

The full fast gate passed 11,630 tests plus all 14 selected checks/build stages.
Each final native entry used the immutable image without a server/client overlay,
fresh disposable PostgreSQL/media tmpfs, no external network or published ports,
read-only UID 1000, two CPUs, 3 GiB memory and equal memory/swap limits. Both entries
passed with zero failures/skips/cancellations: aggregation has 14 scenario groups;
Apple status has 18. Their exact containers were removed and absence verified.
See the implementation outcome for actual corruption, injected reader failure
and owned native PostgreSQL error attribution; scenario groups are not additional
Node test counts or live-provider acceptance.

The preserved administrator's browser passed four provider-status groups on
Chromium 156.0.8078.4. The actual Apple state was incomplete. Controlled partial
responses were browser-local overlays; they made no settings writes and do not
represent live provider faults. Four desktop/mobile screenshots were visually
checked, with no clipping, preserved refresh focus and zero page errors. Actual
status recovery and unchanged operator settings/secret-status snapshots passed.

Automatic schema diagnostics still loaded once when diagnostics opened, reported
164 current anchors with no-store, and exposed no manual schema-refresh button.
Focus/mobile overflow checks passed. Packaged entrypoint identity and the owned
data-bind publication/directory-sync probe passed; its probe files were removed.
The build/inspection helpers were retired. No additional deployed app was added.

Unrelated signing, provider HTTPS, credential-save, OAuth/Plex/session and media
qualification is retained after exact unchanged source/test/packaged-runtime
comparison. The affected provider/Apple status native entries were rerun. Earlier
unexplained linked-login evidence remains separate. No whole-app drainage,
deployment memory minimum, live account/provider acceptance, spoken assistive
technology or physical-device result is claimed. User-deferred manual checks
remain deferred.

Private logs, hashes, native retirement records and screenshots are retained under
`.tmp/provider-status-2026-10-28/`. The final audit binds changed file bytes to the
source gate and image. Main is the only implementation branch; no release/tag,
PR merge or release-workflow dispatch is included.

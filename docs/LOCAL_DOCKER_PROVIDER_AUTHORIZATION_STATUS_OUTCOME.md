# Saved authorization status Docker outcome

October 28, 2026. See separate [Docker design](LOCAL_DOCKER_PROVIDER_AUTHORIZATION_STATUS_DESIGN.md),
[implementation outcome](PROVIDER_AUTHORIZATION_STATUS_OUTCOME.md) and
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

## Current deployment

The preserved walkthrough is healthy at `http://127.0.0.1:47956` on image
`sha256:bade151158eef3d65bbdaa540080b6cb68e5aa95437bde02afe9087756c87f66`.
Its preceding image was
`sha256:0800bfe75f9e76f9dbebd8676b3816510e6ae5cf2314f52ab4a3afd29774a6af`.

The first fresh pull/no-cache build failed before compilation while Docker DNS
could not resolve production.cloudfront.docker.com for the Dockerfile frontend.
Its owned builder was removed and absence verified. Windows host DNS resolved
the CDN on a subsequent check. A new disposable pull/no-cache builder succeeded;
no cached-base fallback was used. Failed and retry evidence are retained separately.

The existing administrator, five bind mounts and loopback port were preserved.
The application remains read-only, Linux x64 UID 1000, Node 24.22.1/npm 12.0.2.
Health and packaged readiness passed. Bootstrap was retired and the temporary
password removed. Startup verified 115 applied migrations with zero pending and
zero newly applied. No manual schema refresh, new deployed service or release.

## Qualified boundaries

| Boundary | Result |
| --- | --- |
| Packaged server/shared | All 1,059 server and 13 shared files unchanged |
| Packaged client | 157 files, 57 changed from the preceding bundle; exact match to final local build |
| Runtime/dependencies | 110 package and 151 OS package records unchanged; root metadata matches source |
| Entrypoint | Source/hash/mode match; identity probes retired |
| Data bind | Packaged service/readiness, directory creation/sync, private modes, exclusive publication, collision preservation and owned cleanup passed |
| Preserved walkthrough UI | Eight groups passed with controlled provider/session/status replies; actual settings/secret-status unchanged, no provider mutation forwarded |
| Fresh packaged native proof | One test, 14 provider-status groups, real HTTP/PostgreSQL/encrypted reads; no provider HTTP calls or writes on reads; container retirement/absence verified |

The native entry covers anonymous, requester/admin and disabled-session behavior,
actual encrypted-storage corruption and recovery, partial/all-unavailable reader
projection, no-store and diagnostic exclusion. It terminates only its owned
fixture backend, observes its end and absence, then qualifies bounded 503 mapping
and recovery. This is not a production database outage or a live-provider test.

The browser scenario separately checks current-session/status GET ordering,
duplicate retry, draft/focus preservation, unknown/session refusal, newer command
precedence and scope disposal. All three provider-command POSTs were fulfilled
locally with current CSRF checks. Six responsive light/dark status/retry captures
were reviewed. Authenticated walkthrough login is distinct from the locally
controlled provider commands. The implementation outcome records canonical
browser results and earlier disposable host-connection failures without diagnosing
their cause.

Retained native proof comprises 30 callback-output, 80 OAuth-owner and 33
Plex-owner groups, 143 total. Those actual executions belonged to image
`sha256:5aad74f6fe9808a34fdb38d127bc9e8d67ad9ff157fe2a0f57445c17f4729de9`
and were already retained by the preceding image. Exact server/shared/dependency
and native-test comparison supports continued retention. These 143 groups were
not rerun; the 14 provider-status groups above are separate fresh executions.

Source identity is recorded in the implementation outcome. No code changed after
the frozen complete gate. There is no native-cache, full WCAG/manual-device,
complete-drainage or memory-minimum claim, and no release/tag/PR merge.

Private evidence: `.tmp/provider-authorization-status-2026-10-28/`, with the failed
initial build at the root, successful build/image/mount/probe records in `rebuild/`,
complete gate in `fast/`, canonical result in `browser-final.log`, walkthrough
result/captures in `browser-result.json` and PNGs, fresh native result/retirement
in `final-provider-*.json`, and retained identity in `retained-native.json`.

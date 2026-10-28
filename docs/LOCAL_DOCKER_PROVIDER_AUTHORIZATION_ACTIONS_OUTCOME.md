# Provider authorization action Docker outcome

October 28, 2026. See the separate [Docker design](LOCAL_DOCKER_PROVIDER_AUTHORIZATION_ACTIONS_DESIGN.md),
[implementation outcome](PROVIDER_AUTHORIZATION_ACTIONS_OUTCOME.md) and
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

## Current walkthrough

The existing application is healthy at `http://127.0.0.1:47956`, running image
`sha256:0800bfe75f9e76f9dbebd8676b3816510e6ae5cf2314f52ab4a3afd29774a6af`.
Its preceding qualified image was
`sha256:f520e5512f14a5eef24925191e47659942fae88558d6935fad1ad98ba0b92fca`.

A fresh pull/no-cache build succeeded on retry. The first attempt failed before
compilation while downloading the Dockerfile frontend: Docker DNS could not
resolve the CDN host. Its failed builder was removed and verified absent. The
retry used a new disposable builder; no cached-base fallback was used. Both the
failure and successful retry evidence remain private.

The administrator and five bind mounts were preserved. The application runs
read-only as Linux x64 UID 1000, Node 24.22.1/npm 12.0.2, with the existing loopback
port. Bootstrap was retired and the temporary password removed. Health and the
packaged readiness command passed. Startup recorded 115 applied migrations,
zero pending and zero newly applied; no schema refresh or maintenance action was
required. No additional deployed service, release or Git tag was created.

## Identity and behavior evidence

| Boundary | Result |
| --- | --- |
| Packaged server/shared | All 1,059 server and 13 shared files unchanged |
| Packaged client | 157 files; 56 differ from the preceding bundle; exact match to final local build |
| Dependencies/runtime metadata | 110 package records and 151 OS package records unchanged; root metadata matches source |
| Entrypoint | Source/hash/mode match before and after; probe containers retired |
| Data-bind probe | Packaged service/readiness, cold/existing directory creation and sync, private modes, exclusive publication/collision preservation and owned cleanup passed |
| Walkthrough browser | 10 action groups passed; 7 controlled local POSTs, current CSRF checks, no forwarded mutations or page errors; actual settings unchanged |

Canonical browser qualification used a disposable application/PostgreSQL fixture;
the same scenario ran against this preserved walkthrough. Authorization replies
and linked-status overlays were browser-local fixtures. No external provider was
contacted and no operator authorization was changed. Feedback screenshots at
desktop/tablet/mobile in light/dark were reviewed after correcting the fixture's
scroll/capture position; twelve pending action-row captures were reviewed
separately. The implementation outcome records the ancillary mobile layout finding.

Prior native evidence was retained only for unchanged server/API/store behavior:
30 callback-output, 80 OAuth-owner and 33 Plex-owner groups, 143 total. The actual
native executions belonged to image
`sha256:5aad74f6fe9808a34fdb38d127bc9e8d67ad9ff157fe2a0f57445c17f4729de9`
and were already retained by the preceding image. Current server/shared,
dependency and native-test bytes matched those records. These are retained groups,
not 143 new executions or live token-publication acceptance. Current client
behavior has separate fresh browser evidence.

Final source identity is recorded in the implementation outcome. The final
browser-only capture adjustment changed no production bytes, so a second image
build was unnecessary. The repeated final build confirmed packaged-client parity.
Actual Back observed persisted=false; native BFCache restoration, manual spoken
feedback/device acceptance, full application drainage and memory minima remain
outside this qualification.

Private records are under `.tmp/provider-authorization-actions-2026-10-28/`:
the initial failed build at the root, successful image/identity/probes in `rebuild/`,
final gate in `qualified-fast/`, canonical result in `browser-qualified.log`,
live result and six feedback captures in `visual-qualified/`, additional action-row
review in `action-row-review/`, and retained native identity in `retained-native.json`.
Earlier partial/failed evidence is preserved; repeated scenarios are not summed.

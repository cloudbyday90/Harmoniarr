# Connections layout Docker outcome

October 28, 2026. See separate [Docker design](LOCAL_DOCKER_CONNECTIONS_LAYOUT_DESIGN.md),
[implementation outcome](CONNECTIONS_LAYOUT_OUTCOME.md) and
[walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

## Current walkthrough

The existing application is healthy at `http://127.0.0.1:47956` on image
`sha256:13615b07f81739b71e4e5325cff86642e1e02d07298dcdc3268ec51c58b93dc1`.
Its preceding qualified image was
`sha256:bade151158eef3d65bbdaa540080b6cb68e5aa95437bde02afe9087756c87f66`.

A fresh disposable pull/no-cache build succeeded, with no cached-base fallback.
The builder was removed and absence verified. Administrator, five bind mounts and
loopback port were preserved. The application remains read-only Linux x64 UID
1000, Node 24.22.1/npm 12.0.2. Health and packaged readiness passed. Bootstrap was
retired and the temporary password removed. Startup verified 115 applied
migrations, zero pending and zero newly applied; no schema refresh was needed.

| Boundary | Qualified result |
| --- | --- |
| Packaged server/shared | All 1,059 server and 13 shared files unchanged |
| Packaged client | 157 files, 70 changed from the preceding bundle; exact match to final local build |
| Runtime/dependencies | 110 package and 151 OS-package records unchanged; root metadata matches source |
| Entrypoint | Source/hash/mode match; identity probes retired |
| Data bind | Packaged service/readiness, directory creation/sync, private modes, exclusive publication, collision preservation and owned cleanup passed |
| Current walkthrough UI | 19 native-keyboard layout scenes passed; actual settings/secret-status unchanged; one local controlled save failure, no forwarded settings/provider mutation or page error |

Six desktop/tablet/mobile light/dark card captures were reviewed. The canonical
disposable application/PostgreSQL browser checks additionally covered Settings
save retry/verification, information hierarchy, authorization start/clear, saved
status and route role/admission. The explicit compatibility entry verified actual
4x Chromium tab zoom before/after all three scenes, a 320x256 CSS viewport and
browser/profile retirement. This is distinct from viewport resizing and from the
controlled feedback-font enlargement used to exercise tall-bar fallback.

Native API/store proof was retained after exact server/shared/dependency and
test comparison: 30 callback-output, 80 OAuth-owner, 33 Plex-owner and 14
provider-status groups, 157 total. The first 143 actual executions belonged to
image `sha256:5aad74f6fe9808a34fdb38d127bc9e8d67ad9ff157fe2a0f57445c17f4729de9`
and were already retained by the preceding image. The 14 status groups actually
ran on the preceding bade151 image. No native groups were rerun for this client
layout change; current layout behavior has separate fresh browser evidence.

Source identity and final commands are in the implementation outcome. No code
changed after the frozen gate. Its known 1.0–1.3px short-viewport textarea edge
clip behind existing mobile navigation remains documented. This qualification
does not certify complete WCAG/reflow, manual spoken/device acceptance, native
provider/account completion, full application drainage or memory minima.

Private evidence: `.tmp/connections-layout-2026-10-28/`, including baseline
`before-layout.json`, final source/code manifests, `fast/`, `browser-final.log`,
walkthrough `browser-result.json` and six PNGs, final `native-zoom-jvr7rE/`,
packaged `runtime-comparison.json`, retained-native identity and cleanup records.
Earlier invalidated/failed preflights are retained separately. No release, Git tag,
PR merge or additional deployed service was created.

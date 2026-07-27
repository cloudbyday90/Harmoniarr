# External Download Path Readiness

Status: **Implemented.**

Date: 2026-07-26.

## 1. Problem

The local walkthrough showed a healthy external Soulseek connection but no saved
download path translation. Harmoniarr could safely reach its own downloads
folder, but it could not prove that a provider-reported completed-file path
referred to the same files. Automatic download and library-add work must stop
at that boundary rather than treating a remote path as a local path.

This is a deployment readiness problem, not a provider-credential problem and
not a reason to expose candidate diagnostics in the normal workflow.

The same live run exposed a separate application defect: the automatic library
discovery claim selected an optional wanted-release projection through a lateral
left join, then issued an unqualified `FOR UPDATE`. PostgreSQL correctly
rejected the lock because the optional join side can be null, so discovery
stopped before it could submit a Soulseek search.

## 2. Research

| Source | Relevant guidance | Design implication |
| --- | --- | --- |
| [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) | Bind mounts make a host directory available at a container path and retain host-side ownership and lifecycle. | The walkthrough must let an operator select a local host folder while keeping the stable in-container target path. |
| [Docker Compose variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) | Compose can resolve environment values with defaults at deployment time. | A shell-only host-path override avoids committing machine-specific paths. |
| [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) | Health checks and dependency readiness are distinct from application-level configuration readiness. | A healthy Harmoniarr container must not imply completed downloads are ready to import. |
| [OWASP Path Traversal Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Path_Traversal_Cheat_Sheet.html) | Filesystem paths from outside a trust boundary require explicit validation and allowlisted resolution. | Keep explicit source-to-local translation and existing path validation; never infer a local path from provider data. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat provider paths as local paths | No setup screen. | Can read the wrong host folder or escape expected mounts. Unsafe. | Reject. |
| Commit a workstation or NAS path in walkthrough Compose | Fast for one machine. | Leaks machine-specific deployment assumptions and breaks other environments. | Reject. |
| Keep only written instructions | No code change. | The setup requirement is easy to miss after a successful connection test. | Reject. |
| Optional host-path override plus explicit in-app translation | Portable, explicit, validates the mounted target, and leaves provider paths under operator control. | Requires one mount setting and one translation. | Adopt. |
| Managed provider overlay | Aligns paths for a managed deployment. | Does not solve separately deployed providers or VPN-networked Unraid containers. | Retain as the existing managed alternative. |

## 4. Final Recommendation Stack

1. Use the external provider only with a least-privilege API key and a
   container-visible completed-download bind mount.
2. Set `HARMONIARR_WALKTHROUGH_DOWNLOADS_HOST_PATH` only in the local shell or
   deployment environment; retain the repo-local walkthrough folder as the
   default.
3. Map the download client's completed-folder prefix to `/data/downloads` in
   Settings > Media & storage.
4. Require existing path validation before automatic provider handoff and
   library add.
5. Keep source paths, provider payloads, usernames, and API keys out of Music
   Queue and Activity; show only a concise setup action.

## 5. Implementation Outcome

- `compose.walkthrough.yaml` now accepts
  `HARMONIARR_WALKTHROUGH_DOWNLOADS_HOST_PATH`, defaulting to the disposable
  repo-local walkthrough downloads folder.
- Settings > Media & storage now shows **Finish automatic download setup** when
  downloads are enabled without a translation. Its action adds a translation
  row and pre-fills Harmoniarr's side with the configured downloads path.
- `LOCAL_DOCKER_WALKTHROUGH.md` documents the host override, stable in-container
  mount, and explicit translation. It makes clear that a translation does not
  create a mount.
- The existing automatic-download readiness gate remains fail-closed. No
  provider path is trusted as a local filesystem path without a saved mapping.
- `claimNextReadyAutomaticDiscoveryRequest` now locks only
  `library_discovery_requests` with `FOR UPDATE OF ... SKIP LOCKED`, avoiding
  PostgreSQL's nullable-outer-join lock error while retaining the existing
  concurrent claim behavior.

## 6. Validation

Focused tests cover the presentation prompt, Compose contract, the scoped
PostgreSQL claim lock, and browser disclosure behavior. The walkthrough was
rebuilt with `docker compose build --no-cache`, started with a local `Y:\\`
host override, and saved this explicit translation:

| Download client path | Harmoniarr path | Result |
| --- | --- | --- |
| `/downloads/Complete/Music` | `/data/downloads` | Validated and healthy |

After the scoped lock fix, the normal heartbeat completed an automatic library
discovery run and dispatched five Soulseek searches. The connected provider
returned no ingestible, acceptable results for that run, so Music Queue showed
the bounded automatic state: **Searching again automatically**. It did not
pretend that a download had started or require a user to inspect raw candidates.

`npm run validate:docker-file-backed-music-queue` passed. It generated local
fixture media in a temporary Docker project, added an authentic quality-eligible
file to the library, and blocked a transcoded file. This is the safe,
deterministic proof for automatic quality checking and library add; it does not
start a real external transfer or write test media to the operator's mounted
download folder.

## 7. Next High-Value Item

Audit why a connected provider can return search responses while Harmoniarr
ingests zero acceptable matches. Add bounded, release-scoped evidence for the
source response count, rejection categories, and selected quality decision;
keep usernames, file paths, and provider payloads out of normal UI. Then run a
controlled transfer acceptance test only with operator-owned or otherwise
authorized media. Do not make real downloads a test prerequisite; retain the
file-backed validator for deterministic library-add proof.

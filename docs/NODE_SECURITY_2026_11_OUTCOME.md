# Node security maintenance outcome — November 2026

November 14, 2026. See separate [research and tradeoffs](NODE_SECURITY_2026_11_RESEARCH.md),
[design](NODE_SECURITY_2026_11_DESIGN.md), [Astra review](NODE_SECURITY_2026_11_ASTRA_REVIEW.md)
and [selected PR outcome](OPEN_PR_68_LOCAL_EVALUATION_OUTCOME.md).

## Maintained result

Canonical development/CI and both Docker defaults select Node 24.22.3, npm
12.0.2 and matching Alpine 3.23. Package and root lock engine floors agree.
The shared ESM baseline policy checks five owners; the signal lane consumes its
canonical image instead of a separate version regex. Explicit 24.22.1 execution
is refused. The repository-local Windows toolchain leaves the OS installation
unchanged. PR #68's complete reviewed dev-tool/client delta is implemented locally.

The Windows binary matches the published SHA-256
`86fc4785327db5f5c7558dc6156c543b433c313e813a222e088086222ab4afa6`.
Registry inspection identified the Node index
`sha256:3946fb783fdce8a2812136ea694bc95c698c4f4096f3fd18568dc27a8ac389dc`
and amd64 manifest
`sha256:30bd1b393bad515bdd6ac3c299783aa8dbc6e98dec609e44665a770463269663`.
Executed application and canonical-media binaries match the executed official
base hash `7e027679034844bb06f53bead732673553cf5bb0de424bbbd257b35c989d34b0`.
Components include Undici 7.30.2, llhttp 9.4.4, Brotli 1.2.1 and OpenSSL 3.5.9.
Checksum/digest comparison is distinct from independent signing-key verification.

Final application image:
`sha256:fda139f38a81a4af9a2b49a6c4521b75aecca279efb9f72c76936a995be49d98`.
Final canonical-media runner:
`sha256:4f1aa6c2de190ff56a28fbfe0c6d3ce9ae804606410c7179efed7927b696ae84`.
These are local qualification artifacts. The walkthrough remains stopped.

## Gaps corrected during qualification

Two application checkout-observer assertions failed on both 24.22.3 and retained
24.22.1. The observer recognized bare pg connect while production already used
an admission wrapper. A predicate in the existing admission service now recognizes
its own data descriptor and native delegate through private WeakMap state.
No delegate is exposed and no admission bound is bypassed. Foreign, replaced,
accessor and borrowed wrappers remain unsupported. Native promise/callback
queueing, busy refusal without native queue growth or fabricated attribution,
zero pending counts and exact restoration pass. The old expectation of no own
connect property now verifies the restored production admission owner instead.

A later broad run stranded an existing 25 ms deadline fixture before dispatch.
Its isolated run passed. The invocation-owned fake-transport test process was
identified and stopped; the collection remains failed evidence. Three synthetic
deadline tests now use controlled monotonic/timer clocks and explicit entry/drain
gates, with cleanup hooks. Production deadlines are unchanged. Initial native-test
lint errors and private probe failures were corrected before final validation;
no failed collection is relabeled a runtime pass.

## Executed validation

| Boundary | Final evidence |
| --- | --- |
| Fast gate | All 14 stages; 11,811 tests: server 6,471, client 4,595, scripts 745; zero failures/cancellations/skips; lint, ESM, copyright, schema/migration/anchor, topology, hygiene and both builds |
| Native PostgreSQL and built browser | 29 passed: TLS DNS/IP acceptance/mismatch/untrusted CA and socket retirement, driver binds, checkout/context, protected sessions/CSRF and four browser journeys |
| Final checkout file | Eight passed again after native-test lint cleanup |
| Packaged native consumers | 61 passed: Spotify/YouTube, Apple, Plex, HTTP error boundary, actual parser/cover, 49 transport/context/runtime controls and seven artwork corpus cases |
| Linux signals | Six passed: SIGINT/SIGTERM, Error/null and actual process close; owned container retired |
| Canonical Linux media | Six scenarios, eight generations, 27 inspections; three owners created/removed; safe cleanup; runner and owned volume retired |
| Fresh/restart app | Exact final image, Node 24.22.3/npm 12.0.2, Linux x64/UID 1000, read-only root, health, 115 applied/zero pending migrations, persisted settings, protected requests, backup/restore, invalid-startup refusal and strict cleanup |
| Tooling | Real language-server typing/edit recovery and loaded Windows/musl Rolldown bindings; matching Playwright browser |

Packaged transport/parser/app consumers used inspected two-CPU/2-GiB/no-swap,
read-only, network-none and disposable tmpfs fixtures. Artwork used its existing
one-CPU/1-GiB profile. The trusted canonical-media controller is a disposable
Docker-API runner; its socket access is not application deployment policy.
Controlled certificates/loopback responses do not establish live-provider
acceptance or independent reproduction of every disclosed vulnerability.

Both folder profiles passed 16 four-scan groups: 128 successful scans total,
four admission/cancellation/late-close groups, exact 203-name Unicode paging and
actual 50,001-entry overflow refusal. Each retired 24 containers and its volume
or bind fixture. They executed the initial patched image
`sha256:8fe00ef0708046616772233a38a7b5c917b97d3cd2b3f96cb4c30acf099f75f7`.
Complete inventories establish identical Node binary/components, OS/npm packages
and folder boundaries in the final image; its additional server delta is the
admission ownership predicate. That supports scoped retention of folder controls,
not identical whole-artifact bytes. No new speedup, long-running memory plateau
or transfer of earlier 24.22.1 percentages is claimed.

## Artifact, security and hygiene

The final 1,063 server files differ from the preceding qualified baseline only
in database-pool-admission-service.js. All 14 shared files match. The changed
158-file client matches the final build. All 110 production npm resolutions match.
Parser bytes, modes and UID match; canonical npm installation changes 217 parser
files from GID 0 to 1000. Program files remain root-owned and not group/world
writable. Root package/lock bytes match source.

The 151-package OS inventory has seven version changes: glib 2.86.3 to 2.86.5,
libexpat 2.9.0 to 2.10.0, libpq/PostgreSQL server/client/contrib 18.6 to 18.7,
and tzdata 2026e to 2026f. Fresh/restart and backup/restore use packaged PostgreSQL
18.7. External TLS/checkout fixtures report PostgreSQL 18.3; FFmpeg/FFprobe remain
8.0.1. These are distinct environments, not identical-runtime or full image-scan
claims.

Npm audit reports zero production vulnerabilities and no high/critical findings.
Nine moderate development-tool findings remain, also present in the opening
lockfile. The existing high-severity gate passes without suppressions or forced
major upgrades/downgrades. Glob/minimatch and Testcontainers/archiver remain
explicit maintenance work; see the research advisories.

Frozen source: 3,892 files, SHA-256
`9f0f86e8c45c454b9342a45a384c72fbb2c33bb6997f36b532156a7c6baaf1fa`.
The separate 16-file code/configuration manifest includes .nvmrc and Dockerfiles.
Raw hashes, failures, plans, archives, inventories and cleanup receipts remain
ignored under `.tmp/node-security-2026-11-14/`. Owned fixtures and provisional
images are retired after verified completion; current qualification images and
the stopped walkthrough/rollback are retained. No shared prune or service restart.
Two provisional images were removed. Automatic approval review rejected bulk
recursive deletion of 34 extracted vendor-review directories (68,714,782 bytes),
reporting "blocked by policy" without further detail. Those extracts and their
archives are retained; the rejected operation is not counted as cleanup.

## Recommendation and next item

Adopt the coordinated patch and qualified PR delta on main. Benefits are Node 24
vendor fixes, consistent runtime admission and tested tooling/client consumers.
Costs are rebuild/native qualification, optional-platform limits and continued
pin/dependency maintenance. The final stack is verified 24.22.3/npm 12.0.2,
matching digest-pinned Alpine 3.23, modular ESM owners, default TLS verification,
bounded pool/folder admission, actual lifetime drainage, fresh consumer controls
and scoped cleanup.

Next component work: repeated browse/cancel cycles in one persistent built-in
service, verifying capacity reuse, idle handles and retained memory over time.
Track moderate dev-tool updates separately. Network/NAS, physical assistive
checks, arm64, full image scanning, hosted CI and live providers remain outside
this local qualification. No release, deployment or PR merge was performed.

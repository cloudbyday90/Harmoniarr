# Local Docker approved external-search recovery outcome

Date: 2026-10-20. Followed the preserved-data rebuild/start/bootstrap/readiness
path in [the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Feature results are in
[the external recovery outcome](EXTERNAL_SEARCH_RECOVERY_OUTCOME.md).

A fresh owned BuildKit builder used `--pull --no-cache --load`; builder removal
was verified. The local `harmoniarr:walkthrough-local` image is now
`sha256:47e283cc82fc952e6c50d8cf5c5f1042d37944bb765354823237bae2be4e46f8`,
replacing
`sha256:53288dd6ee43e376a313398895453cc6d47768674f8e1a31532c889f7315b13b`.

Compose startup passed. The app is healthy, read-only and runs as UID 1000 with
Node 24.22.0 on linux/x64, published only at `127.0.0.1:47956`. Existing data and
the walkthrough administrator were preserved. The bootstrap helper confirmed
the existing account and was removed. Startup applied zero migrations and
verified 110 applied, zero pending. No data reset was performed.

Readiness-only validation passed using a temporary password file outside the
repository; removal was verified. Required provider configuration and download
mapping are present. The existing provider queue still needs attention. This
read-only provider check submits no search or transfer commands and does not
establish a new accepted download, live search or import.

Read-only network-isolated inventory helpers were retired after comparison.
The image contains 862 server files, 152 client files and eight shared files.
Exactly 12 intended server paths changed, including the two new recovery service/
store modules; all other server bytes/modes match the previous image. The new
shared recovery policy and modified operation capabilities match source, while
the six remaining shared files are identical. Every client file matches the final
local production build; 58 paths changed with rebuilt content/chunk names. All
expected permissions are preserved. Node and the 110 npm/147 OS package records
are unchanged.

Private build/startup/bootstrap/migration/readiness logs, immutable image IDs,
builder retirement, source fingerprints and runtime comparisons are retained in
`.tmp/external-search-recovery-2026-10-20/`. No registry image, version, Git tag or
release was published.

Next: qualify explicit fresh searches for completed zero-result external discovery
using a deliberate cooldown/budget policy. Existing provider queue attention is a
separate operational follow-up.

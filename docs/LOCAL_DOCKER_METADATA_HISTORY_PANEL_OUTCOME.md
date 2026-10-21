# Local Docker Metadata history panel outcome

Date: 2026-10-21. Follows the preserved-state path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md) after the
[history panel validation](METADATA_HISTORY_PANEL_OUTCOME.md).

A unique owned `docker-container` BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local`, then retired with removal verified.
New immutable image:
`sha256:a16c3e9ab8c46774a8f55880c47e87419c676cf92538d8da06e74ff5aeee917a`.
Previous running image:
`sha256:179fe56987e5b5b825fad33c580083e1483ff7385461a5bf8775e37b200f797b`.

Read-only, network-isolated inventory containers inspected both images and
retired. All 865 server and 11 shared files retain prior bytes and modes. All
155 packaged client files match the final browser-tested local build; 56
artifacts changed, including dependent chunk references. Node 24.22.0, 110 npm
packages and 147 OS packages match the previous inventory. No application
dependency changed.

The walkthrough ran `up -d --wait --no-build harmoniarr` and the public one-shot
bootstrap helper. The app is healthy, read-only, and bound only to
`127.0.0.1:47956`. Executed runtime is Linux x64, Node 24.22.0, uid 1000. Bootstrap
confirmed the existing admin and retired. All five bind mounts retain their
source, destination and read/write mode. Startup applied zero migrations,
verifying 111 applied and zero pending. No data or volume reset was performed.

The provider validator passed with explicit `--readiness-only`, retaining its
configured-provider and path-mapping requirements. The temporary password-only
file was removed afterward. This invocation submitted no search or transfer
command and does not establish a newly accepted transfer. Provider queue review
and transfer acceptance remain separate operational work. Optional managed-
provider, release and fresh-reset lanes were not invoked against preserved data.

Final source/code hashes, packaged bytes, mounts and local Markdown links are
verified before publication. Private build, inventory, startup, migration and
readiness evidence remains under `.tmp/metadata-history-panel-2026-10-21/`.
No release, Git tag or version bump was created.

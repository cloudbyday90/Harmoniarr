# Local Docker Metadata selection ownership outcome

Date: 2026-10-21. Follows the preserved-state path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md) after the
[selection ownership validation](METADATA_COMMAND_SELECTION_OUTCOME.md).

A unique owned `docker-container` BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local`, then retired with removal verified.
New immutable image:
`sha256:fcd3265a7fdca567245916c13d7cf4ab84de1119b7754c0bf9b9002bccc90e94`.
Previous running image:
`sha256:daf5e515d6b4fce349e811a84c67ff104569e3697a36525920b591c601741745`.

Read-only, network-isolated inventory containers inspected both images and
retired. All 865 server and 11 shared files retain prior bytes and modes. All
155 packaged client files match the final local build; 56 artifacts changed,
including dependent chunk references. Node 24.22.0, 110 npm packages and 147 OS
packages match the previous runtime inventory. No application dependency changed.

The walkthrough ran `up -d --wait --no-build harmoniarr` and its public one-shot
bootstrap helper. The app is healthy, read-only, and bound only to
`127.0.0.1:47956`. Executed runtime is Linux x64, Node 24.22.0, uid 1000. Bootstrap
confirmed the existing admin and retired. All five bind mounts retain the same
source, destination and read/write mode. Startup applied zero migrations,
verifying 111 applied and zero pending. No data or volume reset was performed.

The provider validator passed with explicit `--readiness-only`, retaining its
configured-provider and path-mapping requirements. The temporary password-only
file was removed afterward. This invocation submitted no search or transfer
command and does not establish a newly accepted transfer. Existing provider queue
attention remains a separate operational follow-up. Optional managed-provider,
release and fresh-reset lanes were not invoked against preserved data.

Final source/code hashes, packaged bytes, mounts and local Markdown links are
verified before publication. Private build, inventory, startup, migration and
readiness evidence remains under `.tmp/metadata-command-selection-2026-10-21/`.
No release, Git tag or version bump was created.

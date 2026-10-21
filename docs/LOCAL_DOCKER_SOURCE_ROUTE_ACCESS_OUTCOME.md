# Local Docker source-policy admission outcome

Date: 2026-10-21. Follows [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
with preserved local state after the [feature validation](SOURCE_ROUTE_ACCESS_OUTCOME.md).

A fresh owned `docker-container` BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local`. The builder was removed and its retirement
verified. New immutable image:
`sha256:eeb1ff9d9b4b5d887f2f9a5516a36ec71b8ab6bee002a4ffaccc1557cf9b4f38`.
Previous running image:
`sha256:3c40ceb27661b0c9d5d19fdffefa11633b8001438573b7ac241fbe9ebf4deabe`.

Network-isolated, read-only inventory containers compared both images and retired
afterward. The runtime contains 865 server, 155 client and 11 shared files. All
server/shared bytes and modes match the prior image; no backend or schema change
was introduced. All 155 packaged client files match the local final build, with
55 changed client artifacts including dependent chunk references. Node 24.22.0,
110 installed npm packages and 147 OS packages match the previous inventory.
The CI workflow update is outside the packaged application.

The walkthrough ran `up -d --wait --no-build harmoniarr`, followed by its public
one-shot bootstrap helper. The application is healthy, read-only and bound only
to `127.0.0.1:47956`; executed runtime is Linux x64, Node 24.22.0, uid 1000.
The helper confirmed the existing admin and retired. All prior bind mounts and
their read/write modes were compared exactly and preserved; no reset or data
cleanup was performed. Startup applied zero migrations, verifying 111 applied
and zero pending.

The prescribed provider validator passed with explicit `--readiness-only` and
a temporary password-only file, removed afterward. Existing provider and path
mapping prerequisites remain configured. This run submitted no search or transfer
command and does not claim a newly accepted transfer. Existing provider queue
attention remains a separate operational follow-up.

The full fast gate passed before replacing the running application. Final source,
workflow/test hashes, packaged bytes, mount preservation and local Markdown links
are checked before publication. Private evidence is retained under
`.tmp/source-route-access-2026-10-21/`, including build, inventories, runtime
comparison, startup, migrations and readiness records. No release or tag is
created.

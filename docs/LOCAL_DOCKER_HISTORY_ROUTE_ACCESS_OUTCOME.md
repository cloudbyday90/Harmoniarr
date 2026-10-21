# Local Docker System history admission outcome

Date: 2026-10-21. Follows [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md)
with preserved local state after the [feature validation](HISTORY_ROUTE_ACCESS_OUTCOME.md).

A fresh owned `docker-container` BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local`, then was removed with retirement verified.
New immutable image:
`sha256:e749eb33b6fa1847c10be4f8fb167108e1d99c0247c9d3367c65136bd5a59110`.
Previous running image:
`sha256:eeb1ff9d9b4b5d887f2f9a5516a36ec71b8ab6bee002a4ffaccc1557cf9b4f38`.

Read-only, network-isolated inventory containers inspected both images and retired
afterward. All 865 server and 11 shared files retain their prior bytes and modes.
All 155 packaged client files match the final local build; 55 client artifacts
changed, including dependent chunk references. Node 24.22.0, 110 installed npm
packages and 147 OS packages match the previous inventory. No backend, schema or
dependency change was introduced.

After the complete fast gate passed, the walkthrough ran
`up -d --wait --no-build harmoniarr` and its public one-shot bootstrap helper.
The application is healthy, uses a read-only root and is bound only to
`127.0.0.1:47956`. Its executed runtime is Linux x64, Node 24.22.0, uid 1000.
The helper confirmed the existing admin and retired. All prior bind mounts and
read/write modes match exactly. Startup applied zero migrations, verifying
111 applied and zero pending. No data reset or volume cleanup was performed.

The prescribed provider validator passed using explicit `--readiness-only` and
a temporary password-only file that was removed afterward. Existing provider
and path mapping prerequisites remain configured. This invocation submitted no
search or transfer command and does not claim a newly accepted transfer. Existing
provider queue attention remains a separate operational follow-up.

Final source, code/test hashes, packaged bytes, mount preservation and local
Markdown links are checked before publication. Private evidence is retained under
`.tmp/history-route-access-2026-10-21/`, including build, inventories, runtime
comparison, startup, migrations and readiness records. No release or tag is
created.

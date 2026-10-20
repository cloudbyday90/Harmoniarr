# Search diagnostics local Docker outcome

Date: 2026-10-20. Uses the preserved
[local Docker walkthrough](LOCAL_DOCKER_WALKTHROUGH.md); feature behavior belongs
in the separate [implementation outcome](EXTERNAL_SEARCH_DIAGNOSTICS_OUTCOME.md).

A fresh owned BuildKit builder ran `--pull --no-cache --load` using the current
Dockerfile and tagged `harmoniarr:walkthrough-local`. Builder retirement was
verified. The application image is
`sha256:8efc6c07ca5b620fcbf5291f86b86190c41ac7258c70da49950a56b7bef94f37`, replacing
`sha256:99abc38971652c54146232c8da81249e5a13c453a677e59ff1bde3ed7063397e`.

Compose used `up -d --wait --no-build harmoniarr`, followed by the documented
one-shot bootstrap. Existing admin/data and bind mounts were preserved; the helper
confirmed an existing admin and was removed. Startup verified 111 applied migrations,
zero pending, with zero newly applied. The app is healthy at loopback
`127.0.0.1:47956`, with read-only root and actual linux/x64 Node 24.22.0 execution
as uid 1000.

Readiness-only provider acceptance passed, retaining configured provider/path
mapping and existing queue attention (`no_unlocked_files` diagnostics). It submitted
no live search or transfer. The temporary password-only file and bootstrap helper
were removed. The local walkthrough keeps its explicit development configuration;
the feature's protected command boundaries are covered separately by integration.

Read-only, network-disabled inventory containers were removed after comparison.
There are 864 server, 152 client and ten shared packaged files. Exactly the three
intended server service/worker/store paths changed, plus the new shared projection.
Other server/shared bytes and modes match the prior image. All client bytes match
the local build; 56 paths changed due to content/chunk names. Shared bytes match
source. The 110 npm and 147 OS package inventories are unchanged.

Private no-cache build, cleanup, migration, readiness and inventory evidence lives
under `.tmp/external-search-diagnostics-2026-10-20/`. No live-provider work, published
image, release, tag or version change is claimed by this local rebuild.

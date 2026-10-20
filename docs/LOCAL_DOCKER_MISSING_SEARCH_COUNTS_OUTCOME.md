# Shared-search count local Docker outcome

Date: 2026-10-20. Uses the preserved [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
The separate [feature outcome](MISSING_SEARCH_COUNTS_OUTCOME.md) owns API/browser
evidence; this record owns the no-cache packaged runtime and readiness checks.

A fresh owned BuildKit builder ran `--pull --no-cache --load` using the current
Dockerfile and tagged `harmoniarr:walkthrough-local`. Builder retirement was
verified. The application image is
`sha256:2d62a390659d3e88faa49705cd6b88a45421e611c7bd0a5f0f91e94d6d3abcef`, replacing
`sha256:8efc6c07ca5b620fcbf5291f86b86190c41ac7258c70da49950a56b7bef94f37`.

Compose used `up -d --wait --no-build harmoniarr`, followed by the documented
one-shot bootstrap. Existing admin/data and bind mounts were preserved; the
helper confirmed an existing admin and was removed. Startup verified 111 applied
migrations, zero pending, with zero newly applied. The app is healthy on loopback
`127.0.0.1:47956`, with read-only root and actual linux/x64 Node 24.22.0 execution
as uid 1000.

Readiness-only provider acceptance passed, retaining configured provider/path
mapping and existing queue attention (`no_unlocked_files` diagnostics). It submitted
no live search or transfer. The temporary password-only file was removed. The
walkthrough retains its explicit development configuration; protected command
boundaries are separate from this read-only packaged evidence.

Read-only, network-disabled inventory containers were removed after comparison.
There are 865 server, 153 client and 11 shared packaged files. Exactly the intended
decision service/new policy and the external wrapper/new shared normalizer changed
on the server/shared side. Other server/shared bytes and modes match the prior
image. All client bytes match the local build; 58 paths changed due to content/
chunk names. Shared bytes match source. The 110 npm and 147 OS package inventories
remain unchanged.

Private build, cleanup, migration, readiness and inventory evidence lives under
`.tmp/missing-search-counts-2026-10-20/`. No published image, live-provider work,
release, tag or version change is claimed by this local rebuild.

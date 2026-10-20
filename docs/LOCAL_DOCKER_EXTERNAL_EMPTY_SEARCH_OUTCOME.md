# Empty-search policy local Docker outcome

Completed 2026-10-20 using the preserved
[local Docker walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The separate
[feature outcome](EXTERNAL_EMPTY_SEARCH_OUTCOME.md) owns the database and browser
evidence; this record owns the packaged runtime and local readiness check.

A fresh owned BuildKit builder ran `--pull --no-cache --load` against the current
Dockerfile and tagged `harmoniarr:walkthrough-local`. Builder removal was verified.
The resulting immutable application image is
`sha256:99abc38971652c54146232c8da81249e5a13c453a677e59ff1bde3ed7063397e`, replacing
`sha256:47e283cc82fc952e6c50d8cf5c5f1042d37944bb765354823237bae2be4e46f8`.

Compose startup used `up -d --wait --no-build harmoniarr`; the documented one-shot
bootstrap confirmed the existing admin and was removed. Data/bind mounts were
preserved. The application is healthy on loopback `127.0.0.1:47956`, with read-only
root filesystem and actual linux/x64 Node 24.22.0 execution as uid 1000. Startup
applied the one additive policy migration and verified 111 applied, zero pending.

Readiness-only provider acceptance passed, with configured provider/path mapping
and existing provider queue attention. It submitted no live search or transfer.
Existing `no_unlocked_files` diagnostics remain operational follow-up, not proof
that the new empty-search policy failed. The temporary password-only file and
bootstrap helper were removed; no secret was committed.

Independent network-disabled, read-only inventory containers were retired after
inspection. Packaged inventories contain 864 server, 152 client and nine shared
files. Exactly 11 intended server paths changed (including the new store/migration
and updated schema snapshot), and two shared paths changed. Other server/shared
bytes and modes match the previous image. All packaged client files match the
local build; 56 client paths changed due to content/chunk names. All shared bytes
match source. The 110 npm and 147 OS package inventories remain unchanged.

Private build, migration, readiness, cleanup and byte-comparison evidence lives
under `.tmp/external-empty-search-2026-10-20/`. No live-provider work, release,
version change or published image is claimed by this local rebuild.

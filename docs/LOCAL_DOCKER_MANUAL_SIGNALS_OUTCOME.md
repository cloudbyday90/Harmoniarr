# Local Docker manual signal rebuild outcome

Completed October 21, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

Current local image:
`sha256:9105298ee7ce9046ce6198fd3afc01b7dbc3b360cff26f3c8fbfc93eeef32951`.
Previous image:
`sha256:93ab583dc1e69d89575e85d962fe6c65a6ddb112acae6d2315b8e212513b11d3`.

An invocation-owned BuildKit builder ran `--pull --no-cache --load` against the
existing Dockerfile and local walkthrough tag. Builder removal was verified.
Separate owned read-only/network-disabled inventory containers also retired.
All 865 server, 11 shared and 155 client artifacts retain their prior bytes and
modes. Client artifacts match the final local native-browser/fast build. All
110 npm and 147 OS package versions match. The signal fixture/runner changes
stay outside packaged runtime code; package scripts changed with no application
version, dependency or release change.

The existing Compose walkthrough was recreated using `up -d --wait --no-build`.
It is healthy/read-only at `127.0.0.1:47956`, running Linux x64, Node 24.22.0,
UID 1000. All five bind mounts preserve exact source, destination and access
mode, including the current completed-download override. The disposable public
bootstrap helper confirmed the existing admin and retired. Startup applied
zero new migrations and verified 111 applied, zero pending.

Documented readiness-only provider validation passed with configured-provider
and path-mapping requirements retained. Its temporary password-only file was
removed. It submitted no searches or transfers and makes no new provider
acceptance or import claim. No reset, managed-provider overlay, fresh-install
smoke, deployment release rehearsal, release or tag was run; those documented
optional paths remain separate from a preserved-state rebuild.

The walkthrough retains its explicit local CSRF opt-out, so this is not a
production security qualification. The separate signal test container has no
network, socket or application data. Private build, inventory, mount, migration
and readiness records are in `.tmp/manual-session-signals-2026-10-21/`.

See the [owning outcome](MANUAL_SESSION_SIGNALS_OUTCOME.md) for real Linux signal
proof and its controlled-session limit. Next: use the prepared
[manual acceptance procedure](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md) with an
operator and owned physical device, and fix a reproduced product issue.

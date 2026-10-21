# Local Docker manual cancellation rebuild outcome

Completed October 21, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

Current local image:
`sha256:93ab583dc1e69d89575e85d962fe6c65a6ddb112acae6d2315b8e212513b11d3`.
Previous image:
`sha256:317296581b9d93e5017c40e6da7476e656bf6769bdd3a8af05e0dc2f0b490ea4`.

An owned unique BuildKit builder ran `--pull --no-cache --load` against the
existing Dockerfile and local walkthrough tag; its removal was verified.
Before/after inventories used owned read-only/network-disabled containers that
also retired. All 865 server, 11 shared and 155 client artifacts keep their
previous bytes/modes. Packaged client artifacts match the final browser/fast
build. All 110 npm and 147 OS package versions match the preceding image.
The fixture changes remain outside the packaged application code; package
scripts changed without an application version or release.

The existing walkthrough was recreated with `up -d --wait --no-build`. It is
healthy/read-only at `127.0.0.1:47956`, running Linux x64, Node 24.22.0, UID 1000.
All five bind mounts retain their exact sources, destinations and access modes,
including the existing download-path override. The public one-shot bootstrap
helper confirmed the existing admin and was removed. Startup applied no new
migrations and verified 111 applied, zero pending.

The documented readiness-only provider validation passed with configured-provider
and path-mapping requirements retained. Its temporary password-only file was
removed. It submitted no searches/transfers and supplies no new provider
acceptance or import claim. No reset, managed-provider overlay, fresh-install
smoke, release or tag was run. Those optional rehearsals remain separate from
the preserved-state rebuild.

The walkthrough retains its explicit local CSRF opt-out; this is not a production
security qualification. The manual fixture keeps its separate loopback database,
route guard and actual session checks. Private build/inventory/mount/readiness
records are in `.tmp/manual-session-cancellation-2026-10-21/`.

The [owning outcome](MANUAL_SESSION_CANCELLATION_OUTCOME.md) records cancellation
proof and its limits. Next: perform the [manual acceptance procedure](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
with an available operator, then physical-device safe-area and keyboard checks.

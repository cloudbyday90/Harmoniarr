# Local Docker manual history fixture rebuild outcome

Completed October 21, 2026, following the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). The isolated manual fixture's
database/container is separate from this existing deployment.

Current local image:
`sha256:317296581b9d93e5017c40e6da7476e656bf6769bdd3a8af05e0dc2f0b490ea4`.
Previous image:
`sha256:06d9c2108b0ef65c08654486cb44ed867168ce3d2a0f21d8d6fc744244386682`.

An owned unique BuildKit builder executed `--pull --no-cache --load` against the
existing Dockerfile and local walkthrough image tag. Its removal was verified.
The resulting image was inventoried in an owned read-only/network-disabled
container, which also retired. The final browser/fast build and all 155 packaged
client artifacts match exactly. All 865 server and 11 shared files retain their
previous bytes/modes; all client artifacts also match the previous image.
Inventories retain the same 110 npm and 147 OS package versions. This round's
fixture/CLI lives outside the packaged runtime; package scripts/documentation
changed without an application version or release.

The walkthrough was recreated with `up -d --wait --no-build`, keeping all five
existing bind-mount sources, destinations and access modes, including its actual
download-folder override. It is healthy and read-only on `127.0.0.1:47956`, running
Linux x64, Node 24.22.0, UID 1000. The public one-shot bootstrap helper confirmed
the existing admin and was removed. Startup applied zero new migrations and
verified 111 applied, zero pending.

The documented readiness-only provider check passed with configured-provider
and path-mapping prerequisites still required. It used a temporary password-only
file outside the repository; removal was verified. It issued no provider search
or transfer command and supplies no new accepted-transfer/import claim. No data
reset, managed-provider overlay, fresh-install browser smoke, release or tag was
created. Optional independent rehearsals remain separate from preserved-state
rebuild evidence.

The walkthrough retains its explicit local CSRF opt-out. The application default
and independent authorization/CSRF checks are not weakened by the manual fixture;
this local deployment is not a production security qualification.

Private evidence: `.tmp/metadata-history-manual-2026-10-21/`, including build,
builder retirement, before/after inventories, runtime comparison, preserved
mounts, migration and readiness records. The owning code/validation outcome is
[recorded separately](METADATA_HISTORY_MANUAL_FIXTURE_OUTCOME.md).

Next: use the [prepared manual session](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
with a screen-reader operator. Physical-device safe-area/keyboard acceptance
remains a separate, unperformed follow-up.

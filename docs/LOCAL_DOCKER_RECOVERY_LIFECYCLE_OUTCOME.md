# Local Docker recovery lifecycle outcome

Completed October 21, 2026 after final focused/native/database/fast qualification,
following the preserved-installation path in
[the local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

## No-cache build and preserved upgrade

An invocation-owned BuildKit builder performed `--pull --no-cache --load`, then
was removed with retirement verified. The new local image is:

```text
sha256:1018eb093f161313f940d365d93a8c33e7a31915706bddb639770c777edf1efc
```

Previous preserved image:

```text
sha256:d91a9f770e6c3b274549aa9a0d95f2919edd00b78591cdb42db274c26c410a0b
```

Recreated the walkthrough with `up -d --wait --no-build`, preserving the actual
completed-download host override obtained from the prior container. It is healthy,
read-only, Linux x64, Node 24.22.0, UID 1000, bound only to `127.0.0.1:47956`.
All five bind-mount source/destination/access-mode records match the previous
installation. Existing data and admin were retained; the disposable public
bootstrap helper confirmed the existing admin and removed itself.

Startup applied the one new armed-state uniqueness migration and verified **112
applied, zero pending**. No historical recovery material was selected or cancelled
to make the migration pass. Provider/path readiness-only validation passed with
a temporary password-only file outside the repository; removal and absence were
verified afterward.

## Packaged artifact comparison

Invocation-owned read-only/network-none inventory containers acknowledged the
exact images, exited successfully and were removed with retirement verified.
Of 869 server files, these six new/changed paths match the final source bytes:

- `migrations/20261021_223053_admin_recovery_one_armed_run.sql`
- `recovery/admin-recovery-operator-service.js`
- `recovery/admin-recovery-service.js`
- `recovery/admin-recovery-store.js`
- `schema-anchor-service.js`
- `schema-snapshot.sql`

All other server files retain their bytes/modes. All 11 shared files and 155
client artifacts are unchanged; client files match the native-tested/final-fast
build. The same 110 npm package versions and 147 OS package versions are present.
The final source fingerprint and validation scope are in the
[lifecycle outcome](RECOVERY_LIFECYCLE_OUTCOME.md).

## Limits and next item

This is preserved local deployment, migration and readiness evidence. Armed
recovery concurrency/rollback/ambiguity proof used separate disposable fixtures;
no recovery run was armed on this installation. No reset, fresh-install smoke,
managed-provider overlay, search, transfer, import or registry release was needed.
The pre-existing local CSRF opt-out remains a walkthrough setting; this does not
establish production security readiness. No release, tag or image publication was
created. Private logs retain build, inventory, migration, mount and readiness
records, without committed credentials.

Next, qualify recovery CLI cleanup and one-time material output, including actual
stream drainage and uncertain committed outcomes. Keep any retry/replacement an
explicit operator decision. The migration scaffold's missing copyright header is
also recorded as an authoring-tool follow-up.

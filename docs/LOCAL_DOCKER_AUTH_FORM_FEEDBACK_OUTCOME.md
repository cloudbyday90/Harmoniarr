# Local Docker authentication feedback rebuild outcome

Completed October 21, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

Current local image:
`sha256:3219655e7087c24f94217bf0739e52dfb4ad2d903d096bfc6083bbd25648b34c`.
Previous image:
`sha256:9105298ee7ce9046ce6198fd3afc01b7dbc3b360cff26f3c8fbfc93eeef32951`.

An invocation-owned BuildKit builder completed `--pull --no-cache --load` against
the existing Dockerfile/local walkthrough tag, then retired with removal verified.
Owned read-only/network-disabled inventory containers also retired. All 865
server and 11 shared artifacts retain prior bytes/modes; all 110 npm and 147 OS
package versions match. The 156 client artifacts match the final local native
browser/fast build. Of those paths, 57 have new/changed bytes, including ordinary
bundler dependency-hash propagation. No server/shared code, dependency or
application version changed.

The existing Compose app was recreated using `up -d --wait --no-build`. It is
healthy/read-only at `127.0.0.1:47956`, running Linux x64, Node 24.22.0, UID 1000.
All five bind mounts preserve exact sources, destinations and access modes,
including the current completed-download override. The disposable public
bootstrap helper confirmed the existing admin and retired. Startup applied no
new migrations and verified 111 applied, zero pending.

Documented readiness-only provider validation passed with configured-provider
and path-mapping requirements retained. Its temporary password-only file was
removed. It submitted no searches/transfers and supplies no new provider
acceptance or import claim. No reset, managed-provider overlay, fresh-install
smoke, deployment release rehearsal, release or tag was run; those documented
optional paths are separate from the preserved-state rebuild.

The walkthrough retains its explicit local CSRF opt-out, so this is not a
production security qualification. Auth UI qualification used the separate fresh
real-app/database browser fixture. Private build, inventory, mount, migration and
readiness records are in `.tmp/auth-form-feedback-2026-10-21/`.

See the [owning outcome](AUTH_FORM_FEEDBACK_OUTCOME.md) for authentication feedback
proof and limits. Next: evaluate the recovery form with its expiry, attempt and
safety-hold gates intact; actual operator/device accessibility acceptance remains
deferred.

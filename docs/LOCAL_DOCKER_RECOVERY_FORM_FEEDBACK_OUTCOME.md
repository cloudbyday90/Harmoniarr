# Local Docker recovery feedback rebuild outcome

Completed October 21, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

Current local image:
`sha256:34722bb07b69a6ad78c09038911762c77d4ecdc7e308fb6655c81af675a0a012`.
Previous image:
`sha256:3219655e7087c24f94217bf0739e52dfb4ad2d903d096bfc6083bbd25648b34c`.

An invocation-owned BuildKit builder completed `--pull --no-cache --load` against
the existing Dockerfile/local walkthrough tag, then retired with removal verified.
Owned read-only/network-disabled inventory containers also retired. All 865
server and 11 shared artifacts retain prior bytes/modes; all 110 npm and 147 OS
package versions match. The 155 client artifacts match the final native-browser/
fast build. Of those paths, 59 are new/changed, including ordinary bundler hash
propagation. No dependency or application version changed.

The preserved Compose app was recreated using `up -d --wait --no-build`. It is
healthy/read-only at `127.0.0.1:47956`, running Linux x64, Node 24.22.0, UID 1000.
All five bind mounts preserve exact sources, destinations and access modes,
including the existing completed-download override. The disposable public
bootstrap helper confirmed the existing admin and retired. Startup applied no
new migrations and verified 111 applied, zero pending.

Documented readiness-only provider validation passed with configured-provider
and path-mapping requirements retained. Its temporary password-only file was
removed. It submitted no searches or transfers and supplies no new provider
acceptance/import claim. No reset, managed-provider overlay, fresh-install smoke,
deployment release rehearsal, release or tag was run; those optional documented
paths remain separate from the preserved-state rebuild.

The walkthrough retains its explicit local CSRF opt-out, so this is not a
production security qualification. No recovery run was armed on this preserved
installation. Actual recovery qualification used fresh owned app/database
fixtures, with codes/passwords masked in screenshots. Private build, inventory,
mount, migration and readiness records are in
`.tmp/recovery-form-feedback-2026-10-21/`.

See the [owning outcome](RECOVERY_FORM_FEEDBACK_OUTCOME.md) for native feedback,
focus and server refusal proof. Next: correct the separately reproduced cached
recovery countdown using an owned reactive clock and cleanup while retaining
server expiry authority. Actual AT/device acceptance remains deferred.

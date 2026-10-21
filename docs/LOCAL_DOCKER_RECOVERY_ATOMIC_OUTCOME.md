# Local Docker atomic recovery outcome

Completed October 21, 2026 after stable focused, native and full fast validation,
following the preserved-installation path in
[the local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

## Build and preserved deployment

An invocation-owned BuildKit builder performed `--pull --no-cache --load` and
was removed with retirement verified. The local image is:

```text
sha256:d91a9f770e6c3b274549aa9a0d95f2919edd00b78591cdb42db274c26c410a0b
```

Previous image:

```text
sha256:443dabeedf8a5c48979c72e4157c447fe20f2690a975042379c1f86bd019b2e1
```

The walkthrough was recreated with `up -d --wait --no-build`, preserving the
actual completed-download host override obtained from the prior container. It is
healthy, read-only, Linux x64, Node 24.22.0, UID 1000, bound only to
`127.0.0.1:47956`. All five bind-mount source/destination/access-mode records match.
The disposable public bootstrap helper confirmed the existing admin and removed
itself. Existing data were retained.

Startup verified 111 applied migrations, zero newly applied and zero pending.
Configured provider/path readiness-only validation passed using a password-only
file outside the repository; its removal and absence were verified.

## Exact packaged comparison

Read-only/network-none inventory containers acknowledged each image, exited
successfully and were removed with retirement verified. Of 867 server files,
exactly these four new/changed paths match the final source:

- `recovery/admin-recovery-account-store.js`
- `recovery/admin-recovery-completion-service.js`
- `recovery/admin-recovery-service.js`
- `recovery/admin-recovery-store.js`

All other server files and all 11 shared files retain their bytes/modes. All 155
client artifacts are unchanged and match the native-tested/final-fast local
build. The same 110 npm package versions and 147 OS package versions are present.
No dependency or image-baseline version update was introduced.

Private logs retain build, inventory, source/client manifests, mount comparison,
migration/readiness output and owned resource retirement. The final source
fingerprint and validation scope are in the
[atomic recovery outcome](RECOVERY_ATOMIC_OUTCOME.md).

## Limits and next item

No recovery run was armed on the preserved installation. Atomicity, overlap and
rollback were qualified separately on disposable native fixtures. This rebuild
is local deployment/readiness evidence, without reset, fresh-install smoke,
managed-provider overlay, search/transfer/import qualification or image release.
The pre-existing local CSRF opt-out remains a walkthrough setting; this is not
production security qualification. No release, tag or registry publication was
created.

Next, qualify the operator arm/force-rearm/cancel path before choosing atomic
replacement and one-active-run enforcement. Keep that native proof separate
from preserved-installation readiness and deferred manual AT/device acceptance.

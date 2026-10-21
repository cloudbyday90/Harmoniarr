# Local Docker recovery countdown outcome

Completed October 21, 2026 after the stable recovery countdown candidate passed
focused, native and full fast validation. Followed the preserved-installation
path in [the local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).

## Rebuild and readiness

Built `harmoniarr:walkthrough-local` through an invocation-owned BuildKit builder
with `--pull --no-cache --load`, then removed and verified retirement of that
builder. The resulting image is:

```text
sha256:443dabeedf8a5c48979c72e4157c447fe20f2690a975042379c1f86bd019b2e1
```

Previous preserved image:

```text
sha256:34722bb07b69a6ad78c09038911762c77d4ecdc7e308fb6655c81af675a0a012
```

Recreated the walkthrough with `up -d --wait --no-build`, preserving the actual
completed-download host override obtained from the running installation. The
public bootstrap helper confirmed the existing admin and removed itself. The
current container is healthy, read-only, Linux x64, Node 24.22.0, UID 1000, bound
only to `127.0.0.1:47956`.

All five bind-mount source/destination/access-mode records match the preceding
installation. Existing data/admin were retained. Startup verified 111 applied
migrations, zero newly applied and zero pending. Readiness-only provider/path
validation passed using a temporary password-only file outside the repository;
the file was removed and its absence verified.

## Packaged artifact comparison

Invocation-owned read-only/network-none inventory containers acknowledged the
exact images and exited successfully before verified removal.

| Artifact | Result |
| --- | --- |
| Server | 865 files, unchanged bytes/modes |
| Shared | 11 files, unchanged bytes/modes |
| Client | 155 files matching the native-tested/final-fast local build |
| Client new/changed paths | 56, including build filename propagation |
| Installed npm packages | Same 110 package versions |
| OS packages | Same 147 versions |

The source fingerprint is recorded in the
[recovery countdown outcome](RECOVERY_COUNTDOWN_OUTCOME.md). Private local logs
retain the no-cache build, inventories, client/source manifests, mount comparison,
readiness and owned builder/helper retirement. Credentials are not part of the
committed evidence.

## Qualification limits and follow-up

This is preserved local deployment/readiness evidence. No recovery run was armed
on this installation. Armed recovery, client time and server refusal proof belong
to the separate fresh fixture in the owning outcome. No reset, managed-provider
overlay, fresh-install smoke, search, transfer or import qualification was needed
for this client-only change. The pre-existing local CSRF opt-out remains a local
walkthrough setting; this run does not establish production security readiness.
No release, tag or image publication was created.

Next, qualify concurrent/partially failed admin-recovery completion in a
disposable native fixture before choosing an atomic persistence refactor. Keep
the manual screen-reader/device acceptance deferred until an operator is
available, using the already prepared isolated fixture workflow.

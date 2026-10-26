# Local Docker schema drift validation design

Freeze reviewed source after focused owner, comparison and CLI tests. Stage new
files for whitespace checking, then run the complete static/server/client/script
and build gate once for the stable candidate. Preserve historical SQL, snapshot
and anchor-contract bytes. Record the source fingerprint and changed-file hashes.

Build with a fresh disposable Buildx builder and `--pull --no-cache --load`.
Compare packaged server files with frozen source and unchanged client/shared,
dependency, OS-package, entrypoint and native-library identities. Recreate the
existing walkthrough using all five inspected bind mounts, retaining its existing
administrator/data and downloads override. Verify login/readiness and remove
temporary credentials/helper resources.

The new compiled-image fixture owns two acknowledged databases and one restricted
role. Verify current and deliberately altered schemas through service and actual
compiled/source CLI processes, fingerprinting ledger/catalog/function identity
around observation. Exercise shared readers versus real preparers, read-only
write refusal, actual lock timeout and backend termination. Drop only acknowledged
owned databases after sessions retire; remove the fixture role and verify absence.

Rerun the affected snapshot (17 cases), preparation serialization, migration CLI
reader and concurrent observation native fixtures on the immutable image. Verify
live old/new diagnostics preserve the ledger/catalog and report current state.

Retain the previous 18 container-replacement and seven entrypoint preparation
qualifications only after exact source/test/runtime/dependency identity review of
their unchanged writer/recovery paths. The shared comparison refactor is separately
covered by the snapshot/owner reruns. Do not claim those matrices were rerun here.
No markup changes require browser or manual AT/device acceptance in this task.
See the [outcome](LOCAL_DOCKER_SCHEMA_DRIFT_OUTCOME.md).

# Local Docker native-file rebuild outcome

October 20, 2026. Followed the applicable build/start/bootstrap/readiness steps in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), using `--pull --no-cache`, Linux
amd64 and subsequent `--no-build` startup. Kept existing data/admin, confirmed the
already-created admin through the disposable bootstrap helper, and verified that
helper and the password-only temporary file were removed. Optional reset, live
download actions and release replay were not performed.

New image:
`sha256:4964f3ec7d70f1693317228139a90cb7652a8a7343deeb0c3b939e131fc85276`.
The running walkthrough matches it, is healthy/read-only and executes Node
24.22.0 as uid 1000 on Linux x64. Application port publication remains only
`127.0.0.1:47956`. Readiness-only acceptance passed; the existing external provider
still reports attention. This fixture work does not change that provider's
configuration or establish live download readiness.

Before replacing the mutable local tag, retained baseline
`sha256:32ed87bb8d18386bef5ac6015d9ea919cd4a136cbeabc421aded871bd761fd52`.
Network-disabled read-only inventory containers found all 852 server, 151 client
and six shared files unchanged in path/hash/mode. All 110 installed package and
147 OS package entries, and the Node runtime, are unchanged. The image's package
metadata now includes the extra opt-in validation command; production artifacts
and dependencies retain their previous identity.

The independent [native completion outcome](NATIVE_FILE_TRANSFER_OUTCOME.md)
uses this image as the Node/dependency companion with current fixture/server
source mounted read-only. It proves actual provider files without exposing test
ports or writing to walkthrough data. Private build, image comparison, readiness
and cleanup evidence remains under `.tmp/native-bytes-2026-10-20/`.

No release, Git tag or application branch was created. Next: native truncated
transfer refusal. Diagnose walkthrough provider attention separately before any
new live acquisition command.

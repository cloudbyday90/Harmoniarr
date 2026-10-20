# Local Docker partial-transfer rebuild outcome

October 20, 2026. Followed the applicable build/start/bootstrap/readiness steps in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md): Linux amd64,
`docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr`,
then `--no-build` startup. Existing data/admin were preserved. The disposable
bootstrap helper confirmed the existing admin and was removed; the password-only
temporary file was also removed. Optional reset, live download and release replay
steps were not needed for this preserved-state validation.

New image:
`sha256:57873135f04eefd4d0c1ff11885336dda63177a543ce260e5bbdf53fdec5dc21`.
The running walkthrough matches it, is healthy/read-only and runs Node 24.22.0
as uid 1000 on Linux x64. Application publication remains
`127.0.0.1:47956`. Readiness-only acceptance passed. The existing external
provider still reports attention; this test-fixture change does not establish a
new live acquisition or resolve that separate operational status.

Retained the prior image before replacing the local walkthrough tag:
`sha256:4964f3ec7d70f1693317228139a90cb7652a8a7343deeb0c3b939e131fc85276`.
Network-disabled, read-only inventory containers verified unchanged path/hash/mode
for all 852 server, 151 client and six shared files. All 110 installed package and
147 OS package entries, and the Node runtime, were unchanged. Package metadata
adds the opt-in native partial validation command; production artifacts and
dependency identities remain unchanged. No image-size or speed improvement is
claimed.

The [native fault outcome](NATIVE_PARTIAL_TRANSFER_OUTCOME.md) uses this image as
the Node/dependency companion with current source mounted read-only. Its four
native cases use private disposable storage and publish no ports, separate from
walkthrough data and external providers. Build, runtime comparison, readiness and
cleanup evidence is private under `.tmp/native-partial-2026-10-20/`.

No release, Git tag or application branch was created. Next: qualify bounded
provider retries/resume in the isolated lane. Diagnose walkthrough provider
attention separately before requesting a new live acquisition.

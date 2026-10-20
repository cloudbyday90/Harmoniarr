# Local Docker slskd qualification rebuild outcome

On October 20, 2026, followed the applicable build/start/bootstrap/readiness
steps in [the local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Built with
`--pull --no-cache`, selected Linux amd64, then started with `--no-build`.
Preserved existing walkthrough data and admin; the one-shot bootstrap helper
reported the existing account and was removed. Optional reset, live download
actions and release/deployment replay were not requested or performed.

Candidate image:
`sha256:32ed87bb8d18386bef5ac6015d9ea919cd4a136cbeabc421aded871bd761fd52`.
The running container matches that image, is healthy and read-only, executes
Node 24.22.0 as uid 1000 on Linux x64, and publishes only loopback port 47956.
The password-only temporary file was removed after the readiness command.

Readiness-only acceptance passed. The existing external provider still reports
`attention`; this does not establish readiness for a new live download. The
separate isolated native fixture does not change that provider's configuration,
account or data.

Compared immutable baseline
`sha256:39427ddc8947a6d507ef0b6f12e8f8f38a08c68d2e551933a3d1a8ad54d1ce80`
with the new image in network-disabled read-only inventory containers. Among
852 server paths, only `slskd/slskd-download-protocol-policy.js` changed. All
151 client and six shared files retain exact path/hash/mode identity. The 110
installed package entries and 147 OS package entries are unchanged. This is
artifact comparison, not a whole-application behavior or vulnerability scan.

Private build, inventory, readiness and cleanup evidence remains under
`.tmp/slskd-0261-2026-10-20/`. The local baseline image was retained before
replacing the mutable walkthrough image tag. No Git tag or release was created.

The [provider qualification outcome](SLSKD_0261_QUALIFICATION_OUTCOME.md) records
the independent native tests. Next, extend the native fixture to controlled
file-byte transfer. Diagnose walkthrough provider attention as a
separate operator journey before attempting a live download.

# Local Docker canonical-command rebuild outcome

October 20, 2026. Followed applicable build/start/bootstrap/readiness steps from
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Built Linux amd64 with
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr,
then no-build startup. Existing data/admin were preserved, the bootstrap helper
confirmed the existing admin and retired, and the temporary password file was
removed. Optional destructive reset and release/live-acquisition replay were
not needed.

Running image:
sha256:9370e6949cfa76c0de13989c5a056a9d3ba3a2a2f131e32c3e1a2a12b8fe6e7f.
The app is healthy/read-only, Node 24.22.0 Linux x64 uid 1000, publishing only
127.0.0.1:47956. Startup applied one migration and verified 109 applied, 0 pending.
Readiness-only acceptance passed; existing external-provider attention remains
an operational follow-up before intentional live acquisition.

Baseline retained as harmoniarr-native-canonical:baseline-2026-10-20:
sha256:5690ad5225ef9e4f9d4edb40a852ab762e4d173a2c8f7cc3fe041ad8a153d434.
Network-disabled/read-only inventory containers verified exactly three changed
server files (Activity admission, schema anchors, generated snapshot), one added
migration and no removed server files. Runtime totals: 853 server, 151 client,
six unchanged shared files. Client output has 56 replaced hashed assets and an
updated index.html, built from the frozen client inputs.

All 110 npm package entries and Node match the baseline. Of 147 OS package
entries, 146 match; the no-cache package install changed ca-certificates from
20260909-r0 to 20261020-r0. This is observed package-version evidence, not a
claim about trust-store contents or vulnerability remediation. No runtime speed
or image-size gain is claimed.

Final native command/media proof uses this immutable image with current source
mounted read-only, fresh test PostgreSQL and a disposable internal provider
project; it does not access walkthrough data. The browser evaluation lint fix
after build changed only its test file; production build/schema inputs stayed
identical. See the [canonical outcome](NATIVE_CANONICAL_COMMAND_OUTCOME.md).
Build, runtime inventories, migration/startup and readiness evidence is private
under .tmp/native-canonical-2026-10-20/. No release, Git tag or new branch.

Next: canonical discovery ingestion into the qualified pipeline, while keeping
the walkthrough's existing provider attention a separate operational task.

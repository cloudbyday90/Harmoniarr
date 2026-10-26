# Local Docker snapshot anchor validation design

Build the stable candidate with a fresh disposable Buildx builder, `--pull` and
`--no-cache`, then load the local walkthrough tag. Record the immutable image ID,
compare packaged server files with frozen source and verify unchanged client,
shared code, dependencies, OS packages, entrypoint and loaded native binaries.
This is local validation; no image publication, release or tag is created.

Use the existing walkthrough's inspected five actual bind mounts, including its
downloads override. Recreate only that application with the candidate image;
retain its administrator and data. Verify loopback-only port 47956, read-only
root filesystem, healthy startup, zero pending migrations and existing-admin
login/readiness. Remove the temporary password file and bootstrap helper.

Run the expanded snapshot fixture against compiled modules inside the immutable
image. Each acknowledged private database has independent observer connections,
reviewed retry and verified retirement. Deliberate tail migrations preserve
complete matching receipts while corrupting table/column/constraint/index/trigger
facts. The baseline expected contract remains independent of those tails.

Retain the preparation-owner, ordinary migration, CLI reader, observation,
startup recovery and direct migration-only native fixtures. Qualify the seven
entrypoint preparation cases and 18 container-replacement checkpoints on owned
volumes. These cover real production startup, same-volume WAL recovery and
background services. Restrict native containers' network, privileges, memory,
CPU, PIDs and storage; do not stop unrelated host workloads.

The final audit binds static/unit/script/build results, immutable runtime facts,
native evidence, acknowledged resource retirement and unchanged historical SQL.
See [implementation design](SNAPSHOT_ANCHORS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SNAPSHOT_ANCHORS_OUTCOME.md). Manual screen-reader
and physical-device acceptance remain deferred because no markup changed.

# Local Docker shared media admission outcome

Completed October 23, 2026 using the preserved-state path in the
[local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). See separate
[design](MEDIA_COMMAND_ADMISSION_DESIGN.md), [research](MEDIA_COMMAND_ADMISSION_RESEARCH.md)
and [qualification outcome](MEDIA_COMMAND_ADMISSION_OUTCOME.md).

Two fresh owned Buildx builders ran `--pull --no-cache --load`. The first candidate
was rebuilt after concurrent qualification exposed an artwork rewrite-phase
timeout. Both builders were removed with absence checked.

- Previously published image: `sha256:e65fd0c8a2be6a3e4f190674d65614ffb713ded41e021b95d72dca1bc9be2e73`.
- Intermediate image: `sha256:2243164d3a13a9ae11716ce3fc1f6ebc173c6788b648b135097b29bb19744d68`.
- Final image: `sha256:2cf5917edef018c3b4629b39d9ce7427a2bc5b84a4817515e003c294f4e3ad36`.

Compose used `up -d --wait --no-build`. The final application is healthy at
`http://127.0.0.1:47956`, Linux amd64, UID 1000, with read-only root. All five actual
bind mounts, including the completed-download override, matched across both
rebuilds. Existing admin/data was preserved. Bootstrap confirmed the existing
admin and retired its helper. Startup applied zero migrations and verified 112
applied, zero pending.

Readiness-only browser validation passed after each rebuild with the existing
provider/path mappings. It submitted no new search/download and does not prove an
accepted transfer. Password-only temporary files were outside the repository and
removed. Provider attention remains separate from controlled qualification.

Comparison with the previously published image found exactly the six reviewed
server changes: app wiring, runtime configuration, command facade, new admission
and process modules, and artwork rewrite timing. All other server bytes/modes,
11 shared files and 155 client artifacts match. The final image contains 903
server files. Node binary, 110 production npm versions and 151 APK versions match
the baseline. Package metadata adds one explicit native lane; lockfile/version
are unchanged. Runtime remains Node 24.22.1/npm 12.0.2, Sharp 0.35.5/libvips 8.18.7,
FFmpeg/FFprobe 8.0.1 and PostgreSQL 18.6.

Final native source passed two command cases, 18 artwork lifecycle/corpus/memory
checks and all four shared-container cases in each fresh 2/3 GiB profile on this
exact image. Source/artifact hashes were checked separately. Failed provisional
logs remain retained, and every owned qualification container was removed with
absence checked. The existing app remains running; no second deployed service,
release, tag or version bump was created.

Next: carry durable-worker cancellation through readiness and the shared command
owner, retaining actual process/stdio close and lease finalization.

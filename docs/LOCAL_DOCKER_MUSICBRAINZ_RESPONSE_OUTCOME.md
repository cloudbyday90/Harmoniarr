# Local Docker MusicBrainz response outcome

Completed October 21, 2026 local time, following the preserved-data path in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Transport behavior and standards
scope belong to [the owning outcome](MUSICBRAINZ_RESPONSE_OUTCOME.md).

## No-cache build and startup

An invocation-owned BuildKit builder ran `--pull --no-cache --load` with the
existing pinned Dockerfile and local walkthrough tag. The builder was removed
and absence verified. Compose ran `up -d --wait --no-build`, then the disposable
bootstrap profile/helper. All five bind mount source/destination/access records,
completed-download override and existing admin/data were preserved.

Previous image:

```text
sha256:8bd4f99eddedd2de8288e0a1ffa04008392140cf2b5358c7dd46394eaf1a858b
```

Qualified current image:

```text
sha256:60e15109e966955944cf1235ecc4c2c82cc1fc2639979947a625b82cecbc4029
```

The app is healthy, read-only, Linux amd64, UID 1000 and bound only to
`127.0.0.1:47956`. Bootstrap confirmed the existing admin and left no helper
container. Startup applied **0 migrations**, verified **112 applied**, and
reported **0 pending**. Configured provider/path readiness-only browser validation
passed. Its password-only temporary file was removed and absence verified.
Existing provider and CSRF configuration remained in place.

## Artifact and packaged qualification

The image contains 876 server files. Exactly seven new/changed server files match
tested source: dependency health, the shared parser/core wrapper, MusicBrainz
client/request service/response policy and metadata routes. All other existing
server/shared bytes and modes match the preceding image. All 155 client artifacts
and 11 shared files remain unchanged and match the final build/source. Inventory
containers were retired.

Node **24.22.1**, npm **12.0.2**, OpenSSL **3.5.9**, bundled Undici **7.30.1**,
the Node executable hash, package/lock metadata, 110 production npm packages and
147 OS package versions remain unchanged. The Node binary SHA-256 is
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`.

A separate read-only, network-none, UID-1000, resource-limited container imported
the actual packaged MusicBrainz client and shared wrapper. It verified safe
transport failures, artist overflow refusal, larger release acceptance and the
unchanged 2 MB ceiling for other providers. Default TLS verification remained
enabled. Exact container removal and absence were verified. The separate 14-test
Linux lane established real loopback HTTPS behavior without accounts or remote
network access; packaged synthetic parsing alone does not establish TLS proof.

Readiness establishes configured provider/path usability, not a new MusicBrainz
query, transfer, import or recovery command. No data reset, volume deletion,
release, tag, registry publication or deployment topology change occurred.
Fresh-install/backup-restore/full-release matrices were not repeated for this
HTTP-only change. Private build, mount, runtime, readiness and retirement evidence
is in `.tmp/musicbrainz-response-2026-10-21`.

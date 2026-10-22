# Local Docker Last.fm response outcome

Completed October 21, 2026 using the preserved-data flow in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Last.fm/native HTTPS evidence
belongs to [the owning outcome](LASTFM_RESPONSE_OUTCOME.md).

## Installation and build

An invocation-owned BuildKit builder performed `--pull --no-cache --load` against
the existing pinned Dockerfile. The builder was removed and absence verified.
Compose ran `up -d --wait --no-build`, followed by the explicit disposable
bootstrap helper. Existing admin/data and all five bind mount source/destination/
access records were preserved, including the completed-download host override.

Previous image:

```text
sha256:ee765700649188011314006b63e4478af781dcfc2619f0bc0b61543e9736306e
```

Qualified current image:

```text
sha256:8bd4f99eddedd2de8288e0a1ffa04008392140cf2b5358c7dd46394eaf1a858b
```

The app is healthy, read-only, Linux amd64, UID 1000 and exposed only at
`127.0.0.1:47956`. Bootstrap confirmed the existing admin, exited successfully
and left no helper container. Startup applied **0 migrations**, verified
**112 applied**, and reported **0 pending**. Configured provider/path
readiness-only browser validation passed. Its password-only temporary file was
removed and absence verified. Existing provider and CSRF configuration remained.

## Runtime and artifact checks

Of 873 packaged server files, only `lastfm-client.js` and the new
`lastfm-request-service.js` differ from the preceding image. Both match tested
source. Other existing file bytes/modes match. All 155 client and 11 shared files
are unchanged and match the final build/source respectively. Inventory containers
were retired.

Node **24.22.1**, npm **12.0.2**, OpenSSL **3.5.9**, bundled Undici **7.30.1**,
actual Node executable hash, root package/lock metadata, 110 production npm
package versions and 147 OS package versions remain unchanged. The public test CA,
fixture proxy and test credentials are not deployment configuration.

A separate read-only, network-none, UID-1000 container imported the actual
packaged Last.fm client and request service. It verified a sanitized transport
failure and a rejected oversized JSON response using synthetic input. Default
TLS verification remained enabled; exact container removal and absence were
verified. The separate 11-test Linux lane exercised real loopback HTTPS.

Readiness establishes configured provider/path usability, not a new live Last.fm
result, search, download, import or recovery command. This change required no new
fresh-install/backup-restore/full-release matrix. No reset, data deletion, release,
tag or deployment topology change was performed. Private build, artifact, mount,
readiness and cleanup evidence is under `.tmp/lastfm-bounds-2026-10-21`.

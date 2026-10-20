# Local Docker saved-search recovery outcome

Date: 2026-10-20. Followed the preserved-data rebuild/start/bootstrap/readiness
path in [the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Feature design and
validation are recorded separately in [the recovery outcome](SEARCH_RECOVERY_OUTCOME.md).

The fresh owned BuildKit builder used `--pull --no-cache --load` and was removed
afterward. The new local `harmoniarr:walkthrough-local` image is
`sha256:53288dd6ee43e376a313398895453cc6d47768674f8e1a31532c889f7315b13b`.
Its predecessor was
`sha256:dc3204171d8287f20da79546696d032bda2bb04e2351a53b79b071d26f8b8379`.

Compose startup passed. The app is healthy, read-only and runs as UID 1000 with
Node 24.22.0 on linux/x64, published only on `127.0.0.1:47956`. Existing data and
the walkthrough administrator were preserved. The one-shot bootstrap helper
confirmed the existing account and was removed. Startup applied zero migrations
and verified 110 applied, zero pending. No reset was performed.

The readiness-only validator passed using a temporary password file outside the
repository; removal was verified. Provider configuration and download mapping
were present. Existing provider queue attention remains unresolved. The check
reads existing provider state and submits no search or transfer commands; it
does not establish a newly accepted download or public-network search.

Read-only, network-isolated artifact inventories were collected from both images
with verified helper retirement. They contain 860 server files, 151 client files
and now seven shared files. Exactly six server files changed, each matching the
reviewed source; other server bytes/modes are identical. The shared recovery
policy matches source and all six previous shared files are identical. All client
bytes match the final local production build; 55 paths changed with rebuilt
content/chunk names. Existing permissions are preserved, including executable
source/static assets. The 110 npm and 147 OS package records and Node version are
unchanged. The first private comparison incorrectly required all assets to have
mode 0644; the corrected comparison verifies the actual prior path modes and
expected new source/built-asset modes without changing the image.

Private logs, source fingerprints, runtime inventories, builder retirement and
readiness evidence are retained under `.tmp/search-recovery-2026-10-20/`.
No release image was published and no tag/release was created.

Next: implement explicit recovery for approved external-request searches with
current recipient/intent locks, audit and replay, then qualify that command in
PostgreSQL and the browser. Keep the existing provider queue attention as a
separate operational investigation.

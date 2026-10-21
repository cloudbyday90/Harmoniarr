# Ignored-source return local Docker outcome

Date: 2026-10-20. Uses the preserved [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
The separate [feature outcome](IGNORED_REVIEW_RETURN_OUTCOME.md) owns the native
PostgreSQL/browser journey and focused navigation evidence.

A fresh owned BuildKit builder ran `--pull --no-cache --load` with the existing
Dockerfile, tagging `harmoniarr:walkthrough-local`. Builder retirement was verified.
The new immutable image is
`sha256:dd34ed7cb13701e585cfef287a0b5f4adbb0b4284e9b1dbd162e27e1582c4636`, replacing
`sha256:eb515c54f74dae34cf16a2cf2359ccc6f03804364bd7211a92184224cf333a4c`.

Compose used `up -d --wait --no-build harmoniarr` and the documented one-shot
bootstrap. Existing administrator/data were retained, bind-mount identities were
compared, and bootstrap confirmed the existing account. Its helper was removed.
Startup verified 111 applied migrations, zero pending and zero newly applied.
The app is healthy on loopback `127.0.0.1:47956`, with read-only root, actual
linux/x64 Node 24.22.0 and uid 1000.

Readiness-only provider acceptance passed with the existing configured provider/
path mapping and queue attention (`no_unlocked_files` diagnostics). It submits no
live search or transfer; historical acceptance is not a new transfer. The temporary
password-only file was removed. Walkthrough development configuration remains
separate from native protected-command evidence.

Network-disabled/read-only inventory containers were retired. The image contains
865 server, 155 client and 11 shared files. All server/shared bytes and modes are
unchanged from the previous image. Every client byte matches the final local
build; 58 client paths changed through content/chunk names, with two more packaged
client files. Shared files match source. The 110 npm and 147 OS package inventories
remain unchanged.

Private build, cleanup, inventory, mount, migration and readiness records live in
`.tmp/ignored-review-return-2026-10-20/`. There was no walkthrough reset, published
image, live-provider acquisition, release, tag or version change.

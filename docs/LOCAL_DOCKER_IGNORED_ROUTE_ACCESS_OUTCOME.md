# Ignored-source admission local Docker outcome

Date: 2026-10-20. Uses the preserved [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md).
The separate [feature outcome](IGNORED_ROUTE_ACCESS_OUTCOME.md) owns the native
session/API/browser controls and final source verification.

A fresh owned BuildKit builder ran `--pull --no-cache --load` using the existing
Dockerfile, tagging `harmoniarr:walkthrough-local`. Builder retirement was verified.
The new local immutable image is
`sha256:3c40ceb27661b0c9d5d19fdffefa11633b8001438573b7ac241fbe9ebf4deabe`, replacing
`sha256:dd34ed7cb13701e585cfef287a0b5f4adbb0b4284e9b1dbd162e27e1582c4636`.

Compose used `up -d --wait --no-build harmoniarr` and the documented one-shot
bootstrap. The existing administrator/data were retained, bind-mount identities
were compared and bootstrap confirmed the existing account. Its helper was
removed. Startup verified 111 applied migrations, zero pending and zero newly
applied. The app is healthy on `127.0.0.1:47956`, with read-only root, actual
linux/x64 Node 24.22.0 and uid 1000.

Readiness-only provider acceptance passed with the configured provider/path
mapping and existing queue attention (`no_unlocked_files` diagnostics). It submits
no live search or transfer; historical acceptance is not a new transfer. The
temporary password-only file was removed. Walkthrough development configuration
remains distinct from native protected-command evidence.

Read-only/network-disabled inventory containers were retired. The image contains
865 server, 155 client and 11 shared files. All server/shared bytes and modes are
unchanged from the previous image. Every client byte matches the final local
build; 56 client paths changed through content/chunk names. Shared bytes match
source. The 110 npm and 147 OS package inventories remain unchanged.

Private build, cleanup, inventory, mount, migration and readiness records live in
`.tmp/ignored-route-access-2026-10-20/`. No walkthrough reset, published image,
live-provider acquisition, release, tag or version change was performed.

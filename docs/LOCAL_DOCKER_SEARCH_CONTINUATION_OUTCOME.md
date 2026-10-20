# Local Docker durable-search rebuild outcome

October 20, 2026. Followed the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md)
preserved-state no-cache build/start/bootstrap/readiness path. A fresh owned
BuildKit builder ran --pull --no-cache, loaded the image, then retired with
removal verified. Final immutable app image:
`sha256:dc3204171d8287f20da79546696d032bda2bb04e2351a53b79b071d26f8b8379`.

The recreated service is healthy/read-only, runs Node 24.22.0 linux/x64 as uid
1000 and publishes only 127.0.0.1:47956. Existing walkthrough data/admin were
preserved. Bootstrap acknowledged the existing admin and its one-shot helper
retired. Startup applied the one new additive migration and verified 110 applied,
zero pending. The temporary readiness password file was removed.

Network-disabled read-only inventory containers compared against prior image
`sha256:3fff1db1e030c88cee186d26d2751c44cfe9ec5ed6ca883519a2578b0ef90020`.
The 860 server files contain exactly the 18 intended added/changed paths: six
new files and twelve modifications. Every changed packaged hash matches final
source; remaining server files, all 151 client files and six shared files match
bytes/modes. Node, 110 npm packages and 147 OS packages are unchanged. Both
inventory containers retired.

The [native continuation case](SLSKD_SEARCH_CONTINUATION_OUTCOME.md) passed with
this app image and slskd 0.26.1.0 image
`sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4`.
It used separate disposable PostgreSQL/provider/media storage and an internal
network with no published ports. It verified supplied UUID acceptance, read
continuation with no second POST, canonical ingestion/acquisition and valid/
corrupt publication boundaries.

Walkthrough readiness passed. Existing provider queue attention remains an
operational follow-up; readiness-only validation initiated no new external
transfer. The local loopback CSRF opt-out remains separate from protected
application defaults exercised by native command refusals. No reset, release,
tag, new application branch or PR merge was performed.

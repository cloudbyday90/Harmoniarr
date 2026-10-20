# Local Docker native-search rebuild outcome

October 20, 2026. Followed the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) no-cache
build, startup, existing-admin bootstrap and readiness-only path. Build used
--pull --no-cache and produced immutable app image
sha256:36cabe32e0f59e1b5866d635aaeef25f51976ab49e805cdded4b7835e6c7ac34.

The recreated service is healthy, read-only and runs Node 24.22.0 linux/x64 as
uid 1000. Its only published endpoint is 127.0.0.1:47956. Existing walkthrough
data/admin were retained; bootstrap acknowledged the existing account and its
one-shot helper retired. Startup verified 109 applied migrations, zero pending
and zero newly applied. The temporary readiness password file was removed.

Read-only, network-disabled inventory containers compared against previous image
sha256:1a6c711f722f81a5feea00fd5c53892981bbd16a93079ce395937e648c1cf078.
All 853 server, 151 client and six shared files have identical bytes/modes.
Node, 110 npm packages and 147 OS packages are unchanged. Both inventory
containers were acknowledged and removed. The new image identity reflects a
rebuild; this slice changes qualification fixtures/docs, not production runtime.

The final [native search case](NATIVE_SEARCH_OUTCOME.md) passed against this app
image and slskd 0.26.1.0 image
sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4.
It uses a separate internal network, publishes no ports and owns disposable
PostgreSQL/provider/media storage. Native source/query/payload evidence is kept
separate from packaged-runtime inventory and walkthrough readiness.

Readiness passed. Existing provider queue attention remains an operational
follow-up; readiness-only validation did not initiate a new external transfer.
The walkthrough's explicit loopback CSRF opt-out remains separate from protected
application defaults exercised by native command refusals. No reset, release,
tag, new application branch or PR merge was performed.

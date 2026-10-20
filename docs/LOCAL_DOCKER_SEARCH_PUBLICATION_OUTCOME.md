# Local Docker search-publication rebuild outcome

October 20, 2026. Followed the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md)
preserved-state no-cache build/start/bootstrap/readiness path. A fresh owned
BuildKit builder ran --pull --no-cache, loaded the local image, then was removed
with retirement verified. Immutable app image:
`sha256:3fff1db1e030c88cee186d26d2751c44cfe9ec5ed6ca883519a2578b0ef90020`.

The recreated service is healthy and read-only, running Node 24.22.0 linux/x64 as
uid 1000, published only on 127.0.0.1:47956. Existing data/admin were preserved;
the bootstrap acknowledged the existing admin and its one-shot container retired.
Startup verified 109 applied migrations, zero pending and zero newly applied.
The readiness password file was removed after the check.

Network-disabled read-only inventory containers compared the image against
`sha256:36cabe32e0f59e1b5866d635aaeef25f51976ab49e805cdded4b7835e6c7ac34`.
The 854 server files contain exactly three intended differences: changed
import-candidate-service.js and library-external-request-discovery-service.js,
and added slskd-search-response-service.js. Their packaged hashes match final
source. All remaining server files, all 151 client files and six shared files
match bytes/modes. Node, 110 npm packages and 147 OS packages are unchanged.
Both inventory containers retired.

The [native acquisition case](SLSKD_SEARCH_PUBLICATION_OUTCOME.md) passed using
this app image and slskd 0.26.1.0 image
`sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4`.
It used separate disposable storage and an internal network with no published
ports. Ordinary native qualification is separate from injected timing controls.

Walkthrough readiness passed. Existing provider queue attention remains an
operational follow-up; readiness-only validation initiated no new external
transfer. The walkthrough's saved loopback CSRF opt-out remains distinct from
protected application defaults exercised by the native command refusals.
No reset, release, tag, branch creation or PR merge was performed.

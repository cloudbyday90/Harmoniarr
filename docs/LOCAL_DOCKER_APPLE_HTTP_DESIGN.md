# Apple Music Docker qualification design

October 28, 2026. Qualifies the [implementation](APPLE_HTTP_DESIGN.md) in the
existing application image; [outcome](LOCAL_DOCKER_APPLE_HTTP_OUTCOME.md) records
executed source/image identity and limitations.

Freeze code, workflow bytes and the removed legacy adapter, then run one complete
fast gate with the repository's pinned Node toolchain. Build using fresh BuildKit,
`--pull --no-cache`, then compare exact packaged source/client/shared bytes,
runtime, npm and OS packages against the preceding immutable image. Explicitly
verify the legacy file is absent. Preserve the administrator, actual five bind
sources, read-only root and loopback 47956 walkthrough. Automatic database
preparation/maintenance remains; no manual schema refresh is introduced.

`test/native/apple-music-http.test.js` is an opt-in 3 GiB Linux fixture using actual
packaged Node HTTPS/TLS and PostgreSQL. Public fixture trust and test-only loopback
connection routing preserve original provider URL, Host/SNI and the default
certificate/name verifier. Compare matched, untrusted and trusted wrong-name
controls before claiming identity. No real Apple account or public DNS is used.

Cover compressed/identity success, exact output limits, oversized/malformed bodies,
known HTTP failures, Retry-After, redirect non-contact, header/body deadlines,
active cancellation and shutdown. Observe actual request/socket closes before
fixture destruction. Hold an issued native DNS callback beyond caller failure
and prove neither other providers nor shutdown can bypass its occupied slot.

Use an actual encrypted saved private key and default application collection
access service to establish startup/provider-module/resolver/client wiring.
Exercise all six catalogue methods through the real resolver, verify signed JWTs
cryptographically, and check one client reuses its cached token. Invalid saved
key material must not dispatch. Fast tests separately exercise cache time edges.

Repeat the existing 35-case provider HTTP native entry because Apple now shares
its capacity/origin policy. The eight-case bundled-fetch HTTPS cohort remains a
separately labeled compatibility lane. Retain unrelated OAuth/Plex/session/media/
artwork evidence only after exact source/test/package/runtime comparison; their
implementations are outside this patch. Do not rerun unrelated expensive matrices
or claim fresh memory minimums or assistive-technology acceptance.

Validate the changed action separately using its actual pinned bundle and default
CLI, as specified in [PR design](DEPENDABOT_ORAS_DESIGN.md). Do not dispatch the
release workflow. Verify all disposable containers, builder, temporary readiness
password file and bind-write probe are removed; private evidence lives under
`.tmp/apple-http-2026-10-28/`.

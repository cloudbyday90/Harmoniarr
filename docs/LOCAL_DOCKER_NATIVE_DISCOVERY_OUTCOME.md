# Local Docker discovery qualification rebuild outcome

October 20, 2026. Followed the [walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) rebuild,
startup, existing-admin bootstrap and readiness-only path. Compose build used
--pull --no-cache. No reset or removal of walkthrough data was performed.

Immutable app image:
sha256:1a6c711f722f81a5feea00fd5c53892981bbd16a93079ce395937e648c1cf078.
The recreated service is healthy, read-only, runs Node 24.22.0 linux/x64 as uid
1000 and publishes only 127.0.0.1:47956. Bootstrap acknowledged the existing admin;
its one-shot container retired. Startup verified 109 applied migrations, zero
pending and zero newly applied. The temporary readiness password file was removed.

Independent read-only, network-disabled inventories compared against previous
image sha256:9370e6949cfa76c0de13989c5a056a9d3ba3a2a2f131e32c3e1a2a12b8fe6e7f.
All 853 server, 151 client and six shared files have identical bytes/modes.
All 110 npm packages, 147 OS packages and the Node runtime are unchanged.
Both inventory containers were acknowledged and removed. This is a qualification
and documentation change; the new image identity does not imply a runtime upgrade.

The strengthened [native discovery case](NATIVE_DISCOVERY_COMMAND_OUTCOME.md)
passed against this immutable image and slskd 0.26.1.0 image
sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4.
It uses independent disposable PostgreSQL, native-provider and media storage.

Walkthrough readiness passed. Existing provider queue status remains attention;
readiness-only mode did not create a new external transfer. Native test success
does not resolve that separate operational status. The walkthrough's explicit
loopback CSRF opt-out remains distinct from the protected application defaults
exercised by the native command test. No release was created.

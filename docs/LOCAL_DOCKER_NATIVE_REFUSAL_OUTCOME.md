# Local Docker native-refusal rebuild outcome

October 20, 2026. Followed the applicable build/start/bootstrap/readiness steps in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md), using Linux amd64 and
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr,
then no-build startup. Existing data/admin were preserved. The disposable helper
confirmed the existing admin and was removed, as was the password-only temporary
file. Optional reset, live acquisition and release replay were not needed for
this preserved-state validation.

New and running image:
sha256:6187d8ecdd91d4c1dbb6c9babdcd3b2073a7150ec9091e4ed938dd4ce75081d9.
It is healthy/read-only, runs Node 24.22.0 as uid 1000 on Linux x64, and publishes
only 127.0.0.1:47956 for the application. Readiness-only acceptance passed.
Existing external provider attention remains a separate operational follow-up.

Retained prior image
sha256:a0be16b53a4af66ccbe0529bd0731fdd93c4af29de9905b08704af603b4631eb
before replacing the local walkthrough tag. Fresh network-disabled, read-only
inventory containers verified unchanged path/hash/mode for all 852 server,
151 client and six shared files. All 110 installed package and 147 OS package
entries, and Node, were unchanged. Package metadata adds the opt-in refusal
command; production runtime artifacts and dependencies retain their identities.
No speed or image-size gain is claimed.

The independent [native outcome](NATIVE_REFUSAL_OUTCOME.md) uses the image as
the Node/dependency companion with current source mounted read-only. Disposable
native projects expose no ports and do not access walkthrough data. All final
native cases use the same frozen source and image, with strict resource cleanup.
Build, runtime comparison, readiness and cleanup evidence remains private under
.tmp/native-refusal-2026-10-20/.

No release, Git tag or new application branch was created. Next: an isolated
valid-audio acquisition/inspection/import control and corrupt-payload refusal.
Diagnose external provider attention before a new live acquisition command.

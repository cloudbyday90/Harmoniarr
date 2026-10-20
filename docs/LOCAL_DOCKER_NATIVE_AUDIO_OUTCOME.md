# Local Docker native-audio rebuild outcome

October 20, 2026. Followed applicable build/start/bootstrap/readiness steps in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Built Linux amd64 with
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr,
then used no-build startup. Preserved existing data/admin; the helper confirmed
the existing admin and retired. The temporary password-only file was removed.
Optional destructive reset, live acquisition and release replay were not needed.

New running image:
sha256:5690ad5225ef9e4f9d4edb40a852ab762e4d173a2c8f7cc3fe041ad8a153d434.
The app is healthy/read-only, Node 24.22.0 Linux x64 uid 1000, published only at
127.0.0.1:47956. Readiness-only acceptance passed; existing external-provider
attention remains a separate operational follow-up.

Retained baseline:
sha256:6187d8ecdd91d4c1dbb6c9babdcd3b2073a7150ec9091e4ed938dd4ce75081d9.
Independent network-disabled, read-only inventory containers verified unchanged
path/hash/mode for 852 server, 151 client and six shared files. All 110 installed
package entries, 147 OS package entries and Node were unchanged. Package metadata
adds one opt-in native command. No runtime speed or image-size gain is claimed.

The independent [native outcome](NATIVE_AUDIO_IMPORT_OUTCOME.md) uses current
source mounted read-only with this immutable Node/dependency companion. Its
fresh test PostgreSQL and disposable provider project do not use walkthrough
data. Provider files live in a bounded 4 MiB tmpfs with read-only inspector
access. Build, inventories, native controls and readiness evidence remain private
under .tmp/native-audio-2026-10-20/.

No release, Git tag or new application branch. Next: qualify the canonical Music
Queue selection/handoff into native audio. Diagnose walkthrough provider attention
before intentionally submitting a live acquisition.

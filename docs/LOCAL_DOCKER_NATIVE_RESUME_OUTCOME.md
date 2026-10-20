# Local Docker native-resume rebuild outcome

October 20, 2026. Followed the applicable build/start/bootstrap/readiness steps
in [the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) using Linux amd64,
docker compose -f compose.walkthrough.yaml build --pull --no-cache harmoniarr,
then no-build startup. Existing data/admin were preserved. The disposable helper
confirmed the existing admin and was removed; the password-only temporary file
was also removed. Optional reset, live acquisition and release replay were not
needed for preserved-state validation.

New and running image:
sha256:a0be16b53a4af66ccbe0529bd0731fdd93c4af29de9905b08704af603b4631eb.
It is healthy/read-only, runs Node 24.22.0 as uid 1000 on Linux x64, and publishes
only 127.0.0.1:47956 for the application. Readiness-only acceptance passed.
Existing external provider attention remains a separate operational follow-up.

Retained prior image
sha256:57873135f04eefd4d0c1ff11885336dda63177a543ce260e5bbdf53fdec5dc21
before replacing the local walkthrough tag. Fresh network-disabled, read-only
inventory containers verified unchanged path/hash/mode for all 852 server,
151 client and six shared files. All 110 installed package and 147 OS package
entries, and Node, were unchanged. Package metadata adds the opt-in resume
command; runtime production artifacts and dependencies retain their identities.
The later resume-client polling correction affects mounted test source only;
it does not change image build inputs. No speed or image-size gain is claimed.

The first helper invocation used Windows PowerShell and treated an existing
Compose deploy.mode warning as a terminating stderr error. Retained that log
and completed the same steps with workspace PowerShell 7. The warning does not
establish an application failure. Private build, inventory, readiness and
cleanup evidence is under .tmp/native-resume-2026-10-20/.

The separate [native outcome](NATIVE_RESUME_OUTCOME.md) uses the image as the
Node/dependency companion with current source mounted read-only. Its disposable
provider projects expose no ports and do not access walkthrough data. No release,
Git tag or application branch was created. Next: isolated native retry exhaustion
and changed-size refusal; diagnose provider attention before a new live command.

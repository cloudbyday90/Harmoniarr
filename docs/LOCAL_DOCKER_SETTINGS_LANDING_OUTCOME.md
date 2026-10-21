# Local Docker Settings landing outcome

Date: 2026-10-21. Follows the preserved-state path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md) after the
[landing validation](SETTINGS_LANDING_OUTCOME.md).

A unique owned `docker-container` BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local` and then retired, with removal verified.
New immutable image:
`sha256:b271c204c9c11466b4b73ca35722b4301094741d4763c9203985d062ddb5e7f9`.
Previous running image:
`sha256:09af0d2c907916b5dd99d260de6881f00500ba707d8c17b7d9444c6bb782d49a`.

Read-only, network-isolated inventory containers inspected both images and
retired. All 865 server and 11 shared files retain prior bytes and modes. The
155 packaged client files match the final local build; 56 artifacts changed,
including dependent chunk references. Node 24.22.0, 110 npm packages and 147 OS
packages match the previous runtime inventory. No application dependency changed.

The walkthrough ran `up -d --wait --no-build harmoniarr` and its public one-shot
bootstrap helper. The app is healthy, read-only, and bound only to
`127.0.0.1:47956`. Executed runtime is Linux x64, Node 24.22.0, uid 1000. Bootstrap
confirmed the existing admin and retired. All five previous bind mounts retain
their source, destination and read/write mode. Startup applied zero migrations,
verifying 111 applied and zero pending. No data or volume reset was performed.

The provider validator passed with explicit `--readiness-only`, retaining the
configured-provider and path-mapping prerequisites. Its temporary password-only
file was removed afterward. It submitted no search or transfer command and does
not establish a newly accepted transfer; existing provider queue attention remains
a separate operational follow-up. Optional managed-provider/release/fresh-reset
lanes were not invoked against preserved local data.

Final source/code hashes, packaged bytes, mount preservation and local Markdown
links are verified before publication. Private build, inventory, startup,
migration and readiness evidence is retained under
`.tmp/settings-landing-2026-10-21/`. No release, tag or version bump was created.

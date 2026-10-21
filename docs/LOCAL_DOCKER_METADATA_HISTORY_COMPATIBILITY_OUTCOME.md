# Local Docker Metadata compatibility outcome

Date: October 21, 2026. Follows the preserved-state path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md), after the separate
[feature validation](METADATA_HISTORY_COMPATIBILITY_OUTCOME.md).

A unique owned docker-container BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local`, then retired with removal verified.
New immutable image:
`sha256:06d9c2108b0ef65c08654486cb44ed867168ce3d2a0f21d8d6fc744244386682`.
Previous running image:
`sha256:8d22a13b24843fc1475c1533424c3519370cc2c0e02b7126d53ee4937ac0362f`.

Read-only network-isolated inventory containers inspected both images and
retired. All 865 server and 11 shared files retain prior bytes and modes. All
155 packaged client files match the final browser-tested fast build exactly;
57 artifacts changed, including dependent chunk references. Node 24.22.0,
110 npm packages and 147 OS packages match the prior version inventory. No
application dependency changed. The test-only zoom extension is not part of
the packaged client or installed into the walkthrough browser.

The walkthrough ran `up -d --wait --no-build harmoniarr` and its public one-shot
bootstrap helper. The application is healthy, read-only, and bound only to
`127.0.0.1:47956`. Executed runtime is Linux x64, Node 24.22.0, uid 1000. Bootstrap
confirmed the existing admin and retired. All five bind mounts retain source,
destination and read/write mode. Startup applied zero migrations, verifying
111 applied and zero pending. Data, volumes and configuration were preserved.
The walkthrough's explicit local CSRF opt-out remains its documented setting;
the application default and native command-authority checks remain independent.

Provider validation passed with explicit `--readiness-only`, retaining configured
provider and path-mapping requirements. Its temporary password-only file was
removed. This invocation submitted no search or transfer command and does not
establish newly accepted transfers. Provider queue review and transfer acceptance
remain separate operational work. Optional managed-provider, release and fresh-
reset lanes were not invoked against preserved data.

Final source/code hashes, packaged bytes, mounts and changed Markdown links are
checked through staging before publication. Private build, inventory, startup,
migration and readiness evidence is under
`.tmp/metadata-history-compatibility-2026-10-21/`. No release, tag or application
version bump was created.

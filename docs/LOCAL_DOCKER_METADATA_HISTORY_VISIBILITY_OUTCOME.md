# Local Docker Metadata history visibility outcome

Date: October 21, 2026. Follows the preserved-state path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md) after the
[visibility validation](METADATA_HISTORY_VISIBILITY_OUTCOME.md).

A unique owned docker-container BuildKit builder ran `--pull --no-cache --load`
for `harmoniarr:walkthrough-local` and then retired, with removal verified.
New immutable image:
`sha256:8d22a13b24843fc1475c1533424c3519370cc2c0e02b7126d53ee4937ac0362f`.
Previous running image:
`sha256:a16c3e9ab8c46774a8f55880c47e87419c676cf92538d8da06e74ff5aeee917a`.

Read-only network-isolated inventory containers inspected both images and
retired. All 865 server and 11 shared files retain their prior bytes and modes.
All 155 packaged client artifacts match the final browser-tested fast build;
56 artifacts changed, including dependent chunk references. Node 24.22.0,
110 npm packages and 147 OS packages match the prior version inventory. No
application dependency changed.

The walkthrough ran `up -d --wait --no-build harmoniarr` followed by its public
one-shot bootstrap helper. The application is healthy, read-only, and bound to
`127.0.0.1:47956`. Actual runtime is Linux x64, Node 24.22.0, uid 1000. Bootstrap
confirmed the existing admin and retired. All five bind mounts retain source,
destination and read/write mode. Startup applied zero migrations and verified
111 applied, zero pending. No data, volume or configuration reset was performed.
The walkthrough's explicit local CSRF opt-out remains its documented setting;
the application default and native authorization tests remain separate from it.

Provider validation passed with explicit `--readiness-only`, retaining configured
provider and path-mapping requirements. The temporary password-only file was
removed afterward. This invocation submitted no search or transfer command and
does not establish newly accepted transfers. Provider queue review and transfer
acceptance remain separate operational work. Optional managed-provider, release
and fresh-reset lanes were not invoked against preserved data.

Source/code hashes, packaged bytes, mounts and changed Markdown links are
verified through staging before publication. Private build, inventory, startup,
migration and readiness evidence is under
`.tmp/metadata-history-visibility-2026-10-21/`. No release, Git tag or version
bump was created.

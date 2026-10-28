# Local application of Dependabot ORAS PR design

October 28, 2026. GitHub MCP found two open fresh Dependabot PRs, #59 and #60,
both mergeable against the starting main. A cryptographically random selection
chose [#60](https://github.com/cloudbyday90/Harmoniarr/pull/60). This is a separate
change from the [Apple transport design](APPLE_HTTP_DESIGN.md).

Apply its exact one-line workflow change locally: setup-oras v2.0.0 SHA
`38de303aac69abb66f3e6255b7198bff35f323e3` becomes v2.0.2 SHA
`005458ad77f1c8facd38a094e4af2e69e5607ff4`. Verify that SHA against the official
upstream tag and action metadata. Preserve workflow permissions, trusted-mirror
conditions, inputs and manual dispatch-only release trigger. Do not merge the PR,
create a release/tag or run authenticated registry publication.

The action's default CLI remains 1.3.1; changing the action does not imply adopting
its newest supported CLI. Execute the actual published bundle on Node 24.22.1
inside a disposable non-root container, with no registry credentials. Provide
runner-compatible temporary/path files. The setup action must download the
official CLI and validate its embedded checksum. The fixture's temporary binary
directory must permit execution; this does not change production mounts.

Use the installed binary for local OCI-layout push, manifest fetch, recursive copy
and discovery, comparing copied manifest content. These checks prove local bundle/
CLI compatibility, not GitHub-hosted runner behavior, registry referrers, signing
or publication. Existing release/ORAS policy tests cover unchanged command shaping.

After committing/pushing on main, inspect both PRs again. Close #60 as superseded
only once the exact pin exists on remote main. Keep fresh non-conflicting #59 open;
request a bot rebase if it becomes stale/conflicting. Do not force-push bot branches
or use ignore commands that suppress future dependency updates. The
[outcome](DEPENDABOT_ORAS_OUTCOME.md) records the actual cleanup state and evidence.

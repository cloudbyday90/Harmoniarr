# Local Dependabot Buildx update design

October 28, 2026. GitHub MCP found one open PR, so
[#59](https://github.com/cloudbyday90/Harmoniarr/pull/59) is the sole eligible
selection. It is a fresh mergeable Dependabot change. Apply its two SHA updates
locally on main without merging, retaining the already applied ORAS pin.

Both setup-buildx-action references change from v4.0.0
`4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd` to v4.4.1
`f87e5991a6d7451dcb8d9637bfbc97413f497069`. Verify the official upstream tag and
MCP action metadata. Preserve workflow triggers, permissions, inputs and release
conditions. No release workflow, registry login, publication or tag creation.

Review and execute the actual published Node 24 main/post bundle with an owned
docker-container builder. Use private DOCKER_CONFIG/BUILDX_CONFIG/runner paths,
an explicit local daemon endpoint, no action cache download and use=false.
This avoids changing the host's selected builder. Validate captured state before
post cleanup, especially the absolute certificate directory, which must remain
inside the fixture's private root.

Build a network-disabled scratch fixture into a local directory and compare the
resulting bytes. Run the actual post entry point; verify owned builder/container
and certificate directory removal, and unchanged host selection. A fallback
cleanup may remove only the exact generated builder name if the action fails.
Do not stop unrelated containers or mutate global Docker credentials/configuration.

This qualifies the installed local CLI and Windows Docker Desktop execution. It
does not prove download of an alternate Buildx version, GitHub-hosted Ubuntu/QEMU,
multi-architecture release execution or registry publication. The separate
[outcome](DEPENDABOT_BUILDX_OUTCOME.md) records exact versions and observations.
After pushing and verifying both pins on remote main, close the superseded PR
without merging. Request a bot rebase only for any remaining stale/conflicting PR;
do not force-push bot branches or suppress future updates with ignore commands.

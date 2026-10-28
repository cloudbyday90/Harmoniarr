# Dependabot Buildx local implementation outcome

October 28, 2026. See the separate [design](DEPENDABOT_BUILDX_DESIGN.md) and
[official research](APPLE_SIGNING_RESEARCH_2026_10.md).

## Applied and locally qualified

GitHub MCP found only [PR #59](https://github.com/cloudbyday90/Harmoniarr/pull/59)
open, making it the sole eligible selection. It was fresh and mergeable. Its
exact two setup-buildx-action pin changes were applied locally to main, retaining
the ORAS pin already present. Upstream v4.4.1 checkout and MCP action metadata
agree on `f87e5991a6d7451dcb8d9637bfbc97413f497069`.

The published Node 24 main/post bundle ran on local Node 24.22.1 with installed
Buildx v0.37.2 (`2d379c0c3f22da0d2759d132a0ec81ca949098f0`). Bundle SHA-256:
`3b20231fa7e39b3e7652d9c8321be9f9a47565d72732940891c58b6356483d55`.
An owned docker-container builder booted through the actual action. A scratch
fixture with build networking disabled exported local files with matching bytes.
The actual post entry point removed its builder/container and private certificate
directory. Absolute cleanup paths were checked inside the private fixture root
before post execution; the host's selected builder was unchanged.

Private Docker/Buildx/runner directories and an explicit local daemon endpoint
avoided global configuration or credential changes. No action binary download,
registry login, publication, release workflow or tag creation was attempted.
This verifies the installed local CLI on Windows Docker Desktop, not an entire
GitHub-hosted Ubuntu/QEMU/multi-architecture release or alternate download path.

An initial fixture probe used an unsupported `buildx inspect --format` flag.
It was corrected before actual action execution; no product or action policy was
weakened. The first full gate also found a release test hardcoding the old SHA.
The corrected test requires build/promotion jobs to share one full-length pin.
The failed gate is retained separately. Only the later frozen passing gate is
used for final qualification. Private records live under
`.tmp/apple-signing-2026-10-28/`.

## Completed cleanup

Implementation commit `5e0c4b1e687df8641d98e8c82b3e26d908a4d72b` was pushed to
main, and GitHub MCP verified both new pins in the remote workflow. A maintainer
comment recorded local qualification and its limits. PR #59 was closed as
superseded at 2026-10-28 10:20:33 UTC; the final MCP check confirms closed and
not merged. The subsequent open-PR search returned zero results. No stale
Dependabot PR remained to rebase, and no ignore command or bot-branch force-push
was needed. This documentation follow-up records the completed remote action.

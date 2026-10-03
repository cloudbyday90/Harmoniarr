# Random PR #23 local replay design

Planned October 3, 2026. This document records the research and plan before the local replay. Results belong in the separate [outcome](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md).

## Scope and selected change

The root agent randomly selected [open PR #23](https://github.com/cloudbyday90/Harmoniarr/pull/23) from the GitHub MCP open-PR list. Its immutable head is `ae651337286216e92be7ae977e39fcedc14de7f9`. MCP returned one changed file and the complete patch: `.github/workflows/release-image.yml` changes `docker/metadata-action` from `030e881283bb7a6894de51c315a6bfe6a94e05cf` to `80c7e94dd9b9319bd5eb7a0e0fe9291e23a2a2e9`.

The current workflow already pins `dc802804100637a589fabce1cb79ff13a1411302`. GitHub MCP tag lookups independently bind the PR pin to v6.1.0 and the current pin to v6.2.0. Applying the old PR directly to the tracked workflow would downgrade its dependency. The requested local implementation will therefore replay the exact PR metadata action in an ignored fixture, compare it with the current action, and leave the newer production pin in place. No branch, merge, release, registry publication, or application change is part of this track.

## Research

- [PR complete patch](https://github.com/cloudbyday90/Harmoniarr/pull/23/files) and [immutable workflow source](https://github.com/cloudbyday90/Harmoniarr/blob/ae651337286216e92be7ae977e39fcedc14de7f9/.github/workflows/release-image.yml) were fetched through GitHub MCP. Original inputs generate explicit version, public release, and stable-only `latest` aliases with `latest=false` flavor, plus Harmoniarr OCI labels.
- [Official action README at the PR pin](https://github.com/docker/metadata-action/blob/80c7e94dd9b9319bd5eb7a0e0fe9291e23a2a2e9/README.md), [action metadata](https://github.com/docker/metadata-action/blob/80c7e94dd9b9319bd5eb7a0e0fe9291e23a2a2e9/action.yml), and [entry point](https://github.com/docker/metadata-action/blob/80c7e94dd9b9319bd5eb7a0e0fe9291e23a2a2e9/src/main.ts) were fetched through MCP before execution. The entry point runs bundled `dist/index.cjs` on Node 24, reads GitHub context/repository data, and emits tags, labels, annotations, JSON, and bake files.
- [v6.1.0 release](https://github.com/docker/metadata-action/releases/tag/v6.1.0) and [v6.2.0 release](https://github.com/docker/metadata-action/releases/tag/v6.2.0) were discovered from the MCP release list, including their official archive URLs. Both releases are recorded as immutable. Tag-reference reads verify their full source commit IDs.
- [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) was independently found through web search. It recommends full-commit action pinning and inspecting third-party action source. Keep the reviewed immutable pins in the replay and retained workflow.

## Options and decision

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Downgrade the tracked release action to the selected PR | Literal application of the old dependency bump | Regresses the already newer pin and bundled fixes | Reject |
| Static patch inspection only | Fast; no action execution | Cannot prove generated tags, labels, or bake outputs | Fallback only if local execution is unavailable |
| Execute both immutable bundled actions with generated context in an ignored fixture | Tests actual action behavior without publishing or altering the application | Local context and repository replies differ from a hosted Actions runner | Selected |
| Dispatch the publishing workflow | Tests hosted workflow wiring | Exceeds the user's no-release scope and changes external state | Reject |

## Execution plan

1. Save the exact PR patch and metadata-step fixture under a task-owned `.tmp/` directory. Obtain action archives from the MCP-discovered official URLs and verify resolved source identities against the reviewed full pins before running their bundled entry points.
2. Inspect the downloaded action entry points and repository-data helper. Supply synthetic event context and a loopback repository-data response if needed; never inherit GitHub, registry, or provider credentials. Provide action output/environment/state files and temporary storage inside the fixture.
3. Execute v6.1.0 and v6.2.0 using generated prerelease and stable metadata inputs from the original PR workflow. Also exercise a supplemental candidate-only raw-tag fixture and invalid tag/flavor input if supported. The current production build obtains candidate tags from a separate Harmoniarr plan step, not this metadata action's tags output.
4. Assert explicit aliases, absence/presence of `latest`, version/revision/source/license labels, JSON agreement, and bake output agreement. Compare semantically stable output fields across versions, accounting for generated timestamps and temporary paths.
5. Retain fixed-field evidence and exact commands, including failed attempts and limits, in the outcome. Run only relevant existing release-script tests; do not add a permanent generic test that only repeats a workflow string.

## Acceptance and limits

Success requires running the exact bundled PR action and checking meaningful generated outputs. Static replay alone must be reported as unexecuted action behavior. A local pass establishes metadata-generation compatibility for the supplied fixtures; it does not establish hosted-runner execution, credential handling, build/push, provenance, runtime acceptance, or release publication. The tracked workflow retains its v6.2.0 pin.

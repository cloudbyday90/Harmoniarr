# Random open PR 24 local replay design

Status: Accepted for local implementation
Research date: October 3, 2026

## Selection and immutable scope

GitHub MCP resolved `cloudbyday90/Harmoniarr`, repository ID `1221894481`,
and its canonical repository/API URLs. The open pull collection returned three
PRs, in response order: 40, 24, 23. The first page requested 100 results and
contained three. Previously replayed PRs 23 and 40 were excluded, leaving the
eligible set `[24]`.

The draw used `System.Security.Cryptography.RandomNumberGenerator.GetInt32(0,
eligible.Count)` and returned index 0, PR 24, at
`2026-10-03T17:17:24.1698254Z`. A separately generated 16-byte random nonce was
`99A6E00FEBE57791253CA9E8DEDDA495`. Selection from this singleton is necessarily
deterministic; actual randomness was used without implying multiple eligible
alternatives.

[PR 24](https://github.com/cloudbyday90/Harmoniarr/pull/24) has immutable head
`40cf4d117b69bd55b9a0a7353361838216e1e952`, base
`0b661a2a5a5e6318683ee980c3c5d02298987e9d`, and one changed file:
`.github/workflows/release-image.yml`. MCP returned the complete patch: the
build-push-action pin changes from v7.1.0
`bcafcacb16a39f128d818304e6c9c0c18556b85f` to v7.2.0
`f9f3042f7e2789586610d6e8b85c8f03e5195baf`.

At research time main `0d7a123def86ff6d7e384078e2d2f63ab30efe94` already uses
v7.3.0 `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`. The historical PR is
superseded. Applying its version to the maintained workflow would be a downgrade.

## Official evidence and decision

Sources were discovered through GitHub MCP and web search and read on October 3.

| Source | Finding |
| --- | --- |
| [v7.2 release](https://github.com/docker/build-push-action/releases/tag/v7.2.0) | May 21 release updates dependencies and the Docker action toolkit. |
| [v7.3 release](https://github.com/docker/build-push-action/releases/tag/v7.3.0) | July 1 release is the prior maintained version. |
| [v7.4 release](https://github.com/docker/build-push-action/releases/tag/v7.4.0) | September 15 release is the latest returned release and includes metadata-log command handling and shared Buildx error handling updates. |
| [Upstream metadata-log patch](https://github.com/docker/build-push-action/pull/1617) | Changes `core.info` to `GitHub.printUntrusted` when logging build metadata. |
| [Immutable v7.4 action manifest](https://github.com/docker/build-push-action/blob/c3c9e263c25d99ce0380d002d59b67737d91b0dc/action.yml) | Node 24 main/post action, with unchanged input and imageid/digest/metadata output contracts. |
| [GitHub secure use guidance](https://docs.github.com/en/actions/reference/security/secure-use) | Retain a full commit SHA verified in the upstream repository. |
| [Docker local export guidance](https://docs.docker.com/build/ci/github-actions/export-docker/) | Build results can be retained locally rather than published. |

MCP independently resolved all three upstream version tags to their commit SHAs.
The v7.2, v7.3, and v7.4 `action.yml` files share Git blob
`7a1a94d46f66694384cb558b6f164027cdc3b667`.

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Put historical v7.2 on main | Exactly matches the old version bump | Downgrades maintained v7.3 | Reject |
| Keep v7.3 and document replay only | Avoids a workflow change | Misses current upstream fixes | Control |
| Replay historical v7.2 separately and maintain v7.4 | Honors the selected PR while retaining current fixes | Requires actual action compatibility evidence | Adopt |

Only the maintained build-push-action reference will change to v7.4.0
`c3c9e263c25d99ce0380d002d59b67737d91b0dc`. No workflow trigger, permission,
publication gate, platform, cache, tag, or image behavior change is intended.
The upstream metadata change supports this choice; it is not evidence that
Harmoniarr has an exploitable injection path or that a security scan passed.

## Local implementation and validation plan

Write this design before implementation. Retain immutable MCP metadata, patch,
draw, manifests, source revisions, archives/hashes, and harness evidence under
ignored `.tmp/random-pr-24-local-replay`. Retain a historical head workflow and
a copy of the current workflow replaying only the historical action reference.
Third-party bundled CommonJS action code remains ignored and separate from
first-party ESM source.

Execute the actual published bundled v7.2, prior-main v7.3, and maintained v7.4
main actions against the local Docker engine and Buildx. Use a `FROM scratch`
fixture that copies generated text, local filesystem output, explicit path
context, no push/pull, no build network, no remote cache, no secret/token inputs,
and disabled summaries, annotations, and artifact upload. Isolate Docker config
and child environment; guard Node network access. Execute local post cleanup
only with the action's captured state and checked task-owned temp paths.

Assert exported bytes and generated action outputs/metadata. Compare semantic
results across versions while excluding incidental build reference/timing data.
If practical, include a harmless local workflow-command-shaped metadata value
and verify v7.4's log suppression envelope. This is a local output control, not
an exploit execution on a hosted runner. Preserve failed diagnostic attempts and
report any unsupported action/output behavior honestly.

Run the existing release-image workflow, draft, provenance, tag-promotion, and
fixture contract tests relevant to the one-line pin. Check the maintained diff.
Document actual runtime versions, execution counts, outcomes, evidence hashes,
and limits after execution. No branches, merges, commits, registry pushes,
release publication, workflow dispatch, remote comments, credentials, hosted
runner acceptance, or full application acceptance are part of this replay.

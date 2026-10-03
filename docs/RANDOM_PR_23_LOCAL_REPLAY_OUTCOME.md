# Random PR #23 local replay outcome

Executed October 3, 2026. The separate [design](RANDOM_PR_23_LOCAL_REPLAY_DESIGN.md) records the plan, official-source research, and tradeoffs before implementation.

## Result

The randomly selected [PR #23](https://github.com/cloudbyday90/Harmoniarr/pull/23), head `ae651337286216e92be7ae977e39fcedc14de7f9`, changes only the release workflow's metadata-action pin to v6.1.0. Its exact patch and metadata-step source were retained in `.tmp/random-pr-23-local-replay/`. The PR's bundled action was implemented and executed locally in that ignored fixture with generated Actions context and the original metadata inputs. The current v6.2.0 bundled action was executed against the same fixtures for comparison.

All eight action executions passed their expected outcomes. Three cross-version semantic comparisons passed. The tracked workflow already has the newer v6.2.0 pin and retains it; this work does not claim a new production dependency bump, merged PR, hosted Actions run, or release.

## Source identity and execution boundary

GitHub MCP supplied the complete one-file patch, immutable PR workflow source, official action README/entry point, release list, tag references, and full commit trees. The official downloaded release archives resolved to the expected source-prefix directories. Before execution, Git blob hashing of each downloaded `dist/index.cjs` matched the blob in its reviewed full-commit tree:

| Action | Full source commit | Executed bundle Git blob SHA-1 | Executed bundle SHA-256 |
| --- | --- | --- | --- |
| PR v6.1.0 | `80c7e94dd9b9319bd5eb7a0e0fe9291e23a2a2e9` | `aeeb06b32bb3d72fc6660ef9ec17a22bd943415d` | `1b65452ec38e85f23986a7d2bd1fe05c782c5aea24ce3c5f6783f94ba847716c` |
| Current v6.2.0 | `dc802804100637a589fabce1cb79ff13a1411302` | `9edb5c86adce7aa700ef990a2be4ca7cbffb30a0` | `91b260f14a7be217e6b9145845f957ba35278448b8333bb6c82348dfe0e35694` |

The action reads repository metadata through its normal Octokit boundary. The local harness provided a loopback-only HTTP repository fixture, a generated nonsecret `local-fixture-token`, and a generated event containing the commit timestamp. Each child received an explicit environment instead of the operator's environment. Its action outputs, environment/state files, temporary files, and bake outputs stayed under the task fixture.

A preloaded socket guard admitted only that loopback address and port, rejected TLS connections, and denied subprocess execution. Each action run made exactly one permitted repository GET and one permitted socket connection. No GitHub, registry, provider, or application credential was used. Network downloads occurred only while obtaining the official action archives; action execution used the controlled local repository response.

## Executed scenarios

Each scenario ran with both v6.1.0 and v6.2.0 on Node `v24.18.1`:

| Scenario | Verified behavior |
| --- | --- |
| Original prerelease inputs | Exactly `0.1.0-beta` and `v0.1.0-beta` per image; no `latest` |
| Original stable inputs | Exactly `0.1.0`, `v0.1.0`, and `latest` per image |
| Candidate-only supplemental fixture | One generated candidate alias per image; no version, public-release, or `latest` alias |
| Invalid flavor input | Expected exit 1, explicit invalid-flavor diagnostic, and empty Actions output file |

Both image names were synthetic inputs; none was pushed. Successful scenarios checked version, source, revision, title, URL, and license labels; tags and tag names; annotation and label agreement with JSON; and the tags, labels, annotations, and combined bake files. Bake file paths were checked to remain in the fixture. Cross-version comparisons covered tags, labels, annotations, JSON, and bake contents after removing only the generated creation timestamp. Temporary file paths were not compared. The supplemental candidate fixture tests supported raw-tag behavior; the production build obtains its candidate tags from Harmoniarr's separate candidate-plan step.

## Commands and retained evidence

```powershell
node .tmp/random-pr-23-local-replay/replay.mjs
node --test test/scripts/release-workflow-fixture.test.js test/scripts/release-image-workflow-contract.test.js test/scripts/release-tag-promotion-workflow.test.js test/scripts/release-provenance-workflow.test.js test/scripts/release-draft-workflow.test.js
```

The action harness passed eight executions and three comparisons. All 20 focused existing release-script regressions passed, with zero failures, skips, or cancellations. These cover release metadata/contract wiring, candidate-only build tags, provenance-before-runtime, archived smoke evidence, and draft-first publication dependencies. No permanent static test was added to repeat a workflow string.

Evidence timestamp: `2026-10-03T15:13:31.124Z`. Sanitized evidence: `.tmp/random-pr-23-local-replay/evidence.json`. Its SHA-256 is `6f00db3a0dbd63e29faed21cd3f34147d3d0d9096f260319cb793307df5801c5`. The ignored fixture also retains the standalone harness, network guard, exact patch/step, action archives, unpacked actions, and generated per-run logs and outputs. Those are local replay artifacts rather than permanent application dependencies.

No failed action setup or unexpected action execution occurred. The negative input cases deliberately returned exit 1 and were validated as successful refusal scenarios.

## Disposition and limitations

Retain the current full-commit v6.2.0 production pin. The old PR is superseded, while its requested action was meaningfully tested locally. No branch, merge, workflow dispatch, image build/push, registry alias update, release creation, or application/server/client change occurred in this replay track.

Local metadata generation does not prove hosted Actions runner behavior, real authenticated repository metadata, packaged application behavior, provenance, or release acceptance. The next release work remains the concrete access/baseline handoff in [published acceptance readiness](PUBLISHED_ACCEPTANCE_READINESS_OUTCOME.md). A release owner can separately disposition the superseded PR; no remote PR comment, closure, or merge was performed here.

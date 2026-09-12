# Candidate staging and release tag promotion outcome

Date: September 12, 2026. Starting commit: `9e3eb18f8ca746e729e9431a449bfc48f9464e6b`.

## Implemented behavior

The build now writes only run-specific candidate tags in GHCR and the optional Docker Hub mirror. The trusted-mirror copy also receives a validated candidate-only destination. Pre-promotion mirror verification checks the expected immutable digest without requiring final aliases. Release metadata still records the intended final aliases, and workflow summaries label them as pending promotion.

A separate job runs after provenance, runtime, and release/mirror contract acceptance. Modular native ESM code derives the bounded target set, hashes raw manifest bytes for every source before writes, promotes without rebuilding or changing manifest structure, verifies each alias, and performs a final verification sweep. GitHub release finalization requires successful promotion and evidence upload.

The promotion result proves digest/tag binding. It does not independently prove provenance, runtime acceptance, or release approval. Those remain distinct gates. No registry tag or GitHub release was published by this implementation session.

## Validation

- Root workflow/mirror regression group: 25 tests passed before final integration.
- `actionlint .github/workflows/release-image.yml`: passed.
- Promotion service/CLI regression group: 22 tests passed, including rejection of the Docker-reserved `localhost` registry namespace. Scoped ESLint and both CLI help checks passed.
- Final `npm run test:scripts`: 500 tests passed after the namespace fix.
- `npm run validate:security`: passed with zero reported npm vulnerabilities.
- `npm run validate`: passed, including repository policy checks, lint, 8,254 tests (3,426 server, 4,205 client, 500 scripts, 123 PostgreSQL integration), and client/server production builds; zero failures or skipped tests. The final namespace fix was additionally verified by the complete 500-test script rerun and scoped lint above.

## Local Docker walkthrough rebuild

Completed the documented build, `up -d --wait --no-build`, and one-shot bootstrap sequence from [LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md). Existing environment values and repo-local data mounts were retained; no reset was performed. The bootstrap helper confirmed that the admin already existed.

The rebuilt container uses local image ID `sha256:a6dedc229981c007fc23c055681186480d0e1aa72e5118223703c3f880c294f8`. It is healthy at `http://127.0.0.1:47956`; `/healthz` and `/` returned HTTP 200, and the root page contained the app mount. The stack remains running for local use. This is local walkthrough evidence, not a registry manifest digest, published-image provenance, or release acceptance. The fresh/unconfigured-provider browser smoke was not run against retained operator state.

## Limits and recovery

Aliases remain mutable. This slice moves their writes after acceptance, but does not add version-conflict refusal, stable-channel ordering, multi-registry transactions, or portable compare-and-swap. Some aliases may change before a later failure. The tool stops without rollback/deletion and emits no passed evidence; inspect state using the accepted digest before retrying. Candidate retention is unchanged.

No live registry promotion was performed. The existing immutable-release policy token, protected-tag setup, accessible registry artifacts, and reviewed baseline/live acceptance prerequisites remain open. No application UI or schema changed, and registry verification does not establish W3C accessibility conformance.

## Open PR review

All three open heads and full patches were refreshed through GitHub MCP. None was applicable, applied, or merged:

| PR | Reviewed head | Finding |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture conflicts with the retained Node 24 LTS platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 is superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 is superseded by local 6.2. |

## Next recommendations and stack

| Priority | Recommendation | Benefit | Cost or prerequisite |
| --- | --- | --- | --- |
| 1 | Define version-alias conflict and stable-channel ordering policy. | Prevents replacing a prior version or regressing latest unintentionally. | Needs reliable authenticated registry state handling and explicit recovery semantics. |
| 2 | Complete reviewed baseline and live immutable publication acceptance. | Establishes actual release evidence beyond source tests. | Requires policy access, protected tag, registry access, and baseline decision. |
| 3 | Add candidate retention and partial-promotion recovery policy. | Controls accumulated staging tags and makes interrupted runs reviewable. | Must preserve referenced digests and avoid blind cleanup. |
| 4 | Complete live provider and recovery acceptance. | Exercises saved connections and operational recovery. | Requires a controlled configured deployment. |
| 5 | Verify supported architectures and representative library workloads. | Exposes platform and scale limits beyond fixtures. | Additional runners and bounded realistic workloads. |

Recommended stack: Node 24 native ESM, modular plan/service/CLI files, PostgreSQL, existing Buildx, raw-byte digest checks, candidate-only staging, gated deterministic alias promotion, and draft-first immutable GitHub publication. See the [design](RELEASE_TAG_PROMOTION_DESIGN.md) for official September 2026 sources and pros/cons.

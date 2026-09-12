# Release provenance gate outcome

Date: September 12, 2026. Starting commit: `697d1471f4c815c71c2a39e70bd0424465e9bb44`.

## Implemented behavior

The publishing workflow now requires successful candidate and configured-baseline origin verification before released-image startup, browser smoke, or upgrade execution. A dedicated read-only job owns the gate. The final release-contract aggregation explicitly requires that job to succeed; private repositories cannot bypass it when attestation support is unavailable.

Small native ESM modules share canonical input policy, live cryptographic verification, sanitized result projection, and exclusive evidence-file handling with the existing published-candidate acceptance wrapper. The workflow resolves optional baseline image/revision pairs once, rejects partial overrides, and passes the validated outputs to both verification and runtime. Candidate and baseline evidence are separate artifacts. The earlier repository-only post-runtime check was removed.

Review also found that Playwright installation ran in the publishing job, while browser smoke ran on a different runner without its dependencies. Dependency installation using the project npm setup action and Chromium installation now happen in the browser job before browser smoke. No dependency versions changed.

## Validation and limits

- Focused workflow/baseline tests: 14 passed, including the existing release contract tests. Tests cover missing or partial pairs, foreign/mutable references, output injection, mandatory dependencies, private failure behavior, exact source binding, and browser installation order.
- Shared verifier and CLI regression group: 51 passed, including existing published-candidate behavior.
- `node scripts/verify-published-image-provenance.js --help`: passed.
- Baseline-plan CLI replay through `node --env-file` passed and emitted `baseline_enabled=false` with empty identities for the unconfigured optional baseline.
- `actionlint .github/workflows/release-image.yml`: passed.
- `npm run validate`: passed repository policies, lint, all 8,189 tests (3,426 server, 4,205 client, 435 script, 123 integration; zero failures or skips), and client/server production builds.
- `npm run validate:security`: passed; npm audit reported zero vulnerabilities.

No release workflow was dispatched or release published. No live successful provenance or runtime acceptance is claimed. Accessible published candidate/baseline digests, valid GitHub/registry access, and reviewed baseline acceptance remain prerequisites for a live run. The prior availability assessment is recorded in the [published trust outcome](PUBLISHED_CANDIDATE_TRUST_OUTCOME.md). The starting commit had four green source CI workflows when checked through GitHub MCP; that is not published-image proof.

The provenance report does not establish baseline publication or approval. The full published-candidate wrapper still performs release/tag/metadata checks, runtime identity binding, database continuity, and cleanup. No schema, application UI, ARIA, or focus behavior changed; no new accessibility conformance result is claimed.

## Open PR review

All three open heads and full patches were refreshed through GitHub MCP. None was applicable, so no patch was applied or merged:

| PR | Reviewed head | Disposition |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture change conflicts with retained Node 24 LTS. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 already superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 already superseded by local 6.2. |

## Next five priorities

| Priority | Recommendation | Benefit | Cost or constraint |
| --- | --- | --- | --- |
| 1 | Design and implement draft-first immutable release publication. | Attach assets before publication and protect final tag/assets. | Requires event/lifecycle restructuring and failure recovery. |
| 2 | Establish reviewed baseline acceptance and execute live published-candidate checks. | Closes the remaining artifact-origin/runtime evidence gap. | Requires actual accessible artifacts and approval evidence; first release needs explicit policy. |
| 3 | Complete live provider and recovery acceptance. | Exercises real provider access and operational recovery. | Depends on saved provider connections and a controlled deployment. |
| 4 | Validate each supported platform from the same published index digest. | Finds architecture-specific packaging/startup regressions. | Additional runners and runtime cost. |
| 5 | Exercise representative library size and queue load. | Measures release behavior beyond fixture-scale correctness. | Requires bounded workloads and defensible budgets. |

Recommended stack: retain Node 24 native ESM and modular policy/service/CLI files, PostgreSQL, immutable GHCR references, live GitHub certificate verification, least-privilege mandatory job dependencies, isolated runtime checks, and sanitized evidence. Keep provenance, publication, runtime success, accessibility, and release approval separate. The next code item is draft-first release publication; the next operational gate is a reviewed baseline and live published-artifact run. See the [design and official sources](RELEASE_PROVENANCE_GATE_DESIGN.md).

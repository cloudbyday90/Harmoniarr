# Draft-first release lifecycle outcome

Date: September 12, 2026. Starting commit: `9794d96e4f67ecdf60561531f093897ddd3d747f`.

## Implemented design

The release workflow now starts from manual dispatch, verifies immutable-release policy and exact precreated tag/source identity, and prepares an owned draft before the image build. It retains the mandatory provenance, startup/browser, optional upgrade, and mirror/asset verification gates. The final job consumes the same four named build artifacts from this run and attaches them before publication. The previous published-event asset uploads and replacement flags are removed.

The lifecycle uses modular native ESM policy, command, asset, service, and CLI boundaries. It refuses foreign or already-published releases, incomplete policy access, tag drift, malformed metadata, and conflicting assets. Existing assets can only be reused when they match. Successful finalization requires immutable published state and release verification, then records sanitized evidence. Failures do not delete assets, move tags, or change repository settings.

The separate `RELEASE_POLICY_READ_TOKEN` secret must provide Administration read on this repository. It is used only for the immutable-setting probe. Ordinary release operations use the workflow token. Missing policy access stops before draft creation/build. No credentials are recorded in evidence.

## Validation

- Workflow regression group: 17 tests passed, covering the new draft flow and existing provenance/runtime dependencies.
- Lifecycle service/client/assets/CLI group: 34 tests passed. Coverage includes policy-token separation, annotated tag resolution, owned draft resumption, conflicting/partial assets, byte snapshots, tag/policy drift after staging, immutable publication failure, and exact sanitized evidence binding.
- Workflow summary group: 6 tests passed; the contract summary now accurately describes pre-publication build artifacts.
- `actionlint .github/workflows/release-image.yml`: passed.
- Focused ESLint and `node scripts/release-draft-lifecycle.js --help`: passed.
- `npm run validate:security`: passed with zero reported npm vulnerabilities.
- `npm run validate`: passed repository policies, lint, all 8,226 tests (3,426 server, 4,205 client, 472 script, 123 integration; zero failures or skips), and client/server production builds.

## Actual execution boundary

No draft or release was created, no workflow dispatched, and no repository setting changed during this implementation. GitHub MCP still returned no releases; its unsupported immutable-setting endpoint did not establish the actual repository setting. No successful live publication, provenance, or published-baseline acceptance is claimed. The new workflow requires configured policy access, an exact existing tag, accessible published image verification, and the applicable operator acceptance evidence.

Publication can succeed before a later network, attestation, or local evidence-write failure. Such failures remain failures with uncertain or already-published external state; automatic deletion or rebuilding is not recovery. Repository administrators can also race the workflow's checks because GitHub offers no documented atomic expected-tag-SHA condition. Protect release tags and control concurrent administration.

The existing image build still publishes version/latest registry tags before runtime gates. GitHub release immutability does not protect registry tags; promotion ordering is the next code item. No schema or application UI changed, and no new W3C accessibility conformance result is claimed.

## Open PR disposition

All open heads and full patches were refreshed through GitHub MCP. None was applicable, and none was applied or merged:

| PR | Reviewed head | Finding |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture conflicts with retained Node 24 LTS. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 is superseded by local 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 is superseded by local 6.2. |

## Next recommendations and stack

| Priority | Recommendation | Pro | Con or prerequisite |
| --- | --- | --- | --- |
| 1 | Stage image candidates and promote version/latest registry tags after acceptance. | Prevents unverified builds replacing operator-facing tags. | Requires registry promotion and recovery policy. |
| 2 | Complete reviewed baseline and live immutable publication acceptance. | Establishes actual release evidence beyond source tests. | Needs policy token, protected tag, registry access, and baseline decision. |
| 3 | Complete live provider and recovery checks. | Exercises saved connections and operational recovery. | Requires a controlled deployment with configured providers. |
| 4 | Validate each supported architecture from the same image index. | Detects platform-specific runtime failures. | Additional runner and test cost. |
| 5 | Exercise representative library/queue workloads. | Establishes practical performance budgets. | Requires bounded realistic fixtures and measurements. |

Retain Node 24 native ESM, modular services, PostgreSQL, GHCR digest identity, live certificate/release verification, read-only policy checks, gated draft publication, and separate sanitized runtime evidence. See the [design](DRAFT_RELEASE_LIFECYCLE_DESIGN.md) for official September 2026 sources and alternatives.

## Follow-up implementation

The early registry-tag publication described above is replaced by [candidate staging and gated promotion](RELEASE_TAG_PROMOTION_OUTCOME.md). Mutable-alias conflict/channel policy and actual live release acceptance remain separate work.

# Draft-first immutable release design

Date: September 12, 2026. Platform: Harmoniarr, a Soulseek-native music library manager using Node 24 native ESM, Vue, and PostgreSQL.

## Problem and decision

The previous workflow started after a GitHub Release was published and then uploaded assets with replacement enabled. That ordering cannot support immutable releases, whose assets and tag are protected after publication. Replace it with one manually dispatched, serialized job graph: prepare an owned draft, build and attest the image, verify provenance, exercise startup/browser/optional upgrade, verify artifact and mirror contracts, then attach assets and publish.

The operator must precreate a tag pointing to the exact workflow source commit. Resolve lightweight and annotated tags to a full commit SHA; existence alone is insufficient. The lifecycle must never create or move a tag, overwrite a published release, delete a release asset, or change repository immutability settings. Refuse incompatible existing state. Failed validation leaves a draft for investigation.

Preserve operator notes around the single required ownership marker. Derive prerelease classification from the existing release-tag policy and explicitly avoid marking the release as latest during creation or publication. Finalization does not replace release notes.

Small ESM modules separate native command execution, input/state policy, local asset validation, orchestration, and CLI evidence. Native commands use fixed argv and bounded execution, never generated shell strings. CLI execution requires a workflow_dispatch context with matching repository and source SHA. Only prepare/final publication jobs need contents write; build and verification jobs have separate capabilities.

The final publication job also receives attestations read for live release verification. It needs no attestation write or identity-token capability.

## Immutability and credentials

Check the live repository immutable-releases setting before creating a draft and again before publication. GitHub requires Administration read for that endpoint; the normal workflow token cannot provide it. An operator-provisioned repository secret `RELEASE_POLICY_READ_TOKEN` supplies a fine-grained token or App token with read-only Administration access to this repository. Pass it as `HARMONIARR_RELEASE_POLICY_TOKEN`, use it only for the setting GET, and remove it from all other child environments. Continue to use the normal `GH_TOKEN` for release operations. Missing, disabled, or inaccessible policy fails closed. Never enable the setting automatically.

## Asset and retry contract

The final job downloads exactly the four named build artifacts from its own workflow run. Validate their metadata, repository, tag, immutable image digest, Compose override, names, sizes, and local checksums before uploads. Reuse an existing asset only if the remote state and checksum agree with the local bytes. Refuse unexpected assets, partial uploads, or different contents. Do not use `--clobber`.

Re-read draft ownership, tag, setting, and asset inventory before publishing. After publication, require immutable state and verify the release attestation before recording success. Reserve a new evidence file before the irreversible step. If a network failure leaves publication uncertain, do not report success or issue destructive recovery. A published release is not a fresh build target; investigate and verify it independently.

Concurrency serializes this workflow, but it does not isolate it from external administrators. GitHub does not document an atomic expected-tag-SHA precondition for release publication. Pre/post checks detect changes; protected tags and controlled release administration remain operational requirements. If the post-publication check fails, publication may already have happened and cannot safely be rolled back by the tool.

## Official sources researched

Discovered and opened through research tools on September 12, 2026:

- [Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases): assemble release assets in a draft before publication locks the release.
- [Repository API](https://docs.github.com/en/rest/repos/repos#check-if-immutable-releases-are-enabled-for-a-repository): immutability setting response and Administration-read requirement.
- [Release creation](https://cli.github.com/manual/gh_release_create): `--verify-tag` confirms existence, not an expected commit binding.
- [Release REST API](https://docs.github.com/en/rest/releases/releases): draft/publication fields and existing-tag target behavior.
- [Release assets](https://docs.github.com/en/rest/releases/assets) and [CLI upload](https://cli.github.com/manual/gh_release_upload): asset state/digest fields and destructive replacement behavior.
- [Release verification](https://cli.github.com/manual/gh_release_verify): validate the immutable release attestation.
- [Workflow token behavior](https://docs.github.com/en/actions/concepts/security/github_token): publishing with GITHUB_TOKEN does not start another release-event workflow. Required release evidence therefore stays in this graph; ordinary Supply Chain push/scheduled checks remain separate.

## Alternatives and final stack

| Option | Pro | Con | Decision |
| --- | --- | --- | --- |
| Draft-first, publish after all gates | Assets are complete before protection; failures remain drafts | More orchestration and explicit prerequisites | Adopt |
| Post-publication asset upload | Fewer jobs | Incompatible with protected assets | Remove |
| Separate read-only policy token | Verifies actual setting before irreversible publication | Additional secret provisioning/rotation | Require |
| Trust a repository variable claiming immutability | Easy setup | Cannot prove the actual setting | Reject |
| Replace conflicting draft assets | Convenient reruns | Deletes evidence and conceals changed bytes | Reject |

Retain Node 24 native ESM, small service/policy/CLI modules, canonical GHCR digest references, live GitHub certificate and release verification, least-privilege jobs, and separate runtime evidence. Immutable GitHub releases do not make registry tags immutable. This slice retains the existing early version/latest image-tag publication; staging images by a candidate reference and promoting tags after acceptance is the next code recommendation.

## W3C boundary

No DOM, ARIA, focus, or application UI behavior changes. Existing browser smoke remains a separate gate; provenance and publication are not accessibility conformance results. Machine evidence exposes sanitized facts and no credentials. The operator guide distinguishes draft state, failed/uncertain publication, verified immutable publication, and runtime acceptance.

See the separate [outcome](DRAFT_RELEASE_LIFECYCLE_OUTCOME.md) for measured validation and remaining release prerequisites.

Follow-up: [candidate staging and tag promotion](RELEASE_TAG_PROMOTION_DESIGN.md) now replaces the early registry-tag publication retained by this initial design. Live release acceptance remains separate.

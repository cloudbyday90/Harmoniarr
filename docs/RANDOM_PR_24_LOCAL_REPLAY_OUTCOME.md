# Random open PR 24 local replay outcome

Status: Passed local replay; maintained successor pin updated
Recorded: October 3, 2026
Design: [RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md](RANDOM_PR_24_LOCAL_REPLAY_DESIGN.md)

## Selected PR and maintained result

The fresh GitHub MCP collection contained open PRs `[40, 24, 23]`. Excluding
already replayed `[23, 40]` left `[24]`. The actual cryptographic draw returned
index 0 at `2026-10-03T17:17:24.1698254Z`; the singleton selection was therefore
necessarily PR 24. The design and ignored draw artifact retain the method and
random nonce.

[PR 24](https://github.com/cloudbyday90/Harmoniarr/pull/24), immutable head
`40cf4d117b69bd55b9a0a7353361838216e1e952`, changes one build-push-action
reference from v7.1.0 to v7.2.0. Main already used v7.3.0. The historical change
was replayed separately, not installed as a tracked downgrade or merged.

The maintained workflow now uses v7.4.0, full SHA
`c3c9e263c25d99ce0380d002d59b67737d91b0dc`. Its
[official release](https://github.com/docker/build-push-action/releases/tag/v7.4.0)
includes safer metadata logging, shared Buildx error handling, and dependency
updates. The [upstream logging patch](https://github.com/docker/build-push-action/pull/1617)
changes metadata output to the action toolkit's untrusted-printing helper.
Only that maintained action reference changed in the workflow: one insertion
and one deletion. Publication gates, platforms, cache, tags, and permissions
remain as specified by the existing workflow.

## Immutable source checks

MCP resolved v7.2, v7.3, and v7.4 tags to the full commit SHAs retained below.
All three action manifests have Git blob
`7a1a94d46f66694384cb558b6f164027cdc3b667`: Node 24 main/post actions, unchanged
inputs, and imageid/digest/metadata outputs.

The complete historical base and head workflows were read through MCP. Replacing
only the historical action reference in the base reproduced the head after
retained line-ending normalization. An ignored current-workflow copy also
replays only the selected v7.2 reference. Neither copy was dispatched.

Archives were downloaded from the official GitHub API at immutable commit
URLs. The unmodified extracted bundles' Git blob hashes were computed locally
and matched the upstream recursive Git-tree entries returned through MCP.

| Action | Commit | Verified bundled Git blob |
| --- | --- | --- |
| Historical v7.2.0 | `f9f3042f7e2789586610d6e8b85c8f03e5195baf` | `0c059f440d89d44f407eba1ed7cbe5358b9c7870` |
| Prior-main v7.3.0 | `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a` | `2be9fff2d40fb190754ca1c6a12eaf30630567fd` |
| Maintained v7.4.0 | `c3c9e263c25d99ce0380d002d59b67737d91b0dc` | `4294ed0312008304f474ce56cd1d95208dd35f2d` |

Archive and bundle SHA-256 hashes are also retained in the ignored evidence.
Third-party compiled CommonJS bundles and the local test guard exist only under
ignored `.tmp/random-pr-24-local-replay`, outside first-party ESM source.

## Executed local behavior

Final replay evidence started at `2026-10-03T17:34:30.687Z`, using Windows
Node `v24.18.1`, Linux Docker Engine `29.8.1`, and Buildx `v0.37.1`
(`0b265a9f62db554fa9aba6dd19e1bd5704bc7d8a`). The configured application runtime
is separate from this recorded local action host; this replay did not change it.

Each version executed two real bundled main actions and their real post actions:
six successful main executions and six successful post executions. The fixture
is `FROM scratch` plus a generated text COPY, with `linux/amd64`, local output,
push/pull/load false, build network none, no token/secret input or remote cache,
and disabled annotations, build summaries, and artifact upload. Child
environments and Docker config were isolated. The action guard allowed direct
Docker CLI subprocesses and rejected Node network access; final audit records
contain zero attempted Node network connections and seven allowed Docker
commands per main/post pair. No test container or separate builder was created.

| Scenario | v7.2 | v7.3 | v7.4 | Verified result |
| --- | --- | --- | --- | --- |
| Local filesystem export | Pass | Pass | Pass | Actual exported text matches generated source bytes; valid metadata output. Local export correctly has no imageid/digest output. |
| Local OCI archive and metadata control | Pass | Pass | Pass | imageid/digest/metadata output contract holds; OCI index digest, config platform/label, and extracted layer payload verified. |
| Checked post cleanup | Pass | Pass | Pass | Captured action state identifies a task-owned temp directory, which actual post execution removes. No summary/upload state was enabled. |

Both scenario comparisons passed across all versions. Exported payload SHA-256
is `d08bed2368bfefb7150a30ddd5bb34de006e348637d9a18f641a3bac060072f5`.
All OCI archive runs produced the same manifest digest:
`sha256:bac7a8e193fec93097c6f8e8c06c6db3edeb1a3e4681b22ad97124de99d6e66f`.

For the metadata logging control, the local harness inserted the harmless data
value `::notice::PR24_LOCAL_ONLY` through a checked read seam when the action read
actual Buildx metadata. The on-disk Buildx metadata and bundled action were not
modified. All versions retained the value as JSON output data. The v7.4 metadata
log surrounded it with a fresh stop-commands token and matching resume token;
the v7.2/v7.3 metadata logs lacked this envelope, as expected from upstream
source. This verifies the local logging boundary. It does not execute a workflow
command on a hosted runner, establish a Harmoniarr exploit path, or prove every
action log is sanitized.

Two initial harness failures were retained separately: an extra final newline
in a copied MCP manifest, then omitted Windows `PATHEXT` preventing the action
from finding Docker. The harness normalized only the manifest's trailing
newline and supplied the required nonsecret executable-extension environment.
These failures were corrected before the final successful replay; they were not
action-version compatibility failures. Ignored diagnostic JSON records remain.

## Repository checks and evidence limits

Executed together:

```text
node --test test/scripts/release-image-workflow-contract.test.js test/scripts/release-draft-workflow.test.js test/scripts/release-provenance-workflow.test.js test/scripts/release-tag-promotion-workflow.test.js test/scripts/release-workflow-fixture.test.js
```

Result: 20 passed, zero failed, zero skipped. These tests retain the existing
release graph, trusted mirror contracts, archived evidence gates, provenance
gate, and tag/publication separation. `git diff --check` passed.

Ignored evidence: `.tmp/random-pr-24-local-replay/evidence.json`.
SHA-256: `8d83d551ddc02fc02795617bef282f3eab932aa2b5de10f39b31dc1d469334e3`.
Associated logs, archives, manifests, draw, patch, historical/current replay
copies, upstream Git blob metadata, and harness are retained alongside it.

This evidence covers local amd64 scratch builds and bundled-action output/post
behavior. It does not cover hosted GitHub runner scheduling, arm64 execution,
GHA cache, registry authentication/publication, build summary/artifact upload,
the full application Dockerfile, release acceptance, or a security scan. Public
GitHub research/archive downloads used network access; the action replay used
the local Docker socket and guarded Node connections. No branches, commits,
merges, remote comments, workflow dispatch, image push, or release publication
were performed in this track.

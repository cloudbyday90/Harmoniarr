# PR 66 local login action outcome

Selected November 14, 2026 by a recorded cryptographic draw from open PRs
63, 64, 65 and 66. The result was index 3,
[PR 66](https://github.com/cloudbyday90/Harmoniarr/pull/66), head
`9ceb7dd8a0df3d582396abffc2de03a5a5c970fb`.

The reviewed delta changes nine `docker/login-action` SHA references in
`release-image.yml` from 4.1.0
(`4907a6ddec9925e35a0a9e82d7399ccc52663121`) to 4.7.0
(`81c6f93d4bc991e510b342a00b419b3bb4efc5c6`). It is applied on main without merging
the PR or replacing the workflow with its older base. Conditions, permissions,
credentials and six GHCR/three Docker Hub callers are preserved. No release
workflow was dispatched.

## Actual published bundle proof

MCP upstream commit/file metadata established repository and exact commit identity.
The Git object was fetched from that discovered upstream, and the actual published
`dist/index.cjs` was extracted: 2,160,444 bytes, SHA-256
`73376781a5b1d9f270b90631b00d2c9e837dffe04531d51b537a09cc07f637ed`.
This is a private replay artifact, not new Harmoniarr CommonJS source.

The pinned Node 24.22.3 image executed its main and post entrypoints as separate
processes in an unprivileged, read-only, network-disabled disposable container.
No Docker socket or real credentials were mounted. An allowlisted environment,
owned writable tmpfs/config/home and fake Docker executable controlled subprocess
results. Actual `GITHUB_STATE` records were parsed and replayed into post.

| Case | Observed result |
| --- | --- |
| GHCR password login | Exact registry/username arguments, synthetic password only on stdin, post logout of saved registry. |
| Omitted-registry Docker Hub with OIDC variable and supplied password | Standard password path to `docker.io`; no OIDC network exchange. |
| Logout disabled | Main login, no post logout. |
| Both credentials absent | Main rejects before Docker login. |
| Username absent | Main rejects before Docker login. |
| Password absent | Main rejects before Docker login. |
| Login exits nonzero with stderr | Main fails. |
| Login exits nonzero with empty stderr | Existing upstream limitation: main reports success. |
| Logout exits nonzero with stderr | Post emits warning and succeeds. |
| Logout exits nonzero with empty stderr | Post succeeds without a warning. |

All ten cases assert exit status, exact calls, config ownership, password hash/
length at stdin, absence from output/state/arguments, and bounded child output/
duration. The supervisor awaits actual process close. Container retirement and
removal are acknowledged. Two initial replay attempts failed because tmpfs lacked
executable permission; their containers retired. An explicitly executable private
tmpfs repaired the fixture; no production/workflow policy changed for that repair.

This establishes published-bundle dispatch and state transfer under synthetic
conditions. It does not establish real registry authentication, hosted-runner
masking, credential-store cleanup, OIDC authorization or release publication.
The empty-stderr behavior is a recorded upstream limitation, not evidence that
every login failure is refused.

## Recommendation

Adopt the exact reviewed pin with existing workflow controls. Benefits are vendor
maintenance and scoped configuration fixes; costs are continued bundle review,
upstream limitations and hosted/registry acceptance still outside local proof.
Do not infer that this action is the latest available release. Evaluate current
GitHub workflow dependency lockfile guidance separately; full SHA pinning alone
does not lock transitive action dependencies.

Raw bundle hashes, synthetic supervisor/trace recipes, failure logs, random draw
and final receipt remain ignored under `.tmp/folder-retention-2026-11-14/`.
No real login, image publication, application deployment or PR merge occurred.

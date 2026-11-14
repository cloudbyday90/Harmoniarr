# Folder buffer promotion research

Researched November 14, 2026 using MCP discovery and opened official sources.
See [design](FOLDER_BUFFER_PROMOTION_DESIGN.md),
[Astra review](FOLDER_BUFFER_PROMOTION_ASTRA_REVIEW.md) and
[outcome](FOLDER_BUFFER_PROMOTION_OUTCOME.md).

Node defines opendir bufferSize as an entry count: a larger value trades memory
for fewer internal refills. Close fulfillment means the directory resource has
closed. Promote only the fixed internal buffer; retain bounded selection,
admission, deadline checkpoints and close before publication. The measured
runtime remains pinned to 24.22.1; current v24 documentation serves 24.22.3.
[Pinned Node API](https://nodejs.org/download/release/v24.22.1/docs/api/fs.html),
[current v24 API](https://r2.nodejs.org/docs/latest-v24.x/api/fs.html).

Preserve the exact case and Unicode representation returned by the filesystem.
Do not normalize existing filenames or introduce locale-dependent cursor order.
Different filesystems preserve forms differently; verify actual round trips.
[Node filesystem guidance](https://nodejs.org/learn/manipulating-files/working-with-different-filesystems).
Ext4 component limits are bytes, so long-name fixtures need UTF-8 byte bounds,
not just JavaScript UTF-16 lengths.
[Kernel ext4 documentation](https://docs.kernel.org/5.18/filesystems/ext4/dynamic.html).

W3C internationalization guidance requires explicit string-comparison rules;
the application already uses exact string identity and consistent lexical
ordering. This promotion does not change those rules. Monotonic elapsed time
remains appropriate for measurements. The November 4 High Resolution Time
publication is a Working Draft, not a Recommendation or Node conformance claim.
[W3C internationalization](https://www.w3.org/TR/international-specs/),
[W3C High Resolution Time](https://www.w3.org/TR/2026/WD-hr-time-3-20261104/).

Retain inspected CPU/memory constraints and equal memory/memory-swap values to
disable swap. Process RSS, cgroup charges, lifetime peaks and post-GC snapshots
have different scopes; do not add them or infer a whole-app memory minimum.
[Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints).

Random selection from six open PRs chose
[Dependabot #61](https://github.com/cloudbyday90/Harmoniarr/pull/61), updating
music-metadata 12.2.3 to 12.3.2. Review the exact published archive and lock
integrity, then test real parser and embedded-cover consumers. This is the
selected PR version, not the latest upstream release. Later releases remain
separate update work. The opened advisory lists an older affected range; it
does not establish a new vulnerability in either reviewed version.
[Upstream releases](https://github.com/borewit/music-metadata/releases),
[reviewed advisory](https://github.com/advisories/GHSA-jjpr-9cvf-cq55).

Dependabot rebases conflicting/outdated branches and stops routine rebasing
after 30 days. All six opening PRs were mergeable against the current base and
5–12 days old. Rebase only when needed; do not manufacture stale status from age
alone. An applied update may be closed after its replacement reaches main.
[GitHub dependency PR guidance](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs).

| Choice | Pros | Cons / decision |
| --- | --- | --- |
| Fixed server-owned 128 | Prior local elapsed/CPU benefit; no user configuration or new service | Larger internal buffers; qualify long names and actual package; selected |
| Shared client/server buffer setting | One exposed setting | Couples UI policy to native I/O; unnecessary; rejected |
| Adaptive buffer/concurrency | Could react to observed conditions | New feedback and failure behavior without evidence; deferred |
| Exact 32/128 test variants | Preserves meaningful historical comparison | Must distinguish historical stream/32 from production/128; retained |
| Exact selected parser PR | Small lock delta; current consumer checks are reusable | Many parser internals change; requires fresh native parser/cover proof |

Recommended stack: fixed built-in buffer 128; existing page/raw/admission/deadline
guards; exact-name cursors; opt-in long-name concurrent measurements; real packaged
success/refusal/cancellation; reviewed parser bytes; one stable fast gate; scoped
retention and acknowledged resource cleanup. Network/NAS and manual assistive
checks remain deferred by the user.

Final research identified the November 11 Node 24.22.3 security release. The
retained 24.22.1 artifact is validation-only, not a security-current deployment
recommendation. Coordinate and qualify the new runtime before rollout, including
its changed embedded HTTP/compression components.
[Official release](https://nodejs.org/en/blog/release/v24.22.3),
[November advisory](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases/).

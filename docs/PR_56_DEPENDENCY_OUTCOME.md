# PR 56 local dependency outcome

October 26, 2026. GitHub MCP found two open PRs, 55 and 56. A recorded
`node:crypto.randomInt` selection chose
[PR #56](https://github.com/cloudbyday90/Harmoniarr/pull/56).

Reviewed immutable head `d77be6414d49abcff8cc73d860db1d590ad3b9f1` against base
`593144721d60d1efe18be678150e7351770e5f1b`. Its two-file MCP patch updates Vite
8.3.4 → 8.3.5 and Vue Router 5.2.0 → 5.4.0, with their dev lockfile dependencies.
The patch applied cleanly on `main`; reverse-application checking confirms those
exact changes remain incorporated. No GitHub merge or new branch is used.

[Vite's official releases](https://github.com/vitejs/vite/releases) describe build,
import-map, development-server and dependency fixes.
[Vue Router's releases](https://github.com/vuejs/router/releases) flag experimental
query normalization changes. Source review finds stable `createRouter` and
`createWebHistory` imports, without experimental router entry points. That limits
the expected applicability of the experimental change; it does not replace tests.

Recommendation: adopt the maintained versions with the committed integrity-pinned
lockfile. Benefit: upstream fixes and current stable tooling/router behavior.
Cost: changed dev transitive dependencies and generated client bundles, requiring
fresh client/build/browser qualification. Avoid treating a minor-version label
alone as compatibility proof.

`npm ci --ignore-scripts` passes; no lifecycle-script permission is added. All
4,485 client tests and the complete final fast gate/build pass. Final image client
files match the local build; 68 of 155 packaged file entries differ from baseline.
Seven fresh Chromium checks pass authenticated shell, repeated-query/empty-query/
hash redirect, lazy SPA navigation, back/forward history, route reload and nested
deep link. There are zero page errors or failed asset loads. Browser contexts and
the browser close normally. Prior client-browser evidence is historical.

The audit separately discovered the
[body-parser security issue](COMPRESSED_JSON_SECURITY_OUTCOME.md). Its two runtime
package updates are additional to this PR, clearly identified in the packaged
comparison. No other runtime npm packages or native binary hashes differ.
PR #55's music-metadata update is not included. The PRs were fresh and mergeable;
no stale-branch cleanup was needed. PR #56 is locally implemented and remains
unmerged at final review.

Selection, MCP patch/head metadata, installed audit, exact patch check and browser
evidence are preserved in the initial/final evidence directories named in the
[combined outcome](BACKUP_FAILURE_PRECEDENCE_OUTCOME.md). No application release
or version change is included.

# Open PR 45 local evaluation

Date: 2026-10-19. Follow the [reporter design](TEST_REPORTER_OWNERSHIP_DESIGN.md).
Discover repository/open PR metadata through GitHub MCP. Draw 0.9644102648295998
from ordered open PRs [50, 48, 45] selected
[PR 45](https://github.com/cloudbyday90/Harmoniarr/pull/45).

Immutable base: f8299100f4b3192fb5d59f8126e69ef9adf5c717.
Immutable head: 7204e580497ebb9f77c917f5da10119082067e81.
Opening main: 1ceadb9ec334c3a8c7e044c1180492cc53aa13bf.
Both opening package files exactly matched PR base bytes, so applying the exact
candidate pair did not discard later package changes. Main retains current
Express 5.3.0, Vue 3.5.44, Router 5.2.0, pg 8.23.1 and TypeScript 6.0.3.

## Candidate and official sources

| Installed tool | Before | Candidate |
| --- | --- | --- |
| @testcontainers/postgresql, testcontainers | 12.1.0 | 12.2.1 |
| @vitejs/plugin-vue | 6.0.8 | 6.0.10 |
| @vue/language-server, @vue/typescript-plugin | 3.3.11 | 3.3.13 |
| eslint | 10.9.0 | 10.13.0 |
| eslint-plugin-vue | 10.10.0 | 10.11.1 |
| globals | 17.11.0 | 17.13.0 |
| playwright | 1.62.1 | 1.64.1 |
| vite | 8.2.2 | 8.3.4 |

Official URLs were discovered from PR body/repository metadata or MCP search,
then opened/read on October 19. These are vendor implementation guidance:

- Testcontainers [12.2.0](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.2.0)
  and [12.2.1](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.2.1)
  change stream handling, image identity and container lifecycle. The upstream
  host-port wait default changes; project timeouts and serial scheduling do not.
- [ESLint 10.13.0](https://github.com/eslint/eslint/releases/tag/v10.13.0),
  [Playwright 1.64.1](https://github.com/microsoft/playwright/releases/tag/v1.64.1)
  and [Vite 8.3.4](https://github.com/vitejs/vite/releases/tag/v8.3.4)
  require actual lint/build/browser consumers; local success does not reproduce
  every vendor fix or qualify other platforms/browsers.
- Vue's verified [3.3.13 commit/changelog](https://github.com/vuejs/language-tools/commit/f2d92d3f1cb5513268fff358993f163e78d4821a)
  matches the installed package's gitHead and records setup-macro generation and
  VSCode changes. Its release-list response stopped at 3.3.12; no 3.3.13 release
  page is inferred. [Vue plugin responsibilities](https://github.com/vuejs/language-tools/blob/master/packages/typescript-plugin/README.md)
  and [TypeScript language-server plugin configuration](https://github.com/typescript-language-server/typescript-language-server/blob/master/docs/configuration.md)
  determine the actual two-service probe.

Lock review found 64 changed package entries, including root metadata, build
bindings, tooling/transport subtrees and added cache helpers. Vite/Rolldown/OXC
entries are not dev-only in the lock: Router/unplugin optional peers retain them
in `npm ls --omit=dev`. Picomatch is also a Router runtime dependency. Do not
describe this as zero production dependency-closure change. Platform bindings
remain platform-selective; this Windows gate does not execute Linux binaries.
Review the runtime image's build-tool closure separately before pruning peers.

## Executed evidence and decision

Install used `npm ci --ignore-scripts --no-audit --no-fund`; lock integrity and
the exact candidate package pair were retained. Candidate package SHA-256:

- package.json: f764f9ed9ef23239baed0fc87b490869a0be3219955df96bab84b75654cc3338
- package-lock.json: 198be27e00f3f4f5bf99566abea47b91585c59166a83102dffdda1f82bb35fa6

Real language tooling passed with TypeScript 6.0.3 and TypeScript language-server
6.0.2: initialize both services; open a Vue SFC; obtain script and template type
hovers from the TypeScript plugin; obtain Vue document symbols and HTML hover;
bridge actual projectInfo/component/element requests; shut down and await both
process closes. No mocked tsserver response supplied semantic evidence.

Retained probe failures are harness limitations: initial JSON-RPC import used an
unexported node.js subpath; a second probe incorrectly requested interpolation
types from Vue's HTML service; another ended stdin before the asynchronous exit
write. Correcting those probe contracts produced the complete passing collection.
They are not demonstrated package regressions. Full editor integration, every
language feature and VSCode extension activation were not tested.

Final fast gate passed 10,526 tests plus lint, policy checks and both builds in
116.8 seconds. npm audit reported zero vulnerabilities. Selected native/browser
results and frozen-source identity are recorded in the
[reporter outcome](TEST_REPORTER_OWNERSHIP_OUTCOME.md).

Local evidence remains under ignored .tmp/tests-stream-2026-10-19: immutable PR
package manifest/backups, lock review, install/lint/fast/audit logs, four language
probe attempts and native/browser reports. Private artifacts are not committed.

| Option | Pros | Cons |
| --- | --- | --- |
| Retain the qualified group locally | Updates coupled build/lint/browser/container consumers with one reproducible lock | Larger transitive delta; selected coverage and platform limits remain |
| Split the group now | Smaller dependency surface per commit | Rewrites the tested package pair and repeats qualification; no failure currently requires it |
| Keep old group | No new compatibility risk | Defers reviewed maintenance without an observed blocker |

Retain the candidate: the final selected native/browser gates passed. Keep the
existing modular ESM/Vue/PostgreSQL stack and warning/cleanup contracts. The PR
is evaluated locally without merge; no release, tag or new branch is created.

# October 8 dependency security update design

Status: Accepted for implementation
Research date: October 8, 2026
Baseline: `04fdbce692db2b90e65d6c5397513f943892e710`, main

## Trigger and scope

The current security gate reports four high and one critical affected-package
entries. Raw npm audit additionally reports one moderate entry: six package
entries represent five distinct advisories, because Vue is affected through
`@vue/server-renderer`. This differs from the October 3 zero-advisory snapshot.

`npm ls` locates proxy-addr under Express, sharp directly, Vue/server-renderer
and compiler dependencies under Vue/Vue Router, source-map-js under compiler
and PostCSS, and selector-parser under eslint-plugin-vue. Removal of affected
versions is warranted; this inventory does not establish exploit reachability
in Harmoniarr or justify changing HTTP trust configuration or adding SSR.

## Discovered official sources

Advisory URLs came from npm audit. MCP/web tools opened those URLs and followed
the returned maintainer advisory/release links. Official Vue release/changelog
search and npm registry metadata verified the stable patch family. Consultation
date is distinct from advisory publication/review dates.

| Primary source | Affected installed package and selected remediation |
| --- | --- |
| [Vue maintainer advisory](https://github.com/vuejs/core/security/advisories/GHSA-g2v6-rqmx-r4w6) and [official changelog](https://github.com/vuejs/core/blob/main/CHANGELOG.md?plain=1) | The advisory describes renderer attribute-name handling; its patched-version field remains unset. The official changelog records the 3.5.42 fix. Adopt stable Vue 3.5.43 and its aligned compiler/runtime/renderer family instead of a 3.6 release candidate. |
| [proxy-addr maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) | The IPv4-mapped IPv6 trust-subnet issue is fixed in 2.0.8; refresh the installed 2.0.7 within Express's allowed range. |
| [sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) and [release 0.35.5](https://github.com/lovell/sharp/releases/tag/v0.35.5) | Raise installed 0.35.4 to 0.35.5 and its patched native/libvips package family for the reported librsvg issue. |
| [source-map-js release 1.2.2](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) | Audit reports indexed-map offset CPU exhaustion below 1.2.2. Refresh installed 1.2.1 within parent constraints. |
| [selector-parser maintainer advisory](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf) | Refresh 7.1.5 to patched 7.1.6 for the moderate quadratic selector parsing issue. |

Registry engine metadata admits the supported Node 24 runtime. Sharp requires
Node >=20.9.0; proxy-addr/source-map-js/selector-parser floors are older. Actual
host execution is Node 24.18.1/npm 12.0.2. New first-party verification scripts
remain ESM even though third-party packages can support multiple module formats.

## Alternatives and final recommendation

| Approach | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Suppress the advisories | No dependency diff | Leaves affected versions and fails current security gate | Reject |
| Forced major upgrade or Vue release candidate | Broader refresh | Unnecessary runtime/tooling changes and compatibility scope | Reject |
| Ordinary compatible targeted updates | Removes affected versions, retains parent constraints and runtime family | Native/compiler/HTTP consumers still need validation | Adopt |
| Add exact overrides/direct dependencies for all transitives | Explicit resolution | New override ownership where existing ranges already admit fixes | Defer |

Raise direct Vue/sharp floors to the selected compatible releases and update
only proxy-addr, source-map-js and selector-parser through ordinary transitive
resolution. Review the actual manifest/lock diff. Non-forced audit-fix preview
also refreshes unrelated PostCSS/nanoid patches; targeted resolution is preferred
if it reaches the patched closure without that extra scope.

Actual ordinary targeted resolution also selected compatible PostCSS/nanoid
patches. Accept that small compiler dependency closure and record the precise
diff in the outcome; do not claim only advisory-bearing packages changed.

## Evidence and limits

Check final resolved versions, all-severity audit and lockfile platform closure.
Run affected artwork/HTTP/client/compiler checks, full repository validation and
both builds. Verify sharp loading and real bounded image operations on Windows
x64 and disposable Linux musl x64 against the final manifest/lock. Retain optional
platform entries; do not claim arm64 execution from package presence.

Use test-owned in-memory images and a disposable dependency workspace for native
compatibility. No exploit reproduction, universal vulnerability absence or
published-image acceptance is inferred. Record exact changes and executed
results in a separate outcome document.

Work remains on main. No release, tag, PR merge, new branch, image publication
or runtime-major upgrade is part of this update.

# October 8 dependency security update outcome

Status: Implemented and validated locally
Recorded: October 8, 2026
Design: [DEPENDENCY_SECURITY_UPDATE_2026_10_08_DESIGN.md](DEPENDENCY_SECURITY_UPDATE_2026_10_08_DESIGN.md)

## Actual changes

| Package family | Previous | Installed |
| --- | --- | --- |
| Vue and aligned compiler/runtime/renderer family | 3.5.41 | 3.5.43 |
| sharp and native platform packages | 0.35.4 | 0.35.5 |
| sharp-libvips platform packages | 1.3.3 | 1.3.4 |
| proxy-addr | 2.0.7 | 2.0.8 |
| source-map-js | 1.2.1 | 1.2.2 |
| postcss-selector-parser | 7.1.5 | 7.1.6 |
| PostCSS | 8.5.26 | 8.5.29 |
| nanoid | 3.3.18 | 3.3.20 |

Direct floors retain caret ranges, now `vue: ^3.5.43` and `sharp: ^0.35.5`.
Ordinary targeted npm resolution also selected the permitted PostCSS/nanoid
compiler transitive patches. The actual closure records these extra compatible
patches rather than claiming only advisory-bearing packages changed. No forced
major, release candidate, new override, advisory suppression or new direct
transitive dependency was introduced. Package-path inventory is unchanged;
optional native entries, including Linux musl x64/arm64, remain present.

proxy-addr, sharp, Vue/server-renderer and source-map-js are retained in the
production dependency closure. Selector-parser is a development dependency.
PostCSS/nanoid also remain in the production install through Vue's compiler
dependency graph, despite their main consumer being compilation.
This is dependency inventory, not demonstrated application exploit reachability.

## Executed evidence

```powershell
npm.cmd audit --json
npm.cmd audit fix --dry-run --json
npm.cmd install vue@3.5.43 sharp@0.35.5 --ignore-scripts
npm.cmd update proxy-addr source-map-js postcss-selector-parser --ignore-scripts
npm.cmd ci --ignore-scripts
npm.cmd run validate:security
node --test test/server/artwork-ingestion-service.test.js test/server/runtime-resource-service.test.js test/scripts/pwa-manifest.test.js test/server/app.test.js
```

The manifest and lock root retain their existing caret convention after the
install. The non-forced fix preview was informational; targeted install/update
commands performed the changes. No third-party install script ran.

The initial raw audit reported six package entries/five distinct advisories,
including one moderate entry and Vue's renderer dependency effect. The final
clean install and security gate report **zero vulnerabilities at every severity**.
Both Compose image/tag and single-node topology policies pass. The focused
artwork/runtime/app/manifest command passes **21 tests**, zero failures/skips.

Real in-memory native controls pass on Windows x64 (Node 24.18.1) and disposable
Linux musl x64 (Node 24.21.0/npm 12.0.2). Each loads sharp 0.35.5, libvips
8.18.7, librsvg 2.63.2 and libheif 1.23.5 and verifies JPEG, PNG, WebP and AVIF
encode/decode/resize, bounded SVG decode, and malformed-input refusal. These are
library compatibility controls; SVG/AVIF application acceptance was not widened.

The Linux check mounts this repository read-only, copies the final manifest,
lock, npm configuration and ESM harness into its disposable writable workspace,
then uses `npm ci --omit=dev --ignore-scripts`. The local `node:24.21.0-alpine`
image identity is
`sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`.
The container/workspace is removed after completion. Retained ignored logs are
under `.tmp/automatic-library-add-2026-10/`: `npm-audit-before.json`, install/
update/clean-install logs, `security-after.log`, `dependency-focused.log`,
`native-windows.log` and `native-alpine.log`.

Complete combined `npm run validate` passes 8,799 tests (3,746 server, 4,348
client, 513 script and 192 integration), zero failures/skips, all policy/lint
checks and both builds. The separate
[automatic-add outcome](MUSIC_QUEUE_AUTOMATIC_LIBRARY_ADD_GUARD_OUTCOME.md)
records exact focused/current results and an earlier unreproduced lifecycle lock
observation failure whose isolated/file/complete reruns pass unchanged.
Browser/client proof uses rebuilt Vue 3.5.43; all 20 browser scenarios pass.
Independent read-only dependency review confirms exactly 42 package entries
changed, none added/removed, unchanged engine/platform/optional classifications,
and valid native/compiler dependency closure.

## Recommendation and limits

Retain these compatible patched families and the current all-severity advisory
check. Compiler/native consumers need the same functional/build checks as other
dependency changes; do not add first-party replicas of third-party exploits.

The benefit is removal of currently affected versions without a major migration.
The cost is testing the aligned compiler and native closure, including permitted
transitive patch changes. This audit is time-bound; it does not establish that
unknown vulnerabilities are absent, reproduce exploitation, or validate deployed
historical images. Linux arm64 execution and published-image acceptance were not
performed. No release, tag, PR merge, image publication or runtime-major upgrade
was created.

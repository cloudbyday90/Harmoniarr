# Random PR #40 local replay outcome

Executed October 3, 2026. The separate
[design](RANDOM_PR_40_LOCAL_REPLAY_DESIGN.md) records selection, official-source
research, alternatives, and the accepted implementation before execution.

## Result and maintained change

The fresh random draw selected [PR #40](https://github.com/cloudbyday90/Harmoniarr/pull/40),
head `649659f1e199d48d55cc8d5cccf9f079dc235d86`. GitHub MCP supplied its complete
one-file patch: the controlled-provider fixture image changes from
`node:24.19.0-alpine` to `node:26.7.0-alpine`.

The exact requested image was implemented in an ignored local replay and
executed with current fixture source. The previous main image and the accepted
Node 24.21 LTS successor ran the same checks. All three Docker executions and
both normalized semantic comparisons passed.

The maintained Compose change is one image line, now
`node:24.21.0-alpine`. This is a compatible LTS successor, not the historical
PR's exact Node 26 pin. Current secret-file handling, verifier mounts, non-root
user, and container restrictions remain intact. The historical PR head predates
the secret-file change; its whole Compose file was not substituted for main.
No application Node 26 support, PR merge, or release is claimed.

## Official runtime and component findings

Node 26 is still Current on the research date; its LTS transition is scheduled
for October 28. Node 24 remains LTS. The fixture is standalone ESM using Node
builtins and its local catalog, so testing Node 26 there does not expand the
application's Node 24 engine contract.
[Official schedule](https://github.com/nodejs/Release/blob/main/schedule.json).

Official source manifests and actual Docker `process.versions` agree that the
exact PR image bundles Undici 8.9.0, the prior main image bundles 7.29.0, and
the maintained successor bundles 7.29.1. Both old components precede the
maintainer's patched baseline for GHSA-w293-vg96-wgc3; Node 24.21 includes
the 7.x fix.
[Node 26.7 manifest](https://github.com/nodejs/node/blob/v26.7.0/deps/undici/src/package.json),
[Node 24.19 manifest](https://github.com/nodejs/node/blob/v24.19.0/deps/undici/src/package.json),
[Node 24.21 manifest](https://github.com/nodejs/node/blob/v24.21.0/deps/undici/src/package.json),
[maintainer advisory](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3).

The advisory requires BalancedPool with function-valued custom TLS/connector
options. The inspected fixture uses its own HTTP server and loopback plain-HTTP
health fetch. No such advisory attack path was established here. Refreshing the
bundled component is useful maintenance; this replay is not an image security
scan, proof of exploitation, or assurance against all current vulnerabilities.

## Actual Docker verification

Execution used Docker Engine 29.8.1 and Compose 5.5.1 on Linux amd64 containers.
Each isolated service preserved UID/GID 1000, a read-only root, dropped `ALL`
capabilities, `no-new-privileges`, `/tmp` tmpfs, the existing healthcheck, and
secret-file key handling. The replay added `network_mode: none`, no published
port, and task-owned mounts. Probes ran inside each container against loopback.
The key was generated solely for these fixtures and was not environment-injected.
Public image pulls preceded execution; no image or metadata was published.

| Image | Actual Node / Undici | Probe assertions | Search / transfer / byte-copy totals |
| --- | --- | --- | --- |
| Exact PR `node:26.7.0-alpine` | 26.7.0 / 8.9.0 | 436 passed | 17 / 21 / 18 |
| Prior main `node:24.19.0-alpine` | 24.19.0 / 7.29.0 | 436 passed | 17 / 21 / 18 |
| Maintained `node:24.21.0-alpine` | 24.21.0 / 7.29.1 | 436 passed | 17 / 21 / 18 |

The 1,308 probe assertions exercised health; missing/wrong key refusals;
application/session responses; unknown routes; all 17 catalog search cases;
initial delayed responses followed by completed polling; locked-file evidence;
no-response completion; primary and fallback metadata; failed transfer refusal
to create a file; successful byte copying; shared bounded-stop next-attempt
behavior; individual/global transfer lookup; and final fixture evidence counters.
Host-side assertions also checked actual image/runtime identity and container
settings. Two comparisons confirmed identical normalized responses, transfer
states, counters, and copied-file totals across versions. UUIDs and timestamps
were excluded from the semantic projection.

These were synthetic byte transfers. They do not prove audio decoding,
application quality decisions, safe library addition, or the full Harmoniarr
controlled-provider pipeline. No live Soulseek/provider credential was used.

## Commands and evidence

```powershell
node .tmp/random-pr-40-local-replay/replay.mjs
node --test test/scripts/controlled-provider-compose-contract.test.js test/scripts/controlled-provider-validation-secret.test.js test/scripts/docker-controlled-provider-pipeline-validation.test.js test/scripts/controlled-provider-pipeline-evidence.test.js test/testing/controlled-provider-music-queue-linkage-verifier.test.js
git diff --check
```

The existing focused regression group passed 11 tests, with zero failures,
skips, or cancellations. Whitespace validation passed. No permanent test was
added merely to repeat the pinned image string.

The first harness launch failed before container creation because its explicit
Windows environment omitted `ProgramFiles`, which Docker needs to discover
the Compose plugin. Adding the standard plugin-discovery environment fields
fixed the harness. `initial-launch-failure.json` retains that setup failure;
all subsequent image/runtime checks passed. This was not a fixture image failure.

Evidence timestamp: `2026-10-03T16:02:36.340Z`.
Sanitized aggregate evidence: `.tmp/random-pr-40-local-replay/evidence.json`.
SHA-256: `f6b07377a1509f8f53646427ba4534b839885de485ea4cd53ea6e8907455c676`.

| Image | Resolved repository digest reported by Docker |
| --- | --- |
| 26.7.0 | `node@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019` |
| 24.19.0 | `node@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43` |
| 24.21.0 | `node@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` |

Staged source hashes were checked against current source before execution:
server `54a02bbb5cea25c8ab41657a6d009edc1e66872fd527defb78fd60f1e46c144f`;
catalog `3cf33b5151a9a68261cd0cadd37f4ca33aed4dc68417e333186a76d46c86c3c9`.
The ignored fixture retains the exact patch, historical head file, standalone
harness/probes, staged source, generated Compose files, pull/container logs,
and per-image results. Task-owned containers were removed after execution.

## Remaining scope

The accepted maintained pin includes the verified component fix while preserving
the application-major alignment. Node 26.10 compatibility work is deferred.
The application Dockerfile's Node refresh belongs to the separate root-owned
runtime scope and needs its own packaged build/runtime validation. This fixture
result does not close arm64, live-provider, hosted workflow, published image,
release provenance, or operational recovery gates. No branch, merge, tag,
release, workflow dispatch, image build/push, or remote PR operation occurred
in this replay track.

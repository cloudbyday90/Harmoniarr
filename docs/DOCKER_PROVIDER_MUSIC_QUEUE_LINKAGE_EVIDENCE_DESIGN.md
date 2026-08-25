# Docker Provider Music Queue Linkage Evidence Design

## Decision

Extend the authenticated Docker provider-acceptance validator with an optional
strict **Music Queue link** requirement. When selected, the validator:

1. requires at least one current transfer whose persisted Import Review linkage
   resolves to a Music Queue release for the signed-in operator;
2. selects the native **Only transfers linked to Music Queue** checkbox;
3. verifies the filter's labelled result count and native table rows; and
4. activates Downloader **Refresh** and confirms every originally linked
   in-memory transfer remains linked in the refreshed provider response.

The default validation remains diagnostic-only. A disposable walkthrough may
intentionally have no configured provider, path mapping, execution run, or
Music Queue-origin transfer. Strictness is requested with
`--require-music-queue-link`; it is never inferred from generic health.

## Evidence boundary

`scripts/downloader-music-queue-evidence.js` is a small ESM-only policy module
that returns bounded counts for persisted evidence. It keeps transfer identities
only in memory while comparing the before/after refresh results. The evidence
file records transfer counts, never transfer identifiers, filenames, provider
payloads, API keys, or credentials.

The existing browser validator retains its authenticated API checks. Its
Import Review UI step now uses the current `Match diagnostics` route and runs
only when a diagnostic is required. That lets an intentionally unconfigured
walkthrough collect a safe baseline without waiting for an unavailable panel.

## W3C and provider model

- WCAG 2.2 requires labels or instructions for controls that accept user input.
  The strict check uses the existing visible checkbox label rather than a
  selector-only surrogate.
- WCAG 2.2 status-message guidance calls for state changes to be
  programmatically determinable without focus. The validator reads the
  existing polite filter-result status after selection.
- slskd documents that downloads directories must exist and be writable. This
  evidence validates linkage and UI state only; it does not claim a download is
  import-ready without the separately required path mapping.
- Docker Compose readiness is health-based. The validator runs against an
  already healthy local stack; it does not introduce a second readiness loop or
  a public provider port.

## Alternatives

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Make a Music Queue link mandatory for every provider check | Strongest single signal | Breaks ordinary unconfigured/local troubleshooting | Rejected |
| Persist transfer IDs or raw rows in evidence | Easier forensic replay | Exposes unnecessary provider and library metadata | Rejected |
| Add a separate Downloader endpoint | Could specialize the response | Duplicates authenticated queue semantics | Rejected |
| Optional strict check over the existing queue and native UI | Proves the handoff with minimal surface area | Requires a real Music Queue-origin transfer | Chosen |

## Security

- The validator makes authenticated reads and the existing UI refresh only. It
  does not enqueue, cancel, retry, remove, or clear transfers.
- No provider key is accepted as a CLI argument or written to evidence.
- The durable linkage query remains scoped to the authenticated administrator;
  no cross-operator release association is exposed.
- No new HTTP route, persistence setting, or browser storage is introduced.

## Sources

- [W3C WCAG 2.2: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions)
- [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
- [slskd configuration reference](https://github.com/slskd/slskd/blob/master/docs/config.md)
- [npm 12 `.npmrc` and script arguments](https://docs.npmjs.com/cli/v12/configuring-npm/npmrc/)

## Final stack

- Bounded linkage module: `scripts/downloader-music-queue-evidence.js`
- Browser/evidence orchestration: `scripts/docker-provider-acceptance-evidence.js`
- Strict CLI option: `--require-music-queue-link`
- Stable evidence schema: `scripts/docker-smoke-evidence.js`
- Operator instructions: `docs/LOCAL_DOCKER_WALKTHROUGH.md`

## Next recommended item

After a real provider has accepted a Music Queue-origin transfer, run the
strict command and save the bounded evidence artifact locally. If it fails,
inspect the existing Import Review diagnostic and path mapping before adding
new Downloader controls.

# Docker Provider Acceptance Readiness Design

Date: 2026-08-26

## Decision

Keep the Docker provider-acceptance validator strict when its selected proof is
missing, but replace generic assertion failures with one bounded readiness
result. The result gives a clear label, a short explanation, and one next
action. It is written to the local evidence artifact before the command exits
unsuccessfully.

This is an operator diagnostic, not a new Downloader screen, endpoint, stored
setting, or background job. The existing browser probe still owns
authentication and UI verification. A new ESM-only policy module owns the
readiness decision so the browser flow, CLI, and tests share the same rule.

The 2026-08-26 strict local execution established that the immediate missing
condition is a Music Queue-origin transfer, not an ambiguous control or a
missing combined workspace. The action text therefore names the existing
screen and the conditional match-selection step without claiming a transfer
has been accepted.

## Operator outcomes

| Readiness code | Label | Next action |
| --- | --- | --- |
| `provider_configuration_required` | Connect the download provider | Complete the provider connection in **Settings > Connections**. |
| `download_path_mapping_required` | Set the download path mapping | Add the shared path translation in **Settings > Media & storage**. |
| `download_diagnostic_required` | Record a download outcome | Start an Import Review download run and sync transfer state. |
| `accepted_transfer_required` | Get a provider-accepted transfer | Use the Import Review diagnostic to choose a candidate and retry the run. |
| `music_queue_transfer_required` | Continue the release in Music Queue | Open Music Queue, choose a match if Harmoniarr asks, then wait for the release to appear in Downloader. |
| `ready` | Provider acceptance evidence is ready | Save the local validation evidence. |

The evaluator reports the first unmet selected requirement. It never calls a
path mapping invalid merely because no mapping is present; it accurately says
that a mapping must be set. Verifying that a configured mapping translates a
specific completed file remains the separate file-backed recovery proof.

## Official sources reviewed

- [W3C WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
  requires an error to be identified and described in text. Each state above
  names the missing condition rather than exposing an internal assertion.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  explains that results, waiting states, and errors should be programmatically
  determinable. The structured `readiness` object provides the stable model a
  future visible status can expose without inventing a second flow now.
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) requires instructions where
  input is needed and an error suggestion when it is known and safe. Each
  readiness result supplies one safe corrective action.
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
  recommends health checks and `service_healthy` dependencies. The validator
  remains a probe of an already healthy local stack; it adds no polling loop.
- [Playwright authentication](https://playwright.dev/docs/auth) explains that
  browser contexts are isolated and warns that authenticated storage can be
  sensitive. The probe uses a transient context and does not save its browser
  state.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding, masking, or sanitizing sensitive log data. The saved
  result is an allowlist, not the browser result with fields removed later.
- [slskd configuration guidance](https://github.com/slskd/slskd/blob/master/docs/config.md)
  treats API keys as secrets and warns about remotely retrievable configuration.
  Readiness therefore consumes only existing booleans and counts, never keys,
  paths, or raw provider responses.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep sequential assertion text | Smallest patch | Gives no clear next step and cannot be safely saved before a strict failure | Rejected |
| Save raw Settings and provider responses | More forensic detail | Exposes unnecessary paths, credentials, and provider metadata | Rejected |
| Persist the browser scenario result directly | Fewer transformations | Retains internal run/candidate IDs, usernames, endpoints, and screenshot paths that are unnecessary for evidence | Rejected |
| Add a new Downloader setup page | Could display guidance immediately | Expands product surface before observing actual recovery friction | Deferred |
| Use a pure readiness policy with a separately allowlisted artifact | Clear outcome, secure artifact, reusable by a later UI | Does not prove a configured mapping resolves a real file | Chosen |

## Final stack

- Readiness policy: `scripts/docker-provider-acceptance-readiness.js`
- Artifact allowlist: `scripts/docker-provider-acceptance-artifact.js`
- Browser/evidence orchestration: `scripts/docker-provider-acceptance-evidence.js`
- Evidence contract: `scripts/docker-smoke-evidence.js`
- CLI: `scripts/validate-docker-provider-acceptance.js`
- Focused tests:
  `test/scripts/docker-provider-acceptance-readiness.test.js`,
  `test/scripts/docker-provider-acceptance-artifact.test.js`,
  `test/scripts/docker-provider-acceptance-evidence.test.js`, and
  `test/scripts/docker-smoke-evidence.test.js`

## Security boundary

- The artifact retains only configuration-presence booleans, aggregate counts,
  stable diagnostic codes, statuses, and the bounded readiness text.
- It excludes application and provider endpoints, usernames, run and candidate
  identifiers, download-client or Harmoniarr path prefixes, release titles,
  screenshot paths, API keys, transfer identities, and raw provider payloads.
- The browser scenario keeps only the transient context needed to authenticate,
  inspect the existing interface, and render a concise terminal result.
- The browser probe performs authenticated reads and the existing Downloader
  refresh only; it does not enqueue, cancel, retry, remove, or clear work.

## Follow-up

Run the strict local provider probe after Music Queue has progressed a release
to Downloader. If the resulting readiness code exposes real recovery friction,
improve that single existing screen rather than adding another queue or setup
surface. The current result is a prerequisite, not authority to submit a real
peer-to-peer request from automated validation.

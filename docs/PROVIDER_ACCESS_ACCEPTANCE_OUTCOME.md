# Provider access and acceptance outcome

Implementation date: September 11, 2026. Starting commit: `ee33431`.

## Implemented behavior

Administrators can explicitly check a saved music-provider connection against a supported playlist or artist URL in Settings → Connections. The check observes only that source. It distinguishes configuration, authentication, denied access, unavailable resources, documented quota exhaustion, temporary throttling, malformed pages, version changes, timeouts, and provider outages.

The [design document](PROVIDER_ACCESS_ACCEPTANCE_DESIGN.md) records independently discovered official sources, alternatives, pros and cons, the final architecture, and reviewed PR heads. This outcome records the resulting code and verification.

`POST /api/v1/providers/collection-access-check` accepts only `{ sourceUrl }`, requires a fresh administrator session, invokes the existing deployment CSRF policy, and sets `Cache-Control: no-store`. Authorization precedes a shared four-checks-per-minute limit. Changing forwarded IP headers does not bypass that quota. Configure `security.csrfProtectionMode: required` for release use; this change preserves the existing deployment opt-out rather than claiming CSRF is unconditional.

The ESM service resolves only the selected provider and checks at most two container pages, 200 entries, eight provider HTTP requests, and 30 seconds. One check can run per service instance. Authentication exchanges and Spotify version reads consume the same request budget. Existing collection adapters validate page structure and continuations. No album descendants are fetched and no request, ingestion, collection ledger, discovery, download, or import work is created. The selected account's existing OAuth token may be refreshed using the encrypted secret store.

Spotify, YouTube, and Apple Music clients now share small request, bounded JSON, and error-classification modules. Authenticated transport allows fixed provider origins, rejects redirects, and holds cancellation through response-body reading. Provider bodies are capped at 2 MB; API-key-bearing URLs and raw transport causes no longer enter client error detail. Documented quota reasons remain distinct from temporary request limits. A 403 cannot establish the provider's account/quota mode; `quotaMode` remains `unknown` even after successful access.

Native labelled input, guarded button and Enter handling, persistent status/alert messages, visible corrective actions, and preserved input/focus support accessible checking within the existing Settings form. Editing the source clears stale observations. Two-page partial coverage and a complete one-page collection have different evidence; neither passes strict multi-page acceptance.

## Local acceptance command

Enable and configure the chosen provider in the target application's saved connections first. Spotify Development Mode may require an owning or collaborating authorized user. Public web visibility does not establish API entitlement. Apple Music checks currently cover catalog resources, not private user libraries.

Use a protected password-only file and a new evidence output path. The command accepts a loopback HTTP origin or an explicit HTTPS origin without a path, query, or credentials. Redirects are rejected and the application JSON response is capped at 64 KiB. No provider credential is supplied to the CLI.

```powershell
node scripts/validate-provider-collection-access.js --live `
  --base-url http://127.0.0.1:47956 `
  --username <administrator> `
  --password-file <protected-password-file> `
  --source-url 'https://www.youtube.com/playlist?list=PL1B627337ED6F55F0' `
  --evidence-path .tmp/provider-access-evidence.json
```

`npm run validate:provider-collection-access -- <options>` is the package alias. On this Windows environment, use `npm.cmd` or the direct Node invocation above: the installed PowerShell `npm.ps1` wrapper does not preserve argument forwarding for this invocation. `node scripts/validate-provider-collection-access.js --help` prints supported options. Without explicit `--live`, execution stops before secret-file reads or network access. Direct password arguments and plain password environment values are unsupported.

The source above is the public **NPR Music Tiny Desk Concerts** playlist, chosen under the user's instruction to select a popular testing source. Its actual YouTube link was discovered through the linked MusicBrainz series and opened through the web tool; see the design for provenance. It is a useful public diagnostic sample. A large playlist may exceed the two-page limit and therefore fail strict acceptance despite verified access. For strict acceptance, choose an accessible stable collection that spans exactly two fetched pages.

The collector logs in, calls the same protected endpoint, validates field types and cross-field consistency, reconstructs fixed copy, writes an exclusive new JSON artifact, and closes the session. The artifact contains no source/application URL, resource/account identity, password, token, raw body, or secret-file path. Observation timestamps must be within five minutes of collection time. It records `evidenceType: live_provider_collection_access`; strict success requires verified access, multiple observed pages, and full traversal. Incomplete or failed checks are saved and produce exit code 1. Logout failure also preserves already validated evidence but produces exit code 1. Existing output files are never overwritten.

## Live observation and limitations

The existing Docker walkthrough was discovered at `http://127.0.0.1:47956`. A read-only query through its packaged settings module observed `spotifyEnabled: false`, `youtubeEnabled: false`, and `appleMusicEnabled: false`. No credential value was retrieved or printed. No live provider API request or strict live acceptance run was performed. The running walkthrough was not restarted or redeployed with this working tree.

Choosing a public testing source resolves source selection, but an enabled saved connection and administrator session are still needed to run the protected check. Live multi-page acceptance remains outstanding. Controlled fixtures prove transport and application behavior; they are not retained or presented as real-provider entitlement evidence. The diagnostic does not prove acquisition, access to arbitrary sources, private Apple libraries, or an unchanging remote snapshot.

## Validation

Final validation passed on Node 24.18.1 and npm 12.0.2:

| Check | Result |
| --- | --- |
| `npm run validate` | Passed copyright, migration/schema policy, ESM, Compose policy, lint, test hygiene, all Node suites, and both builds |
| Server tests | 3,390 passed |
| Client tests | 4,194 passed |
| Script tests | 337 passed |
| PostgreSQL integration tests | 86 passed |
| Total Node tests | **8,007 passed; zero failures, cancellations, or skips** |
| `node --test --test-concurrency=1 test/browser/settings-provider-collection-access.test.js` | Two Chromium/PostgreSQL scenarios passed; zero skips |
| `npm run validate:security` | Passed; dependency audit reported zero vulnerabilities |
| Direct CLI help and `--no-live` checks | Help succeeded; missing opt-in produced the expected safe rejection before credentials/network |
| `git diff --cached --check` | Passed |

Full validation initially exposed four existing generic OAuth fixtures using an unsupported fake provider origin. They now use a supported provider identity with mocked transport, preserving the production destination allowlist. The corrected full validation run passed. No database migration or running-container deployment was required for this implementation.

Focused coverage includes fixed destinations and redirect rejection, response/body deadlines, HTTP request budgets including OAuth, selected-provider isolation, source validation, source-version mismatch, malformed continuations, partial traversal, safe failure projection, quota classification, artifact bounds/freshness/redaction, explicit CLI opt-in, session cleanup, and exclusive evidence writes.

The PostgreSQL integration scenario exercises the actual application graph and stored sessions. It verifies administrator role, password-change freshness, required-mode CSRF, shared rate limiting, status-read isolation, disabled-provider evidence through the CLI, and unchanged request/ingestion/collection/discovery tables. Browser scenarios use controlled HTTP responses with real PostgreSQL and Chromium, verify keyboard focus and Enter behavior without Settings submission, exercise safe errors and source edits, and inspect 390/800/1280-pixel layouts in both themes. Screenshots mask the source URL.

## Recommendations and final stack

| Priority | Next change | Pros | Cons / prerequisite |
| --- | --- | --- | --- |
| 1 | Capture live two-page access evidence for each supported connection mode | Establishes actual account entitlement and current provider envelopes | Requires enabled saved connections and an eligible stable collection; public samples may exceed limits |
| 2 | Prove PostgreSQL backup/restore of request decisions and retained work | Verifies recovery of the new durable collection ledger | Requires an isolated restore rehearsal and continuity assertions |
| 3 | Page broad Music Queue reads and expose preparation progress | Keeps larger libraries responsive and makes remaining preparation visible | Requires stable paging/filter contracts and client-state coverage |
| 4 | Replay fresh-install and upgrade acceptance against an immutable release image | Verifies the packaged runtime users receive | Requires a built candidate digest and deployment evidence |
| 5 | Evaluate guarded automatic collection continuation | Reduces repeated preparation actions | Depends on provider evidence, bounded quotas, cancellation, and preserved operator review |

Recommended stack: Node 24 LTS, modular native ESM, existing encrypted OAuth storage, provider-specific clients over fixed-origin bounded transport, shared collection adapters, PostgreSQL for durable work, fresh-admin sessions with required deployment CSRF, and native Vue controls. Explicit bounded checks add useful evidence at predictable cost, but require operator setup and cannot establish universal provider health.

The next independent code item is **PostgreSQL backup/restore continuity for requests, decisions, and retained collection work**, while live provider evidence awaits saved connection configuration. Keep full database recovery distinct from the existing logical settings/wanted export.

September 11 follow-up: the [PostgreSQL recovery outcome](POSTGRES_RECOVERY_REHEARSAL_OUTCOME.md) records a passing full generated-fixture archive rehearsal and a cancellation-recovery fix. It advances the next independent code item to Music Queue pagination and preparation progress. The live-provider and operator-recovery limits above remain open.

## Pull request disposition

GitHub MCP refreshed all open PRs and inspected each complete patch. No patch is applicable: #23 and #24 are superseded by newer pinned workflow actions already local; #40 upgrades only the fixture to Node 26, diverging from the Node 24 platform. The design records their exact immutable heads and discovered links. No PR was merged or changed.

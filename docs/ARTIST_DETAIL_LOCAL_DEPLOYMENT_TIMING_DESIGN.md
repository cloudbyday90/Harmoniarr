# Artist Detail Local Deployment Timing Design

Status: Implemented
Date: 2026-08-29
Owner: Metadata architecture + quality engineering

## Decision

Add a one-shot, local-only browser measurement for a reproducible Artist
Detail loading report. The command drives the normal authenticated interface
against the running local deployment and records the precise route sequence:

1. local metadata lookup;
2. authenticated operator projection, when local metadata exists; and
3. provider Discography fallback, only when the application starts it.

The output is a bounded JSON artifact that contains fixed request-category
labels, status families, browser timings, the resulting flow, and a capture
timestamp. It contains no URL, artist identifier, release data, user identity,
credential, cookie, header, or response body.

This complements the disposable PostgreSQL/Chromium regression proof in
[Artist Detail Local and Operator Timing Design](ARTIST_DETAIL_LOCAL_OPERATOR_TIMING_DESIGN.md).
That proof establishes the route contract; this command captures the same
contract on the affected home-hosted deployment before any code path is
redesigned.

## Why this is the next work

The reported symptom is perceived Artist Detail latency despite the completed
provider-SWR evidence. A durable fix must first distinguish which existing
leg is slow. The local route, per-user operator projection, and provider
fallback have intentionally different ownership and cache behavior. Combining
them into one navigation duration would not identify an actionable fix.

No dashboard is added: a persistent timing UI would disclose operational
information without helping a normal household user manage music. This
one-shot diagnostic is run only when an administrator has a reproducible
case, then the artifact can support a narrow regression and fix.

## Standards and research review

Reviewed on 2026-08-29 against current primary sources:

- [W3C Resource Timing](https://www.w3.org/TR/resource-timing/) defines the
  browser resource timing model. Same-origin application calls are the right
  measurement boundary; the specification intentionally masks detailed
  cross-origin data unless the resource provider opts in with
  `Timing-Allow-Origin`.
- [W3C Server Timing](https://www.w3.org/TR/server-timing/) remains the
  complementary evidence for the existing provider cache state. Its privacy
  guidance confirms that servers decide which information to expose. This
  command does not add any new server metric or header.
- [Playwright Request timing](https://playwright.dev/docs/api/class-request#request-timing)
  makes `responseEnd` available after a request finishes. The command observes
  that event boundary, rather than guessing individual costs from total page
  navigation time.
- [Playwright network monitoring](https://playwright.dev/docs/network)
  supports observing the actual requests caused by browser navigation. This
  preserves session, CSRF, authorization, and client orchestration behavior.

There is no interface change in this increment. W3C accessibility guidance
continues to apply to the existing Artist Detail page, while this work follows
the related W3C performance model without introducing new controls, status
messages, or focus behavior.

## Design

`scripts/measure-artist-detail-local-timing.js` is a small orchestration
script. `scripts/artist-detail-local-timing-evidence.js` owns the bounded
artifact contract and validation.

The command accepts a MusicBrainz artist identifier, local username, and a
password-file path. It launches a fresh browser context with service workers
blocked, signs in through the same accessible form as a normal user, then
opens the Artist Detail route. It observes only these same-origin request
shapes:

| Category | Meaning | Included output |
| --- | --- | --- |
| `local_metadata` | Local metadata lookup | Status family and timing |
| `operator_projection` | Current authenticated user’s projection | Status family and timing |
| `discography` | Provider fallback begun by the client | Status family and timing |

The artifact derives exactly one outcome:

| Outcome | Request order | Meaning |
| --- | --- | --- |
| `local_projection` | local metadata → operator projection | A populated local projection avoided a provider browse |
| `provider_fallback_after_local_lookup` | local metadata → Discography | Local data was unavailable or could not be used |
| `provider_fallback_after_operator_projection` | local metadata → operator projection → Discography | The projection was unavailable or did not provide a release catalog |

Exact status codes are reduced to `2xx`, `3xx`, `4xx`, or `5xx`; timings are
rounded, bounded browser-relative milliseconds. The script does not read
response bodies and cannot write, import, request, or mutate music data.

## Security and multi-user boundaries

- The base URL must be an HTTP(S) loopback origin with no credentials, path,
  query, or fragment. This prevents a local diagnostic command from becoming
  a general authenticated browser client or SSRF mechanism.
- A password may only be read from `--password-file` or
  `HARMONIARR_ARTIST_DETAIL_TIMING_PASSWORD_FILE`. Plain password CLI and
  environment inputs are deliberately unsupported for this new command.
- The only optional persisted artifact path must remain inside the working
  directory. Its schema rejects unexpected fields, so a URL, ID, payload,
  account, secret, cache key, or response header cannot be written through
  this contract.
- The operator route is still authenticated and per-user. The measurement
  does not replace or aggregate a user projection with shared artist data;
  administrators run it under the account whose experience is being checked.
- The browser context blocks service workers so the timing is a direct view of
  the local application route, not a synthetic cache response. No
  `Timing-Allow-Origin`, public telemetry endpoint, or browser persistence is
  added.

## Use

Run it only after reproducing an Artist Detail load for a local artist. The
password file should contain only the password and should not be committed.

```powershell
npm run measure:artist-detail-local-timing -- -- `
  --artist-mbid 01234567-89ab-cdef-0123-456789abcdef `
  --username local-admin `
  --password-file C:\secrets\harmoniarr-password `
  --evidence-path artifacts\artist-detail-local-timing.json
```

The standard output is the safe JSON artifact. `--evidence-path` is optional;
when supplied it writes the same artifact under the repository workspace.
With npm 12, the first `--` terminates npm options and the second one begins
the script arguments. Keep both separators so that `--artist-mbid` and other
diagnostic options reach the ESM script instead of being parsed as npm
configuration.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Redesign cache or parallelize every call now | May hide a delay in one environment | Risks redundant provider work and erodes the per-user projection boundary | Reject without evidence |
| Add a production timing dashboard | Always available | Adds non-actionable operational disclosure to a home-hosted app | Reject |
| Capture browser devtools data manually | No code change | Not repeatable or schema-bounded; easy to expose URLs, user data, or credentials | Reject |
| Local, authenticated, allowlisted browser measurement | Reproduces actual orchestration with a small safe artifact | Requires a reproducible artist and local account credentials | Adopt |

## Open pull request assessment

The currently open dependency PRs were assessed before this implementation.
None safely applies to this change, so no PR was copied or merged locally:

| PR | Proposed change | Decision |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | Node `24.19.0-alpine` → `26.7.0-alpine` | Defer as a dedicated major-runtime migration; current engines permit only Node 24 |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `docker/build-push-action` 7.1 → 7.2 | Superseded because the workflow already pins 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `docker/metadata-action` 6.0 → 6.1 | Superseded because the workflow already pins 6.2 |

## Final recommendation stack

1. Preserve the local metadata → per-user projection → provider fallback
   sequence; it avoids unnecessary external work when local data is sufficient.
2. Use this local command only for a reproducible report and create a focused
   regression around the dominant measured leg.
3. If Discography is dominant, use the existing cache-phase evidence before
   altering cache policy. If local or operator projection is dominant, profile
   only the responsible query or projection service.
4. Keep user projections, requests, and history scoped to their owner. Do not
   shorten the chain by sharing private operator state across users.

## Follow-up measurement

[Artist Detail Local Deployment Timing Batch Design](ARTIST_DETAIL_LOCAL_DEPLOYMENT_TIMING_BATCH_DESIGN.md)
extends this one-shot command with a bounded three-sample comparison workflow.
Use it for a reproducibly slow local Artist Detail load, then choose one
targeted database, projection, or provider-cache regression from the repeated
outcome and dominant request category—rather than changing orchestration
pre-emptively.

[Artist Detail Local Presentation Timing Design](ARTIST_DETAIL_LOCAL_PRESENTATION_TIMING_DESIGN.md)
then extends the safe artifact to verify the user-observable Discography
loading state after those requests settle. Its schema version 2 supersedes the
original request-only local artifact.

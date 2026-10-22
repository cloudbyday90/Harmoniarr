# Last.fm response containment outcome

Implemented October 21, 2026 on main following the
[design](LASTFM_RESPONSE_DESIGN.md) and [official research](LASTFM_RESPONSE_RESEARCH_2026_10.md).

## Implemented behavior

Last.fm's client now delegates HTTP attempts and body handling to a narrow ESM
request-service factory. It reuses `readBoundedJsonResponse` with the existing
2,000,000-byte decoded ceiling, strict UTF-8, JSON object-root and declared-length
checks. Malformed/oversized successful responses reject as
`lastfm_invalid_response`, with no additional body-error retry or successful
empty result. One per-attempt deadline covers response headers and body.

Provider-originated failures contain an approved diagnostic category and only
attempt count, configured retry count, retryable flag and sanitized HTTP status.
They retain no API-key URL, native cause, body text or arbitrary header data.
Rejected base URLs and numeric configuration errors also stop echoing inputs.

Transport failures and HTTP 429/5xx retain the existing attempt/backoff policy.
Ignored HTTP error bodies are cancelled before retry backoff or terminal
classification, with bounded waiting under the same attempt signal. Cleanup
failure does not replace an observed HTTP status. Non-retryable HTTP results
still become empty lists through the client. Missing API keys remain a no-op;
the client retains its serial queue, normalization, MBID/name inputs and internal
caller-owned Error abort identity. The existing HTTP-200 error-envelope behavior
is retained without adding vendor-error retry policy.

The actual related-artists consumer continues to return healthy other-provider
results after the Last.fm client rejects invalid JSON. Its Promise.allSettled and
name-fallback catch paths do not publish the provider error. Raw URL/cause
retention was demonstrated internally; no external disclosure was reproduced.

## Executed evidence

Final source fingerprint, **3,263 files**:

```text
4e1eed649121965ed0e3a17aec1620354058343d630b373129718ca1d3eb0589
```

Ten changed code/configuration hashes remain stable through final validation.

| Gate | Result |
| --- | --- |
| Focused Last.fm, shared HTTPS/JSON/cancellation, related-artists budget/cache and consumer selection | 138 passed; zero failed/cancelled/skipped |
| `npm run validate:fast` | 10,827 passed: 5,660 server, 4,470 client, 697 scripts |
| Static, lint, copyright, ESM, migration/snapshot policy and both builds | Passed through the final fast gate |
| Native HTTPS files in a bounded, network-none Linux amd64 Node container | 11 passed; zero failed/cancelled/skipped; exact container removal and absence verified |
| Client build | All 155 hashes unchanged |
| Updated testing skill reference | `quick_validate.py` passed |

The selected 138 tests completed in about 4.57 seconds on this host. This is not
a matched whole-suite timing comparison or hosted-runner performance claim.
Native tests join the ordinary server lane without Docker or live accounts;
the separate Linux check qualifies platform behavior. No SQL, session, UI or
schema change required unrelated PostgreSQL/browser matrices.

Unit controls accept exactly 2,000,000 decoded bytes and refuse one extra byte.
Gated ignored-body cancellation prevents backoff/another attempt until its
returned cancellation settles. Invalid JSON/UTF-8/object roots and provider
stream errors reject without exposing private sentinel text. Caller cancellation
closes the active reader and permits later queued work. Retry counts/backoff
bounds and configuration-error privacy are checked independently.

Native Last.fm uses its actual default ws.audioscrobbler.com URL/Host/SNI and
bundled fetch. The public test leaf was extended for that DNS name; the fixture
CA, leaf key, mismatched identity and production origin policies remain unchanged.
Only the child trusts the public test CA. Three new native cases cover:

- Normal gzip/Brotli payloads, existing empty/error-envelope behavior and ignored
  non-retryable HTTP-body cancellation.
- Gzip/Brotli decoded overflow despite a smaller encoded Content-Length,
  chunked overflow, malformed JSON/UTF-8/compression and excessive declared length.
- HTTP 503/429 cancellation then successful retry, two-attempt HTTP-500
  exhaustion and deadlines before headers or during stalled/trickling bodies.

A later successful response is held until earlier server sockets actually close,
while the child remains alive. Exit or fixture teardown cannot supply that proof.
Native retry sleep is deliberately stubbed; actual attempt/ordering/socket evidence
does not qualify wall-clock rate cadence. Existing eight shared HTTPS cases also
pass after the fixture's additional child-entrypoint option and certificate SAN.

## Retained failures and scope

The baseline probe accepted a 2,000,001-byte valid body. A separate old/new
comparison retained URL and cause plus the API-key sentinel on the old client,
and none on the new one. Initial targeted tests failed before implementation.
The temporary fixture-conversion helper first expected six JSON-only mocks but
found five and stopped before writing. The ensuing tests exposed those old mock
contracts. All five were converted to standard Response objects; no production
JSON-only fallback was introduced. Original logs remain under the ignored
`.tmp/lastfm-bounds-2026-10-21` evidence directory.

The [Docker outcome](LOCAL_DOCKER_LASTFM_RESPONSE_OUTCOME.md) owns the preserved
no-cache rebuild, actual packaged-service checks and configured readiness result.
No dependency, runtime pin, database, project-version, release or branch change
was introduced. Live providers, public DNS, IPv6, arm64, every metadata client,
decompressor allocation limits and general standards conformance remain outside
these selected checks.

MCP GitHub queries at selection and completion found zero open PRs, so no PR was
available to select, implement, rebase, close or merge. Publication stays on main.
The existing related-artists test file has mixed CRLF/LF endings. Default Git
whitespace checking flags its newly added CRLF lines; raw inspection found zero
trailing spaces, and CRLF-aware whitespace checking passes. Tested bytes were
preserved without changing repository Git configuration.

## Recommendation and next work

Retain the shared bounded reader, provider-specific modular request services,
default TLS, redirect refusal and approved diagnostics on Node 24.22.1/npm 12.0.2
with pinned Alpine images and PostgreSQL 18. Benefits are bounded accepted data,
earlier connection release and fewer copies of parsing policy. Costs are the
explicit Last.fm size ceiling, maintained transport tests and separate sizing
work for other providers.

Next, qualify **MusicBrainz response budgets by operation** before adopting bounded
parsing and approved diagnostics there. Preserve its larger release/relation
payloads, paging, 404 handling, throttling and Retry-After behavior; do not apply
Last.fm's cap across every metadata method without compatibility evidence.

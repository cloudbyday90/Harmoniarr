# PostgreSQL startup write outcome

Date: 2026-10-16. Implemented the
[design](POSTGRES_STARTUP_WRITE_DESIGN.md), using the
[official research](POSTGRES_STARTUP_WRITE_RESEARCH_2026_10.md).

Implemented focused ESM write-observer and record modules under the existing
owned-client/queue owners. Connection records are version two; outer checkout
v3 and server versions are unchanged. Original Error/null, bytes, receivers,
return values, explicit application names and resource limits are preserved.

The original startup call temporarily owns only its native stream's write method.
Its descriptor is restored synchronously. The observation records approved local
return/backpressure and callback outcomes without parsing startup bytes or
observing later auth/query writes. Unsupported shapes remain unknown. A held
startup control proves local callback completion while authentication remains
unobserved; it does not establish PostgreSQL receipt.

## Final-code validation

- All 44 focused cases pass, including held/error/late callback controls, private
  wire-byte comparison, native socket error-event parity, descriptor restoration
  and rejection of custom/accessor packets, methods and streams. Focused ESLint
  passes with zero warnings.
- Seven selected native files pass all 31 cases, with zero failures,
  cancellations or skips, in 132.402 seconds. Each file completed with actual
  process/stream cleanup and approved evidence before the next was admitted.
  This is a selected collection, not a complete integration gate or speedup claim.
- `npm run validate:fast` passes all 10,475 cases (5,420 server, 4,384 client,
  671 scripts), static policies, lint, test hygiene and both builds in 122.806
  seconds. All three test lanes have zero failures, cancellations or skips.
  The client fixtures still emit 225 Vue warnings; this slice does not claim to
  resolve those existing warnings.

| Selected native file | Passed cases |
| --- | ---: |
| fixture-pool-checkout.test.js | 7 |
| app-checkout-diagnostics.test.js | 3 |
| postgres-startup-server.test.js | 4 |
| postgres-startup-cancellation.test.js | 4 |
| postgres-runtime-startup.test.js | 2 |
| library-media-request-atomic-creation.test.js | 6 |
| library-scan-receipt-invalidation.test.js | 5 |

The frozen source covers 3,017 files, SHA-256
`7f0dcb7fe8faba76be96fb901b30a07f4e2cefbecf8745620dd9de935b150268`.
All seven changed JavaScript files have matching opening/closing byte hashes.
Private logs and reports remain under `.tmp/startup-write-2026-10-16/`; raw packet,
configuration and server identity data are not published.

The pre-final native-v1 collection separately passed the same 31 selected cases
in 150.129 seconds on source
`e7f1a066b402af225af2a2afc76fa6805cb0ebf4397f97ebfbc25b8f5639402d`.
It is retained as pre-final evidence. Subsequent review found a changing-getter
privacy edge case in record construction: a second read could replace an approved
value. The touched builders now capture each scalar once, with a regression
control. A pure test fixture's promise-executor lint issue was also fixed.
The final native-v2 collection validates those final bytes; collections are not
combined or replayed as additional accepted coverage.

## Scope and recommendation

The original [broad failures](WANTED_ROOT_TEST_LANES_OUTCOME.md) and
[queued-checkout investigation](POSTGRES_QUEUED_CHECKOUT_OUTCOME.md) remain
historical failures. New local completion evidence cannot retrospectively prove
their PostgreSQL receipt or authentication state. The underlying production
code, schema, dependencies, timeouts, pool size and scheduling are unchanged.
The remaining 120 canonical integration files were not freshly rerun. Native
PostgreSQL controls use plaintext sockets; TLS capability admission is tested,
but an authenticated PostgreSQL TLS connection was not exercised in this slice.

Opening and closing GitHub MCP discovery found zero open PRs, so random local
PR application and stale-PR cleanup are inapplicable. Work remains directly on
main, with no PR merge, release or tag. Existing testing and standards skills now
carry the verified local/remote distinction, ownership controls and privacy
regression guidance. The previous
[no-cache walkthrough rebuild](LOCAL_DOCKER_QUEUED_CHECKOUT_OUTCOME.md) remains
separate evidence; this testing-only slice does not change image inputs.

The [HTTP phase follow-up](FIXTURE_HTTP_PHASE_OUTCOME.md) now records the next
implementation and its own validation scope. The historical evidence above
remains unchanged.

Next at this slice: bind fixture HTTP phase context at the actual server request boundary,
preserving concurrent/nested ownership and avoiding phase assignment to unrelated
background work. Then use the richer evidence in a fresh full-gate investigation
before scheduling or capacity changes.

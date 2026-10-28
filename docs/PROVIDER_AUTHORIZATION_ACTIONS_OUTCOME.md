# Provider authorization action outcome

October 28, 2026. See the separate [research and tradeoffs](PROVIDER_AUTHORIZATION_ACTIONS_RESEARCH_2026_10.md),
[design](PROVIDER_AUTHORIZATION_ACTIONS_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_PROVIDER_AUTHORIZATION_ACTIONS_OUTCOME.md).

## Implemented behavior

Spotify and YouTube connect/clear now share one scoped pending owner in
[useProviderAuthorizationActions](../src/client/composables/useProviderAuthorizationActions.js).
It admits a command synchronously before awaiting, rejects duplicate and competing
activation without resetting feedback, and publishes only its current result.
The existing useConnections handlers and per-action flags remain available;
settings/form/secret-status ownership stays there. Three production client files
changed; no backend, shared, schema, maintenance or dependency changes were needed.

Loading or saving settings refuses command admission. An occupied command also
refuses settings load/save, including direct submit/handler calls. Clear requires
saved linked eligibility and an explicit linked=false acknowledgement before
updating local status. Malformed replies preserve the prior observation. Start
performs one acknowledged navigation and retains ownership through handoff.
Neither a start response nor a navigation handoff claims a completed provider link.

Failures use fixed could-not-confirm guidance; navigation failure has distinct
could-not-open guidance. Diagnostics are never projected. No automatic retry,
timeout-based replay or client rollback claim is introduced. Scope disposal closes
admission/publication and suppresses late navigation. A scoped pageshow listener
retires only an acknowledged handoff after persisted return; it does not retire
an unsettled POST, run on ordinary pageshow, or send another request. Its exact
listener is removed on disposal.

The four native buttons use guarded aria-disabled, retaining keyboard discovery
and the invoking focus while unavailable. Clear success keeps focus even after
the saved link becomes absent. Later user focus moves win. The feedback paragraph
is present before updates with role=status and aria-atomic=true. Controls have a
44 px minimum height and theme-token styling. Settings save remains truthful about
its own state while command admission is occupied.

## Executed verification

| Check | Result |
| --- | --- |
| Focused owner, Connections, view/presentation and callback tests | 81 passed; zero skipped |
| Complete fast gate, 14 stages | 11,697 passed: server 6,453, client 4,541, scripts 703; zero failed, cancelled or skipped |
| Static checks and build | Node baseline, copyright, migration/schema/anchor, ESM, image/topology, lint, test hygiene and build passed |
| Canonical browser command | 5 tests in 3 suites passed; zero failed, cancelled or skipped |
| Preserved walkthrough browser scenario | 10 groups passed; 7 locally fulfilled command POSTs, all with the current CSRF contract; zero forwarded mutations, blocked unexpected writes or page errors |
| Visual review | Feedback at 1440/800/390 px in both themes; six unobscured captures, no horizontal feedback overflow. Twelve additional pending action-row captures reviewed across both providers; all four buttons met 44 px height and their centers were unobscured |
| Existing server/API/store native evidence | 143 prior groups retained after exact server/shared/package/test identity comparison; not rerun as fresh native tests |

Focused command:

```text
node --test test/client/useProviderAuthorizationActions.test.js test/client/useConnections.test.js test/client/settings-connections-view-contract.test.js test/client/settings-connections-presentation.test.js test/client/useProviderCallbackFeedback.test.js
```

Canonical browser command:

```text
node --test --test-concurrency=1 test/browser/provider-authorization-actions-browser-verification.test.js test/browser/provider-callback-feedback-browser-verification.test.js test/browser/connections-route-access.test.js
```

Held responses exercised duplicate Enter/Space/direct activation, cross-command
contention, settings-submit refusal, dirty-draft retention, failure/explicit
recovery, clear eligibility, user focus moves, malformed clear, late response
after route disposal, acknowledged navigation and actual Back. Existing callback
and route role/admission coverage also passed. Browser overlays exposed fixture
linked states without saving them. Actual settings/secret-status snapshots before
and after matched; request checks recorded booleans rather than CSRF values.

Actual Back returned a document with persisted=false in Chromium
156.0.8078.4. Controlled persisted-event unit coverage establishes owner behavior,
not native BFCache acceptance. Manual screen-reader and physical-device checks
remain deferred as requested. These checks do not establish full WCAG conformance,
live provider/account acceptance, complete application quiescence or a memory minimum.

Final reviewed source: 3,832 files,
SHA-256 `b7a85a84b1f652d88a7a9efb27533459ddec14f19e05efbf922e5125f154bd23`.
Seven changed code files were frozen before the final complete fast gate and
canonical/live browser qualification. Production client code did not change
after image construction; its packaged bundle matches the final local build.

Private evidence is under `.tmp/provider-authorization-actions-2026-10-28/`.
Initial lint failures and the first browser teardown failure were corrected before
the initial complete gate. Visual review then caught a tablet capture obscured by
the sticky save bar. Centering the capture and checking interior hit points fixed
the fixture; the first hit-point attempt sampled rounded corners and was corrected.
The final complete gate and browser checks were repeated for that fixture change.
Earlier failures/partial runs remain retained and are not added to passing totals.
The separate Docker outcome records an initial download failure and fresh retry.

GitHub MCP found no open PRs at the initial and final checks, the latter at
2026-10-28 14:15:52 UTC. Random PR
implementation and stale Dependabot cleanup/rebasing were therefore inapplicable.
Work remains on main, with no PR merge, new branch, release or Git tag.

## Next recommended item (implemented)

Add an owned, read-only saved-link/current-session reconciliation after an
uncertain command result or persisted handoff return. Reuse the existing
[provider-status GET](../src/client/lib/provider-api.js) and
[bounded saved-link projection](../src/client/lib/provider-callback-feedback-policy.js),
with latest-intent/disposal guards. Update only the saved-link observation;
preserve edited settings, focus and current server authorization. Never replay
the POST to discover its outcome.

The current owner correctly preserves older observations on uncertain results
and directs the user to review/reload Connections. Reconciliation would make that
review more useful without a second service. The benefit is fresher recovery
guidance; the cost is another bounded read owner and explicit handling of expired
sessions and failed reads. This is a follow-up source finding, not a reproduced
server publication defect. Keep deferred manual acceptance separate.

Ancillary whole-card captures also exposed tall existing mobile fields and
sticky-save-bar occlusion when framing an entire card. The unchanged shared
form CSS should receive a separate mobile flex-sizing/clearance audit. The
authorization rows were separately centered, hit-tested and captured; this
qualification does not claim complete Connections layout acceptance.

The scoped saved-status follow-up is now implemented. See its separate
[research](PROVIDER_AUTHORIZATION_STATUS_RESEARCH_2026_10.md),
[design](PROVIDER_AUTHORIZATION_STATUS_DESIGN.md) and
[outcome](PROVIDER_AUTHORIZATION_STATUS_OUTCOME.md). The mobile layout finding
remains a separate follow-up.

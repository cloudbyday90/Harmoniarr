# Settings Provider-State And Recovery Consistency

Status: **Implemented**

## Scope

Settings has three supported Soulseek provider modes:

- **Managed**: Harmoniarr's Compose deployment supplies the sidecar and its
  file-mounted credentials.
- **External**: Harmoniarr connects to an independently deployed slskd service,
  including an Unraid or VPN-routed container.
- **Disabled**: Harmoniarr does not contact Soulseek or start downloads.

This slice makes the mode, saved connection result, recovery guidance, and
Settings setup checklist tell the same story. It also removes the incorrect
implementation where clicking `Test saved connection` fetched the full system
overview, which could check unrelated dependencies instead of only the service
the operator asked to test.

## Research Baseline

The requested June 2026 research baseline was checked against current official
sources on 2026-07-31.

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires consistent component
  identification, clear error identification, useful error suggestions, and
  programmatically determinable status messages. The design uses one status
  vocabulary and one action per state, with polite `role="status"` feedback.
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
  recommends generic client responses and server-side detail logging to avoid
  information disclosure. Browser-visible connection states therefore consume
  allow-listed codes and never provider exception messages.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports meaningful HTTP status codes and protected management endpoints.
  The existing admin-only `GET /api/v1/slskd/status` endpoint remains the
  narrow read contract for the Settings connection test.
- [Docker Compose secrets guidance](https://docs.docker.com/compose/how-tos/use-secrets/)
  recommends per-service secret access instead of environment variables for
  sensitive values. Managed configuration remains deployment-owned; external
  API keys remain encrypted and write-only in Harmoniarr.
- [Playwright locator guidance](https://playwright.dev/docs/locators) recommends
  role- and label-based test contracts. Browser verification targets the named
  status region, radio group, and connection-test button rather than layout
  selectors.

## Problem Analysis

The former Settings implementation had three inconsistencies:

1. `Test saved connection` called the system overview endpoint through
   `useDependencyHealth`. That request can assess MusicBrainz, media tooling,
   and other system state even though the operator asked to test Soulseek.
2. The Settings setup checklist and Connections card interpreted mode and
   health independently, allowing labels and recovery wording to drift.
3. Request failures were surfaced from JavaScript error text. Even when most
   upstream messages were safe, this creates an information-disclosure risk
   for URLs, credentials, and implementation diagnostics.

## Options

### Full System Overview As The Test

Pros:

- Already available in the client.
- Can show many dependencies at once.

Cons:

- Does more work than the requested test.
- Couples routine Settings interaction to unrelated provider health.
- Encourages a busy, diagnostic-first Connections page.
- Makes result ownership ambiguous.

### Separate Settings-Only Test Endpoint

Pros:

- Could tailor a purpose-built response.

Cons:

- Duplicates the existing authenticated `slskd/status` route and service
  behavior.
- Adds another security-sensitive endpoint to maintain.

### Existing Scoped Soulseek Status Route

Pros:

- Tests only the saved Soulseek configuration.
- Keeps the admin authorization boundary already enforced by the route.
- Reuses the service's Managed, External, and Disabled behavior.
- Supports one compact, release-independent presentation model.

Cons:

- Does not show other dependency diagnostics on Connections.
- Requires explicit diagnostic navigation when investigating a different
  provider.

## Final Recommendation

Use the existing scoped admin-only status route and the following stack:

1. `fetchSlskdStatus` remains the narrow API client for
   `GET /api/v1/slskd/status`.
2. `useSoulseekConnectionStatus` owns only the saved status, loading flag, and
   bounded error code.
3. `buildSettingsSoulseekProviderState` is the sole client mapping from mode,
   deployment state, status, and code to user-facing copy.
4. `SettingsProviderConnectionStatus` renders that model in Connections.
5. `SettingsSetupView` consumes the same model for its `Connect Soulseek`
   setup step.

The design deliberately leaves cross-provider health in System and advanced
diagnostics. A normal connection workflow should not probe or display unrelated
services.

## State And Action Contract

| State | Visible status | One next action | Test request allowed |
| --- | --- | --- | --- |
| `downloads_off` | Downloads off | Choose a download mode | No |
| `managed_setup_required` | Setup needed | Finish managed setup | No |
| `connection_setup_required` | Setup needed | Review connection details | No |
| `connection_unavailable` | Unavailable | Try connection again | Yes |
| `connection_not_ready` | Not ready | Try connection again | Yes |
| `connection_healthy` | Ready | Test saved connection | Yes |
| `connection_not_checked` | Not checked | Test saved connection | Yes |

The presentation model uses fixed copy for each outcome. Provider response
`message` fields are intentionally ignored by this model.

## Security And Privacy

- The status route continues to require an administrator session.
- Testing is a `GET` read and cannot write provider configuration or start a
  search/download.
- External API keys stay encrypted and write-only. Managed secret files remain
  deployment-owned and are never copied into Settings.
- `slskd_misconfigured` and `slskd_request_failed` route responses now use
  generic messages instead of propagating arbitrary provider exception text.
- Client state stores only error codes, never exception messages.
- Presentation and recovery tests assert private hostnames, secret-like text,
  and URLs do not appear in browser-facing models.

## Accessibility And UX

- The provider state has one named `Soulseek status` section, semantic status
  pill, and a `role="status"` message.
- The connection-test button has a stable accessible name and a visible
  testing state.
- Managed and Disabled modes do not present a non-functional test button;
  they state the next setup action instead.
- The page no longer includes unrelated provider rows in the primary
  Connections flow, reducing diagnostic noise for home users.

## Implementation Outcome

- Added `useSoulseekConnectionStatus` to call only the existing scoped status
  endpoint.
- Added `buildSettingsSoulseekProviderState` and
  `SettingsProviderConnectionStatus` as reusable presentation boundaries.
- Migrated Settings setup and Connections to the shared state/action model.
- Updated Music Queue return confirmation to accept the direct connection
  result, avoiding a broad dependency-health refresh after a Connections save.
- Removed the obsolete `SettingsProviderHealthSummary` component and its
  full-overview dependency contract.
- Added client, server, and browser coverage, including proof that an explicit
  connection test creates one scoped status request and no new full-overview
  request.

## Validation

Focused validation covers:

- mode/action mapping and redaction;
- direct-status composable behavior;
- Setup and Connections presentation contracts;
- generic server error normalization for the status route; and
- browser-visible Managed, External, Disabled, successful-test, and request
  scoping behavior.

Full validation results are recorded with the implementation commit.

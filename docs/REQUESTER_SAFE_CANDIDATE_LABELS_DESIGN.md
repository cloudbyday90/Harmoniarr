# Requester-Safe Candidate Labels Design

> Phase 16 of the request-experience hardening track. This document covers
> requester-safe source labels for media-request pipeline candidates.

## Problem

Phase 12 added the request journey and Phase 14 added Downloading-stage
progress. The request detail page still rendered each linked import candidate
as:

`peer username -> remote folder`

That is useful operator diagnostic context, but it is not requester-facing
language. It can expose Soulseek peer identities, folder names, internal source
selection details, and future operator-only fields that requesters do not need
to understand where their request stands.

The goal is to let requesters see compact progress such as `Source 1`, while
preserving full peer/folder diagnostics in operator Activity and non-requester
views.

## Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified through online search rather
than inferred.

### Do not rely on client-side filtering

OWASP's latest Web Security Testing Guide entry for
[Testing for Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure)
warns that hiding fields in the UI is insufficient because API responses are
directly inspectable. It recommends comparing visible UI data with the full API
response and checking whether low-privilege users receive the same fields as
administrators.

Applied here:

- The media-request pipeline service must shape requester responses on the
  server.
- The requester response must not include raw `username`, `folderPath`,
  `candidateType`, internal run IDs, status messages, or run error text.
- Tests must assert the serialized requester payload does not contain peer,
  folder, filename, path, or internal run identifiers.

### Least privilege and authorization tests

OWASP's
[Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
recommends least privilege, object-level authorization, and unit/integration
tests for access-control behavior.

Applied here:

- Continue authorizing the media-request ID before loading pipeline data.
- Return requester candidate data with the minimum fields needed for the
  request journey and pipeline summary.
- Preserve existing authorization tests and add field-level minimization tests.

### Privacy risk management and disassociated processing

NIST describes the
[Privacy Framework](https://www.nist.gov/privacy-framework) as a tool for
managing privacy risk while protecting individuals' privacy. NIST's
[Disassociability](https://www.nist.gov/node/1630826) guidance focuses on
processing information without association to individuals or devices beyond the
system's operational requirements.

Applied here:

- A requester needs to know that Harmoniarr found or is trying sources; they do
  not need to know which remote peer or folder produced each candidate.
- Generic sequential labels preserve orientation without associating the
  requester's view with remote peer identities.

### Vue rendering safety

Vue's official
[Security guide](https://vuejs.org/guide/best-practices/security) documents
that template text interpolation is escaped by native browser APIs and warns
against rendering untrusted HTML.

Applied here:

- Candidate labels remain plain text interpolation.
- No `v-html`, dynamic templates, or HTML-bearing labels are introduced.

### Clear labels

W3C's WCAG guidance for
[Headings and Labels](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)
requires headings and labels to describe topic or purpose clearly enough for
users to orient themselves.

Applied here:

- Generic labels use `Source 1`, `Source 2`, etc. rather than vague text such
  as `Hidden candidate`.
- The count and status pill remain nearby, so the label still describes a
  concrete candidate source without exposing its internals.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A - Keep raw peer/folder labels** | Full transparency; no compatibility work | Exposes peer identities and remote folders to requesters; conflicts with least privilege and prior progress minimization |
| **B - Hide the entire fulfillment pipeline from requesters** | Strong minimization; low UI complexity | Removes useful status context; weakens the value of the request journey when multiple attempts exist |
| **C - Client-only generic labels** | Fast UI change | API still exposes raw fields; fails OWASP excessive-data-exposure guidance |
| **D - Server-side requester projection with generic labels (chosen)** | Minimizes raw response fields; keeps requester orientation; preserves operator diagnostics; testable at service/integration boundaries | Adds a role-aware projection boundary; requester payload differs from admin payload |

## Final Recommendation Stack

1. **Role-aware server projection**
   - Keep the persistence store unchanged.
   - In `library-media-request-pipeline-service.js`, project candidates through
     a pure role-aware policy after request authorization.

2. **Requester allowlist**
   - For `actorUserRole === "requester"`, return only:
     - `sourceKey`
     - `sourceLabel`
     - `status`
     - `fileCount`
     - `totalSizeBytes`
     - minimal `execution` / `apply` status and timestamps
     - `transferProgress`
   - Omit peer usernames, remote folders, candidate type, candidate IDs,
     operation run IDs, status messages, run errors, and planning snapshots.

3. **Operator diagnostics preserved**
   - Admin and operator responses retain the existing candidate contract.
   - Add `sourceLabel` as a convenience display field without removing raw
     fields from admin/operator contexts.
   - Unknown or future roles fall back to the requester-safe projection.

4. **Plain-text labels**
   - Use `Source N` for requester source labels.
   - Use Vue text interpolation only.
   - Avoid implementation labels such as `candidate-<uuid>` in requester copy.

5. **Requester UI behavior**
   - Request detail renders `candidate.sourceLabel` first.
   - Requesters do not see the `Open in import review` link because the route
     is operator/admin diagnostic space.

## Outcome

Requesters now see generic source labels in the request pipeline while the API
response itself withholds raw peer, folder, and run diagnostic fields. The
request journey remains informative and the operator Activity path retains the
full details needed for review and troubleshooting.

## Security

- Request authorization still occurs before any candidate query.
- Requester field minimization is enforced by the server, not by the Vue layer.
- The requester payload omits object identifiers that are not required by the
  request detail presentation.
- Run error messages and status messages are omitted from requester pipeline
  payloads because they can contain paths, remote peer details, or internal
  workflow text.
- No new routes, mutations, schemas, external calls, or permissions are added.
- Labels are rendered as escaped text interpolation; no HTML rendering path is
  introduced.

## Future Design Areas

1. **Requester-safe import-candidate detail contract.** The owned
   import-candidate API remains request-scoped, but still returns operator-rich
   detail. Decide whether requesters need that endpoint at all or whether it
   should receive a separate minimal projection.
2. **Retry-aware journey messaging.** Distinguish `trying another source` from
   a failed Downloading stage when a replacement source is selected after a
   failed transfer.
3. **Importing-stage freshness and explanation.** Apply the same safe-label and
   observed-age vocabulary to validation, scan, transcode, and quarantine
   progress.

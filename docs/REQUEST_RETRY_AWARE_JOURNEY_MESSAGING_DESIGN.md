# Retry-Aware Journey Messaging

## Scope

This phase improves requester-facing copy in the request journey Downloading
stage. It distinguishes:

- a failed download with no replacement source active;
- a replacement source selected but not transferring yet;
- a replacement source actively transferring after an earlier download did not
  finish.

The change is intentionally limited to the existing request journey read model.
It does not add endpoints, schemas, mutations, logs, or operator controls.

## Official Research Baseline

Research was refreshed against official sources on June 6, 2026.

- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- W3C Understanding Success Criterion 4.1.3, Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- W3C WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- W3C APG range widget guidance:
  https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/
- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Web Security Testing Guide, Testing for Excessive Data Exposure:
  https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure
- NIST Privacy Framework:
  https://www.nist.gov/privacy-framework
- NIST CSRC glossary, Disassociability:
  https://csrc.nist.gov/glossary/term/disassociability

The relevant guidance is:

- WCAG 2.2 recommends current WCAG guidance for accessibility work and requires
  status messages to be programmatically determinable without moving focus.
- WCAG status-message guidance favors brief, contextual text and warns against
  making dynamic applications too chatty.
- APG range guidance says indeterminate or unknown progress values should not
  expose `aria-valuenow`.
- OWASP recommends validating access on every request, avoiding unnecessary
  identifiers, and testing authorization behavior.
- OWASP excessive-data guidance recommends explicit server-side response
  filtering instead of relying on hidden UI fields.
- NIST disassociability supports processing events without associating them to
  individuals or devices beyond operational need.

## Current Risk

Before this phase, the journey could show a failed Downloading stage whenever a
download run failed. That was technically true for the failed candidate, but it
was misleading when Harmoniarr had already selected or started a replacement
source. Requesters could see a failure even though the request was still moving.

The inverse problem also mattered: when there is only a failed candidate and no
replacement source active, the journey should clearly say the download did not
finish instead of vaguely implying that a retry may happen.

## Options

### Option A: Leave Downloading as Failed Whenever Any Execution Fails

Pros:

- Simple and conservative.
- Clearly surfaces that something went wrong.

Cons:

- Misrepresents the current request when a replacement source is selected or
  actively transferring.
- Can make a healthy retry look like a stuck failure.
- Does not match the journey's request-level intent.

### Option B: Add Durable Retry Events

Pros:

- Best long-term audit trail.
- Can explain retry history across source selection, execution, and operator
  intervention.

Cons:

- Requires schema, event taxonomy, persistence, and migration work.
- Larger blast radius than needed for this messaging phase.
- Still needs a request-level presentation policy.

### Option C: Derive Retry-Aware Copy From Existing Safe Candidate State

Pros:

- Uses the read models the request detail page already loads.
- Requires no new backend exposure or persistence.
- Keeps copy generic and requester-safe.
- Stays testable in the existing pure journey library.

Cons:

- It is a projection, not a durable retry audit trail.
- It cannot distinguish every operational reason for replacement until a future
  event model exists.

## Final Recommendation Stack

Use Option C.

1. Keep retry-aware messaging inside `src/client/lib/request-journey.js`, the
   pure derivation boundary that already owns request stage semantics.
2. Treat Downloading as `active` when a failed candidate exists and a separate
   non-failed candidate is selected for transfer.
3. Use this requester copy for selected replacements:
   `Trying another source. Waiting for transfer to start.`
4. Treat Downloading as `active` when a failed candidate exists and a separate
   non-failed candidate is actively transferring.
5. Use this requester copy for active replacements:
   `Trying another source after an earlier download did not finish.`
6. Keep Downloading as `failed` only when failed candidates exist and no
   replacement source is selected or active.
7. Continue selecting progress only from non-failed active candidates.
8. Do not expose candidate IDs, peer names, file names, paths, run IDs, or run
   error messages in retry text.

## Outcome

The request journey now:

- keeps failed-only downloads on the failed Downloading stage;
- keeps queued replacement downloads on an active Downloading stage;
- keeps active replacement downloads on an active Downloading stage with the
  replacement progress model;
- ignores failed candidates when selecting the progress-driving candidate;
- keeps stage announcements brief and stable through the existing polite
  `role="status"` timeline live region;
- keeps the APG progressbar behavior unchanged.

## Security Notes

- No new server data is exposed.
- The retry copy is derived only from already-authorized request detail and
  requester-safe pipeline candidates.
- The copy intentionally avoids object identifiers, peer identity, folder paths,
  file names, source-user trust, and operator run messages.
- The implementation remains client-side, read-only, and deterministic.

## Next High-Value Design Areas

1. **Importing-stage freshness and explanation.** Extend safe sub-stage
   language to validation, scan, transcode, apply, post-apply scan, and
   quarantine states.
2. **Requester-scoped transfer actions.** Design cancel, retry, and requeue
   mutations with request-level authorization, idempotency, rate limits, audit
   events, and eligibility rules.
3. **Requester-safe failure and blocker reasons.** Define a bounded vocabulary
   for failed search, failed download, import blocked, operator review needed,
   and unavailable source states without exposing diagnostics.

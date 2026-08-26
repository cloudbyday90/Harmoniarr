# Missing Music canonical links and legacy redirects

**Status:** approved for implementation

**Created:** 2026-08-26

## Purpose

This document defines the next Missing Music workflow slice: make **Missing
Music** the canonical destination for release decisions while preserving saved
Music Queue and interim Acquisition URLs. It implements the navigation model
already adopted in [Missing Music decision workflow design](MISSING_MUSIC_DECISION_WORKFLOW_DESIGN.md), without removing legacy API or view modules in
the same change.

## Problem

The application already exposes the same release decision through Missing
Music, but active links in Artist Detail, Activity, import diagnostics, and
Downloader still direct people to **Music Queue**. This splits one user goal
between two names and two URL families. It also lets stale saved paths reach a
now-secondary workspace instead of the current decision surface.

The existing server-side Missing Music service already resolves a
`decisionId` under the authenticated actor's allowed scope. Today that ID is
the durable wanted-release ID. The browser must not infer a target user, turn a
query parameter into authorization, or pass transfer/provider identifiers.

## Decision

Use **Missing Music** for all new public release-decision links. Keep
**Downloader** as the administrator-only transfer operation surface.

| Legacy or interim URL | Canonical destination | State retained |
| --- | --- | --- |
| `/app/music-queue` | `/app/missing` | Query and fragment |
| `/app/music-queue/:wantedReleaseId` | `/app/missing/:decisionId` | Query and fragment |
| `/app/acquisition` | `/app/missing` | Query and fragment |
| `/app/acquisition/music-queue` | `/app/missing` | Query and fragment |
| `/app/acquisition/music-queue/:wantedReleaseId` | `/app/missing/:decisionId` | Query and fragment |
| `/app/acquisition/downloader` | `/app/downloader` | Query and fragment |
| `/app/activity/queue` | `/app/missing` | Query and fragment |

The named route `missing-decision` receives the release ID only as an opaque
`decisionId`. Its route component calls the scoped Missing Music API; the
server determines the caller and target-user scope on every request. A caller
who does not own or administer the decision receives the existing safe
not-found result rather than another user's release data.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Keep Music Queue as a parallel live destination | Lowest immediate change | Continues duplicate terminology and makes the decision path ambiguous | Rejected |
| Remove legacy URLs outright | Simplest route table | Breaks saved links, notification targets, and recovery return paths | Rejected |
| Redirect legacy routes through a pure client helper | Keeps compatibility, makes one canonical URL family, isolates URL behavior for tests | Requires temporary legacy route records and helpers | **Adopted** |
| Put target-user identity in redirect URLs | Seems explicit for administrators | Creates a confused-deputy risk and leaks household context into shareable URLs | Rejected |

## Module boundaries

| Responsibility | Module or boundary | Rationale |
| --- | --- | --- |
| Legacy URL normalization and location construction | `src/client/lib/missing-music-legacy-route-redirect.js` | Pure ESM helper; preserves only ordinary navigation state and has focused tests. |
| Router compatibility records | `src/client/router.js` | Thin adapter that delegates redirect construction. |
| New release-decision destinations | Active Artist Detail, Activity, import, Settings recovery, and Downloader link callers | One public route name and one visible label. |
| Scope and target-user authorization | Existing Missing Music server routes/services | Server-owned; not duplicated in the router or UI. |
| Legacy Music Queue modules/APIs | Existing files, unchanged unless an active caller is migrated | Prevents a high-risk, unrelated deletion during this compatibility slice. |

## Accessibility and security rationale

### W3C model

W3C recommends descriptive headings and labels that identify a control's
purpose, short visible labels for interactive elements, and native semantics
where available. Therefore visible links change from vague or stale **Open
Music Queue** wording to **Open in Missing Music** or a release-specific
equivalent. These are ordinary router links because they navigate; state
changes remain native buttons in Missing Music.

The redirect itself is intentionally silent: it neither steals focus nor adds a
live-region announcement. The destination page's named heading remains the
orientation point. Query strings and fragment identifiers are retained so a
saved filter or page anchor is not discarded by the compatibility layer.

### Authorization model

The redirect helper only maps a legacy release ID to the existing opaque
decision route parameter. It does not read a user ID, role, provider username,
transfer ID, path, token, or raw provider payload. The router may make a
destination easier to find; it does not grant access. Missing Music reads and
mutations continue to resolve and authorize the decision at the server for
every request.

This follows OWASP guidance to enforce least privilege, deny by default, and
validate authorization for each request. It also preserves the existing
administrator-only Downloader route rather than revealing transfer operations
to non-administrators.

## Recommendation stack

1. **Canonical release decisions:** Use `/app/missing` and
   `/app/missing/:decisionId` for all new links and accessible labels.
2. **Safe compatibility:** Retain old Music Queue and Acquisition paths as
   query/hash-preserving redirects only.
3. **Server-authorized scope:** Keep target-user resolution in Missing Music
   service calls; never encode authority in a route or query string.
4. **Bounded retirement:** Leave legacy modules in place until the remaining
   cross-user and keyboard browser coverage is complete, then remove them in a
   dedicated cleanup change.

## Sources checked 2026-08-26

- [W3C WAI — Writing for Web Accessibility](https://www.w3.org/WAI/tips/writing/)
- [W3C WCAG 2.2 — Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- [W3C ARIA APG — Providing Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [W3C WAI-ARIA overview](https://www.w3.org/WAI/standards-guidelines/aria/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## Validation plan

1. Unit-test location construction, malformed release handling, and exact
   query/fragment preservation.
2. Verify all active link builders use `missing` or `missing-decision` rather
   than a Music Queue route name.
3. Browser-test a saved legacy release URL through the canonical destination
   and ensure its scoped Missing Music read is used.
4. Run client lint, focused tests, the client suite, client build, repository
   validation, and the documented walkthrough Compose rebuild.

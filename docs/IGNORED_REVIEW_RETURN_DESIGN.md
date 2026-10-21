# Ignored-source review return design

Date: 2026-10-20. Follows the [correction outcome](MISSING_SEARCH_CORRECTIONS_OUTCOME.md).
See the separate [research](IGNORED_REVIEW_RETURN_RESEARCH_2026_10.md).

The canonical correction link reaches administrator-owned source policy, but that
page currently loses the originating release. Add a deliberate return link to
the same Missing Music decision. It must not imply that review changed policy,
that removing an ignore is safe, or that another search has been requested.

A focused ESM navigation module builds the fixed `activity-ignored` destination
with the existing `returnTo=missing_music_decision` and bounded `returnReleaseId`
context. Reuse the existing context parser/ID validator without accepting its
other contexts or legacy aliases at this new boundary. Return parsing requires
the exact context and an administrator role. Duplicate/array values, external
paths/URLs, unsupported contexts and missing/oversized IDs produce no return link.
Unknown query fields cannot become route parameters, URLs or permission claims.

A small Activity component owns the context/session projection and semantic
return card. The large existing view only supplies whether an ignore/remove/
auto-ignore save is pending. While pending, withhold the return anchor and show
polite saving feedback; do not navigate before the owning save/read completes.
Do not save form drafts, remove ignores or retry work during navigation.

The return route mounts the existing Missing Music inspector, whose immediate
detail read, cancellation and scope handling already obtain current facts.
No refresh marker, duplicate fetch, polling loop, cache or new backend route is
needed. Existing server authorization still owns the referenced decision; the
bounded context is navigation data, not proof of ownership or current eligibility.
Missing or revoked targets use the existing unavailable/read-only states.

Validate the pure boundary cheaply, then exercise the actual canonical detail,
ignore review, explicit mutation and return read in a PostgreSQL-backed browser
scenario. Prove pending return suppression, reload/query handling, keyboard focus,
mobile target size, new detail reads and no implicit search commands. Separate
controlled state advancement from any claim that removing an ignore updates the
historical search counters. Retain the fast gate and local no-cache readiness
check; do not repeat unrelated native media/scaling matrices.

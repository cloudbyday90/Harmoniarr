# Source-policy route admission design

Date: 2026-10-21. Continues the [ignored-source admission outcome](IGNORED_ROUTE_ACCESS_OUTCOME.md).
See the separate [research and recommendation stack](SOURCE_ROUTE_ACCESS_RESEARCH_2026_10.md).

Source users and Source blocklist currently mount for operators, although their
read APIs require an administrator. Extend the existing narrow ESM Activity
access policy to `activity-users` and `activity-blocklist`, alongside
`activity-ignored`. Reuse the router guard and diagnostic-link projection rather
than adding checks to each page or duplicating the session store.

The existing initial session read owns cold entry. Cached-session entry to any
of these three destinations waits for a current session read. Retain the existing
bootstrap, password-change and login precedence. Non-admin roles return to Home
without carrying query parameters; a failed cached verification cancels entry
with bounded feedback and leaves the invoking link usable for retry. Other
routes retain their existing policies and session-read behavior.

The same reviewed policy filters all three diagnostic links for non-admin and
unknown roles. Preserve native RouterLinks, descriptive names, remaining group
order and sequential keyboard focus. Source users' Manage blocklist and detail
panel's Open blocklist links enter the same guarded destination. Opening review
does not change trust, block a peer or start a search.

The server remains authoritative: source-user list/detail/export and blocklist
reads require `requireAdminSession`; trust and blocklist mutations require
`requireFreshAdminSession`, CSRF and the existing mutation limiter. Their routes,
stores, schemas and permission contracts remain unchanged. Admission checks own
new navigation; they do not continuously remove an already mounted view after
role revocation. Subsequent API requests independently enforce current access.

Validate pure role/projection decisions cheaply. Extend the existing owned
PostgreSQL/browser suite across all three destinations, retaining actual session
reads behind controlled response gates. Check pending admission, role refusal,
password-change precedence, revocation, failed verification/retry, and independent
401/403 responses across reads, exports and mutations. Retain the canonical
ignored-source return and lazy Settings navigation controls. Then run the stable
fast gate once and rebuild preserved local Docker without cache.

Random PR work is independent: apply PR #53's exact full-scan OSV workflow SHA
update locally after reviewing its pinned source, permissions and default inputs.
Leave its PR-comparison sibling unchanged because that is outside the selected
patch. Validate workflow syntax and the new scanner/reporting boundary locally;
GitHub-hosted SARIF upload and runner execution remain separate CI evidence.
No merge, branch, release, tag or version bump is part of this round.

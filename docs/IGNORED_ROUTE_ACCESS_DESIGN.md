# Ignored-source route admission design

Date: 2026-10-20. Follows the [return outcome](IGNORED_REVIEW_RETURN_OUTCOME.md).
See the separate [research](IGNORED_ROUTE_ACCESS_RESEARCH_2026_10.md).

The ignored-source read/write APIs already require an administrator. Operators
can nevertheless enter the client page shell and receive refused data requests.
Correct navigation without changing server permissions or broadening this work
into a complete Activity/Settings role migration.

A focused ESM policy identifies `activity-ignored` as the reviewed administrator
route. Share that role decision between the global router guard and the Activity
diagnostic navigation projection. Filter the ignored-source link for other or
unknown roles, preserving the order and availability of unrelated destinations.
Keep the immutable route inventory separate from its role-aware presentation.

When the session has not loaded, retain the existing initial session read. When
it is already cached, refresh the current session before entering this route.
Hold admission until that read settles: cached admin status and a query parameter
are not current authority. A failed cached-session check cancels navigation and
uses the existing bounded error toast. Existing bootstrap/password-change/login
checks retain precedence after the read; non-admin roles return to Home without
carrying the untrusted query. Ordinary routes do not gain extra session requests.

The destination APIs independently recheck sessions/admin/freshness/CSRF as
before. This improves navigation and avoids mounting a refused page; it is not
a replacement authorization boundary. Changing role while already mounted is
still enforced by API checks; this policy owns new navigation admission.

Prove current admin entry, operator/requester/anonymous direct links, navigation
filtering and preservation, held session verification, cached-role revocation,
failed verification feedback and zero ignored-page API reads on refused entry.
Retain the native return journey and provider/Settings navigation controls.
Use pure policy tests, real app-shell PostgreSQL/browser checks, then the stable
fast gate and preserved no-cache Docker/readiness workflow. No new API, schema,
dependency, queue, version or release is needed.

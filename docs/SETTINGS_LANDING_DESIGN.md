# Role-aware Settings landing design

Date: 2026-10-21. Continues the [Connections outcome](CONNECTIONS_ROUTE_ACCESS_OUTCOME.md).
See [research and tradeoffs](SETTINGS_LANDING_RESEARCH_2026_10.md) for source status.

The Settings root mounts Setup, whose setup-progress and Soulseek-status
composables read `/api/v1/settings` and `/api/v1/slskd/status`. Both require
administrator authority. Operators currently enter a refused Setup page;
requesters are sent Home despite ordinary Account being available.

Extend the existing focused Settings policy to own Setup as well as Connections.
The existing common guard must verify the current session before either page can
mount. Keep bootstrap, login and mandatory password-change precedence. After
those checks, the area policy redirects a non-admin Settings root to the named
`settings-account` destination with replacement history. Discard Setup query/hash
context at this role redirect: it cannot grant authority or specify a different
Account destination. Preserve the original target on the existing login and
password-change flows and preserve both ordinary Account aliases.

Keep global Settings links stable at `/app/settings`; the role-aware landing
guard owns the final destination, including stale cached roles. Navigation uses
the same area decision to remove Setup and Connections for non-admin/unknown
roles while retaining the relative order of surviving links. Account remains
under the existing More settings disclosure, which opens on the Account route.
Keep native links, keyboard cues and focus recovery after verification failure.
If role filtering removes the focused tab, reuse the existing interaction-focus
tracker and move focus to the surviving disclosure button after rendering. Leave
focus alone if the user moved to another control while verification was pending.
This is admission behavior; already mounted views still rely on API enforcement.

Do not classify all remaining Settings tabs in this change. They need separate
reader/write and actor contract reviews. No backend, schema, dependency, release
or version change is required. All first-party modules remain ESM.

Validate cheap role/redirect/projection contracts first, then one selected native
browser cohort covering Setup, existing Connections/Activity admission, lazy
Settings navigation and the canonical provider recovery handoff. Prove actual
held session ordering, successful admin reads, zero protected reads for refused
entry, non-admin direct/global landing, Account aliases, back/forward, bootstrap,
login, mandatory password change, cached revocation and bounded retry. Finish
with the stable fast gate and preserved no-cache Docker walkthrough. Actual
results belong in a separate outcome document.

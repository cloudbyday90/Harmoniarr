# Settings page authority design

Date: 2026-10-21. Continues the [landing outcome](SETTINGS_LANDING_OUTCOME.md).
See [official research and tradeoffs](SETTINGS_AUTHORITY_RESEARCH_2026_10.md).

## Route/API matrix

| Settings route | Reader/command owners | Admission decision |
| --- | --- | --- |
| `settings` (Setup) | Settings GET and saved Soulseek status; both admin | Existing current-admin admission; non-admin root goes to Account |
| `settings-connections` | Settings/status and provider configuration; admin reads, fresh-admin configuration writes | Existing current-admin admission |
| `settings-media-storage` | Settings GET, artwork quota/history, explicit filesystem browse; all admin. Settings PUT is fresh-admin/CSRF | Add current-admin admission |
| `settings-library` | Settings GET and PUT | Add current-admin admission |
| `settings-general` | Settings GET and PUT | Add current-admin admission |
| `settings-users` | User list and Plex linked-account overview; admin. User/configuration actions retain their own admin checks | Add current-admin admission |
| `settings-user-detail` | User detail and audit/activity; admin. Session/user commands retain their existing guards | Add current-admin admission |
| `settings-recovery` | Backup and maintenance-lock readers; admin. Preview/export/diagnostics also admin; mutations use existing fresh-admin/CSRF guards | Add current-admin admission |
| `settings-library-browser` | Authenticated metadata browsing plus separately admin-only refresh/import/cache actions | Preserve admin/operator browsing and existing requester refusal; align visible tab with that rule |
| `settings-notifications` | Fresh authenticated user's own preferences; public VAPID key and authenticated push subscription contract | Preserve personal access |
| `settings-account`, `account-security` | Own sessions, sign-in/security and preferences | Preserve both aliases and mandatory password-change access |

Trace actual handlers in `routes/system-routes.js`, `routes/artwork-routes.js`,
`routes/app-user-routes.js`, `routes/push-routes.js` and metadata routes; inventory
labels alone do not prove enforcement. Metadata's requester exclusion is an
existing product route rule, not a claim that its authenticated read APIs require
admin. The admin-only cache panel is already conditionally rendered. Its other
privileged controls require a separate command-level review.

## Implementation

Extend the existing small ESM Settings policy with an explicit private set of
eight admin route names. Reuse the common current-session mechanism and native
navigation projection. Remove duplicate Settings names from the old requester
restriction set once the area policy owns them. Do not add another guard or
broaden API permissions. Root Account redirection, authentication precedence,
bounded verification failure, focus ownership and ordinary Account aliases remain.

Non-admin primary navigation retains Notifications. Secondary navigation retains
Account, plus Metadata browser for operators. Admin order stays intact. Filtering
preserves relative native link order and the existing owned focus fallback. Use
role-aware workspace copy so personal destinations do not instruct people to
configure deployment folders.

The old requester route set also blocked Notifications despite its own-user API.
Removing that duplicate restriction repairs requester entry; native preference
save/readback and unchanged peer preferences must prove the ownership boundary.

Media recovery query data remains navigation context. A current admin can still
open/save folder repair and return to the existing canonical review. A link or
query cannot grant permission or initiate a recovery command by itself. Keep all
server freshness, CSRF, resource ownership and mutation behavior intact.

Validate cheap role/navigation/composed guards, then real PostgreSQL/browser
session ordering for each newly protected page, direct/legacy aliases, API denials,
personal preference isolation, notifications, operator metadata browsing, cached
revocation/focus/retry and the existing folder recovery handoff. Combine affected
browser cases once after review, then run the stable fast gate and preserved
no-cache Docker walkthrough. No release, schema or dependency change is needed.

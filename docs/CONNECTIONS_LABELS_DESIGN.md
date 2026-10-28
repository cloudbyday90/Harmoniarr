# Connections label design

October 28, 2026. See [research and alternatives](CONNECTIONS_LABELS_RESEARCH_2026_10.md).

## Ownership

SettingsConnectionsView owns ten new matching for/id pairs: Soulseek timeout,
playlist mode and timeout, Spotify Client ID and secret, YouTube API key and OAuth
ID/secret, and Fanart.tv project/personal keys. Preserve six existing explicit
Soulseek/Apple field associations and the collection-check component's association.
Checkboxes and radios retain wrapping labels and the provider-mode legend.

Use static route-prefixed IDs, consistent with the current single mounted route.
Do not introduce an ID registry, singleton, dependency, generic input component or
focus handler. A future repeatable field extraction should own useId at setup.
No new name attribute changes native form submission behavior; the existing JSON
save owner retains serialization. All JavaScript fixtures remain ESM.

## Acceptance

Inventory the built form after both disclosures open and External mode is visible.
Check all 17 text/password/number/select/textarea fields, native labels on every checkbox
and radio, no duplicate document IDs, and exact visible accessible names. Click
each enabled field's label and require native focus on that control. Exercise
desktop, tablet and mobile in both themes, then collapse/reopen disclosures.

Browser-local saved-secret status enables testing blank secret inputs and each
remove checkbox's disabled behavior without sending credentials or commands.
Keep synthetic drafts through label activation and disclosure changes. Guard all
API mutations, retain zero unexpected writes and page errors, and compare actual
settings before/after walkthrough validation. Existing save/layout/authorization
browser regressions cover shared behavior; unchanged native server proof can be
retained only after exact source and packaged-runtime comparison.

No database migration, schema refresh or maintenance change is required. The
previous approximately one-pixel mobile textarea/navigation edge finding remains
open. Manual screen-reader and physical-device checks remain deferred by the user.

# Apple saved-status UI design

October 28, 2026. Follows the next [backend status item](APPLE_STATUS_OUTCOME.md).
See [official research and alternatives](APPLE_STATUS_UI_RESEARCH_2026_10.md) and
the separate [outcome](APPLE_STATUS_UI_OUTCOME.md).

## Ownership and presentation

Add a narrow SettingsAppleSigningStatus component inside the existing Apple card.
Keep the secret presence/source pill. Show local saved checks independently of
the form's unsaved values and the existing explicit Collection access check.
Use fixed labels for saved Team ID, key ID and private-key checks. Never display
response messages, credential values, IDs, parser detail or JWTs.

Validate the returned localSigning enums and summary/check consistency before
adoption; malformed/unsupported data is unavailable, not success. A small
presentation module owns labels/tones and saved-versus-draft comparison. Compare
loaded/saved ID primitives and draft key/clear intent only; do not retain a saved
private key or send a draft to status GET. Enabled/storefront edits do not change
the meaning of local signing checks.

Capture saved ID primitives after the initial settings load and successful saves.
If Apple credentials differ, state that unsaved changes are not included. Saved
invalid checks describe saved data rather than setting aria-invalid on current
draft fields. Associate Apple form labels with stable input IDs.

## Request and save lifetime

Use a per-component composable over the existing provider-status GET. Forward an
AbortSignal and keep one current request with a 15-second browser deadline.
Reject duplicate activation, superseded responses and post-disposal publication,
even if an injected transport ignores abort. Store only copied fixed enums.

On mount read once. When a Settings save starts, invalidate/cancel the old read
and clear its result. After the attempt settles, read saved state again, including
failed/uncertain saves. This small extra GET after unrelated saves avoids a
second save classifier or trusting an old status after returned settings change.
The existing save error and unsaved drafts keep their owners. No auto retry/polling.

Use a persistent role=status paragraph with polite atomic announcements outside
any busy ancestor. Keep the native refresh button mounted, with aria-disabled
plus guarded activation during reads/saves, preserving keyboard focus. No automatic
focus movement. Static failure copy offers retry without reflecting raw errors.
Existing design tokens/primitives remain; support both themes and all breakpoints.

## Qualification and limits

Test enum refusal/labels/drafts and request success/failure/deadline/invalidation/
disposal independently. Verify the actual built Settings view in Chromium with
controlled status/save responses: held loading/retry, invalid/incomplete/valid,
failed read/save, draft IDs/key/clear, post-save refresh, unmount and focus/layout.
Keep controlled browser effects distinct from real encrypted persistence. Verify
actual status GET against the packaged server and retain unchanged server-native
evidence only after exact source/runtime comparison. See the
[Docker design](LOCAL_DOCKER_APPLE_STATUS_UI_DESIGN.md).

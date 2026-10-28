# Storage folder browser design

October 28, 2026. See [research and alternatives](FOLDER_BROWSER_RESEARCH_2026_10.md)
and [outcome](FOLDER_BROWSER_OUTCOME.md).

The four Storage Browse invokers retain their visible label and gain distinct
destination names. FolderBrowserModal owns the native dialog lifecycle and a
setup-time heading ID. Close receives autofocus. Escape uses the browser's
normal cancellation behavior; native close, Cancel, Close, backdrop and Select
converge on idempotent retirement. Native close runs before emitting events that
unmount the dialog, returning focus while its invoker is connected. Parent
unmount also closes and disposes without issuing another selection.

The new useFolderBrowser composable owns requested and confirmed paths separately.
Starting a read clears confirmation, parent and entries, aborts its predecessor
and captures a unique request controller. Only the current live controller can
publish success, failure or loading completion. Valid directory responses contain
an explicit successful flag, nonempty path, valid parent and unique valid entry
paths. Errors expose fixed feedback with Retry. Closing or scope disposal aborts,
revokes selection and fences later outcomes. No retry timer, global cache or
strong retained request registry is added. Abort is cleanup, not proof of response
retirement; identity checks remain authoritative for client publication.

The system API helper forwards the optional AbortSignal through the existing
shared client. Its cookies, authentication handling and API behavior remain.
The server still enforces the existing administrator session and filesystem
policy. Client confirmation guards accidental draft selection, not permissions.

Folder rows are buttons inside a native list. Activating an entry, Up or Retry
moves focus synchronously to the persistent path display only when that control
owns focus. Completion never moves focus again. Loading/failure/success use a
persistent atomic status node outside the busy list area. The old double-click
handler and unsupported listbox/option contract are removed. Scoped CSS uses
existing tokens, a scrollable body and wrapped footer within the dynamic viewport.

Selecting a confirmed path updates only the captured Storage draft field.
Other drafts survive dismissal and navigation. Nothing saves automatically.
The fixture substitutes synthetic filesystem reads, guards every mutation and
compares actual packaged settings before/after. Unit tests cover stale results
that ignore abort, malformed data, explicit root confirmation, retry and disposal.
Browser checks cover all four invokers, native return, keyboard navigation,
loading/refusal and re-opening, viewport/themes and actual 400% tab zoom. These
checks do not establish screen-reader speech or physical-device acceptance;
those remain deferred at the user's request.

# Metadata history feedback and focus design

Date: 2026-10-21. Continues the [history ownership outcome](METADATA_DETECTION_HISTORY_OUTCOME.md).
See [official research and tradeoffs](METADATA_HISTORY_FEEDBACK_RESEARCH_2026_10.md).

The native browser reproduction fails after a final page removes Load more
history: keyboard focus does not reach a surviving history target. The component
also lacks a persistent status container for loading/completion/error feedback.
Keep the existing workspace/page generations authoritative for all new feedback.

The history composable owns a status-message ref and returns a small completion
result with its current-generation predicate. Loading, appended-count/end-of-list
feedback and failures are current-page decisions. Reset clears feedback; obsolete
or ignored work returns no result. Expected current aborts stay silent but may
return a cancelled result for owned focus recovery.

The artist workflow forwards the status ref without adding UI behavior. The
summary component renders one pre-existing, polite, atomic `role=status` container
with a name. It displays bounded error feedback or the current progress/completion
message. Keep it outside the busy history list so loading feedback is not deferred
by `aria-busy`. Do not place focus in the live region just to trigger an announcement.

Use a small ESM focus composable in the view. Capture the initiating control and
reuse the existing user-interaction tracker. Await the page and Vue's DOM flush,
then recheck result currency and focus ownership. A surviving button receives
focus after failure, cancellation or a non-final page. A final page moves owned
focus to the component's Recent discoveries heading, exposed through its ref.
Give that heading `tabindex=-1` and a visible focus indicator without adding a
sequential tab stop. If the user has moved elsewhere, or selection has changed,
do nothing. Dispose the tracker on every exit, including a thrown command.
Allow the heading to scroll into view after a long history; use `preventScroll`
only when restoring the existing invoker. A focused off-screen heading is not
a sufficient completion destination.

Keep HTTP/session, page bounds, read cancellation and command/CSRF behavior
unchanged. This is presentation ownership; no authorization, backend, schema,
dependency, global focus manager or polling mechanism is added.

Prove loaded/empty/error/reset messages and completion currency in focused tests,
then use native browser pages, controlled service failure/holds, keyboard focus,
a user's move elsewhere and the affected history/command/cache consumers. Check
that the same status node exists before the message changes. Inspect light/dark
captures at narrow/wide widths. DOM/ARIA and focus checks do not establish actual
screen-reader announcements or complete WCAG conformance; record that limit.
Run one stable fast gate and rebuild preserved local Docker without cache.

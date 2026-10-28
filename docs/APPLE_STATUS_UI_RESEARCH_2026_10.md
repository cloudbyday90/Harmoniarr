# Apple saved-status UI research

Consulted October 28, 2026 through Search/GitHub MCP. URLs were discovered through
search and opened directly. Local versions are Node 24.22.1, Vue 3.5.44 and
Playwright 1.64.1; packaged versions are compared during qualification.

| Primary source/status | Applicable guidance | Decision |
| --- | --- | --- |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/?cq_net=g), W3C Recommendation, criteria 4.1.3, 3.3.1 and 3.3.2 | Make status changes programmatically available; describe detected errors in text and label inputs. | Keep a persistent polite status paragraph, describe saved field checks in text, and associate Apple labels with their controls. A saved invalid value does not mark a different unsaved draft invalid. |
| [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) and [Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification), informative WAI guidance | Explain asynchronous outcomes without moving focus; identify affected information. | Show loading, saved result and bounded failure in the existing Apple card. A stable native refresh button retains focus and guards duplicate activation. |
| [Vue Watchers](https://vuejs.org/guide/essentials/watchers.html), framework documentation | Invalidate asynchronous effects so stale responses cannot replace current state. Cleanup must respect watcher/scope lifetime. | Use an AbortController, request identity and scope disposal; clear stale results before saves and reload afterward. No polling. |

## Alternatives and recommendation

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Show secret presence only | Cheap and compatible | Does not explain invalid legacy credentials | Retain presence/source and add local status |
| Validate current drafts with saved status | Appears immediate | Can falsely endorse unsaved IDs/key changes | Keep saved status and draft notice separate |
| Fetch after selected key/ID saves only | Fewer reads | More orchestration; uncertain/unrelated save responses can contain changed saved state | One bounded refresh after each settled Settings save |
| Poll status continuously | Notices outside changes | Repeated database/parsing work and noisy updates | Initial load, post-save refresh and explicit retry |
| Echo response errors/check values | Rich diagnostics | Can disclose untrusted text or credentials | Validate fixed enums and use static UI copy |

Recommended stack: a small presentation module, per-component request composable
and Apple status component inside the existing Settings card. Reuse the provider
status GET, adding signal forwarding. A 15-second browser deadline, generation
ownership and cancellation prevent stale publication; client cancellation does
not prove server database work has drained. Save ownership/encryption stay on the
existing server. No new endpoint, dependency, persistent cache or deployed app.

Local validity is not provider connection acceptance. Use the existing explicit
Collection access check for remote access. Automated browser checks can establish
DOM/focus/layout behavior, not spoken announcements or full WCAG conformance.
Manual screen-reader and physical-device checks remain deferred. See
[design](APPLE_STATUS_UI_DESIGN.md) and [outcome](APPLE_STATUS_UI_OUTCOME.md).

# Metadata browser command authority design

Date: 2026-10-21. Continues the [Settings authority outcome](SETTINGS_AUTHORITY_OUTCOME.md).
See [official research and tradeoffs](METADATA_COMMAND_AUTHORITY_RESEARCH_2026_10.md).

| Action | Actual server contract | Browser/workflow decision |
| --- | --- | --- |
| Browse/search metadata and open saved artist/group/release | Authenticated reads | Preserve operator access and existing read handlers |
| Import artist | `registerSessionImportRoute`: fresh authenticated session and CSRF | Preserve authenticated artist import; do not apply the admin predicate |
| Refresh artist metadata | Fresh admin and CSRF before queuing | Show only for admin; check the current client predicate at dispatch; retain native server refusal |
| Import/re-import release group | `registerImportRoute`: fresh admin and CSRF | Show import only for admin; preserve the imported-row Open release group action for operators |
| Import/re-import release | Same fresh-admin import helper | Show only for admin; preserve separate local release opening |
| Cache baseline panel | Existing admin-only panel/read API | Retain its existing visibility rule |

Keep one small pure ESM command policy for the exact admin role. The Metadata
view derives current presentation access and passes default-false capability
props into the three command components. The two existing workflow factories
accept a default-deny predicate; the parent supplies the live session decision,
and the artist factory forwards it to its release workflow. Check only privileged
dispatch methods, before busy flags or service calls. A hidden button is not a
server boundary; API freshness, CSRF and resource checks remain authoritative.

Keep opening separate from importing. The release-group component currently
uses one control for an already imported group's read action or a provider-only
group's import. Filtering the whole component would remove valid operator reads.
Keep its Open branch. Provider-release import buttons disappear for operators;
the separate local release list continues to open saved releases. Do not invent
a provider-only read workspace or silently turn an Open action into an import.

Use neutral browse copy for operator surfaces and native labeled controls in
their existing order. The operator workflow cannot dispatch privileged commands
through stale component events once the client role changes. A cached admin role
can still advertise a command after server-side revocation; the unchanged fresh
server check must refuse it with bounded feedback and no queued/imported result.
This round does not add background role polling or a second session mechanism.

Use a small focus composable for the three privileged handlers. It reuses the
existing interaction tracker, waits for error rendering/busy reset, and restores
the still-connected invoker after failure only while that interaction owns focus.
Dispose the tracker on every exit and preserve a user's focus move during a held
native refusal. Keep workflow error/result ownership separate from this wrapper.

Validate the pure role decision, default denial, current predicate changes and
preserved reads; then use actual browser commands and native API refusal. Keep
controlled provider/catalog responses distinct from server persistence evidence.
Retain existing route hydration and cache-panel consumers, run the stable fast
gate once the candidate is reviewed, and rebuild preserved local Docker without
cache. No backend, schema, dependency, release or version change is required.

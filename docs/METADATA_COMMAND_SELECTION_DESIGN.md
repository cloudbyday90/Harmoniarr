# Metadata command selection ownership design

Date: 2026-10-21. Continues the [command authority outcome](METADATA_COMMAND_AUTHORITY_OUTCOME.md).
See [official research and alternatives](METADATA_COMMAND_SELECTION_RESEARCH_2026_10.md).

The initial seven controlled workflow cases reproduce stale refresh results,
stale errors, obsolete imports starting follow-up reads, and delayed catalog
publication after navigation. Comparing resource IDs alone cannot distinguish
leaving artist A and returning to A before an older command completes.

## Ownership

Reuse `createLatestRequestGate`, adding a capture operation that borrows the
current generation and signal without advancing or cancelling it. Existing
begin/invalidate semantics stay intact. Artist selection advances its generation;
refresh captures it before dispatch. A new artist workspace resets its pending
flags. Late refresh success, error and final cleanup may update only that same
generation. Capture the artist ID before awaiting and refuse duplicate pending
refresh invocations within the current workspace.

Release commands begin a release-selection generation, capture the target ID,
artist and active release-group ID, and keep that token across POST and all
follow-up reads. Opening another group/release or resetting the artist workspace
invalidates it and resets pending selection flags. Load the imported group with
the original token instead of starting a new selection after the POST returns.
Check currency after each awaited boundary and before result/error/busy updates.

Artist catalog refresh after a release import borrows the artist generation and
also checks the release command token before and after its reads. It must not
advance artist ownership and invalidate a user's navigation. Reads may use the
existing abort signals; token checks also protect against services that ignore
abort. POST requests receive no navigation abort signal and are not retried or
treated as rolled back when selection changes. The server may accept a command
whose UI response is later obsolete; this design governs presentation ownership,
not server cancellation or authorization.

## Boundaries and verification

Keep fresh session/admin/CSRF checks unchanged. Do not add another command bus,
global state store, provider dependency, migration, or route permission model.
Use narrow ESM factory changes. Keep current response/error behavior for a command
whose selection remains current and preserve the existing focus wrapper.

Prove same-ID reselection, stale success and rejection, held follow-up reads,
current positive/error outcomes and pending ownership in focused tests. Browser
checks hold actual native responses after server guard/command dispatch, change
selection with native controls, then release the old response. Distinguish the
fixture's controlled catalog/command owners from durable imports/worker evidence.
Run the affected authority/cache/Settings consumers together and the final fast
gate once the candidate is stable. Preserve failed candidates and rebuild local
Docker without cache, keeping existing admin, mounts and data.

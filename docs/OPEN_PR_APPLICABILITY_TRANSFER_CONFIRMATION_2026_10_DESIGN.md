# Open PR applicability for transfer confirmation: design

Accepted assessment, October 8, 2026 (America/New_York).
Parent-provided local baseline: `33ad042`, main.

## Scope and eligibility

Refresh repository discovery and the open pull collection through GitHub MCP.
Use canonical URLs and REST templates returned by repository metadata. Request
100 items per page, retain the complete responses, and explicitly request the
next page to corroborate the observed boundary. Recheck changed filenames and
immutable heads/bases after collecting the list; corroborate them with a final
collection read. Separate consultation timestamps from publication dates.

Compare each patch with the completed local replays of
[PR 23](RANDOM_PR_23_LOCAL_REPLAY_OUTCOME.md),
[PR 24](RANDOM_PR_24_LOCAL_REPLAY_OUTCOME.md), and
[PR 40](RANDOM_PR_40_LOCAL_REPLAY_OUTCOME.md).
Exclude unchanged previously replayed patch scope. A materially changed head,
base or file scope requires fresh patch inspection rather than exclusion by PR
number alone. An open unreplayed patch must be applicable to the maintained
repository; a superseded version pin does not justify a downgrade.

If a nonempty eligible set remains, retain its ordered immutable identities and
a cryptographically generated seed before drawing uniformly. Retain the draw
algorithm, rejection steps and selected index so selection can be reproduced.
Report the exact patch and material risks to the root before implementation.
The root owns any local implementation and validation.

An empty set means no draw, redundant replay, downgrade or merge. This assessment
does not re-execute earlier replay harnesses or establish current dependency,
application, hosted-runner or published-artifact behavior.

## Evidence and boundaries

Retain discovery, complete collection pages, file-list responses, subsequent
metadata and exact comparisons under ignored
`.tmp/transfer-confirmation-2026-10/pr-applicability/`, with SHA-256 hashes.
Write observed identities and disposition in the separate
[outcome](OPEN_PR_APPLICABILITY_TRANSFER_CONFIRMATION_2026_10_OUTCOME.md).

HTTP Link headers may not be exposed by MCP; record that limit rather than
claiming header-based traversal. Pages and metadata are separate reads, not an
atomic GitHub snapshot. No application/test edits, tests, Git commands, branches,
commits, pushes, remote comments, merges, workflow dispatches or publication
belong to this applicability assessment.

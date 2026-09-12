# Track ownership accessibility design

Reviewed September 12, 2026. Harmoniarr artist detail shows library ownership separately from desired state and acquisition requests.

## Decision

Keep the release tracklist compact. Render actual screen-reader text inside each ownership marker, hide its redundant circle from assistive technology, and expose the same text as a pointer tooltip. Use `In library` only when `isOwned === true`; otherwise use `Not matched in library`. The backend also returns false when recording or ownership-match evidence is unavailable, so absence of a match is not proof of library absence.

The badge is static metadata in an existing semantic list item. Do not add focus stops, buttons, or live regions. Filled versus empty circles continue to distinguish states without relying solely on color. Preserve desired-state controls, keyboard navigation, Save/Cancel, and existing security boundaries. No new API, HTML injection, dependency, or persistence behavior is introduced.

## Options and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Real text with decorative circle (chosen) | Reliable text semantics; compact layout; accurate evidence language | Screen-reader-only text is not permanently visible to sighted users; tooltip requires pointer hover |
| Change only aria-label on generic span | Small patch | Generic span naming is prohibited; does not reliably expose the state |
| Always-visible text column | Broad visual clarity | Expands dense rows and requires responsive layout work |
| Live region per track | Announces changes | Unnecessary announcement noise for static metadata |

Final stack: existing boolean ownership projection → Vue template with strict positive check → existing sr-only utility and decorative glyph → browser accessibility-tree regression checks. Keep this bounded template change in the existing component; a new service for a two-state label would add unnecessary indirection.

## Official sources

Discovered and opened through tools as of September 12, 2026:

- [W3C ARIA in HTML](https://www.w3.org/TR/html-aria/): naming restrictions for generic elements.
- [W3C decorative images](https://www.w3.org/WAI/tutorials/images/decorative/): avoid redundant decorative information for assistive technology.
- [WCAG 2.2 use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color): state must not depend on color alone.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages): distinguish actual status announcements from static content.

## Validation plan

Check actual browser accessibility snapshots for owned and unmatched rows, exclusion of decorative circles, and changed ownership after previewing another edition. Preserve existing focus containment and override interactions. Run client validation and production builds, then rebuild the local Docker walkthrough. This is targeted evidence, not a full WCAG or screen-reader conformance certification.

## Open PR review

GitHub MCP refreshed all open PRs and complete patches. #40 at `649659f1e199d48d55cc8d5cccf9f079dc235d86` changes a Node fixture to another major and is unrelated. #24 at `40cf4d117b69bd55b9a0a7353361838216e1e952` is superseded by local build-push 7.3; #23 at `ae651337286216e92be7ae977e39fcedc14de7f9` is superseded by local metadata 6.2. No applicable patch was applied or merged.

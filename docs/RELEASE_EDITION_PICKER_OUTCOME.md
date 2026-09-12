# Release edition picker outcome

Date: September 12, 2026. Starting commit: `1d8054c`.

## Implemented result

Replaced the six-edition preview cap with a modular native selector over the supplied editions. Selection identifies local editions by local ID and remote editions by MusicBrainz release ID. Preview remains separate from saving an artist edition and setting the global default. See the [design and alternatives](RELEASE_EDITION_PICKER_DESIGN.md).

The new `ReleaseEditionPicker.vue` owns candidate selection and an explicit Preview action. `release-edition-options.js` owns option labels and typed identity mapping. Missing identities remain visible but disabled; a current edition absent from the supplied choices gets an empty selection prompt. Labels include an ordinal, country, full date, track count when known, and supplied disambiguation. They do not invent media formats.

The parent keeps metadata loading in its existing guarded composable. Preview moves focus to the persistent Close control before the picker unmounts for loading; late responses do not move focus. Existing Retry behavior retains the chosen edition descriptor. Administrator default and operator Save actions retain their separate guards. No server authorization or write contract changed.

## Validation

- Five edition-option unit tests passed, covering more than six entries, local/remote identity, absent identities, labels, and missing current choices.
- Three browser suites passed eight scenarios with zero skips: existing edition Save and modal lifecycle workflows, Retry recovery, and local/remote selection beyond six without unintended mutation requests.
- The final selector suite also passed Close-focus assertions and light/dark layout bounds at 390, 800, and 1280 pixels. Inspected mobile screenshots in both themes, plus tablet and desktop captures; the selector fits the modal without horizontal overflow. These fixture checks are not an assistive-technology certification or complete WCAG audit.
- Scoped ESLint, client/server production builds, ESM consistency, and copyright checks passed.
- Security validation passed; npm audit reported zero vulnerabilities.
- `npm test` passed repository lint, test hygiene, and all 8,283 tests: 3,428 server, 4,232 client, 500 scripts, and 123 PostgreSQL integration tests. Zero failures or skips.

## Local Docker walkthrough

Rebuilt and restarted using the documented build, health wait, and one-shot bootstrap sequence. Saved environment, existing admin, downloads mount, and data were retained. Local image ID: `sha256:21fb9096355afccbe0720a96bfc2d744f872e67afd5b197e78ad1b3c13f22df0`. The container is healthy at `http://127.0.0.1:47956`; `/healthz` returned HTTP 200 after startup. This is local image/startup evidence, not public registry publication or live provider acquisition evidence.

## Open PR review

GitHub MCP refreshed all three open PRs and their complete patches on September 12, 2026. None contained an applicable change, so none was applied or merged.

| PR | Reviewed immutable head | Disposition |
| --- | --- | --- |
| [40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Fixture-only Node 26 upgrade diverges from the retained Node 24 platform. |
| [24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 is superseded by locally pinned 7.3. |
| [23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 is superseded by locally pinned 6.2. |

## Limits and next recommendation

This addresses item 4 of the [artist review](ARTIST_DETAIL_REVIEW_2026_09.md). It does not fetch a complete remote catalog: the fallback still supplies its first 25 editions and does not hydrate tracks. Deterministic pagination and explicit completeness metadata remain item 14.

Next prioritize item 5: require an expected snapshot revision on artist saves. The current route defaults an absent revision to null, and the save service skips conflict checking for null. Requiring an explicit initial or existing revision would protect saved operator intent from callers bypassing concurrency checks. Cover missing and malformed revisions, initial saves, and stale concurrent saves returning 409 without partial writes. This code observation does not establish that an actual lost update has occurred.

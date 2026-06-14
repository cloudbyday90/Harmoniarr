# Discover Artist Card State Design

Status: Accepted for implementation
Last updated: 2026-06-12
Owner: Product + client architecture

## Purpose

This document covers the next Discover recommendation-model checklist item:
`Discover recommendation cards show monitored vs recommended correctly`.

`DiscoverArtistCard.vue` already receives card view models from the Discover
container, but its action button state was embedded directly in the template.
That made the visible label, accessible name, disabled state, and busy state
harder to reason about together. The clearest next step is a small
presentation-state helper that makes the card action contract explicit and
testable.

## Research Baseline

Official sources reviewed in June 2026 for current guidance as of May 2026:

- W3C WAI-ARIA Authoring Practices, Button Pattern, requires buttons to have an
  accessible label and notes that unavailable button actions should expose a
  disabled state:
  https://www.w3.org/WAI/ARIA/apg/patterns/button/
- W3C WAI-ARIA Authoring Practices, "Providing Accessible Names and
  Descriptions", defines accessible names as short labels that convey purpose
  and distinguish elements:
  https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- W3C WCAG Understanding 4.1.2, "Name, Role, Value", explains that UI
  components require programmatically determinable names, roles, and states:
  https://www.w3.org/WAI/WCAG21/Understanding/name-role-value
- Vue official accessibility guide documents label and `aria-label` patterns in
  Vue templates:
  https://vuejs.org/guide/best-practices/accessibility
- WHATWG HTML Standard documents native `<button disabled>` behavior as
  non-interactive, and separately discourages relying on `title` because many
  user agents do not expose it accessibly:
  https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element
  https://html.spec.whatwg.org/multipage/dom.html#the-title-attribute
- Node.js official test runner documentation supports focused ESM tests with
  `node:test`:
  https://nodejs.org/api/test.html

Applied here:

- Keep the native `<button>` element rather than replacing it with a custom
  ARIA button.
- Ensure the current action state changes both the visible text and accessible
  name.
- Do not rely on `title` for the icon-only add affordance.
- Test the state contract at a pure ESM boundary.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| A. Leave template logic inline | No new files | State contract remains implicit; easy for visible and accessible labels to drift |
| B. Add a pure presentation helper | Small, testable, reusable by component and future contract tests | Adds one new module |
| C. Mount Vue component in tests only | Proves rendered behavior | Requires more test setup; still leaves state logic embedded in SFC |
| D. Replace `+` with full `Add artist` label | Maximally explicit | Conflicts with the locked compact `+` Discover affordance |
| E. Add a `title` tooltip for `+` | Simple hover hint | HTML Standard discourages relying on `title` for accessible communication |

## Final Recommendation Stack

### R1. Add `discover-artist-card-presentation.js`

Create a pure ESM helper:

```js
resolveDiscoverArtistCardActionState({
  artistName,
  monitored,
  monitoring,
  disabled,
})
```

It returns:

- `state`
- `visibleLabel`
- `ariaLabel`
- `buttonVariant`
- `buttonDisabled`
- `iconOnly`
- `ariaBusy`

### R2. Make action states explicit

| State | Visible label | Accessible name | Disabled | Busy |
| --- | --- | --- | --- | --- |
| Addable | `+` | `Add {artist}` | No | No |
| Adding | `Adding...` | `Adding {artist}` | Yes | Yes |
| Already monitored | `Already monitored` | `Already monitored: {artist}` | Yes | No |
| Unavailable | `Unavailable` | `Add unavailable for {artist}` | Yes | No |

Precedence:

1. `monitoring`
2. `monitored`
3. `disabled`
4. addable

This ensures a pending add announces as pending instead of continuing to
announce as a fresh add action.

### R3. Keep `+` as the compact add affordance

The addable state remains icon-only to preserve the locked Discover design.
The accessible name is explicit, and no `title` dependency is introduced.

### R4. Keep recommendation/search classification outside the button helper

Recommendation vs search-result labels stay in `discover-presentation.js`.
The new helper only owns the card action state. This keeps the module focused
and avoids creating a large presentation singleton.

## Security

The helper only returns strings and booleans. Artist names can be remote
metadata, but Vue escapes interpolated text and attributes by default. The
helper does not generate HTML or use `v-html`.

The state labels are fixed platform copy plus a normalized artist name. Empty
or non-string names fall back to `this artist`, avoiding blank accessible names.

## Validation

- `node --test test/client/discover-artist-card-presentation.test.js`
- `node --test test/client/discover-artist-card-contract.test.js`
- `npm run lint:client`
- `npm run lint:test`
- `npm run build:client`

Browser validation is not required for this pass because layout and focus
behavior are unchanged. A later browser regression should cover refresh after
monitoring multiple artists.

## Outcome

Implemented:

- Added `src/client/lib/discover-artist-card-presentation.js` as a pure ESM
  state resolver for the Discover card add action.
- Updated `DiscoverArtistCard.vue` to consume the resolver through a `computed`
  state and bind visible label, accessible name, disabled state, `aria-busy`,
  button variant, and icon-only rendering from one object.
- Added focused helper tests in
  `test/client/discover-artist-card-presentation.test.js`.
- Added a lightweight SFC contract test in
  `test/client/discover-artist-card-contract.test.js`.

Validation completed:

- `node --test test/client/discover-artist-card-presentation.test.js` — 7/7 passing.
- `node --test test/client/discover-artist-card-presentation.test.js test/client/discover-artist-card-contract.test.js` — 9/9 passing.
- `npm run lint:client` — passing.
- `npm run lint:test` — passing.
- `npm run build:client` — passing.

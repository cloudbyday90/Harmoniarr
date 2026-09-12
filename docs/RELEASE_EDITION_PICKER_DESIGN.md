# Release edition picker design

Date: September 12, 2026. Starting commit: `1d8054c`.

## Problem and scope

Artist detail supports previewing edition metadata, saving an edition for a monitored artist, and an administrator choosing the global default edition. These are distinct actions. The existing preview radio group silently renders only the first six returned editions. Remote fallback entries have no local database ID, so comparing their null IDs also fails to identify the selected edition correctly.

Expose all editions supplied by the existing tracklist response through a small Vue component and a pure ESM identity/option helper. Keep fetching in the existing lifecycle-guarded composable. Local previews use `preferReleaseId`; remote previews use `preferReleaseMbid`. Do not invent IDs or relax server validation. Changing a candidate must not submit a saved selection, canonical override, or acquisition request.

## Options and recommendation

| Option | Pros | Cons |
| --- | --- | --- |
| Native select and explicit Preview action | Bounded visual footprint; built-in keyboard selection; separates choosing from fetching; supports all supplied entries | An extra activation; native popup styling varies by browser |
| Expand the radio group | Preserves the existing interaction and visible comparison | Long lists grow the modal; pagination complicates selected state and keyboard focus |
| Custom searchable combobox | Can improve discovery in very large lists | Requires additional focus, selection, popup, and assistive technology behavior; higher maintenance |

Recommend the native select with explicit preview. Use descriptive edition labels and stable identities; retain the current preview until the operator activates Preview. Distinguish candidate selection from saved artist intent. Preserve the existing server authorization and protected write paths.

## Standards and platform stack

Official guidance discovered and read through research tools on September 12, 2026:

- [W3C form grouping](https://www.w3.org/WAI/tutorials/forms/grouping/) describes associated labels and semantic grouping of related choices.
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/) supports a visible label associated with the select.
- [W3C keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) distinguishes focus from selection and explains the cost of selection triggering slow content changes. This supports a deliberate preview activation here.
- [W3C radio pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) specifies grouped radio keyboard behavior; retaining radios would require keeping the entire selection model coherent when expanding or paging.
- [Vue form bindings](https://vuejs.org/guide/essentials/forms) documents select state and the disabled empty option when no value matches; [Vue list identity](https://vuejs.org/guide/essentials/list) recommends stable primitive keys.

Retain Node 24 native ESM, Vue Composition API, native HTML form controls, existing `--hx-` design tokens, the release-detail read composable, Express authorization/CSRF boundaries, and PostgreSQL persistence. No new dependency or state singleton is needed. These recommendations are application design judgments informed by the sources, not a claim of full WCAG conformance.

## Acceptance and limits

Verify more than six editions, selection beyond the initial six, distinct remote entries with null local IDs, keyboard selection without premature fetching, deliberate preview, loading/failure recovery, and modal focus. Check narrow and wide layouts in both themes. Retain separate operator Save and administrator default actions.

The remote fallback still supplies its first 25 editions and may return no hydrated tracks. This UI change cannot establish complete MusicBrainz coverage. Catalog pagination and completeness metadata remain artist review item 14. Invalid or absent identities must not become actionable preview requests.

See the separate outcome document for implemented behavior, tests, PR disposition, and remaining work.

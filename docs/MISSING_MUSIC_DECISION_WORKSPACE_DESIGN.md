# Missing Music decision workspace design

**Status:** Implemented 2026-08-26

## Outcome sought

Missing Music answers one bounded question: which selected releases are not yet
fully available in the library, and what is the safe next step for each one?
It is not a second Downloader and it is not a generic request form.

The completed flow is:

```text
Missing Music
  ├─ Start search (explicit confirmation)
  │    └─ Music Queue (search, automatic choice, or manual match choice)
  │         └─ Downloader (live transfer state and transfer controls)
  ├─ Open Music Queue (read/navigation only)
  └─ Keep selected manually (separate confirmed desired-state decision)
```

## Research basis

Research was checked against official sources on 2026-08-26.

- [W3C WCAG: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions)
  requires controls and choices to say what input or outcome they expect. Each
  Missing card therefore names **Start search**, **Open Music Queue**, and
  **Keep selected manually** rather than using a generic **Request** label.
- [W3C WAI-ARIA APG: Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  requires a labelled dialog, focus inside while open, keyboard escape, and a
  logical focus return. The existing native-dialog component is reused; its
  search explanation is explicitly described to assistive technology and
  initial focus is on **Cancel**, the least-destructive action.
- [W3C WAI-ARIA APG: Alert and message dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
  recommends placing initial focus on the least-destructive option for a
  consequential confirmation. Starting a search is reversible, but it still
  creates work, so the cancellation control receives focus first.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  recommends CSRF protection for every state-changing cookie-authenticated
  request and warns against state-changing GET requests. Navigation to Music
  Queue remains a GET/route change only; the existing POST search request
  remains behind its CSRF and permission checks.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Retain the generic request dialog and user-target selector | No presentation work | The primary button says `Start search` but the confirmation speaks of a request and offers an unrelated recipient choice. The outcome is unclear. | Rejected |
| Add a Missing-to-Downloader command | Short apparent path | Skips discovery, match choice, quality gates, and the established Music Queue authorization and idempotency contracts. | Rejected |
| Make each card a readable decision entry with a confirmed search and a Music Queue link | Preserves the established lifecycle, gives a direct way to inspect/manual-match one release, and uses clear action labels | Adds one small presentation module and an extra secondary button per card | Selected |
| Fold manual desired-state selection into Start search | Fewer controls | Confuses a durable policy decision with an acquisition action and risks starting work when an operator meant only to preserve selection. | Rejected |

## Final recommendation stack

1. **Make the release action explicit.** The primary button is **Start
   search**. Its visible support text states that a manual match decision, if
   needed, happens in Music Queue.
2. **Offer a safe, direct inspection path.** **Open Music Queue** routes to
   the one durable wanted-release ID. It makes no network mutation and lets an
   operator defer or make the next informed choice on the release workspace.
3. **Keep desired-state decisions distinct.** **Keep selected manually**
   remains separately confirmed, records durable selection intent, queues
   reconciliation, and explicitly does not start a search.
4. **Keep Downloader as the transfer specialist.** Music Queue hands a
   selected candidate to Downloader only after the existing selection and
   quality decisions. Missing Music never exposes raw transfer commands.
5. **Use the existing authorization boundary.** The route parameter is only a
   wanted-release ID; Music Queue continues to scope its read model on the
   server. Search continues to use the existing session, permission, and CSRF
   validation.
6. **Test exposed behaviour.** Verify pure route/copy builders, exact
   accessible labels, confirmation focus, card keyboard movement, and the
   release-specific Music Queue route.

## Implementation boundary

The implementation stays deliberately small and ESM-only:

- `missing-release-decision-presentation.js` owns durable ID routing and the
  decision labels/accessible names.
- `MissingReleaseDecisionActions.vue` owns card-level decision copy and emits
  intent only.
- `MissingView.vue` owns existing queries, confirmation state, and navigation.
- `ConfirmRequestModal.vue` remains the single native-dialog implementation;
  it now exposes its concise action explanation through `aria-describedby`
  and initially focuses `Cancel`.

No endpoint, database migration, queue write, provider credential, local
storage, telemetry, or Downloader control is introduced. The Music Queue
route contains no provider identifiers, filenames, paths, candidates, or
secrets.

## Validation plan

- Client lint and test lint.
- Pure tests for route identity and visible/accessible label alignment.
- Regression coverage for wanted-release normalization, including separation
  of the artwork identifier from the durable wanted-release ID.
- Client production build.
- Browser verification of the roving artwork grid, card action order, dialog
  focus, no recipient selector in the search confirmation, and direct
  Music Queue navigation.
- Repository-wide validation and security checks before commit.

# Missing Music Legacy Settings Recovery Context — Design

**Status:** Implemented
**Date:** 2026-08-28

## Purpose

Harmoniarr has already made **Missing Music** the canonical release-decision
surface. Older Settings links can still carry the fixed
`music_queue_release` return-context token. This document defines a narrow
compatibility rule: accept that token at the Settings boundary, map it to the
canonical `missing_music_decision` context immediately, and never emit the
legacy token in newly constructed links.

The change is limited to return-context normalization. It does not rename
server error codes, delete historical route modules, change a release's owner,
or alter the operator and administrator authorization model.

## Evidence and scope

The audit found that current client link producers already create
`missing_music_decision` for a scoped release, including Activity and Missing
Music recovery links. The legacy token remains in the Settings recovery
allowlist and duplicate destination metadata, historical browser assertions
for saved Music Queue recovery links, and presentation guards that must still
recognize a scoped Missing Music recovery after normalization.

The legacy `repair` query key remains accepted because old deep links may use
it. It remains an input alias only; new handoff locations use `returnTo`.

## Decision

Use a small pure ESM normalization map in
`src/client/lib/settings-recovery-handoff.js`.

1. Read one string value from `returnTo` or the retained `repair` alias.
2. Translate the exact `music_queue_release` token to
   `missing_music_decision` before destination lookup.
3. Validate the accompanying release ID with the existing bounded allowlist
   pattern.
4. Construct return actions and Settings URLs from the canonical context only.
5. Retain `MUSIC_QUEUE_RELEASE` as a legacy input constant for compatibility,
   but remove its duplicate destination branch and new-caller use.

This produces one operator-facing destination and one accessible action name:
**Return to Missing Music**. A historic Settings URL still works, while its
next Settings handoff uses the canonical query value.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Keep legacy and canonical destination entries indefinitely | No immediate test changes | Duplicates routing policy and can keep emitting two identities for the same action | Rejected |
| Remove the legacy token immediately | Simplest steady-state helper | Breaks bookmarked Settings links and retained activity/history targets | Rejected |
| Translate the legacy token in the Settings helper | Keeps saved links working, centralizes policy, and makes all new links canonical | Requires explicit compatibility tests and a later retirement review | **Adopted** |
| Accept arbitrary return URLs or route names | Appears flexible | Creates open-redirect and confused-deputy risk | Rejected |

## W3C accessibility model

WCAG 2.2 Success Criterion 3.2.4 requires components with the same function
to be identified consistently across a set of pages. A Settings repair that
returns to the same Missing Music release therefore keeps one destination and
one visible label, regardless of whether the person entered from an old or new
link. WCAG 2.2 Success Criterion 2.4.4 further supports a descriptive return
action whose purpose can be understood from its text and context.

This is a logic-only change: it adds no control, does not change focus, and
does not add a live-region announcement. Existing native router links, heading
orientation, keyboard behavior, and accessible names remain intact.

## Security and multi-user model

- The browser accepts only a fixed context allowlist and a bounded opaque
  release identifier. It never accepts a URL, path, route name, user ID,
  provider endpoint, transfer ID, or authorization claim.
- Normalization occurs before a destination is selected, so a legacy input
  cannot select a legacy route or a new arbitrary destination.
- The release ID is navigation state only. Missing Music still resolves the
  decision and validates ownership or administrator scope on every server
  request. The mapping cannot grant cross-user access.
- Retained history remains useful because old links continue to resolve, while
  new history and handoffs converge on the canonical route family.

This follows OWASP's allowlist validation guidance and its requirement to
validate authorization on every request.

## Final recommendation stack

1. **One canonical destination:** serialize `missing_music_decision` for every
   newly created scoped Settings recovery handoff.
2. **One bounded compatibility adapter:** map only
   `music_queue_release` at the recovery-input boundary; preserve the existing
   release-ID validation.
3. **Server-owned authorization:** continue treating route values as opaque
   identifiers and enforce per-request, per-user authorization in Missing
   Music services.
4. **Focused regression coverage:** verify both `returnTo` and legacy `repair`
   inputs, malformed IDs, canonical outbound URLs, and the same named return
   route.
5. **Retire deliberately:** keep the legacy constant only while historical
   deep-link support is required; remove it in a dedicated breaking-change
   release after usage evidence permits.

## Sources checked 2026-08-28

- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
- [Vue: Composables and extracted logic for code organization](https://vuejs.org/guide/reusability/composables)
- [MDN: `export` and named re-exports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [OWASP: Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

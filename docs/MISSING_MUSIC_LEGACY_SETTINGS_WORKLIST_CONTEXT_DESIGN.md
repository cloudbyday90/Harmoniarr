# Missing Music Legacy Settings Worklist Context — Design

**Status:** Approved for implementation
**Date:** 2026-08-28

## Purpose

Missing Music is Harmoniarr's canonical worklist for releases that still need
an action or an automatic search. Historical Settings links can contain the
generic `music_queue` return-context token. Unlike the previously migrated
`music_queue_release` token, it carries no release identifier and therefore
must return to the Missing Music worklist, not a per-release decision.

This design keeps bookmarked links and retained history useful while ensuring
new Settings handoffs use only the canonical `missing_music` token.

## Evidence and scope

The recovery helper currently has two equivalent generic destinations:
`missing_music` and `music_queue`. Both return to the `missing` route with the
same action label and provider-ready copy. The provider Settings confirmation
still checks the legacy generic token to add the one-time `provider_ready`
marker, even though that marker is presented by the canonical Missing Music
module.

No current canonical client producer emits `music_queue`. The token remains an
inbound compatibility concern for older `returnTo` and `repair` query values,
including saved history. It has no user identity, provider secret, transfer
identifier, or release identifier.

## Decision

Use the existing pure ESM recovery adapter in
`src/client/lib/settings-recovery-handoff.js`.

1. Accept `music_queue` only at the bounded Settings recovery-input boundary.
2. Normalize it immediately to `missing_music` before destination lookup.
3. Remove the duplicate generic `music_queue` destination metadata.
4. Serialize `missing_music` in every new Settings handoff and return action.
5. Treat canonical generic Missing Music and scoped Missing Music decisions as
   eligible for the fixed `recovery=provider_ready` marker after a successful
   provider repair.
6. Retain `MUSIC_QUEUE` as an explicitly legacy input constant until a
   deliberate breaking-change retirement removes historical-link support.

The user-facing return action remains **Return to Missing Music**. The
provider-ready message uses the same Missing Music wording; no browser-facing
technical or historical label is introduced.

## Options considered

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Keep a second `music_queue` destination | No short-term changes | Maintains duplicate routing policy and allows divergent behavior | Rejected |
| Remove `music_queue` support immediately | Smallest helper | Breaks saved Settings links and retained history | Rejected |
| Normalize `music_queue` to `missing_music` | Preserves history, produces one canonical route, and needs no release ID | Requires compatibility coverage and a retirement review | **Adopted** |
| Normalize to `missing_music_decision` | Reuses the scoped workflow | Cannot identify a safe release; would create an invalid or misleading destination | Rejected |
| Accept an arbitrary return path | Flexible-looking | Enables open-redirect and confused-deputy behavior | Rejected |

## W3C accessibility model

WCAG 2.2 Success Criterion 3.2.4 calls for components with the same function
to be identified consistently. A provider repair that returns a person to the
same Missing Music worklist therefore retains one visible destination and one
action name, regardless of whether they opened a historical or current link.

WCAG 2.2 Success Criterion 2.4.4 supports the descriptive **Return to Missing
Music** label: its destination is apparent without interpreting a technical
context token. The one-time provider-ready status is a bounded visibility
message, not a new control or automatic navigation. This logic-only change
does not modify focus order, keyboard behavior, semantic HTML, or live-region
contracts.

## Security and multi-user model

- The client allows only fixed context tokens. It never accepts a URL, path,
  route name, user ID, administrator scope, provider endpoint, secret, or
  authorization claim.
- Normalization happens before destination selection. An old input cannot
  select a legacy page or an arbitrary destination.
- The optional `provider_ready` value is a code-owned presentation marker; it
  is not authorization state and is consumed after use.
- Missing Music still obtains worklist and decision data through the server,
  which must authorize each request for the authenticated user or an
  authorized administrator. The route query cannot grant cross-user access.
- Historic links remain readable for audit and history, but newly created
  links converge on a single canonical representation.

This follows OWASP's recommendation to enforce authorization on every
request and to use allowlists for structured input.

## Recommendation stack

1. **Canonical worklist context:** emit `missing_music` for generic Missing
   Music recovery flows.
2. **Small compatibility adapter:** accept and translate only the exact legacy
   `music_queue` token at the Settings boundary.
3. **One descriptive recovery action:** use **Return to Missing Music** for
   both legacy and canonical inputs.
4. **Code-owned status marker:** preserve `provider_ready` only for canonical
   Missing Music recovery so the person receives useful confirmation after a
   provider repair.
5. **Server-authorized multi-user data:** treat the query as navigation state
   only; continue authorization and ownership checks on every API request.
6. **Focused regression coverage:** verify current and legacy query keys,
   canonical outbound URLs, generic return behavior, and the provider-ready
   marker.

## Sources checked 2026-08-28

- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
- [W3C WCAG 2.2: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
- [W3C WCAG 2.2: On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input)
- [Vue: Composables](https://vuejs.org/guide/reusability/composables)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

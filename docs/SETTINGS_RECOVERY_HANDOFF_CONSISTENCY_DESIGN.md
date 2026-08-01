# Settings Recovery Handoff Consistency Design

## Scope

This slice makes setup recovery consistent when normal music handling stops for
a missing provider connection or required folder. It covers the user-facing
surfaces where the interruption is encountered:

1. Home provider notices.
2. Music Queue provider notices and release-specific setup actions.
3. Downloader while Soulseek is disabled.
4. Activity library-add and audio-check recovery actions.

The goal is not to create a Settings wizard or a new diagnostic workspace.
Each interruption names the missing prerequisite, opens the normal Settings
page that owns the repair, and returns to the originating operational context
after the prerequisite is verified.

## Problem

Recovery had grown independently in several views:

- Music Queue used a fixed `repair=music_queue` query value, but its return
  path only covered provider repair.
- Home used that same Music Queue context, so a person who repaired a Home
  notice was sent to a different workspace.
- Downloader and folder setup actions opened Settings with no return context.
- Library-add diagnostics did the same, losing a release-specific diagnosis
  after a folder repair.

This made a blocked workflow feel like a dead end even when the app knew the
next safe action.

## Research

Official guidance was requested for June 2026. The sources below were located
and reviewed on 2026-08-01, which is the current official guidance available
at implementation time.

- [W3C WCAG 2.2: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
  supports descriptive actions whose destination is clear from the link and
  surrounding context.
- [W3C WCAG 2.2: Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
  recommends presenting a known correction without exposing unsafe detail.
- [W3C ARIA Authoring Practices: Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/)
  recommends native links for navigation rather than buttons that emulate
  navigation.
- [GOV.UK interruption pages](https://design-system.service.gov.uk/patterns/interruption-pages/)
  recommends a clear repair action and a grouped continuation after the
  interruption is resolved.
- [GOV.UK check answers](https://design-system.service.gov.uk/patterns/check-answers/)
  demonstrates concise, contextual return actions rather than a vague global
  back control.

## Options

### Per-page repair query parameters

Pros:

- Small local changes.
- Lets each view choose its own return wording.

Cons:

- Duplicates routing and validation logic.
- Produces inconsistent return behavior and can lose the original workspace.
- Encourages future pages to add unrestricted query values.

### Free-form `returnUrl`

Pros:

- Can preserve an arbitrary deep link.
- Requires little route-specific code.

Cons:

- Creates an open-redirect risk unless every target is exhaustively validated.
- Makes navigation state hard to reason about and test.
- Can carry unneeded paths or query data into Settings.

### Allowlisted recovery context, selected

Pros:

- Preserves the workspace or safe release detail a person was using.
- Uses named Vue routes and a small, auditable data contract.
- Rejects external URLs, arbitrary route names, path-like values, and malformed
  release identifiers.
- Reuses one confirmation presentation for provider and folder repair.

Cons:

- Each new recovery origin must be intentionally added to the allowlist.
- It preserves operational context, not arbitrary UI filter state.

## Decision

Use one bounded client-side recovery contract.

`settings-recovery-handoff.js` accepts only these internal contexts:

| Origin | Repair page | Safe return |
| --- | --- | --- |
| Home | Connections | Home |
| Music Queue | Connections | Music Queue |
| Music Queue release | Connections or Media & storage | That Music Queue release |
| Downloader | Connections | Downloader |
| Activity library-adds | Media & storage | Activity library-add diagnostics |
| Activity library-add release | Media & storage | That release's Activity diagnostics |
| Activity timeline | Connections | Activity timeline |

New handoffs serialize `returnTo` plus a bounded `returnReleaseId` only for
release-specific targets. The prior `repair=music_queue` value remains readable
for existing deep links, but no new UI generates it.

After a successful provider save or test, Connections verifies the scoped
provider status and then shows one `SettingsRecoveryConfirmation` action. After
a folder save, Media & storage shows the action only when the server returns a
healthy folder-validation summary. A failed or unverified check has no return
action and gives the person the next safe correction instead.

## Final Recommendation Stack

1. **Named router destinations:** return targets are route names and controlled
   params, never a passed URL.
2. **Pure recovery presentation:** route serialization, validation, provider
   result shaping, and folder result shaping are isolated ESM modules.
3. **Native link handoffs:** blockers use normal router links with descriptive
   labels such as `Set up Soulseek` and `Set up folders`.
4. **Verified continuation:** present `Return to ...` only after the relevant
   provider or folder prerequisite is confirmed ready.
5. **Release-scoped continuity:** retain a bounded wanted-release identifier
   when a repair originated from a specific Music Queue or Activity release.

## Security Boundaries

- No free-form URL, route name, hash, or path is accepted from query input.
- Release-specific recovery accepts only a bounded identifier pattern and has a
  fixed maximum length.
- Settings continues to render provider and folder health through existing safe
  presentation models. It does not echo API keys, provider addresses, raw
  provider failures, or raw paths in recovery confirmations.
- The return route is navigation only. Existing server authorization still
  controls every release, Activity, provider-status, and Settings request.
- A ready confirmation is not a claim that a download has started. Normal
  Music Queue scheduling remains authoritative.

## Implementation

- Added `settings-recovery-handoff.js` for context validation, safe route
  construction, and verified folder results.
- Added `settings-provider-recovery-presentation.js` so Connections can shape
  a safe provider recovery result for every approved origin.
- Added reusable `SettingsRecoveryConfirmation.vue` and removed the
  Music-Queue-specific confirmation component.
- Updated Home, Music Queue, Music Queue progress strips, Downloader, Activity
  library-add diagnostics, and audio-check Activity links to use the shared
  handoff builder.
- Updated Connections and Media & storage to confirm the repair and return to
  the originating workspace only when ready.
- Simplified disabled Downloader wording so it explains that Soulseek is off
  and states the one direct setup action without candidate or internal service
  terminology.

## Validation

- Pure client tests cover the allowlist, malformed and external context
  rejection, release-scoped named routes, and folder confirmation gating.
- Existing provider recovery, Music Queue progress, Activity handoff,
  Downloader copy, and Settings source contracts cover the updated consumers.
- Browser verification covers Home and Music Queue handoff origins, provider
  recovery confirmation, disabled Downloader recovery, and folder repair
  returning to the same Music Queue release.

## Outcome

Settings now behaves as a repair destination, not a dead-end configuration
page. A person can fix the prerequisite in its normal owner page and continue
from the same music task without being exposed to arbitrary redirects or
advanced diagnostics.

# Music Queue Release Progress Design

Status: Implemented
Date: 2026-08-25

## Purpose

Music Queue is Harmoniarr's release-centred control surface. Downloader remains
the provider-operations surface. A selected release therefore needs a small,
plain-language view of its lifecycle without exposing provider internals or
making the user decide what Harmoniarr can continue safely on its own.

This design adds a four-step, read-only summary to the selected release
inspector:

1. Search
2. Choose match
3. Download
4. Add to library

The existing **Current status** and state-specific controls remain first. The
progress summary follows them to orient the user; it never introduces a second
set of actions. In particular, a confirmed transfer is evidence that
Harmoniarr recorded an accepted download handoff, not a claim that the file is
complete or safe to add.

## Research Basis

Research was checked against current official W3C guidance on 2026-08-25.

- WCAG requires status messages to be programmatically determinable and
  announced without receiving focus. The refresh control uses one concise
  `role="status"` update, while persistent release progress remains ordinary
  structured content. [W3C: Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
- Keyboard focus must preserve meaning and operability. The new ordered,
  non-interactive list is in the same DOM and visual order; refreshing does not
  shift focus from the Refresh button. [W3C: Understanding Focus Order](https://www.w3.org/WAI/WCAG21/Understanding/focus-order)
  and [Technique G59](https://www.w3.org/WAI/WCAG22/Techniques/general/G59)
- Repeating functions should have consistent identification. Existing labels
  such as **Refresh**, **Choose a match**, and **Add to library** are retained
  rather than adding generic commercial vocabulary such as “Needs review.”
  [W3C: Understanding Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)

## Options Considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Keep status text only | Lowest implementation cost | Users cannot see where a release is in the end-to-end flow; handoff confirmation remains hidden. |
| Put full provider transfer controls in Music Queue | One apparent destination | Conflates release decisions with provider operations, exposes distracting technical state, and duplicates Downloader. |
| Add a compact, ordered release lifecycle with existing actions | Clear orientation; simple keyboard reading order; separates decision state from automation; exposes only aggregate durable evidence | Adds a small read-model projection and presentation component. |
| Make progress live-polling with frequent announcements | Potentially immediate feedback | Can interrupt assistive-technology users and makes a home-hosted page noisy without adding control. |

## Final Recommendation Stack

1. Keep Music Queue release-centred and Downloader provider-centred.
2. Render the four-stage lifecycle only in a selected release's existing
   inspector, after the current status and before any state-specific action.
3. Project only aggregate, durable confirmation data: transfer count, number
   of linked candidates, and latest confirmation timestamp.
4. Use the status service's `progressStep`, with a status-code fallback, to
   identify the current or stopped stage. Do not infer file completion from a
   transfer handoff.
5. Preserve existing action labels and show controls only where the state
   service makes a decision available.
6. On an explicit refresh, announce one short result with `role="status"` and
   retain focus; do not add polling or focus movement.

## Data and Security Boundaries

The server derives transfer confirmation through the established durable chain:

`wanted release → discovery request lastSearchId → import candidate → confirmed transfer link`

Only the release-scoped aggregate crosses into the Music Queue response. It
does not include provider transfer IDs, source usernames, filenames,
filesystem paths, provider payloads, or secrets. The existing app-user-scoped
release lookup and server-derived status/action authorization remain unchanged.

## Accessibility and Interaction Outcome

- The progress display is a semantic `<section>` with a named heading and an
  ordered list; it contains no redundant focus targets.
- A single current or stopped step uses `aria-current="step"`.
- The visual markers are supplementary; every state is expressed in text.
- The Refresh result is the only new live message. It is atomic and polite by
  virtue of `role="status"`, and focus stays on the triggering button.
- No control is added to the progress display. Existing actions remain near
  the status that explains them.

## Validation Plan

- Unit-test the pure client presentation for downloading, stopped, and
  completed release states.
- Unit-test the server's durable aggregate projection and ensure it never
  includes provider identity fields.
- Test the selected detail refresh contract for a status announcement and no
  focus call.
- Run focused server/client tests, lint, full validation, production build,
  and browser acceptance where the local runtime is available.

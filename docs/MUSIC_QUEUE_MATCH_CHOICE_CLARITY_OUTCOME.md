# Music Queue Match Choice Clarity Outcome

Date: 2026-08-25

## Delivered

Music Queue now says when it is showing a score-ordered shortlist instead of
all discovered candidates. For example, a release with five visible options and
285 discovered candidates explains that it is showing the five highest-ranked
matches of 285 candidates.

Repeated `Use this match` and `Reject match` buttons now retain their visible
label while adding the card identity to the accessible name. This makes an
action unambiguous in the accessibility tree without changing the on-screen
control or the manual selection flow.

## Outcome

Pros:

- Operators know that a bounded shortlist is intentional before making a
  download-related decision.
- The default view stays compact and readable on desktop and mobile.
- Assistive technology can distinguish repeated match actions.
- No provider call, queue mutation, or sensitive data exposure was added.

Cons:

- The current product still deliberately exposes only the highest-ranked
  candidate cards. A future request for broader candidate exploration should
  be based on observed operator need, not inferred from the total alone.

## Next recommended item

Select one reviewed Music Queue match in the local walkthrough, wait for its
Downloader handoff, then run the strict provider-acceptance proof. This is an
operator choice because it can create external peer-to-peer work:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

# Music Queue Match Selection Feedback Outcome

Date: 2026-08-25

## Delivered

Match-selection confirmation now reuses the authoritative release state
returned by the server:

- `checking_matches` explains that Harmoniarr will queue the selected match
  after its checks finish.
- `downloading` explains that Harmoniarr will check the files and then add them
  to the library.
- An absent or unfamiliar state receives a cautious confirmation that the
  release will be updated as its next step is prepared.

The existing release-scoped polite status message and keyboard-focus recovery
remain unchanged. The confirmation therefore stays attached to the operator's
decision without unexpectedly navigating to Downloader.

## Outcome

Pros:

- The confirmation reflects the persisted state rather than a client guess.
- Operators and assistive-technology users receive the same concise handoff
  description.
- The UI avoids implying that a provider accepted a transfer before that is
  durably known.
- The reusable ESM projection avoids duplicating state-to-copy mappings.

Cons:

- A response without a recognizable state necessarily uses a less specific
  fallback. The refreshed release remains the source of detail.

## Next recommended item

Choose a reviewed match in the local walkthrough only after confirming the
release and quality evidence, then let Music Queue show its resulting handoff
state. Once Downloader contains the linked transfer, run the strict proof:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

The match choice remains a deliberate operator decision because it can create
external peer-to-peer work; this change does not make that choice or submit a
transfer automatically.

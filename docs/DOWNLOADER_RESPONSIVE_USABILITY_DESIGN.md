# Downloader Responsive Usability Design

## Decision

At narrow widths, stack the **Transfer Queue** title and its filter controls
within the Downloader card header. The State select and the Music Queue linkage
checkbox then use the header’s full available width.

The transfer table remains a native HTML table with its existing horizontal
scroll treatment. A transfer has a genuine two-dimensional relationship across
file, source, state, progress, size, speed, queue position, and diagnostics;
turning it into cards would make comparison slower and risk hiding its direct
Music Queue handoff.

## Evidence

The final operator check uses two linked active transfers and two unlinked
queued transfers at 1280 px and 375 px. At 375 px:

- all four summary cards remained within the 375 px document width;
- the three page-header actions were visible and had 44 px heights;
- the filters remained labelled and the linkage checkbox retained a 44 px
  target;
- the Transfer Queue header gave the title/result only about 89 px while the
  filters occupied about 229 px, producing unnecessary title and result
  wrapping.

That last condition is not a workflow blocker, but it makes the result count
harder to scan precisely where responsive reflow should preserve clear order.

## Accessibility model

The change preserves the existing native `fieldset`, `select`, checkbox,
labels, status message, and native `table`. It uses CSS flex reflow rather than
changing roles or introducing a scripted widget. At small widths the controls
remain full-width, and the existing 44 px mobile checkbox target remains in
place.

This follows WCAG 2.2 Reflow’s requirement to retain information and
functionality at a 320 CSS-pixel width, while treating the transfer table as
the permitted two-dimensional exception. W3C’s ARIA Authoring Practices also
recommends native HTML tables when the host language provides one. Target Size
(Minimum) remains satisfied by the existing 44 px mobile control treatment.

## Alternatives

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep the side-by-side header | No code change | Narrow title/result column makes scan order less clear | Rejected |
| Stack this card header and make filters full-width | Clear reading order; minimal, local change | Uses more vertical space on phones | Chosen |
| Change every card header globally | Consistent mobile rule | Risks regressions on unrelated cards without evidence | Rejected |
| Replace the table with mobile cards | Avoids horizontal table presentation | Loses row comparison and complicates the direct handoff | Rejected |

## Security and data handling

This is CSS-only presentation work. It does not alter the Downloader response,
authorization, Music Queue linkage rule, browser storage, telemetry, or network
requests.

## Implementation boundaries

- Scope the responsive header reflow to Downloader’s Transfer Queue card.
- Keep the filter component modular and its native controls unchanged.
- Add browser evidence for desktop and 375 px widths, including visible action
  targets, summary-card bounds, filter sizing, and table semantics.
- Do not add a persistent preference or another Downloader destination.

## Sources

- [W3C WCAG 2.2: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [W3C WCAG 2.2: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C ARIA Authoring Practices: Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Next recommended item

After this responsive polish, observe real Downloader usage before introducing
more controls. The next product improvement should be selected from a concrete
operator decision that cannot be made from the transfer row, its details, or
the direct Music Queue handoff.

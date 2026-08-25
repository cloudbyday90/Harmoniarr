# Downloader Music Queue Handoff Design

Status: Implemented
Date: 2026-08-25

## Purpose

Downloader is the live provider-operations view; Music Queue is the
release-centred decision and lifecycle view. A transfer that Harmoniarr can
durably associate with a Music Queue release should offer one clear, read-only
link back to that release. This avoids making Downloader responsible for
release decisions or duplicating Music Queue controls.

The handoff appears only in Transfer details, under **Diagnostics contract**:

- It names the associated artist and release.
- Its link text names the destination, for example, **Open Music Queue release:
  Artist — Release**.
- It closes the native transfer-details dialog and navigates to the existing
  release route.
- It adds no mutation, provider action, new route, or polling behavior.

## Research Basis

Research was checked against current official W3C guidance on 2026-08-25.

- A link's purpose should be clear from its text or programmatically determined
  context. The handoff uses its destination in the link text instead of a vague
  **View details** label. [W3C: Link Purpose in Context](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context)
  and [Technique G91](https://www.w3.org/WAI/WCAG22/Techniques/general/G91)
- Headings and labels should describe the topic or purpose. **Music Queue
  release** is a compact description of the linked data and appears in the
  existing diagnostics definition list. [W3C: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- Information and relationships conveyed visually must also be programmatically
  determinable. The existing `dt`/`dd` structure preserves the relationship
  between the linkage label, release identity, and link. [W3C: Info and
  Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
- The existing native HTML `dialog` retains its normal focus behavior. The
  handoff is an ordinary in-dialog link, not another modal or scripted focus
  pattern. [W3C Technique H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)

## Options Considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Keep only the Import Review link | No additional read model | Operators must navigate through candidate diagnostics to find the release lifecycle. |
| Add Music Queue actions to Downloader | Fewer page changes in theory | Conflates live provider operations with release decisions, duplicates controls, and increases mutation risk. |
| Resolve all releases sharing a search | Maximum correlation | Can expose another operator's release and produces ambiguous multiple destinations. |
| Add one app-user-scoped, read-only Music Queue handoff | Direct path, clear destination, preserves view boundaries, and avoids new control authority | Requires a small extra read query for linked transfers. |

## Final Recommendation Stack

1. Use the existing durable transfer-to-import-candidate link as the only
   starting point.
2. Resolve only the candidate's persisted `musicQueue` wanted-release IDs; do
   not infer an association from filenames, paths, usernames, or a live
   provider response.
3. Scope the lookup by the authenticated administrator's `app_user_id`. Do not
   return a handoff when the caller or a matching release is absent.
4. Return only release identity and wanted state: wanted-release ID, artist,
   release title, and wanted status.
5. Render one semantic Diagnostics contract row and one destination-specific
   link in the existing transfer-details dialog.
6. Keep all provider controls in Downloader and all release decisions in Music
   Queue.

## Security Boundaries

The server follows this bounded chain:

`live transfer → import_execution_transfer_links → import candidate → persisted musicQueue wanted-release ID → app-user-scoped library_wanted_releases row`

The release lookup is parameterized and requires the authenticated app-user ID.
It returns no source username, provider transfer ID, filename, directory,
filesystem path, raw provider payload, candidate payload, or secret. When a
candidate is shared by several operators, each caller can receive only the
release that belongs to that caller. No write path or authorization exception is
introduced.

## Validation Plan

- Unit-test the scoped server linkage query and its no-caller/no-candidate
  behavior.
- Unit-test the Downloader read model's caller propagation and the route's
  session propagation.
- Unit-test the client route helper and check the transfer-details dialog
  contract for a descriptive link.
- Run focused server and client tests, client lint/build, a browser acceptance
  test, the full validation suite, and the security validation.

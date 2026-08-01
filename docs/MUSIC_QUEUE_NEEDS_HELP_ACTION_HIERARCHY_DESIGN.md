# Music Queue Needs Help Action Hierarchy Design

Status: **Implemented.**

Date: 2026-08-01.

## 1. Problem

The safe add boundary already recognized collisions, quality stops, incomplete
audio checks, unreachable completed files, and unsafe add plans. The normal
Music Queue presentation still used both `Needs help adding` and `Needs help`,
however, and the release detail panel could make `Advanced diagnostics` appear
as the primary next action for review-only stops.

That made an otherwise simple state harder to scan and sent a household user
toward operator tooling before explaining the release-level problem.

The normal-path contract is:

`Needs help -> concise reason -> one release-scoped repair action`

Advanced diagnostics remains available for authorized troubleshooting, but it
is not the primary workflow.

## 2. Official Sources Reviewed

The following official sources were reviewed on 2026-08-01 against the
requested June 2026 baseline.

| Source | Design input |
| --- | --- |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | A status must be programmatically determinable and communicated without relying on color alone. The visible `Needs help` label and textual reason meet that requirement. |
| [W3C WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria/) | A non-urgent state update should use a status pattern; a destructive confirmation should use a real dialog only when acknowledgement is required. This change does not add a modal for a non-mutating review state. |
| [W3C APG Alert Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) | Focus-trapping alert dialogs are appropriate only when the user must respond. Review-only safe stops remain in the release detail panel instead. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Protected diagnostics must preserve deny-by-default and object-level authorization. The normal projection stays bounded, while the existing release-scoped diagnostics authorization remains unchanged. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep `Needs help adding` and a primary diagnostics button | Minimal code change. | Redundant wording, noisy hierarchy, and diagnostics become the apparent normal path. | Reject. |
| Make every stop a new public status code | Precise labels at the API level. | Couples internal add implementation detail to the client contract and creates unnecessary migration pressure. | Reject. |
| Retain `needs_help_adding` as the stable API code, present one `Needs help` label, and use the existing allow-listed repair data | Preserves compatibility, gives each stop a concise reason and action, and keeps protected diagnostics secondary. | The implementation must keep recovery codes tightly allow-listed. | Adopt. |

## 4. Final Recommendation Stack

### Normal Music Queue

- Keep `needs_help_adding` as the stable read-model status code.
- Present it as **Needs help** everywhere user-facing.
- Name the bounded safe-stop title in the release row, for example
  `Existing library files need review`.
- Keep the reason-specific release action as the primary action, such as
  `Review library conflict`, `Review audio quality`, or
  `Try audio check again`.
- Use the selected release detail as the first review surface.

### Release Detail

- For a manual stop, show the status separately from the repair title, safe
  explanation, and next step. Do not repeat the same explanatory paragraph in
  multiple sections.
- Keep the only state-changing repair action primary when one exists:
  folder setup or an audio recheck.
- Render `Advanced diagnostics` as a secondary link for every repair reason.

### Security

- Continue to construct normal UI text only from
  `music-queue-add-recovery-presentation.js` allow-listed values.
- Never use raw paths, filenames, source users, provider output, ffprobe
  output, or worker errors in the normal queue or Activity presentation.
- Keep existing fresh-session, CSRF, ownership, maintenance-lock, and safe
  preview checks on mutation routes. This UI change adds no mutation endpoint.

## 5. Implementation Outcome

- `needs_help_adding` now presents as `Needs help` while preserving the public
  status code used by existing read-model consumers.
- Music Queue release rows surface the bounded repair title for safe add
  stops, making the reason scannable before opening details.
- The review panel shows a repair's safe explanation only in the repair
  section, avoiding duplicate copy.
- `Advanced diagnostics` is always secondary within a repair panel.
- The terminal-recovery browser fixture now carries a realistic library
  collision repair object and verifies the normal row action opens the
  selected release rather than a candidate-first or diagnostics-first view.

## 6. Acceptance

- A collision, lossy decision, suspicious lossless result, incomplete audio
  check, source-path stop, unsafe plan, or stopped add projects one bounded
  `Needs help` release state.
- The release row presents one reason-specific action without raw diagnostic
  data.
- The release detail keeps diagnostics available, but not primary.
- Existing protected diagnostic routes and mutation authorization remain
  unchanged.

## 7. Next Step

Implement the remaining explicit manual `Add to library` confirmation only for
a freshly previewed, ownership-scoped, policy-compliant add plan. It should
remain unavailable for collisions, suspicious lossless claims, and other
unsafe stops.

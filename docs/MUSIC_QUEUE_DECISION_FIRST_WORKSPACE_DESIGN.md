# Music Queue Decision-First Workspace Design

Status: Adopted 2026-08-23

## Purpose

Music Queue is a release-triage workspace, not a dashboard of every automation
stage. Its default answer must be: **what needs an operator decision now, why,
and what is the safe next step?**

Automation remains visible as context, but it does not share the primary list
with releases that have an available operator action. This is a client-side projection over
the existing authenticated Music Queue read model; it does not change desired
state, provider state, acquisition policy, or release ownership.

## Research

Official W3C/WAI guidance was reviewed on 2026-08-23.

| Source | Finding | Design consequence |
| --- | --- | --- |
| [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html) | Labels should describe purpose. | Replace `Current work` and `Show` with `Actions` and `Show releases`. |
| [W3C Forms Tutorial: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/) | Related controls are clearer when grouped semantically. | Use a named native form for queue controls and visible labels for scope and search. |
| [W3C WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Focus order must preserve meaning and operability. | Future selected-release work will preserve Queue → release detail → Close/return orientation. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Supplementary detail belongs behind a native, stateful disclosure. | Keep technical evidence and diagnostics in the existing selected-release disclosure, not the normal list. |
| [W3C WCAG 2.2: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Dynamic outcomes need concise programmatic status. | Announce an explicit scope change once; do not announce every background polling update. |

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep `Current work` | Preserves the previous compact surface. | Mixes human decisions and automatic work, leaving the operator unclear about whether action is required. | Reject. |
| Default to every release | Complete with no scope switch. | Stable history, scheduled work, and active work bury urgent decisions. | Reject. |
| Decision-first scopes | Separates available actions from automatic work, keeps scheduled work reachable, and retains complete history. | A user intentionally changes scope to browse stable records. | Adopt. |

## Decision

The Music Queue scope model is mutually exclusive:

| Scope | Included release states | Default |
| --- | --- | --- |
| Actions | Failed, setup, terminal-match, quality, safe-add, and match-choice decisions | Yes |
| In progress | Searching, checking, downloading, retrying a candidate, and library-add work | No |
| Scheduled | Queued or retrying automatic searches | No |
| All releases | Every normalized release, including stable library records | No |

Each release belongs to one focused scope, while `All releases` intentionally
includes every release. This prevents a release from being silently hidden by
the new default.

The scope control includes a current count. Search and advanced filters still
refine the selected scope, while `Clear filters` clears only narrowing filters
and preserves the operator's chosen scope.

## Implementation Boundary

The foundation is deliberately modular:

- `music-queue-scope-presentation.js` owns operator scope classification,
  counts, headings, empty copy, and scope status text.
- `music-queue-filter-presentation.js` owns query, type, state, and scope
  filtering for the normalized client read model.
- `acquisition-pipeline-presentation.js` retains normalization and detailed
  acquisition/review presentation. It no longer owns Music Queue list filters.
- `MusicQueueView.vue` consumes the focused modules and provides named native
  form controls plus a scope-change-only status announcement.

This creates no new endpoint, mutation, or data persistence path. Existing
release actions retain fresh-session, CSRF, authorization, and release-scoped
server validation.

## Final Recommendation Stack

1. Ship the decision-first scope foundation and explicit labels.
2. Next, make the unselected list full width and render the review inspector
   only for a selected release.
3. Then normalize the row to one route-level action and implement
   history-aware selected-detail focus handling.
4. Keep advanced filters and diagnostics as deliberate secondary tools.

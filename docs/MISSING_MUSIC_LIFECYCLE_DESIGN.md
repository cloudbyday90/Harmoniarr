# Missing Music Lifecycle Design

Date: 2026-08-25

## Decision

`Missing music` is the operator's selection-gap workspace. It shows releases
that have been selected for an artist but are not fully in the library. A
confirmed **Start search** action creates the existing request handoff into
Music Queue. Music Queue owns search, matching, and recovery; Downloader
continues to own live transfer detail.

The durable `library_wanted_releases` projection must be derived from the
same effective release-group selection and desired-state policy used by artist
reconciliation. It must not independently reconstruct selected releases with
ad-hoc SQL.

## Lifecycle and ownership

```text
Artist selection
  └─ Missing music: selected release is not fully in library
       └─ Start search (confirmed)
            └─ Music Queue: search, candidate choice, recovery, library add
                 └─ Downloader: live transfer detail while a transfer exists
                      └─ Library: complete
```

Each surface has one primary question:

| Surface | Primary question | Primary action |
| --- | --- | --- |
| Artist detail | What music is selected? | Change selection and save it. |
| Missing music | Which selected releases are absent or incomplete? | Start search. |
| Music Queue | What is Harmoniarr doing next, or what choice is required? | Take the one stated action. |
| Downloader | What is actively transferring? | Inspect or control a transfer when supported. |
| Library | What is present and usable? | Browse and manage acquired music. |

## Research basis

- [WCAG 2.2, 2.4.6 Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
  requires headings and labels that describe their topic or purpose. This
  supports `Missing music`, `Selected releases`, `Not in library`, and
  `Some tracks missing` over ambiguous labels such as `Wanted` or `Partial`.
- [WAI-ARIA Authoring Practices: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  advises against automatic tab activation when panel loading is noticeable.
  The future Music Queue scopes (`Next steps`, `In progress`, `Downloads`)
  should therefore use route/query navigation, not ARIA tabs, unless their
  panels are already available without latency.
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  calls for CSRF defenses on state-changing requests. A page or URL change
  must never start a search; the existing session-, permission-, and
  CSRF-protected mutation remains behind explicit confirmation.
- The official [Servarr Wiki source for Sonarr settings](https://github.com/Servarr/Wiki/blob/master/sonarr/settings.md)
  describes associating a download request with a download-client category and
  monitoring those associated downloads. Harmoniarr should retain the same
  release-to-work correlation without copying controls that the local provider
  cannot safely support.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep a standalone SQL wanted projection | Simple query; no service boundary work. | Duplicates selection policy, misses explicit choices, and drifts from reconciliation. |
| Derive the projection from effective desired state | One authoritative selection contract; explicit overrides work; policy gates remain testable. | More modular reads and bounded per-artist projection work. |
| Merge Music Queue and Downloader immediately | One apparent work area. | Hides the difference between release workflow and file transfer diagnostics; high UI and route churn. |
| Keep Music Queue and Downloader separate with explicit handoffs | Clear task ownership; preserves transfer diagnostics; matches current local-provider capabilities. | Requires disciplined labels and deep links. |

## Recommended stack

1. **Authoritative desired-state projection** — implement now. Build
   `library_wanted_releases` from effective release selection, desired-state
   policy, and library reconciliation.
2. **Clear Missing Music language and confirmed handoff** — implement now.
   Explain the selected-library gap and name the next action `Start search`.
3. **Direct selection command** — next. Allow an operator to select a release
   from Missing Music only through the existing saved artist snapshot and
   reconciliation path; do not write a bare selection record.
4. **Music Queue scope navigation** — after the command is complete. Expose
   `Next steps`, `In progress`, and `Downloads` as URL-backed views, with
   standard links until instant panel activation is demonstrably available.
5. **Downloader consolidation decision** — defer. Keep Downloader as the
   live-transfer specialist until a unified release view preserves its
   diagnostics and safe controls.

## Security and integrity requirements

- Preserve server-side authorization, ownership checks, and CSRF validation on
  all state changes. Client copy and query parameters are not authority.
- Do not add a direct Missing Music write endpoint that calls the low-level
  release-group selection store. A selection must create the normal durable
  snapshot and reconciliation run so downstream work is auditable and
  idempotent.
- Treat a metadata artist disappearing during projection as a benign refresh
  race. Surface all other errors rather than silently producing an incomplete
  global projection.
- Keep projection fan-out bounded. The initial service processes at most six
  artists concurrently, avoiding an unbounded metadata/database burst in a
  home-hosted deployment.

# Metadata continuing-page focus visibility

Consulted and designed October 21, 2026. This implements the next item in the
[panel outcome](METADATA_HISTORY_PANEL_OUTCOME.md); source selection and tradeoffs
are in the separate [research document](METADATA_HISTORY_VISIBILITY_RESEARCH_2026_10.md).

## Problem and ownership

Appending ten detection events moves the surviving Load more history button below
the viewport. The previous native diagnostic found keyboard focus at y=3124.56
in a 1280x720 viewport. Restoring focus with preventScroll preserves that failure.
Checking activeElement alone also misses a button that retains focus while moving.

Keep the existing page-generation and user-focus ownership checks after Vue's
DOM flush. Only a successful current continuing page may reveal its invoker.
Restore focus without automatic centering, then request immediate nearest-edge
scrolling in both axes. Native nearest alignment leaves a fully visible target
in place. Recheck currency, interaction ownership and actual focus after focus()
because synchronous focus handlers can redirect focus or retire the result.

Keep the final-page destination at the surviving history heading. Failure and
current cancellation retain their existing retry-focus behavior. Stale/no-op
results, disabled/detached targets and a user's move elsewhere cannot scroll.
The shared command tracker and server/API authorization remain their existing
owners; this read-only presentation adjustment grants no command authority.

## Layout and module boundaries

The existing small ESM useMetadataHistoryFocus composable owns the policy. Avoid
a global scroll manager, DOM observers, timers or another singleton. The history
panel owns a scoped scroll margin for its button, using existing spacing and
mobile navigation tokens, including safe-area inset. The shell's normal padding
already supplies scrollable clearance. Do not change scrolling across every view
as part of this local fix. The heading's completion behavior stays unchanged.
Use the heading's existing two-pixel accent focus cue on the button too; the
old native control displayed a one-pixel browser outline. Two pixels is the
project convention, not a claim about the minimum WCAG Focus Visible criterion.

## Verification plan

First retain a failing native keyboard regression on the old client. Qualify ten
initial plus ten appended entries at desktop and mobile widths, including bottom
navigation clearance and visible focus. Compare an already-visible empty
continuing page's scroll position before/after; do not call a scrolling test API
after the response when checking the application's result. Hold a native GET
while the user focuses another input and verify both focus and scroll position.
Retain final completion, retry, selection/abort and command-authority consumers.

Unit controls cover retained focus, stale/no-op outcomes and synchronous focus
redirection/invalidation. Run one stable complete fast gate, then the preserved
no-cache Docker walkthrough. Freeze source before browser builds and compare
client artifacts with the final build and packaged image. No release or branch
creation is part of this work. Record executed evidence and limits separately.

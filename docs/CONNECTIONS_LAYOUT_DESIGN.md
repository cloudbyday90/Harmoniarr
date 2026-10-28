# Connections layout design

October 28, 2026. Implements the next [saved-authorization item](PROVIDER_AUTHORIZATION_STATUS_OUTCOME.md).
See [research](CONNECTIONS_LAYOUT_RESEARCH_2026_10.md),
[outcome](CONNECTIONS_LAYOUT_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_CONNECTIONS_LAYOUT_DESIGN.md).

The read-only baseline found mobile flex-basis=200px, field height=200px and
input height about 106px. A later base rule overrode the mobile basis rule.
Native Tab traversal found hidden/overlapping controls at desktop, tablet, mobile
and a short 320px reflow viewport. This is reproduced scope, not a complete audit.

Move shared form-row layout into a small stylesheet loaded after the design
system. Preserve desktop wrapping/density. Place mobile rules after the base:
column direction, stretch alignment, content-sized fields and zero minimum inline
size. Retire superseded rules rather than adding another view override.

Keep save-bar styles in its component; retire global negative margins that assumed
panel padding. Use normal flow at <=640px width or <=600px height. Sticky bars
reserve their border-box height in the actual .hx-main scrollport's scroll padding,
plus breathing room and existing navigation clearance. A bar exceeding half the
scrollport uses normal flow so reading space remains available.

A small ESM DOM owner observes bar/scrollport size and window resize. Reservations
are scoped by scroll element; overlapping mounts reserve the largest active
height. Retiring an older owner must preserve newer space. Restore prior inline
value/priority only while still owned; preserve unrelated later writes. Disconnect
observation, remove the exact listener and suppress late callbacks. Render updates
also refresh measurement, including the no-observer fallback. Do not introduce
focus handlers, scrollIntoView interception or scripted focus restoration.

Verify wrapping/tall feedback, action changes, resize, fallback, overlapping owners
and retirement. Built checks must use native Tab/Shift+Tab without per-step
corrective scrolling, preserve dirty drafts, cover shared consumers/themes/
viewport boundaries and actual native tab zoom. Controlled save failures remain
browser-local; no operator setting/provider authorization is changed.

Finish focused review before a frozen complete fast gate. Rebuild the preserved
walkthrough and compare packaged identity before retaining unchanged native proof.
Manual AT/device work remains deferred. Main only; commit/push all without release,
Git tag, PR merge or additional deployed service.

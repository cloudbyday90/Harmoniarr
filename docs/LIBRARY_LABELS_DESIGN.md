# Library label design

October 28, 2026. See [research and tradeoffs](LIBRARY_LABELS_RESEARCH_2026_10.md).

SettingsLibraryView owns 24 new native label associations: source-safety cooldown,
three retention controls, seven ranking weights, nine audio/trust thresholds and
four naming templates. Preserve five existing explicit associations and the two
wrapping checkbox labels. IDs remain unique within the single mounted route.

Reuse SettingsFormGroup inside the existing retention wrappers for Operation runs
and Outcome events. Their existing titles become legends. Preserve both Max age
(days) labels, identifying each field through its named group. No new generic input
component, singleton, dependency, focus handler or CSS owner is needed.

The existing form composable continues to own drafts, resets and JSON saves.
Preserve all numeric constraints, v-model bindings, warning/help copy and input
types. Do not add name attributes or alter server settings, cleanup scheduling,
session/CSRF, acquisition or filesystem authority. No migration, schema refresh or
maintenance task is required. First-party JavaScript remains ESM.

Browser proof opens all six disclosures, checks all 29 field associations and
accessible names, document ID uniqueness, label activation, retention-group context
and cooldown disabled/enabled behavior. Exercise both themes at desktop, tablet,
mobile and short reflow sizes, native Tab/Shift+Tab and actual 400% tab zoom.
Preserve local drafts across activation, resizing and disclosure changes; verify
the ranking reset and native numeric range validity without submitting settings.
Block all fixture mutations and compare actual settings privately in the packaged
walkthrough. Replace source-only label assertions with behavior at this boundary;
retain unrelated native proof only after exact source/runtime comparison.

Manual screen-reader and physical-device acceptance remains deferred by the user.
The previous Connections textarea/navigation edge finding remains separate. These
checks do not establish complete WCAG conformance or live-provider qualification.

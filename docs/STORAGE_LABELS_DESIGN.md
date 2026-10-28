# Storage label and row design

October 28, 2026. See [official research and alternatives](STORAGE_LABELS_RESEARCH_2026_10.md).

SettingsMediaStorageView retains data loading, add/remove actions, the settings
draft, save command, folder recovery and quota lifetimes. Nine artwork fields gain
static route-owned label links. Four existing folder links remain.

SettingsDownloadMappingRow and SettingsUserMusicRootRow each own two native fields,
two required named string models, setup-time useId values, a remove event and a
native form group. Current row numbers identify visible groups and remove actions;
field identity is independent of that number. Existing card/row styles are reused.

createSettingsRowKey creates one WeakMap per view owner and returns a stable symbol
for each reactive row object. No key or ID is attached to saved form objects.
Replacing a row object deliberately creates a new render identity; editing its
fields or moving/removing another row preserves the surviving component and IDs.
The normalizers and server settings contract stay unchanged. No new dependency,
global registry, timer, schema refresh, migration or maintenance job is needed.
All JavaScript is ESM.

Browser proof uses synthetic settings responses scoped to the browser. Cover
existing rows, edits, preceding-row removal, duplicate blank additions, both row
types, names/groups/ID uniqueness, label activation, keyboard/reflow behavior and
actual 400% zoom. Distinguish a controlled programmatic preceding-row removal
while another input owns focus from a person's pointer removal of its own button.
Inspect one locally fulfilled failed settings PUT for current CSRF and canonical
row keys; do not forward it. Preserve drafts and compare actual server settings
privately before/after the packaged walkthrough. Never publish paths, cookies,
credentials or request bodies as evidence.

The scope does not change filesystem authorization, provider commands or save
replay. Manual screen-reader and physical-device checks remain deferred. Record
unresolved focus or layout findings separately instead of claiming full WCAG
acceptance. Existing native API/store evidence may be retained only after exact
source, test and packaged-runtime comparison.

Stable keys actually remove the invoking node rather than reusing another row's
button. removeSettingsRowWithFocus mutates synchronously, then uses the existing
focus tracker through nextTick. Only an interaction owned by the disappearing row
can move focus to a captured connected/visible next input, previous input or Add
button. A user move, refused removal or retired destination prevents that jump;
listeners retire on success or failure. Add-button refs stay view-owned. Browser
tests must prove visible focus for first/last/only-row removals of both types, and
unit checks cover ownership loss and failure cleanup.

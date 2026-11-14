# Folder buffer promotion design

November 14, 2026. See [research](FOLDER_BUFFER_PROMOTION_RESEARCH_2026_11.md),
[Astra review](FOLDER_BUFFER_PROMOTION_ASTRA_REVIEW.md) and
[outcome](FOLDER_BUFFER_PROMOTION_OUTCOME.md).

Change the service's local fixed directory buffer to 128. Keep existing public
responses, page/raw limits, four admissions, cooperative deadline, cursor signing,
metadata checks, error sanitization and close/publication ordering. Update benchmark
assertions to expect production 128 before deliberately substituting an independent
32 or 128 comparison variant. Keep the default algorithm lane's historical 32
explicit in reports and documentation.

A small ESM name-fixture module constructs long common-prefix ASCII, NFC, NFD and
supplementary-character names. Components stay within 255 UTF-8 bytes and Windows
component limits. Canonically equivalent forms have the same visible suffix and
remain distinct strings. Expected pages use an independent, bounded ordinal
model; never retain a whole 50,000-name expected array inside measured work.

Extend the existing owned fixture/runner rather than creating another framework.
The long-ceiling case has 50,000 directories; a small names case has 203 directories
and one ordinary file. Fixed concurrent pairs measure both buffers with sampling
on/off. Separate native controls exhaust and reverse small-case pages, check exact
names/paths and cursor boundaries, and exercise sanitized filesystem failures,
metadata change and controlled cooperative timeout. Existing lifecycle controls
retain fifth refusal, read/close cancellation and capacity reuse.

After all measurement/control consumers retire, a root-only owned-fixture step may
add one ordinary file to the ceiling directory. A fresh UID-1000/read-only consumer
then exercises actual 50,001-entry overflow through the production buffer without
allocating a second large fixture. No prior cursor or timing sample is reused after
this mutation. Cleanup removes the whole owned fixture only after actual container
retirement. All writes stay inside the UUID marker/canonical-containment boundary.
Fixture preparation and removal have a bounded 15-minute allowance for Windows
long-name filesystem work; consumer containers keep their two-minute outer bound
and the production service keeps its five-second cooperative deadline.

Apply PR #61's exact JSON/lock delta locally, without a merge. Compare published
old/new package files and transitive dependency declarations; preserve all other
lock entries. Refresh packaged parser/projection and embedded-cover controls.
Runtime inventory must report the changed parser rather than claim the package
tree is unchanged.

Build one immutable qualification candidate from the retained app image, changing
only the reviewed server module, root/installed package metadata and verified
parser archive. Preserve root ownership of program files and the unchanged nested
content-type dependency; replace obsolete upstream files rather than overlaying.
Retain the build recipe and compare complete packaged server/shared/client/OS and
dependency inventories. This deliberately avoids unrelated OS/runtime refresh in
the qualification image. The canonical Dockerfile remains available for a future
release build; this task creates no release or rollout. Preserve the existing
walkthrough's stopped state and private mounts.

Freeze source/package bytes after focused checks. Run one complete fast gate and
fresh native profiles serially, keeping CPU-heavy validation out of measurement
windows. Record actual resources, Node/npm/parser versions, source hashes, full
plans, refusals and cleanup. Retain unrelated evidence only with explicit unchanged
boundary and dependency review; do not claim fresh execution of historical groups.

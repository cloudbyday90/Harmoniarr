# Discover Recommendation Model Plan

Status: Accepted platform direction, implementation in progress
Last updated: 2026-05-30
Owner: Product + app architecture

## Purpose

This document defines how `Home`, `Discover`, monitored artists, and recommendation inputs should relate to each other.

It exists because the current implementation mixes two different concepts:

- artists the operator explicitly wants to monitor for releases
- artists temporarily used as recommendation graph inputs

That overlap produced confusing UX and unstable language such as `seed`, `followed`, and `monitored` referring to nearly the same thing.

The goal is to replace that ambiguity with one coherent model.

## Current Problem

Today, Discover behaves as if a monitored artist and a seed artist are the same thing.

That causes several issues:

- the UI implies users are managing a separate seed collection
- the recommendation graph language does not match the operator's actual intent
- Discover feels like a hybrid of recommendation browsing and graph curation
- Home and Discover do not have a clean responsibility split
- implementation details such as `seed` leak into user-facing copy

## Product Direction

The product should treat monitored artists as the canonical recommendation basis.

In plain terms:

- `Home` is where the operator's monitored artist profile lives
- `Discover` is where the operator evaluates recommendations and new candidates
- monitored artists are the default input set for recommendations
- Discover should not ask the user to manage a second persistent "seed" list

## Current Implementation State

As of 2026-05-30, the backend has moved past the original draft architecture in several important areas:

- operator-scoped policy tables now exist for artist monitoring, release-group selection, track overrides, and reconciliation snapshots
- artist-detail save orchestration persists policy and selection state through modular ESM services
- save-triggered reconciliation is queued through the existing operation-run system and coalesces repeated saves for the same operator and artist
- the older `metadata_artist_monitoring` table still exists for legacy read paths and compatibility during transition

The remaining product/design gap is primarily on the Home and artist-detail client surfaces:

- Discover now has the `+` add affordance and compact `Add artist` policy modal wired to operator policy save
- Home cards still need the policy, coverage, progress, and activity summary treatment
- artist detail still needs the draft editing, `Save` / `Cancel`, and override visibility experience

## Locked Design Choices

The following design choices are considered locked unless a later design review explicitly reopens them.

### Discover Is The Add Surface

- Discover is the place where operators find recommended artists and evaluate candidates.
- Discover should use a `+` add affordance rather than a literal `Monitor` button.
- Clicking `+` opens a compact `Add artist` modal.
- The add modal sets initial artist policy and adds the artist to the monitored profile shown in Home.

### Home Is The Canonical Managed Surface

- Home is the source of truth for monitored artists.
- Adding an artist from Discover should make that artist appear in Home immediately.
- Home should reflect both monitoring state and high-level policy.

### Artist Detail Is The Deep Curation Surface

- The artist detail page in Home is where deeper curation happens.
- It should be organized into sections by release type.
- Expected sections include:
  - Albums
  - EPs
  - Singles
  - Compilations
  - additional sections such as Live / Other later as needed

### Artist Detail Should Support Broad Catalog Management

- The artist detail page should support the full synced catalog context rather than an artificially narrow subset.
- Operators should be able to review everything that has been synced and then make more specific choices from there.
- The initial add flow stays compact; deeper management belongs in artist detail.

### Save And Cancel Are The Operational Boundary

- Edits made in artist detail are draft-only until `Save`.
- `Cancel` discards unsaved changes.
- No operational work should fire directly from toggling a checkbox or selection control.

### Save Triggers Background Reevaluation

- `Save` persists policy and selection changes.
- After save, Harmoniarr should trigger reevaluation through the background jobs system.
- The operator should be able to observe this operational activity under:
  - `Activity`
  - `Background Jobs`
- If no newly desired items were created, the job may still run and effectively no-op.

### Desired State And Deletion Are Separate

- Unchecking a release, single, or track changes future desired state only.
- Unchecking does not delete already acquired media.
- Deletion is a separate explicit action available from artist detail.

### Home Cards Should Show Coverage And Progress

- Home artist cards should show more than just a name and status badge.
- They should present a compact overview of the artist's managed catalog.
- The v1 card should stay intentionally compact and scan-first.
- Expected signals include:
  - a compact policy summary
  - one acquired-versus-desired coverage line
  - one lightweight activity line
  - a progress bar along the bottom of the card
- Detailed per-section counts belong in artist detail, not on the Home card surface.

### Manual Overrides Must Stay Visible

- Broad section policy should never silently hide local exceptions.
- If a section is broadly disabled but contains manually re-enabled releases or tracks, the UI must show that state explicitly.
- Manual overrides should be legible both while editing and after save.
- The product should favor clarity over silent convenience when broad policy and local exceptions differ.

### Harmoniarr Is Automation-First

- Harmoniarr should be designed as an automation-first system.
- Admin-managed artist monitoring should naturally feed automated workflows.
- Auto-approved user requests fit the same product philosophy.
- The first-pass add modal should favor future-oriented automation while avoiding surprise historical backfill.

## Canonical Terms

### Monitored Artist

An artist the operator has explicitly chosen to track for:

- current and upcoming releases
- wanted-state generation
- request and discovery workflow participation
- operational library workflows

This is a real product entity and should remain visible in `Home`, `Activity`, and other operational surfaces.

### Recommended Artist

An artist surfaced by Discover because the recommendation system inferred it from the current monitored artist profile.

This is a derived result, not a primary persisted entity.

### Recommendation Input

Internal-only algorithm term for an artist that contributes to the recommendation graph.

Default source:

- all monitored artists

This term may be useful in code and documentation, but it should not be the main user-facing label.

### Seed

This should be treated as a legacy implementation term.

Rules:

- remove it from user-facing copy
- avoid introducing new product behavior around it
- gradually replace it in code where practical

## UX Intent

### Home

Home should communicate:

- these are the artists currently shaping release monitoring
- this monitored artist profile also powers Discover recommendations

Possible supporting copy:

- "Your monitored artists power upcoming release tracking and recommendation discovery."

### Discover

Discover should communicate:

- these are recommended artists based on the monitored profile
- you can search, inspect, and promote recommendations into monitored artists

Discover should not communicate:

- that the operator is building a separate seed graph by hand
- that "followed" and "monitored" are two different long-lived states

## Core Behavioral Rules

1. All monitored artists are recommendation inputs by default.
2. Recommended artists are derived from monitored artists plus similarity sources.
3. Search results in Discover are candidate artists, not a second state container.
4. Monitoring an artist immediately makes it part of the recommendation basis.
5. Unmonitoring an artist removes it from the recommendation basis.
6. Discover should never require the operator to maintain a separate persistent seed list.

## Monitoring Mechanism

Adding an artist from Discover should be the durable promotion action into the operator's working set.

Mechanically, that means:

1. The operator evaluates an artist in Discover.
2. The operator clicks the `+` action.
3. The operator confirms initial policy in the `Add artist` modal.
4. The artist is added to the canonical monitored artist profile.
5. The artist appears in `Home` immediately.
6. The artist becomes part of the recommendation basis immediately.
7. Background metadata, release detection, and downstream acquisition workflows continue asynchronously.

Important distinction:

- `Add artist` does not mean `download now`
- `Add artist` means `start tracking this artist operationally with the selected policy`

This keeps Discover as an evaluation surface while Home remains the canonical surface for what the operator has actually committed to managing.

## Add Artist Interaction

The primary Discover add action should move away from a literal `Monitor` button and toward an add affordance that opens a compact policy modal.

Recommended interaction:

- artist card shows a `+` action
- the `+` action uses clear accessible labeling such as `Add artist` or `Add to monitored artists`
- clicking `+` opens an `Add artist` modal

The modal should be:

- fast for common cases
- transparent about what will happen
- flexible enough for operator policy choices
- intentionally not over-engineered

This is closer to the Sonarr/Radarr operator mental model:

- pick a candidate
- choose a small number of important rules
- add it to the managed system

## Add Artist Modal Goals

The modal exists to answer:

- what content types should be tracked for this artist?
- how broad should acquisition scope be?
- what quality or format profile should be preferred?
- should matching releases become wanted automatically?

It should not become:

- a full advanced settings page
- a raw codec matrix
- a place for deep track-level policy authoring

## Add Artist Modal Principles

1. Keep the first pass compact.
2. Expose only options the operator can understand later in Home.
3. Use profiles and plain-language descriptions before low-level technical controls.
4. Prefer a strong fast path with defaults plus optional adjustments.
5. Do not silently create user requests from this modal.

## Recommended Modal Structure

### Header

Display:

- artist name
- artwork
- concise supporting line such as:
  - "Add this artist to your monitored profile and choose how Harmoniarr should track releases."

### Section 1: Content To Track

This controls which release types participate in monitoring and downstream acquisition logic.

Recommended options:

- Albums
- EPs
- Singles
- Compilations
- Live

Recommended first default:

- Albums + EPs

Design note:

- use a checkbox group
- include a short description:
  - "Choose which release types from this artist should participate in monitoring and acquisition workflows."

### Section 2: Release Scope

This defines how far the monitored artist should reach into release coverage.

Recommended options:

- `Track only`
- `Future releases only`
- `Current and future releases`

Interpretation:

- `Track only`
  Track the artist, but do not automatically mark releases as wanted.
- `Future releases only`
  Only new releases from this point forward are eligible for automation.
- `Current and future releases`
  Existing missing releases plus future releases are eligible for automation.

This wording is preferred over vague labels such as `Nothing`, `All`, or `Future`.

### Section 3: Acquisition Profile

Quality and format should be expressed as named profiles first, not raw codec-level controls.

Recommended examples:

- `Lossless archive`
- `Balanced library`
- `High quality portable`
- `iPhone / iPad friendly`
- `Storage saver`

Each profile should include a short description.

Examples:

- `Lossless archive`
  Preserve the highest-quality versions for long-term library storage.
- `Balanced library`
  Keep a strong default balance between quality, compatibility, and storage usage.
- `High quality portable`
  Prioritize strong lossy formats with broad device compatibility.
- `iPhone / iPad friendly`
  Favor Apple-friendly playback formats and practical portability.
- `Storage saver`
  Minimize size while keeping acceptable playback quality.

Important design rule:

- if the backend cannot yet honor a profile meaningfully, the UI should not over-promise

### Section 4: Wanted Automation

This defines whether monitored releases should automatically become wanted.

Recommended options:

- `Do not mark wanted automatically`
- `Mark future matching releases as wanted`
- `Mark current and future matching releases as wanted`

This is intentionally framed in terms of `wanted`, not `request`, because operator automation is not the same as explicit user demand.

### Section 5: Defaults

The modal should support reuse without forcing repeated reconfiguration.

Recommended behavior:

- show that the current modal is using last-used or default settings
- allow the operator to save the current choices for next time

Recommended affordances:

- `Using your last add settings`
- optional checkbox:
  - `Use these settings next time`

This gives operators a fast path without removing transparency.

## First-Pass Modal Field Set

The first implementation should use a constrained set of operator-facing fields.

This is intentionally modeled after the official *Arr pattern:

- small add-time policy surface
- explicit monitoring/search behavior
- deeper curation deferred to item detail views

### V1 Field Table

| Field | Control | Allowed Values | Suggested Default | Why It Exists |
| --- | --- | --- | --- | --- |
| Content to track | Checkbox group | Albums, EPs, Singles | Albums + EPs | Gives operators immediate control over release-type breadth without requiring them to manage every release manually after add. |
| Release scope | Dropdown | Track only, Future releases only, Current and future releases | Future releases only | Makes the automation scope explicit and avoids surprising catalog-wide backfill by default. |
| Acquisition profile | Dropdown | Balanced library, Lossless archive, Apple friendly portable, Storage saver | Balanced library | Exposes quality/format intent through understandable presets instead of raw codec controls. |
| Wanted automation | Dropdown | Do not mark wanted automatically, Mark future matching releases as wanted, Mark current and future matching releases as wanted | Mark future matching releases as wanted | Keeps monitoring distinct from aggressive historical backfill while preserving Harmoniarr's automation-first posture. |
| Search now | Checkbox | On or Off | Off | Mirrors the official *Arr “start search for missing” pattern and lets operators opt into immediate backfill searches deliberately. |
| Use these settings next time | Checkbox | On or Off | On | Supports a fast operator workflow similar to Sonarr/Radarr without hiding the chosen policy. |

### Why These Fields, Specifically

These six fields are enough to cover the important operator choices without making Discover feel like a settings screen:

- what kinds of releases matter
- how far back the app should care
- what acquisition quality/format intent should be used
- whether matching releases should become wanted automatically
- whether an immediate search should run now
- whether the same choices should become the next default

### Why Other Fields Are Deferred

The following are intentionally out of scope for the first pass:

- raw codec or bitrate selection
- detailed custom format scoring
- desired-track selection
- indexer-specific routing
- tag-driven advanced policy
- explicit request creation

These all create more power, but they also make the add flow heavier and harder to explain. They belong either in advanced settings or on the artist detail surface once the artist has already been added.

## Default Policy Guidance

The suggested defaults above are intentionally future-oriented rather than historical-backfill-oriented.

Recommended default behavior:

- add the artist to the monitored profile
- sync artist metadata and releases
- track albums and EPs
- watch future releases by default
- mark future matching releases as wanted by default
- do not automatically trigger a historical search unless the operator explicitly asks for it

This keeps the first add experience transparent and safe while still letting operators broaden scope later from the artist detail surface.

## Artist Detail Follow-Up Model

The add modal should establish the artist's initial policy.

The artist detail view in Home should be the place where operators can later:

- include singles or other release types
- broaden release scope
- manually mark specific releases as wanted
- adjust policy after metadata sync completes

This preserves a clean division:

- Discover = add and choose initial policy
- Home artist detail = inspect and refine

## Editing And Deletion Principles

The product should explicitly distinguish between:

- changing what is desired
- deleting what already exists

That means the artist detail page should eventually support:

- selection controls for future desired state
- separate delete controls for already-present items

This protects operators from destructive surprises and keeps the mental model consistent.

## Official Pattern Reference

This design direction is intentionally aligned with official Servarr guidance as of May 2026:

- Lidarr add flow exposes add-time choices like monitoring state, quality profile, tags, and start-search behavior.
- Radarr guidance explicitly distinguishes add-time monitoring/profile/path choices from whether the app should search for older missing items immediately.
- Lidarr metadata and quality settings emphasize profile-based release-type and quality selection rather than forcing low-level codec choices at add time.

See:

- `Lidarr Quick Start` on the Servarr Wiki
- `Lidarr Settings` on the Servarr Wiki
- `Radarr FAQ` on the Servarr Wiki
- `Readarr Settings` on the Servarr Wiki

## What The Modal Should Not Include In V1

The first implementation should avoid:

- raw codec and bitrate matrices
- deep per-artist search tuning
- track-level desired-track authoring
- user-request creation controls
- too many advanced toggles with unclear downstream effects

Those can be introduced later if the backend and Home presentation can support them clearly.

## Home Visibility Requirement

Every meaningful choice made in the modal should be representable later in Home.

If an operator adds an artist with choices such as:

- Albums + EPs
- Future releases only
- iPhone / iPad friendly
- Mark future matching releases as wanted

then Home should eventually be able to summarize that policy in compact, understandable form.

Otherwise the modal becomes write-only configuration, which is not acceptable.

## Home Artist Card Information Hierarchy

The Home artist card should be optimized for fast operator scanning, not for full-detail presentation.

The card should answer:

- who is this artist?
- what is the current broad policy?
- how much desired media is already acquired?
- is anything active or needing attention?

### Layer 1: Identity

This is the recognition layer.

Expected content:

- artist artwork
- artist name
- optional compact status chip

### Layer 2: Policy Summary

This is the broad configuration layer.

Expected content:

- a compact policy summary line

Example:

- `Albums + EPs • Future • Auto-wanted`

This should be concise and scannable rather than a long metadata block.

### Layer 3: Coverage And Progress

This is the main operational scan layer.

Expected content:

- acquired versus desired release count
- optional small secondary counts such as wanted items or tracked section totals
- one progress bar along the underside of the card

The progress bar should represent:

- desired releases acquired / total desired releases

Coverage semantics:

- a release counts as `desired` if it is fully selected or partially selected
- a partially selected release is still part of the desired set because the operator has intentionally requested some of its content
- a release counts as `acquired` when all currently desired tracks for that release are present
- this allows partial releases to contribute meaningfully without forcing the Home card into track-level density

It should not attempt to represent:

- every known release in MusicBrainz
- every track-level selection
- every section independently

The progress bar should remain a coverage signal first, not a job-status widget.

Recommended visual behavior:

- default / healthy: steady accent fill against the existing sunken track
- syncing: same bar shape with a subtle animated sheen or pulse to indicate active work without changing the metric
- queued: same bar shape with no animation; job state is communicated by the status chip and activity line instead

This keeps the card visually consistent with the rest of Harmoniarr's quiet operational surfaces and avoids overloading one element with two meanings.

Example:

- `8 / 12 desired releases acquired`
- `3 wanted`

### Layer 4: Activity / State

This is a lightweight operational signal layer.

Expected content:

- sync in progress
- wanted items available
- background activity running
- no pending activity

This should remain secondary to identity, policy, and progress.

## Home Artist Card UX Principle

The card should be:

- scannable across many artists
- informative without becoming dense
- sufficient to tell the operator whether to drill into artist detail

The card should not attempt to expose every release-type count or every override detail on the surface.

Detailed breakdown belongs in artist detail.

### Recommended V1 Home Card Surface

The Home artist card should show:

- artist artwork
- artist name
- optional compact status chip
- one compact policy summary line
- one coverage line such as `8 / 12 desired releases acquired`
- one lightweight activity line such as `3 wanted`, `syncing`, or `no pending activity`
- one bottom progress bar

The Home artist card should avoid:

- per-section count grids
- multiple stacked status rows
- deep override details
- track-level statistics

### Home Artist Card Visual Direction

The Home artist card should visually align with Harmoniarr's existing dense ops-console language.

Recommended direction:

- use the existing `hx-card` / compact media-card idiom rather than a new bespoke tile style
- use one compact `hx-pill`-style status indicator, not a row of competing badges
- keep policy and coverage text in muted, scannable lines below the artist name
- use the existing accent and semantic token system for status tone rather than introducing new colors
- place the progress bar along the underside of the card as a quiet completion signal rather than a dominant chart element

This means the surface should feel visually related to:

- current Activity status pills
- existing artwork-first artist/release cards
- current compact operations and settings cards

Recommended v1 status labels:

- `Syncing`
- `Wanted`
- `Queued`
- `Healthy`
- `Attention`

These should map to the platform's existing semantic tones and remain secondary to the artist identity.

Recommended Home-card status priority:

1. `Attention`
2. `Syncing`
3. `Queued`
4. `Wanted`
5. `Healthy`

Reason:

- `Attention` is the only state that should interrupt normal scanning behavior
- `Syncing` represents work happening now
- `Queued` indicates committed follow-up work
- `Wanted` is informative but less urgent than active orchestration
- `Healthy` is the quiet resting state

The status chip should show the highest-priority active state only.

The secondary activity line should stay compact and factual, for example:

- `Running reconciliation`
- `Queued after save`
- `3 wanted`
- `No pending activity`

## Post-Save View Stability Principle

After `Save`, the artist detail page should remain spatially stable.

Recommended behavior:

- preserve the operator's current scroll position
- preserve expanded and collapsed section state
- preserve focus unless a validation or save error requires attention elsewhere
- show save feedback inline rather than jumping the viewport

Exceptions:

- if validation fails, move focus to the first invalid control
- if a blocking save error occurs, focus the inline error region or sticky action area

This matches the platform's dense workspace style better than auto-scrolling after every save.

## Artist Detail Editing Model

The artist detail view in Home should be the deeper curation workspace.

It should support:

- reviewing synced releases after metadata hydration
- refining artist-level policy
- selecting or unselecting releases and tracks
- saving or discarding changes intentionally
- explicitly deleting already-present media when needed

It should not behave like a page of live toggles that immediately fires background work on every click.

### Recommended Behavior

1. The operator opens an artist from Home.
2. Harmoniarr displays the synced catalog context: albums, singles, EPs, and related metadata as available.
3. The operator changes policy or selection state.
4. The page enters a dirty state.
5. `Save` applies changes and allows automation to proceed from the new state.
6. `Cancel` restores the last saved state.

### Dirty State Expectations

The artist detail view should make unsaved edits clear.

Expected UX:

- visible `Save` action
- visible `Cancel` action
- obvious dirty-state indication once edits exist

### Save Feedback Expectations

Save feedback should fit Harmoniarr's current compact inline status language rather than introducing a large banner pattern.

Recommended behavior:

- use a compact inline success pill or status note near the sticky action area
- keep the message factual and short
- let the running / queued job state become the longer-lived confirmation

Recommended examples:

- `Saved`
- `Saved • Running reconciliation`
- `Saved • Latest save queued`

Avoid:

- full-width celebratory banners
- modal confirmations for normal save success
- toast-only confirmation with no persistent inline state

## Manual Selection Model

The current direction implies a layered workflow:

- Discover add flow sets initial artist policy
- Home artist detail refines that policy and allows more specific selection

Examples:

- an operator may add an artist with `Albums + EPs`
- later, from artist detail, the operator may decide a specific single should be desired
- that single should only become operationally relevant after `Save`

This allows Harmoniarr to be automation-first while still supporting deliberate manual curation.

## Selection Hierarchy Model

Artist detail should support selection at three levels:

1. section level
2. release level
3. track level

### Section Level

Sections group the synced catalog by release type.

Examples:

- Albums
- EPs
- Singles
- Compilations

Section-level actions should support bulk draft operations such as:

- `Select all`
- `Clear all`

These actions affect draft state only until `Save` is used.

Section policy sets the broad default for everything in the section.

If a section is disabled broadly:

- all items in that section are disabled by default
- the operator may still manually re-enable specific releases or tracks inside that section
- those local exceptions become explicit manual overrides

### Release Level

Each release should be selectable as a whole.

Selecting a whole release means:

- the release is desired
- all tracks within that release are desired by default

Unselecting a whole release means:

- the release is not desired
- its tracks are not desired unless the operator later changes them in draft state

### Track Level

Tracks provide precision overrides within a release.

This allows operators to:

- keep the whole release selected
- remove specific tracks they do not want
- or select only specific tracks when taste requires it

Track-level edits remain draft-only until `Save`.

Track-level selection should be treated as an override layer, not a separate top-level policy system.

## Release Selection States

Each release should support three visible states:

### Unselected

Meaning:

- the release is not desired
- no tracks are currently selected

### Selected

Meaning:

- the whole release is desired
- all tracks are selected

### Partial

Meaning:

- some but not all tracks are selected
- the release is in a custom selection state

This `Partial` state is important because it reflects real operator taste and avoids forcing the user into an all-or-nothing album model.

Recommended expansion behavior:

- a release becoming `Partial` should not auto-expand permanently or move the viewport
- if the operator directly caused the transition by editing tracks, the release may stay open in that moment
- otherwise partial releases should remain collapsed until intentionally expanded

Reason:

- automatic expansion across many releases would create visual noise
- the platform's current dense workspace design favors stable layout over surprising movement
- explicit expansion keeps the detail surface readable at scale

## Selection Inheritance Rules

The recommended inheritance rules are:

1. Selecting a whole release selects all tracks by default.
2. Unselecting one or more tracks from a selected release moves that release into `Partial`.
3. If all tracks in a release become unselected, the release becomes `Unselected`.
4. If all tracks in a release are selected again, the release returns to `Selected`.

These rules should be reflected visually in the release row or card state.

## Section Policy Override Rule

Section policy should behave as the broad default layer, not as an absolute prohibition.

That means:

- disabling a section disables all items in that section by default
- operators can still enter the section and manually re-enable specific releases or tracks
- manual exceptions remain valid draft choices until saved

This is intentionally similar to the *Arr-style operator model:

- broad policy first
- explicit exceptions second

This is especially important for noisy categories such as Singles, where the operator may want the section broadly disabled but still want to select a few specific items manually.

## Bulk Action Rules

Bulk actions should apply at the section level and update draft state clearly.

Recommended initial behavior:

- `Select all` in a section selects all releases and tracks in that section
- `Clear all` in a section clears all releases and tracks in that section

Recommended design principle:

- section bulk actions should overwrite draft selection within that section
- they should not try to preserve hidden partial exceptions automatically

This is clearer for operators than trying to merge bulk actions with older partial choices invisibly.

### Bulk Action Confirmation Rule

Bulk actions should not confirm by default.

Recommended behavior:

- normal section-level `Select all` / `Clear all` should feel immediate in draft state
- confirmation is only needed when the action affects a large amount of content and would be difficult to visually recover from quickly

Recommended threshold direction:

- no confirmation for ordinary section operations that remain easy to inspect and undo before `Save`
- confirmation for unusually large bulk changes, especially when they affect many releases and tracks at once

Reason:

- draft state plus `Cancel` already provides a recovery path
- constant confirmation prompts would make the deep-management surface feel heavy
- selective confirmation preserves speed while still guarding against high-impact mistakes

## Override Visibility Principle

Manual overrides should be visually obvious in artist detail.

Recommended indicators:

- section-level exception count such as `3 manual overrides`
- release-level `Partial` state
- track-count summary for partial releases
- section subtitle patterns such as `Disabled by default • 3 overrides`

If a section is broadly disabled but has local overrides, the section header should communicate that clearly.

Recommended interaction model:

- section headers show broad policy plus override count
- release rows use tri-state selection semantics (`Unselected`, `Selected`, `Partial`)
- partial releases show compact counts such as `5 / 12 selected`
- track lists stay collapsed by default and expand on demand
- previously cleared or disabled items remain selectable again when the operator intentionally re-enables them

Recommended visual treatment:

- use indeterminate checkbox state plus a compact `Partial` pill for partial releases
- keep exception counts in muted section metadata rather than high-contrast warning banners
- reserve warning/danger tones for real operational issues, not normal override usage

Recommended section-header copy pattern:

- primary title remains simple: `Albums`, `Singles`, `EPs`
- mixed policy state lives in the muted metadata line below or beside the title

Examples:

- `18 releases • Enabled by default`
- `12 releases • Disabled by default`
- `12 releases • Disabled by default • 3 overrides`
- `7 releases • Enabled by default • 2 partial`

This stays visually consistent with the platform's current use of compact subtitles and meta lines.

## Save Reconciliation Model

When `Save` is pressed, Harmoniarr should treat the artist as a reconciled desired-state graph rather than only applying the last changed checkbox.

That means:

- artist policy is saved
- release selections are saved
- track selections are saved
- the system recomputes desired state for the artist as a whole
- the background jobs system then reevaluates what action, if any, is needed

This model is much easier to reason about than trying to process every control independently in real time.

## Save Orchestration Principle

`Save` may reasonably trigger multiple operational steps, but those steps should be staged and conditional rather than brute force.

Expected orchestration model:

- always persist policy and selection changes
- always recompute desired state for the artist
- conditionally refresh metadata if needed
- conditionally queue searches for newly desired missing items

Expected duplicate-aware checks before queueing new searches or requests:

- already imported library items
- Harmoniarr active queue state
- download-client queue state
- recent app or client history where practical

This means a save operation can fan into multiple background-job phases while still doing nothing destructive when no new action is required.

Operational evidence for this work should appear in:

- `Activity`
- `Background Jobs`

Recommended operator-facing contract:

- the UI should show one artist-level reconciliation job
- implementation may internally stage metadata refresh, desired-state recompute, and search enqueue sub-steps
- no-op saves are normal and should complete cleanly rather than warn unnecessarily

## Save Cooldown And Requeue Principle

Saving artist detail should behave like snapshot-based orchestration rather than a live mutable job.

Rules:

- each `Save` captures the desired state at that moment
- a running reconciliation job continues processing its saved snapshot
- if the operator saves again while a job is running, a follow-up reconciliation job is queued for that artist
- already-importing or already-processing content from the previous snapshot is allowed to finish
- if that content is no longer desired after the newer save, the operator can remove it explicitly through delete actions in artist detail

To avoid queue spam, the system should apply a per-artist cooldown / coalescing rule:

- if no reconciliation job is running and no same-artist follow-up job is pending, enqueue a job immediately on `Save`
- if a same-artist job is already running, allow exactly one pending follow-up reconciliation job
- if another `Save` happens while that follow-up job is already pending, cancel and replace the pending follow-up snapshot rather than queueing unlimited duplicate jobs

This preserves operator intent, avoids hidden cancellation behavior, and keeps background-job volume operationally sane.

Operator-facing expectations:

- the currently running reconciliation remains visible as `Running`
- the replacement follow-up appears as `Queued`
- only one queued follow-up is shown for the artist at a time
- the queued follow-up represents the latest saved snapshot, not every intermediate save
- the queued follow-up is artist-level / global for that artist, not tied to a single release row

Recommended operator-facing wording:

- running job label: `Running`
- queued follow-up label: `Queued`
- compact secondary text: `Latest save queued`

The queue UI does not need to explain internal snapshot replacement mechanics in the primary label.
If more detail is exposed in drilldown, it can say that the queued run reflects the latest saved changes for the artist.

## Related Intent Domains

The product needs to keep three separate concepts distinct.

### Monitoring Domain

Monitoring is operator-level supply intent.

Meaning:

- "Keep this artist under observation"
- "Track current and upcoming releases"
- "Feed release-oriented operational workflows"

This is long-lived state and belongs to:

- Home
- release radar
- wanted-generation logic
- operational library workflows

### Request Domain

Requests are user-level demand intent.

Meaning:

- "Someone explicitly wants this release or track"

This is separate from monitoring.

A request:

- may come from a requester
- may come from an operator acting on behalf of another user
- should remain explicit and auditable
- should not be silently created by Discover's `Add artist` action

### Desired Track Domain

Desired tracks are fine-grained acquisition intent.

Meaning:

- "Within this artist or release context, these exact tracks matter"

This is not the same as:

- monitoring an artist
- requesting a full release

Desired tracks should act as precision-level acquisition rules or overrides rather than replacing either monitoring or requests.

## Relationship Between Adding, Requests, And Desired Tracks

These concepts should answer different product questions.

- `Add artist`
  What should Harmoniarr start watching under operator policy?
- `Request`
  What does a person explicitly want?
- `Desired tracks`
  What exact media should be acquired within a release?

The system should always be able to answer:

- Why is this artist being tracked?
- Why is this release being pursued?
- Why are these specific tracks wanted?

If those answers collapse into the same state, the model becomes ambiguous and harder to explain in the UI.

## Automation Contract

Harmoniarr should be treated as an automation-first system, but automation is not a generic user toggle.

Instead:

- automation follows from saved monitoring and selection policy
- the right settings produce the right automation behavior
- the UI should describe concrete outcomes, not abstract "automation on/off" states

Examples of preferred wording:

- "Future releases will be tracked automatically"
- "Selected releases will be included after save"
- "Saving these changes updates monitoring and acquisition behavior"

Avoid vague wording such as:

- "Enable automation"
- "Turn automation off"

The more correct model is:

- policy is edited
- policy is saved
- automation follows from that saved state

## Immediate vs Deferred Effects Of Adding An Artist

### Immediate Effects

When the operator confirms `Add artist` in Discover:

- monitored state is persisted
- the artist appears in Home immediately
- Discover updates to `Already monitored`
- the recommendation basis expands immediately

### Deferred Effects

After monitoring succeeds, background work can continue:

- metadata hydration or refresh
- release detection
- wanted-generation policies
- discovery dispatch
- eventual slskd-oriented acquisition workflows

Those deferred effects should not be used as the boundary for whether the artist is considered monitored.

## Save And Cancel Boundary

Changes made inside the artist detail view should be draft state until the operator explicitly chooses to save them.

That means:

- checking or unchecking releases does not immediately trigger operational work
- changing artist-level policy does not immediately trigger operational work
- changing track-level desired state does not immediately trigger operational work
- `Save` commits the new state
- `Cancel` discards unsaved edits

This is the core execution boundary for the deeper curation surface.

Why this matters:

- no accidental searches
- no accidental wanted generation
- no half-applied state
- a clear and understandable editing model for operators

## Existing Media vs Desired State

Selection state and deletion must remain separate concepts.

Rules:

- unchecking a release, single, or track means it is no longer desired going forward
- unchecking does not delete already acquired media
- deletion must be a separate explicit action

This gives the product two clear meanings:

- `Unchecked`
  Stop treating the item as desired or monitored in that scope.
- `Delete`
  Remove already-present media from the managed library.

These actions must not be conflated.

## Screen Responsibilities

### Home

Primary responsibilities:

- display monitored artists
- show release-oriented operational value
- make clear that the monitored profile drives recommendations
- reflect newly monitored artists immediately, even while background sync work continues

### Discover

Primary responsibilities:

- search for artists
- show recommendation results
- explain why an artist is recommended
- allow promotion from recommendation candidate to monitored artist

Secondary responsibilities:

- artist detail drill-through
- evaluation of whether a candidate belongs in the monitored profile

## Recommended User-Facing Language

Replace:

- `Seed`
- `Followed artist`
- `Add as seed`
- `Seed match`

With:

- `Monitored artist`
- `Recommended artist`
- `Already monitored`
- `Recommended from your monitored artists`
- `Recommended from X monitored artists`

## Target Interaction Model

### Search Result

For an unmonitored artist:

- primary action: `+` opens `Add artist`
- secondary action: `View artist`

Mechanism:

- `Add artist` adds the artist to the Home monitored profile
- `Add artist` makes the artist part of the recommendation basis
- `Add artist` does not create a request
- the add modal applies default or operator-selected policy choices
- the artist then becomes eligible for deeper manual refinement later in Home

For an already monitored artist:

- primary state: `Already monitored`
- still allow detail drill-through

### Recommendation Card

For an unmonitored recommendation:

- show recommendation rationale
- allow `+` to open `Add artist`

For an already monitored recommendation:

- show `Already monitored`
- no duplicate promotion action

### Monitored Artist Band In Discover

This should be reframed as:

- "Monitored artists"
- "These artists currently shape your recommendation graph."

Not:

- "Followed artists"
- "Seeds"

## Architecture Direction

### Short-Term Approach

Keep the current underlying graph mechanics, but change the product contract:

- Discover hydrates from monitored artists
- user-facing terminology removes seed semantics
- graph logic remains recommendation-oriented, not seed-management-oriented

### Medium-Term Approach

Rename client-state concepts where useful:

- `seeds` -> `recommendationInputs` or `monitoredInputs`
- `suggestions` -> `recommendations`
- `addSeed()` -> `addRecommendationInput()` or a hydration-specific method

### Long-Term Approach

If needed, support temporary filtering of the recommendation graph by a subset of monitored artists without creating a second persistent entity.

Important distinction:

- temporary graph filtering is acceptable
- a second persistent "seed profile" is not the target direction

## Acquisition Policy Principle

Monitoring should not automatically be defined as an explicit request.

Recommended principle:

- monitoring creates observation plus eligibility for automation
- requests create explicit demand priority
- desired tracks create precision-level acquisition constraints

This preserves a clear separation between:

- operator supply management
- user demand
- track-level specificity

## Proposed Implementation Phases

### Phase 1: Product Language Alignment

Goal:

- remove user-facing seed terminology

Work:

- update Discover copy
- update badges and button text
- update aria labels
- update summary cards
- update helper text in Home and Discover

### Phase 2: Discover Behavior Alignment

Goal:

- make Discover clearly recommendation-first

Work:

- ensure Discover always hydrates from monitored artists
- ensure monitored artists are visibly the recommendation basis
- ensure search results only represent candidate artists
- ensure add-to-monitored is the one durable promotion action
- introduce the compact add-artist policy modal

### Phase 3: Internal Naming Cleanup

Goal:

- reduce architectural confusion in code

Work:

- rename composable state and helper names where safe
- reduce legacy `seed` usage
- keep compatibility where refactor churn would be disproportionate

### Phase 4: Recommendation Explainability

Goal:

- improve trust in Discover results

Work:

- show recommendation source overlap
- show "recommended because" text
- expose monitored-artist overlap counts more clearly

### Phase 5: Artist Detail Editing Contract

Goal:

- make Home artist detail the clear deep-management surface

Work:

- define draft editing behavior
- define `Save` / `Cancel` interaction
- define desired-state vs delete-state behavior
- define how saved changes trigger downstream automation

## Expected File Areas

Likely client-touch points:

- `src/client/views/HomeView.vue`
- `src/client/views/DiscoverView.vue`
- `src/client/composables/useDiscoverGraph.js`
- `src/client/composables/useMonitoredArtists.js`
- `src/client/composables/useArtistMonitoring.js`
- `src/client/lib/discover-presentation.js`
- `src/client/components/media/DiscoverArtistCard.vue`

Likely test-touch points:

- `test/client/useDiscoverGraph.test.js`
- `test/client/discover-graph.test.js`
- `test/browser/operator-ui-smoke.test.js`

Likely low or no backend impact:

- similarity API
- monitored artist API
- metadata monitoring mutation path

## Acceptance Criteria

The redesign should be considered complete when all of the following are true:

1. Discover has no user-facing `seed` terminology.
2. Home clearly acts as the monitored artist source of truth.
3. Discover clearly treats monitored artists as the recommendation basis.
4. Search results in Discover do not imply a separate persistent seed state.
5. Monitoring an artist updates both Home and Discover consistently.
6. Refreshing Discover preserves the monitored-artist basis immediately.
7. Recommendation cards explain their relationship to the monitored profile.
8. `Add artist` in Discover is clearly understood as an operational tracking action, not a request action.
9. The product model distinguishes monitoring, requests, and desired-track intent explicitly.
10. The add action in Discover is compact, transparent, and does not feel over-engineered.
11. The add modal gives operators meaningful content, scope, quality-profile, and wanted-automation choices.
12. Artist detail edits do not trigger operational changes until `Save` is used.
13. `Cancel` reliably discards unsaved artist-detail edits.
14. Unchecking desired items does not delete already-present media.
15. Deletion is a separate explicit action from changing desired state.
16. Home artist cards communicate policy, coverage, progress, and activity without becoming visually dense.
17. The Home progress bar measures desired releases acquired rather than total known catalog size.
18. Broad section policy and local manual overrides can coexist without hiding exceptions.
19. `Save` creates one artist-level reconciliation job and avoids duplicate queueing against known queue or history state.

## Resolved Decisions And Remaining Open Items

Most decisions in this section are now accepted platform direction. Items marked `later` are intentionally deferred rather than undecided.

### Decision 1: Should Discover use all monitored artists by default?

Recommendation:

- yes

Reason:

- simplest mental model
- strongest consistency with Home
- avoids duplicate state

### Decision 2: Should Discover allow temporary filtering by a subset of monitored artists?

Recommendation:

- yes, later

Reason:

- useful for narrowing recommendations
- should be introduced only as a temporary filter, not a persisted alternate profile

### Decision 3: Should recommendation rationale be visible on every card or only on demand?

Recommendation:

- lightweight rationale on every card
- deeper rationale on artist detail or expanded state

### Decision 4: How automatic should acquisition be for monitored artists?

Decision:

- monitoring should create observation plus eligibility for automation
- request creation should remain explicit
- desired-track rules should remain a separate precision mechanism
- first-pass defaults should allow future matching releases to become wanted, but should not trigger historical search unless explicitly requested

This means the product still needs a clear policy boundary for when monitored releases become wanted or downloadable.

### Decision 5: Which add-artist options are required in the first implementation pass?

Recommended first-pass modal fields:

- content to track
- release scope
- acquisition profile
- wanted automation
- search now
- use these settings next time

Deferred:

- raw format tuning
- advanced search policy
- desired-track authoring
- request creation

### Decision 6: How should manual overrides be surfaced on the Home card?

Recommendation:

- keep Home compact
- do not show deep override breakdown on the card
- only surface override detail indirectly through policy wording such as `manual overrides` when needed

Reason:

- override detail is important but becomes noisy quickly
- the artist detail page is the correct place for exact exception visibility

### Decision 7: Should the `Save` workflow appear as one job or multiple jobs?

Status:

- resolved and implemented as one artist-level reconciliation run with internal orchestration

Decision:

- one artist-level job in the operator-facing UI
- internal staged orchestration behind the scenes

Reason:

- simpler mental model
- cleaner Activity surface
- still allows implementation to split sub-steps internally

### Decision 8: When should bulk actions require confirmation?

Recommendation:

- do not confirm normal section operations
- confirm only unusually large bulk changes

Suggested first-pass threshold:

- confirm when the action affects more than `25` releases or more than `250` tracks in one step

Reason:

- below that threshold, draft-state review plus `Cancel` is usually enough
- above that threshold, the visual and operational impact is large enough to justify an extra guardrail
- this keeps the workflow fast while still preventing obviously high-impact mistakes

### Decision 9: How should the sticky save area balance draft state vs job state?

Recommendation:

- use one shared sticky action area, visually aligned with the existing `cfg-save-bar` pattern
- show the newest relevant state, not every state at once

Recommended behavior:

- dirty and unsaved: show `Save` / `Cancel` plus draft-state messaging
- just saved and running: show compact inline success state such as `Saved • Running reconciliation`
- just saved and queued: show compact inline success state such as `Saved • Latest save queued`
- new edits while a reconciliation is still running: return primary emphasis to the new dirty state, while keeping the run state secondary

Reason:

- avoids stacking multiple competing status rows
- matches the platform's current compact save-bar pattern
- keeps the operator focused on the most actionable state

### Decision 10: Are section-level filters and sorting part of the first implementation pass?

Recommendation:

- not in the first pass
- revisit once real artist-detail catalogs show that default grouping is insufficient

Reason:

- the section / release / track hierarchy already introduces meaningful complexity
- adding filter and sort controls too early risks turning the artist detail page into another control surface before the core edit model is proven
- large-catalog pressure can be addressed later with evidence

### Decision 11: What exact enum values should the new artist-level policy fields use?

Status:

- resolved and implemented in `operator_artist_monitoring`

Decision:

- define a complete first-pass policy vocabulary up front rather than growing ad hoc strings later
- keep the enum set broad enough for current UX and likely near-term expansion

Recommended artist-policy fields:

1. `monitored_release_group_types`

Persisted as a text-array / set of release-type keys.

Recommended allowed values:

- `album`
- `ep`
- `single`
- `compilation`
- `live`
- `other`

Notes:

- `other` is the bucket for categories we do not yet want to over-model in v1
- this is broader than the current `album` / `ep` only implementation and matches the sectioned artist-detail direction

2. `release_scope`

Recommended allowed values:

- `track_only`
- `future_only`
- `current_and_future`

Meaning:

- `track_only`
  Track and sync metadata, but do not automatically widen desired state beyond explicit manual selection
- `future_only`
  Treat future matching releases as eligible for automation based on the rest of policy
- `current_and_future`
  Treat both already-known matching releases and future releases as eligible

3. `wanted_automation_mode`

Recommended allowed values:

- `manual_only`
- `future_matching`
- `current_and_future_matching`

Meaning:

- `manual_only`
  Desired state comes only from explicit operator selections
- `future_matching`
  Future matching releases may become wanted automatically
- `current_and_future_matching`
  Existing matching releases plus future matching releases may become wanted automatically

4. `acquisition_profile_key`

Recommended first-pass system keys:

- `balanced_library`
- `lossless_archive`
- `apple_friendly_portable`
- `storage_saver`

Notes:

- store the key, not the resolved text label
- keep room for future custom profiles without changing the artist-policy table shape

5. `search_on_add_mode`

Recommended allowed values:

- `none`
- `missing_now`

Meaning:

- `none`
  Save the artist and let normal automation handle future work
- `missing_now`
  Immediately enqueue search/reconciliation for already eligible missing items after add

6. `selection_source_mode`

Recommended internal-only allowed values:

- `policy_only`
- `policy_plus_overrides`

Purpose:

- internal clarity for whether an artist is still fully governed by broad defaults or already has explicit release/track overrides
- does not need to be exposed as a user-facing setting

Reason:

- this keeps the save/reconciliation pipeline explicit
- avoids inventing new ad hoc booleans every time the UI grows
- gives the database and API a stable contract early

### Decision 12: Should release-level persistence be keyed to release groups, canonical releases, or both?

Status:

- resolved and partially implemented through `operator_release_group_selection` and `operator_track_override`

Decision:

- use both, with different responsibilities

Recommended model:

- release-group level is the primary durable selection unit
- canonical-release level is the track-resolution and import-resolution unit

Why this matters:

- release groups are the most stable user-facing concept for `Albums`, `EPs`, `Singles`, etc.
- canonical releases can change as metadata improves, regions differ, or the operator switches the active release
- track-level partial selection needs a specific release tracklist context, which a release group alone cannot provide

Recommended persistence split:

1. release-group selection table

Purpose:

- store whether a release group is `unselected`, `selected`, or `partial`
- attach broad desired-state intent to the conceptual album / single / EP

Recommended keys:

- `metadata_artist_id`
- `metadata_release_group_id`

2. release-level resolution table or fields

Purpose:

- record which concrete release / pressing currently resolves the selected release group for track-level operations
- support canonical-release changes without losing the operator's higher-level intent

Recommended keys:

- `metadata_release_group_id`
- `metadata_release_id`

3. track override table

Purpose:

- store explicit per-track intent for partial releases
- tie those choices to a resolved track identity, not just a release-group shell

Recommended keys:

- `metadata_artist_id`
- `metadata_release_group_id`
- `metadata_release_id`
- stable track identity where available

Plain-language interpretation:

- the operator chooses the album concept at the release-group level
- Harmoniarr resolves that to a concrete release for track-level editing and import behavior
- if the canonical release changes later, the system should remap carefully rather than discarding the operator's album-level choice

This is the safest model for both user intent and metadata drift.

### Decision 13: Where should saved add-artist defaults live?

Recommendation:

- persist add-artist defaults per operator on the server side
- keep recommendation and monitoring data globally deduplicated at the artist / release level

Meaning:

- each operator can have their own default add policy
- the admin / system layer still deduplicates the underlying monitored-artist and recommendation data where different operators overlap
- overlap in artist intent should be shared where it makes operational sense, while policy defaults remain personal

Recommended storage direction:

- store add-policy defaults in per-user preference storage
- do not duplicate artist metadata or recommendation entities just because operators have different defaults

Reason:

- matches the user's expectation that defaults are personal
- avoids making the shared metadata graph fragmented by operator-specific preference copies
- keeps the admin side able to reason about overlap and shared similarity inputs

### Decision 14: Is monitoring global per artist or operator-scoped?

Status:

- resolved and implemented as operator-scoped policy in `operator_artist_monitoring`

Decision:

- operator-scoped policy and desired state
- shared backend media/storage layer where overlap exists

Meaning:

- each operator can monitor the same artist with different policy
- each operator's Home / Discover / artist-detail state may differ
- the backend may still reconcile shared metadata, release matching, and stored files across those overlapping intents

Implication:

- what one operator sees as available or desired may differ from what another operator sees
- the system should not force one operator's artist policy to overwrite another's

### Decision 15: How should multi-operator conflicts resolve for the same artist?

Recommendation:

- resolve to the common denominator at the shared-storage layer
- preserve operator-specific policy and access at the operator-facing layer

Meaning:

- if multiple operators want overlapping media, shared physical storage should be reused where possible
- if operators want different subsets or policies, each operator still sees their own intended state in the UI
- backend reconciliation may satisfy multiple operators from one imported artifact when the file / release identity is compatible

Recommended interpretation:

- policy conflict is not resolved by picking one operator as the winner
- policy conflict is resolved by:
  - keeping per-operator intent separate
  - sharing the underlying media artifact when safe
  - exposing operator-specific availability / desire through links, access, or ownership mapping

### Decision 16: What should delete mean in a multi-operator model?

Recommendation:

- delete should default to removing the operator's access / association, not blindly deleting the shared physical file

Meaning:

- if the media is still needed by another operator or shared policy path, the physical artifact may remain on disk
- delete from an operator workflow can mean:
  - remove from this operator's desired / available view
  - remove or detach this operator's association with the item
  - remove the physical file only when no remaining operator / shared workflow still needs it

Design analogy:

- think closer to hardlink-style shared ownership than single-owner destructive delete
- the operator-facing action should still read simply, but backend behavior must respect shared usage

Recommended UX implication:

- the UI may need distinct wording later for:
  - remove from my library / access
  - delete physical media

The first implementation pass can keep the user-facing action simple as long as the destructive physical-delete semantics are not incorrectly implied.

### Decision 17: How should partial track intent be normalized when releases change?

Status:

- resolved and partially implemented through `operator_track_override`

Decision:

- persist both the recording identity and the release-track identity
- treat the recording as the semantic song identity
- treat the track as the release-specific placement identity

Recommended normalization model:

1. release-group level

Store the operator's album / single / EP intent at the release-group level.

Purpose:

- stable conceptual selection target
- survives canonical-release changes better than a release-only model

2. release level

Store the currently resolved concrete release used for track-level editing and import behavior.

Purpose:

- provides the actual tracklist context
- supports canonical-release changes and pressing changes without losing the higher-level selection

3. track override level

Persist both:

- `recording_mbid`
- `track_mbid`

Plus local release context such as:

- `metadata_release_id`
- disc / medium position
- track position
- title / length snapshot where useful for remapping

Interpretation:

- `recording_mbid` answers: "which song / recording did the operator mean?"
- `track_mbid` answers: "which specific appearance of that recording on this release did the operator choose?"

Recommended remapping behavior on metadata or canonical-release change:

1. Prefer exact `track_mbid` match when the same release-track still exists.
2. If the canonical release changes or the exact track no longer exists, fall back to `recording_mbid` to find the equivalent song on the new resolved release.
3. If more than one track on the target release matches the same recording, use release context to disambiguate:
   - disc / medium number
   - track number
   - title
   - length
4. If remapping is still ambiguous, preserve the override in a review-needed state rather than silently picking the wrong track.

Reason:

- official MusicBrainz data treats recordings and tracks as different concepts
- recordings are the durable audio identity
- tracks are release-specific representations of those recordings
- using both gives the best chance of preserving user intent when metadata evolves

### Decision 18: What should the temporary compatibility projection be?

Recommendation:

- start with a plain SQL view for compatibility reads
- move to a refreshable summary / projection table only if measured workload shows the view is too expensive

Recommended first-pass choice:

- `CREATE VIEW` for legacy compatibility semantics

Recommended escalation path:

- if Home / Activity / admin overlap queries become too expensive under real operator-scoped load, introduce a rebuildable summary or materialized projection
- keep that summary as a derived read model, never as the canonical write target

Why this is the right default:

- PostgreSQL views are simple, transparent, and always reflect the latest canonical tables
- materialized views persist results and require explicit refresh strategy
- introducing a persisted summary too early adds refresh/invalidation complexity before we have evidence that we need it

Recommended compatibility responsibilities for the view:

- expose "monitored by at least one operator" semantics
- expose aggregate release-type participation
- expose shared refresh / overlap signals needed by older read paths

Recommended non-responsibilities:

- no policy writes
- no queued-snapshot ownership
- no operator-specific selection source of truth

Escalation trigger guidance:

- stay on the plain view while:
  - read latency is acceptable
  - query plans remain index-friendly
  - Home / Activity do not need heavy pre-aggregation
- introduce a summary/projection only when:
  - measured query cost is repeatedly high
  - admin overlap views need expensive repeated aggregation
  - the same derived counts are being recomputed often enough to justify persisted read models

Implementation principle:

- canonical tables first
- compatibility view second
- summary/materialized projection only by measured need

## Implementation Impact

The redesign is not only a presentation change. It will require new persisted artist-policy and selection state so the UI, reconciliation logic, and background jobs all operate from the same saved model.

### Client-Side Impact

Expected new or expanded client responsibilities:

- replace the current one-click `monitorArtist()` flow with:
  - import artist
  - open / submit add-artist policy modal
  - persist initial artist policy
- extend Home artist cards to show:
  - compact policy summary
  - desired-release coverage
  - artist-level job state
- extend artist detail from read-mostly discography browsing into:
  - draft editing state
  - section / release / track selection UI
  - sticky save / cancel area
  - inline save feedback
- add client state for:
  - dirty draft detection
  - snapshot comparison
  - current artist reconciliation run state
  - queued follow-up state

Likely client touch points:

- `src/client/views/DiscoverView.vue`
- `src/client/components/media/DiscoverArtistCard.vue`
- `src/client/composables/useArtistMonitoring.js`
- `src/client/views/HomeView.vue`
- `src/client/views/ArtistDetailView.vue`
- `src/client/lib/metadata-api.js`
- new artist-policy / artist-selection composables and presentation helpers

### API / Server Impact

The current metadata monitoring API only supports a small patch:

- `isMonitored`
- `monitoredReleaseGroupTypes`

That is not sufficient for the redesigned contract.

Expected server additions:

- expand artist monitoring / policy mutation support to include:
  - release scope
  - acquisition profile key
  - wanted automation mode
  - optional search-on-add behavior
- add an artist-detail save endpoint or extend the monitoring endpoint so one save can persist:
  - artist-level policy
  - release-level selections
  - track-level selections
  - save snapshot metadata
- add an artist-level reconciliation enqueue service that:
  - creates or updates one running / queued artist reconciliation operation
  - coalesces pending snapshots for the same artist
  - checks queue/history duplicates before new requests/searches are created

Likely server touch points:

- `src/server/routes/metadata-routes.js`
- `src/server/metadata/metadata-monitoring-service.js`
- `src/server/metadata/metadata-monitoring-store.js`
- `src/server/metadata/metadata-read-service.js`
- library wanted / discovery reconciliation services
- operation-run queue services already used by other background workflows

### Database / Migration Impact

The current implementation has already introduced the first-pass operator-scoped schema instead of extending `metadata_artist_monitoring`.

Implemented canonical tables:

1. `operator_artist_monitoring`
   - operator-scoped broad artist policy
   - includes `release_scope`, `acquisition_profile_key`, `wanted_automation_mode`, `search_on_add_mode`, and `selection_source_mode`

2. `operator_release_group_selection`
   - operator-scoped release-group selection state
   - persists `unselected`, `selected`, and `partial`

3. `operator_track_override`
   - operator-scoped partial-track intent
   - stores both release context and track / recording identity where available

4. `operator_artist_reconciliation_snapshot`
   - immutable saved snapshot used by background reconciliation
   - supports queued follow-up replacement after repeated saves

Still needed:

- move remaining legacy read paths off `metadata_artist_monitoring` or place a compatibility projection in front of them
- decide where saved add-artist defaults live, likely per-operator preference storage
- add `operator_library_item_access` or an equivalent access-link table before destructive delete semantics are exposed

Recommended persistence direction:

- keep artist policy and selection state normalized in relational tables
- avoid storing the entire artist-detail draft as one opaque JSON blob

Reason:

- wanted reconciliation, coverage summaries, and duplicate-aware job decisions will need queryable state
- normalized tables are easier to aggregate for Home cards and Activity
- partial selections become difficult to reason about if hidden inside unstructured JSON

### Comprehensive Schema Direction

The current one-row-per-artist monitoring model is not compatible with the locked operator-scoped design.

The redesigned persistence model should separate:

- shared metadata entities
- operator-specific policy
- operator-specific selection state
- shared physical media artifacts
- operator-specific access / ownership links

Recommended first-pass schema blueprint:

1. `operator_artist_monitoring`

Purpose:

- operator-scoped monitoring and broad artist policy

Recommended columns:

- `id UUID PRIMARY KEY`
- `app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`
- `metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE`
- `is_monitored BOOLEAN NOT NULL DEFAULT FALSE`
- `monitored_release_group_types TEXT[] NOT NULL`
- `release_scope TEXT NOT NULL`
- `wanted_automation_mode TEXT NOT NULL`
- `acquisition_profile_key TEXT NOT NULL`
- `search_on_add_mode TEXT NOT NULL DEFAULT 'none'`
- `selection_source_mode TEXT NOT NULL DEFAULT 'policy_only'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `last_reconciled_at TIMESTAMPTZ NULL`
- `last_saved_snapshot_at TIMESTAMPTZ NULL`

Recommended constraints:

- `UNIQUE (app_user_id, metadata_artist_id)`
- `CHECK` constraints for `release_scope`, `wanted_automation_mode`, `acquisition_profile_key`, `search_on_add_mode`, and `selection_source_mode`

Recommended indexes:

- `(app_user_id, is_monitored, updated_at DESC)`
- `(metadata_artist_id, updated_at DESC)`

Direction note:

- this supersedes the current global `metadata_artist_monitoring` table as the canonical policy model
- compatibility is still needed while older read paths depend on the global table shape

2. `operator_release_group_selection`

Purpose:

- operator-specific album / EP / single intent at the conceptual release-group layer

Recommended columns:

- `id UUID PRIMARY KEY`
- `app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`
- `metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE`
- `metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE`
- `selection_state TEXT NOT NULL`
- `resolved_metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL`
- `selection_source TEXT NOT NULL DEFAULT 'manual'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended constraints:

- `UNIQUE (app_user_id, metadata_release_group_id)`
- `CHECK (selection_state IN ('unselected', 'selected', 'partial'))`

Recommended indexes:

- `(app_user_id, metadata_artist_id, selection_state)`
- `(metadata_release_group_id)`

3. `operator_track_override`

Purpose:

- operator-specific partial-track intent for releases that diverge from full inheritance

Recommended columns:

- `id UUID PRIMARY KEY`
- `app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`
- `metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE`
- `metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE`
- `metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL`
- `recording_mbid UUID NULL`
- `track_mbid UUID NULL`
- `medium_position INTEGER NULL`
- `track_position INTEGER NULL`
- `track_title_snapshot TEXT NULL`
- `track_length_ms_snapshot INTEGER NULL`
- `is_desired BOOLEAN NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `remap_status TEXT NOT NULL DEFAULT 'resolved'`

Recommended constraints:

- require enough identity to remap safely:
  - `CHECK (recording_mbid IS NOT NULL OR track_mbid IS NOT NULL)`
- `CHECK (remap_status IN ('resolved', 'review_needed', 'orphaned'))`

Recommended uniqueness direction:

- one override row per operator + release-group + resolved track identity
- exact unique key may need to prefer `track_mbid` when present and otherwise fall back to `(recording_mbid, medium_position, track_position)`

4. `operator_artist_reconciliation_snapshot`

Purpose:

- persist the latest saved artist-detail snapshot for reconciliation and queued follow-up replacement

Recommended columns:

- `id UUID PRIMARY KEY`
- `app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`
- `metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE`
- `snapshot_revision BIGINT NOT NULL`
- `snapshot_payload JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Recommended constraints:

- `UNIQUE (app_user_id, metadata_artist_id, snapshot_revision)`

Scope note:

- this is one of the few places JSONB is appropriate because it stores the immutable saved snapshot used by a job
- JSONB is not recommended as the primary source of truth for ongoing policy or selection state

5. `operator_library_item_access`

Purpose:

- represent operator-specific access / ownership links to shared physical media

Recommended columns:

- `id UUID PRIMARY KEY`
- `app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`
- `library_file_id UUID NOT NULL` or equivalent canonical local-media reference
- `metadata_artist_id UUID NULL REFERENCES metadata_artists(id) ON DELETE SET NULL`
- `metadata_release_group_id UUID NULL REFERENCES metadata_release_groups(id) ON DELETE SET NULL`
- `metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL`
- `granted_reason TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Purpose note:

- this is the table that supports "remove from my view/library" semantics without necessarily deleting the shared file

Recommended constraints:

- `UNIQUE (app_user_id, library_file_id)`

6. Optional shared projection / summary tables

Purpose:

- speed up Home-card summaries and admin overlap views without making them the source of truth

Examples:

- operator artist coverage summary
- shared artist overlap summary
- operator-specific desired vs acquired counts

Recommended direction:

- keep these as rebuildable projections or summary stores, not canonical input tables

### Constraints And Type Strategy

Recommended database style:

- continue using UUID primary keys
- continue using `TEXT + CHECK` for evolving app-policy vocabularies
- use foreign keys aggressively for ownership and remap safety
- use partial / covering indexes where queue-state or active-run uniqueness depends on status

Inference from official PostgreSQL docs:

- PostgreSQL enums are suitable for static ordered sets, but this redesign is likely to evolve during implementation
- because the repo already favors `TEXT + CHECK`, that remains the safer first-pass fit here

### Active Reconciliation Job Uniqueness

The queued-save model needs database-backed deduplication.

Recommended direction:

- one running reconciliation per `(app_user_id, metadata_artist_id)`
- at most one pending follow-up reconciliation per `(app_user_id, metadata_artist_id)`

Implementation note:

- PostgreSQL partial unique indexes are the right fit when uniqueness should apply only to rows in active statuses such as `pending` or `running`

This aligns with the official PostgreSQL guidance that partial uniqueness should be enforced with a unique partial index rather than a regular unique constraint.

### Migration And Compatibility Strategy

Recommended transition strategy:

1. Introduce the new operator-scoped canonical tables first.
2. Migrate reads and writes to those canonical tables.
3. Keep the current global monitoring shape only as a compatibility projection while older code paths still depend on it.
4. Remove the old global table or compatibility layer once all callers have been moved.

Recommended position on the current `metadata_artist_monitoring` table:

- do not keep it as the long-term source of truth
- if temporary compatibility is required, convert its role into a derived summary / projection

Recommended compatibility forms:

- read-only SQL view when the shape can be expressed directly from canonical tables
- refreshable summary / materialized projection only if query cost makes a plain view impractical

Why this direction:

- a plain PostgreSQL view is not physically materialized and is appropriate for compatibility reads when performance is acceptable
- a materialized view persists results and can be refreshed later, which is useful only if the compatibility projection becomes too expensive to compute on demand
- neither should remain the primary write target for operator policy

Recommended derived meaning for a temporary global projection:

- "is this artist monitored by at least one operator?"
- "which release-group types are effectively in use across operators?"
- "what is the latest shared refresh state?"

That projection should support legacy read paths only. It should not be the place where new artist-policy writes land.

Recommended migration phases:

1. Schema phase

- add the new operator-scoped tables
- add new partial indexes / foreign keys / check constraints
- leave the current table in place

2. Dual-read phase

- introduce server services that read from canonical operator tables
- provide compatibility projection helpers for old global-monitoring callers

3. Dual-write or write-cutover phase

- move all new policy writes to operator-scoped tables
- stop treating `metadata_artist_monitoring` as canonical

4. Projection-only phase

- if still needed, expose old semantics through a derived view or summary store
- remove direct business logic dependencies on the old table

5. Removal phase

- remove the old table or projection once all callers and migrations are complete

Recommended implementation principle:

- prefer explicit code migration over long-term hidden compatibility layers
- use compatibility views/projections as temporary scaffolding, not as the final architecture

### Background Job Impact

No brand-new job framework is required.

Recommended direction:

- reuse the existing operation-run / background-job infrastructure
- introduce one artist-level reconciliation operation type for this workflow
- store the latest saved artist snapshot in the run summary / payload for processing
- allow one pending follow-up run per artist and replace it when a newer save occurs

This is preferable to inventing a second job system just for artist detail saves.

### Testing Impact

Expected new coverage areas:

- unit tests for:
  - policy normalization
  - release / track selection inheritance
  - save snapshot replacement logic
  - duplicate-aware enqueue decisions
- client tests for:
  - dirty state
  - partial release rendering
  - sticky save bar state transitions
- browser tests for:
  - add artist modal flow
  - artist detail save / cancel flow
  - queued follow-up replacement after repeated saves
- server tests for:
  - migration-safe persistence
  - reconciliation job coalescing
  - queue/history duplicate suppression

## Risks

- terminology cleanup without state cleanup may leave code harder to maintain
- internal renaming that is too aggressive may create unnecessary churn
- recommendation-source explanations may expose low-confidence ranking behavior if added before scoring is improved further

## Non-Goals

The following are not required for the first implementation pass:

- a separate recommendation-input persistence model
- a new backend recommendation service contract
- operator-customized long-term seed collections
- a full recommendation analytics dashboard

## Working Notes

- The current direction intentionally mirrors the *Arr pattern of broad monitoring defaults plus item-level exceptions, but keeps the Home card lighter than the full artist-detail surface.
- Duplicate-aware save reconciliation is required so artist-detail saves do not repeatedly request items already in queue, in history, or already acquired.

Use this section for incremental updates during implementation.

- 2026-05-25: Initial plan created. Direction agreed in conversation: monitored artists are the real durable concept; Discover should focus on recommended artists rather than a second seed state.
- 2026-05-25: Mechanism clarified. `Monitor` in Discover should add the artist to Home immediately, make it part of the recommendation basis immediately, and let metadata/release/discovery workflows continue asynchronously afterward.
- 2026-05-25: Product intent clarified. Monitoring, requests, and desired-track rules are separate domains and should not collapse into one state.
- 2026-05-25: Discover add interaction refined. Replace the literal `Monitor` button with a `+` add affordance that opens a compact policy modal, balancing operator choice with transparency and avoiding unnecessary complexity.
- 2026-05-25: Editing contract clarified. Artist detail changes should be draft-only until `Save`; `Cancel` discards edits; unchecking changes future desired state only; deletion is a separate explicit action.
- 2026-05-25: Selection model clarified. Artist detail should support section, release, and track hierarchy with `Unselected`, `Selected`, and `Partial` release states, plus bulk operations that update draft state only.
- 2026-05-25: Home card direction clarified. Cards should emphasize identity, policy summary, coverage/progress, and lightweight activity state rather than dense detail.
- 2026-05-25: High-level design choices locked. Discover is the add surface, Home is the canonical monitored surface, artist detail is the deep curation surface, `Save` triggers background reevaluation, and Home cards should summarize catalog progress and coverage.
- 2026-05-30: Plan aligned with implementation. Operator-scoped policy, release selection, track override, reconciliation snapshot tables, and save-triggered reconciliation services now exist; remaining work is centered on Discover/Home/artist-detail client surfaces and legacy monitoring read-path migration.

## Checklist

- [ ] Phase 1 terminology pass complete
- [x] Discover recommendation-basis copy updated
- [ ] Home monitored-profile copy updated
- [ ] No user-facing seed language remains
- [ ] Discover recommendation cards show monitored vs recommended correctly
- [ ] Browser regression test covers refresh after monitoring multiple artists
- [x] Discover `Add artist` action is implemented as promotion into Home's monitored profile
- [x] Monitoring vs request vs desired-track intent is reflected in product language
- [x] Add-artist modal field set is finalized for first implementation pass
- [x] Add-artist modal defaults strategy is finalized
- [x] Artist detail `Save` / `Cancel` contract is finalized
- [x] Desired-state changes vs delete behavior is finalized
- [x] Home artist card v1 content and layout is finalized
- [x] Save-triggered background orchestration contract is finalized
- [ ] Internal naming cleanup evaluated
- [ ] Follow-up scoring/explainability work planned

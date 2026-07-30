# Harmoniarr Implementation Task List

Implementation source: `docs/harmoniarr.md`
Security posture source: `docs/SECURITY_POLICY.md`
Backup and restore source: `docs/BACKUP_RESTORE_DESIGN.md`
Admin recovery source: `docs/ADMIN_RECOVERY_RUNBOOK.md`
Database model source: `docs/DATABASE_MODEL.md`

## Current Status (2026-05-23)

- Current validation baseline: 1534 server / 3087 client tests pass.
- Issue #4 is closed as a historical media-consumption re-scope ledger. New
  Music Queue and download/import workflow work is tracked in focused design
  documents, led by
  `ACQUISITION_PIPELINE_REDESIGN_PLAN.md`.
- Activity Imports and artist reconciliation recovery: fixed the blank
  `Activity > Imports` view by importing its shared formatter helpers, added a
  bounded one-shot self-healing path for failed operator artist reconciliation
  runs, and exposed a CSRF-backed Artist Detail `Retry reconciliation` action.
  See `ACTIVITY_IMPORTS_AND_RECONCILIATION_RECOVERY_DESIGN.md`.
- Request pipeline import-readiness surfacing: live walkthrough diagnosis
  showed wanted generation, discovery, candidate ingestion, provider enqueue,
  and transfer completion evidence were present, but completed files were not
  visible to Harmoniarr because download path mappings were empty. Activity >
  Imports now uses the import-pending summary, shows blocked/ready/warning
  counts, links path blockers to Media & storage, and deep-links candidates into
  Import Review for repair and apply. Browser coverage proves the blocked
  import-readiness handoff, and shared blocked-candidate runway copy now uses
  correct singular/plural wording. See
  `REQUEST_PIPELINE_IMPORT_READINESS_DESIGN.md`.
- Music Queue pipeline redesign planning: the former `Download candidates`
  experience is being redesigned around release progress instead of raw
  import-candidate review. The new plan defines release-centered statuses,
  button language, read-model phases, match drilldowns, setup blockers,
  candidate-scoped execution, safe library add, and walkthrough proof.
  Phase 0 now has a completed design/research/evaluation outcome covering the
  status/action contract, Activity boundary, quality profiles, candidate hiding
  rule, event payloads, match-attempt lifecycle, and walkthrough payload
  examples. Follow-up open questions are closed in
  `MUSIC_QUEUE_OPEN_QUESTIONS_DECISIONS.md`, locking Music Queue route
  ownership, Activity boundaries, default quality profiles, fallback/cutoff
  behavior, setup gates, auto-add policy, and diagnostics visibility before
  Phase 1. See `ACQUISITION_PIPELINE_REDESIGN_PLAN.md` and
  `MUSIC_QUEUE_PHASE_0_DESIGN.md`.
- Music Queue Phase 1 read model: added the read-only `src/server/acquisition/`
  module, status and quality policy services, authenticated Music Queue API
  routes, route inventory entries, client API/composable/presentation helpers,
  top-level `/app/music-queue` route, primary navigation, skeleton view, and
  focused tests. Phase 2 should now replace the visible candidate-first workflow
  with Music Queue match drilldowns while keeping Import Review as advanced
  diagnostics. See `MUSIC_QUEUE_PHASE_1_READ_MODEL_DESIGN.md`.
- Music Queue Phase 2 UX slice: Music Queue now has six user-facing summary
  buckets, search/state/type filters, release rows with reason, last activity,
  quality, progress chips, and next actions, plus a release details panel for
  match/quality review. Activity and Import Review copy now frame raw
  candidate tools as diagnostics instead of the primary download workflow. See
  `MUSIC_QUEUE_PHASE_2_UX_DESIGN.md`.
- Music Queue Phase 2 match drilldown: Music Queue now projects bounded
  release-scoped match summaries from existing Import Review evidence and shows
  simplified per-match cards with score, status, quality fit, track coverage,
  file count, size, and source-health hints. Raw provider payloads, source
  usernames, and folder paths stay in advanced diagnostics. See
  `MUSIC_QUEUE_PHASE_2_MATCH_DRILLDOWN_DESIGN.md`.
- Music Queue Phase 2 match actions: Music Queue now exposes release-scoped
  `Use this match` and `Reject match` controls in the match review panel. The
  routes require fresh session and CSRF, re-check the match belongs to the
  caller's wanted release before delegating to Import Review transitions, and
  refresh the release projection after success. See
  `MUSIC_QUEUE_PHASE_2_MATCH_ACTIONS_DESIGN.md`.
- Music Queue Phase 2 quality-choice review: quality profiles now expose
  cutoff, fallback, upgrade, and verification policy fields, and Music Queue
  details show release-level and per-match quality fit, including preferred,
  minimum, cutoff, fallback, audio-check, and spectral verdict context. This is
  read-only; fallback/try-again mutations remain the next Phase 2 slice. See
  `MUSIC_QUEUE_PHASE_2_QUALITY_CHOICE_REVIEW_DESIGN.md`.
- Music Queue Phase 2 Search again action: stopped releases now expose a
  release-scoped `Search again` / `Try again` action from the Music Queue
  details panel. The route requires fresh session and CSRF, re-checks release
  ownership before resetting discovery state, records bounded
  `musicQueueRediscovery` evidence, and starts or reuses the existing Library
  discovery dispatch operation. See
  `MUSIC_QUEUE_PHASE_2_SEARCH_AGAIN_ACTION_DESIGN.md`.
- Music Queue Phase 2 fallback-quality action: releases stopped at
  `Quality choice needed` for below-profile evidence now expose an audited
  release-scoped `Allow fallback quality` action. The route requires fresh
  session and CSRF, re-checks release ownership, persists a bounded
  `musicQueueQualityOverride`, records `quality_fallback_allowed` Activity,
  queues rediscovery, and keeps unverified lossless claims blocked for audio
  verification. See
  `MUSIC_QUEUE_PHASE_2_FALLBACK_QUALITY_ACTION_DESIGN.md`.
- Music Queue Phase 3 automatic match/download handoff: discovery dispatch now
  passes release quality profile and per-release fallback override evidence into
  automatic match selection. Auto-selection filters matches through the Music
  Queue quality policy before selecting exactly one high-confidence match, and
  the existing auto-download runner starts the candidate-scoped execution run
  only when quality is accepted. See
  `MUSIC_QUEUE_PHASE_3_AUTO_MATCH_DOWNLOAD_HANDOFF_DESIGN.md`.
- Music Queue Phase 3 failed-match retry: provider-enqueue and transfer-failure
  recovery now keeps the failed match terminal, carries bounded Music Queue
  quality context through candidate ingestion and browse enrichment, skips
  below-profile retry matches, promotes the next acceptable scoped match, and
  persists bounded skipped-match evidence in the existing execution snapshot.
  See `MUSIC_QUEUE_PHASE_3_FAILED_MATCH_RETRY_DESIGN.md`.
- Music Queue Phase 4 safe auto add handoff: completed download reconciliation
  now queues a safe automatic add-to-library operation through the existing
  import apply run service. Safe-auto runs process only clean `ready`
  import-pending candidates, leaving warning and blocked candidates for review,
  and reconciliation returns bounded start/skip evidence. See
  `MUSIC_QUEUE_PHASE_4_SAFE_AUTO_ADD_HANDOFF_DESIGN.md`.
- Music Queue Phase 4 verified quality auto-add gate: safe automatic
  add-to-library now rechecks ffprobe-backed audio evidence before moving files
  for strict `Lossless archive` releases. Missing probe evidence, lossy codecs,
  codec/extension mismatch, suspicious low-bitrate lossless evidence, and
  existing suspicious/transcoded spectral verdicts block safe-auto add while
  leaving the candidate available for review. See
  `MUSIC_QUEUE_PHASE_4_VERIFIED_QUALITY_AUTO_ADD_GATE_DESIGN.md`.
- Music Queue Phase 4 cached spectral pre-add proof: strict lossless safe-auto
  add now derives sampled content fingerprints, reuses cached spectral
  measurements, runs bounded ffmpeg spectral analysis on cache miss, stores raw
  measurements for threshold reclassification, and blocks safe-auto add when
  proof is suspicious, transcoded, inconclusive, unavailable, or failed. See
  `MUSIC_QUEUE_PHASE_4_CACHED_SPECTRAL_PRE_ADD_PROOF_DESIGN.md`.
- Music Queue and Activity surfacing: strict-quality safe-auto add stops now
  project back into Music Queue as `Quality choice needed`, record a sanitized
  `music_queue_quality_blocked` Activity event, and deep-link Activity back to
  the selected Music Queue release review. See
  `MUSIC_QUEUE_ACTIVITY_SURFACING_DESIGN.md`.
- Activity timeline navigation: `/app/activity` now opens a readable bounded
  event timeline with outcome filters, polite refresh/filter status, and clear
  Music Queue quality handoffs. The former twelve-tab workbench is preserved
  behind one `Advanced diagnostics` disclosure, without breaking diagnostic
  deep links. See `ACTIVITY_TIMELINE_NAVIGATION_DESIGN.md`.
- Activity advanced diagnostics boundary: match, library-add, and failed-add
  workbenches now use canonical `/app/activity/diagnostics/...` routes behind
  the Activity disclosure. Legacy candidate/import URLs redirect with their
  query and hash state intact, while Music Queue, Downloader, request detail,
  and notifications use friendly advanced-diagnostics or normal workflow
  handoffs. See `ACTIVITY_ADVANCED_DIAGNOSTICS_BOUNDARY_DESIGN.md`.
- Match diagnostics recovery-first entry: the advanced match workspace now
  leads with the selected match's automatic state and one safe repair. Raw
  source paths, file rows, collision checks, and uncommon transitions are
  disclosed, while direct diagnostic-file links still expand and focus the
  affected evidence. See `MATCH_DIAGNOSTICS_RECOVERY_FIRST_DESIGN.md`.
- Match diagnostics run-history controls: media checks, download dispatch, and
  add-to-library run workbenches now sit behind a collapsed native disclosure;
  direct run URLs expand it automatically, operator controls remain intact,
  and visible labels use match/download/library wording. See
  `MATCH_DIAGNOSTICS_RUN_HISTORY_CONTROLS_DESIGN.md`.
- Match diagnostics match finder: the previous fixed queue/filter rail is now
  one compact native `Search saved matches` disclosure. Direct candidate and file
  links keep their already-visible recovery target focused, while manually
  selecting another match closes the finder and returns focus to that recovery
  card. See `MATCH_DIAGNOSTICS_FIND_MATCH_TOOL_DESIGN.md`.
- Match diagnostics current automation: selected-match and pending-library
  summaries now live in a closed native `Current automation` disclosure with
  a Music Queue handoff. Status-only selected or pending-library links open it
  when useful; direct candidate/file links keep recovery focused. See
  `MATCH_DIAGNOSTICS_CURRENT_AUTOMATION_DESIGN.md`.
- Match diagnostics recovery focus: the default header now names the active
  recovery purpose instead of a visible-match count. Exact result totals remain
  within the optional `Search saved matches` disclosure, where they describe the saved
  result list being inspected. See
  `MATCH_DIAGNOSTICS_RECOVERY_FOCUS_DESIGN.md`.
- Match diagnostics saved-match search: status and folder text now form the
  short primary search, while recorded search references and source users are
  under `More filters`. Existing deep links reveal active source-detail
  filters automatically without changing route or API behavior. See
  `MATCH_DIAGNOSTICS_FILTER_HIERARCHY_DESIGN.md`.
- Music Queue Activity lifecycle: release-scoped history now shows a saved
  search-again action, retrying the same download, trying the next safe match,
  no-matches-left rediscovery, and terminal failures. Events use a bounded
  sanitized contract, stay under the Downloads filter, and link to Music Queue
  instead of exposing candidate or provider details. See
  `MUSIC_QUEUE_ACTIVITY_LIFECYCLE_DESIGN.md`.
- Music Queue progress strip: Home now surfaces active automated release work
  without an empty all-clear panel, while monitored Artist Detail provides a
  filtered per-artist status strip. Both use bounded rows and safe handoffs to
  Music Queue or setup, never raw provider details or inline mutations. See
  `MUSIC_QUEUE_PROGRESS_STRIP_DESIGN.md`.
- Music Queue Home focus: Home now shows only active automatic progress and
  releases that need help, omits idle and completed rows, and gives each row
  one direct `View details` handoff. See
  `MUSIC_QUEUE_HOME_PROGRESS_FOCUS_DESIGN.md`.
- Music Queue current-work focus: the main queue now defaults to releases
  moving automatically or needing help, keeps an explicit `All releases`
  option for stable records, and links to Activity History. See
  `MUSIC_QUEUE_CURRENT_WORK_FOCUS_DESIGN.md`.
- Music Queue status hierarchy: the list header now owns one concise current
  status, omits zero-value dashboard detail, and treats scheduled automatic
  search as a secondary `View scheduled releases` handoff. See
  `MUSIC_QUEUE_STATUS_HIERARCHY_DESIGN.md`.
- Music Queue quality-stop recovery automation: downloaded matches that fail
  strict safe-auto quality verification are now marked as quality failures,
  excluded from the recovery cascade, and followed by the next quality-eligible
  match when one exists. Music Queue now lets selected or queued next-match
  progress override stale quality-block evidence. See
  `MUSIC_QUEUE_QUALITY_STOP_RECOVERY_AUTOMATION_DESIGN.md`.
- Music Queue strict-quality release projection: the controlled-provider
  Docker proof now creates an operator-scoped wanted release, carries its
  authoritative ID through automatic discovery, and reads the actual Music
  Queue list/detail and Activity route after strict-quality exhaustion. A stale
  queued execution item no longer hides the quality stop, while a genuinely
  downloading fallback still takes precedence. See
  `MUSIC_QUEUE_STRICT_QUALITY_RELEASE_PROJECTION_DOCKER_EVIDENCE_DESIGN.md`.
- Music Queue shared-discovery correlation fan-out: a single metadata-release
  discovery request now links every active operator wanted release through a
  durable junction table. Request and wanted reconciliation preserve stable
  IDs with upserts, shared selection takes the strictest linked profile, and
  lifecycle Activity writes fan out safely to every linked release without
  storing account or per-operator policy data on candidates. See
  `OPERATOR_SHARED_DISCOVERY_CORRELATION_FANOUT_DESIGN.md`.
- Music Queue shared-discovery browser acceptance: selected release deep links
  now resolve through the scoped direct endpoint and return a generic normal
  unavailable state instead of an empty detail pane when the release is not
  visible to that session. A two-context browser journey proves separate
  operator sessions receive the same shared status, only their own Activity
  handoff, and reciprocal copied URLs disclose neither sibling IDs nor private
  policy markers. See `MUSIC_QUEUE_SHARED_DISCOVERY_BROWSER_ACCEPTANCE_DESIGN.md`.
- Music Queue file-backed Docker acceptance: a disposable production runtime
  now generates real lossless and MP3-derived FLAC fixtures, reconciles their
  completed transfers through persisted safe auto-add, and proves the genuine
  file is added while the disguised file is quality-blocked with Activity
  evidence. See `MUSIC_QUEUE_FILE_BACKED_DOCKER_ACCEPTANCE_DESIGN.md`.
- Music Queue release-progress browser acceptance: a deterministic browser
  scenario now proves one release moves from `Searching` through `Downloading`,
  `Ready to add`, `Adding to library`, and `In library` using only normal
  Music Queue and Downloader/Library handoffs. Candidate wording and the
  diagnostics route remain hidden until matching and quality details are
  deliberately expanded. Shared configured-provider browser fixtures remove
  duplicate health-route mocks from the focused Music Queue suites. See
  `MUSIC_QUEUE_RELEASE_PROGRESS_BROWSER_ACCEPTANCE_DESIGN.md`.
- Music Queue strict-quality recovery browser verification: a server recovery
  contract now proves an exhausted strict-quality failure creates no follow-up
  execution run, while a Docker-backed browser contract proves a failed match
  continues through `Trying another match` to `Downloading` when a safe next
  match exists. The exhausted branch remains `Quality choice needed` with a
  single review action, no Downloader handoff, and a release-scoped Activity
  link instead of raw candidate diagnostics. See
  `MUSIC_QUEUE_STRICT_QUALITY_RECOVERY_BROWSER_VERIFICATION_DESIGN.md`.
- Music Queue Activity repair handoffs: Activity now records release-scoped
  match selection, accepted transfer, audio inspection, download completion,
  library-add, and request-fulfillment milestones. Rows use one clear Music
  Queue, Connections, Library, or Request Detail handoff and do not expose
  source users, paths, or raw provider diagnostics. See
  `MUSIC_QUEUE_ACTIVITY_REPAIR_HANDOFFS_DESIGN.md`.
- Activity history initial-load browser verification: normal Activity and
  advanced System history now keep first-load state distinct from a genuine
  empty result, avoiding a false empty-history message on direct navigation or
  reload. Browser coverage proves fresh requests on reload plus filtered,
  release-scoped handoffs to Music Queue, Connections, Library, and Request
  Detail without diagnostic navigation. See
  `ACTIVITY_HISTORY_INITIAL_LOAD_BROWSER_VERIFICATION_DESIGN.md`.
- Managed slskd deployment foundation: the former standalone slskd example is
  now an optional Compose overlay with a one-shot configuration renderer,
  persistent app/download mounts, private provider networking, file-mounted
  API credentials, pinned provider image, and an external-provider escape hatch
  for existing Unraid/VPN deployments. A dedicated Docker smoke now proves the
  renderer, secure bundle extraction, IPv4-only provider bind, private
  authenticated API access, generated-config permissions, and cleanup with
  disposable credentials. See
  [Managed slskd Docker Smoke Design](MANAGED_SLSKD_DOCKER_SMOKE_DESIGN.md)
  and [Managed slskd Deployment Contract](MANAGED_SLSKD_DEPLOYMENT_CONTRACT.md).
- Settings progressive disclosure: Settings now starts with a concise setup
  checklist, keeps Soulseek health, folder locations, and library behavior in
  the primary flow, and moves specialist timing, provider, quality, retention,
  naming, security, and artwork controls behind accessible named disclosures.
  See `SETTINGS_PROGRESSIVE_DISCLOSURE_DESIGN.md`.
- Settings Connections hierarchy: Managed, External, and Disabled provider
  modes, their required configuration, saved Soulseek connection state, and
  `Test saved connection` now share one primary surface. MusicBrainz and media
  tooling remain available through a named supporting-service disclosure, so
  diagnostics do not compete with routine setup. See
  `SETTINGS_CONNECTIONS_HIERARCHY_DESIGN.md`.
- Soulseek provider-mode onboarding: Settings > Connections now makes Managed,
  External, and Disabled explicit. Managed deployments remain Compose-owned,
  external Unraid/VPN setups retain their URL and encrypted write-only key, and
  Disabled blocks provider clients and Downloader polling while preserving
  external credentials. See `SLSKD_PROVIDER_MODE_ONBOARDING_DESIGN.md`.
- Soulseek provider-mode recovery guidance: a missing Managed overlay now has
  a concise secret-filename checklist and the checked-in Compose start command;
  External mode links directly to Media & storage so completed-download mounts
  and path translations are configured in their existing home. See
  `SLSKD_PROVIDER_MODE_RECOVERY_GUIDANCE_DESIGN.md`.
- Soulseek provider-mode setup progress: the default Settings setup checklist
  now identifies a missing Managed overlay as an explicit deployment step and
  hands off only to Connections, while retaining generic runtime health states
  for every other provider condition. See
  `SLSKD_PROVIDER_MODE_SETUP_PROGRESS_DESIGN.md`.
- Music Queue provider repair context: Home and Music Queue now show one
  compact Connections handoff only when provider-dependent queued music is
  blocked by Disabled mode, incomplete Managed setup, External setup, or
  provider reachability. See `MUSIC_QUEUE_PROVIDER_REPAIR_CONTEXT_DESIGN.md`.
- Music Queue provider repair recovery confirmation: a Connections save reached
  from Music Queue now refreshes bounded provider health, reports eligibility
  without claiming a transfer, and uses only an allow-listed return context.
  See `MUSIC_QUEUE_PROVIDER_REPAIR_RECOVERY_CONFIRMATION_DESIGN.md`.
- Music Queue provider recovery visibility: returning after a verified
  Connections repair now performs one queue refresh, names only the first
  release already waiting for its normal search check, consumes the fixed
  return token, and does not dispatch a search or download. See
  `MUSIC_QUEUE_PROVIDER_RECOVERY_VISIBILITY_DESIGN.md`.
- Music Queue normal-cycle Activity visibility: a due automatic release now
  keeps a durable internal recovery marker while Soulseek is unavailable or
  needs setup. Once Soulseek accepts its resumed search, Harmoniarr consumes
  that marker and records one sanitized release event under Downloads. See
  `MUSIC_QUEUE_NORMAL_CYCLE_ACTIVITY_VISIBILITY_DESIGN.md`.
- Music Queue Activity event coalescing: the normal Activity timeline now
  condenses routine automatic search, match, download, and audio milestones
  into a bounded release story with a semantic disclosure. Final outcomes,
  attention states, retries, and explicit user actions remain visible, while
  raw durable events remain available to diagnostics. See
  `MUSIC_QUEUE_ACTIVITY_EVENT_COALESCING_DESIGN.md`.
- Activity information hierarchy: the normal Activity timeline now uses a
  labeled native filter select, a single header freshness cue, attention-only
  row badges, and a secondary Advanced diagnostics disclosure after the
  timeline. Desktop and mobile browser verification confirms the reduced
  hierarchy and retained repair filter. See
  `ACTIVITY_INFORMATION_HIERARCHY_DESIGN.md`.
- Music Queue release-row hierarchy: normal release rows now use one explicit
  state, release identity, bounded progress and quality facts, and one primary
  action. Quality verification stops remain visible without turning routine
  automatic progress into a chip-heavy diagnostics row. Desktop and mobile
  browser verification confirms the review handoff and no horizontal overflow.
  See `MUSIC_QUEUE_RELEASE_ROW_HIERARCHY_DESIGN.md`.
- Music Queue summary and filter hierarchy: six zero-heavy summary cards are
  replaced by one compact overview that prioritizes releases needing attention
  and active automatic work. Search remains directly visible while State and
  Type remain available behind an accessible Filters disclosure. Browser proof
  confirms the first release remains visible in the initial mobile viewport.
  See `MUSIC_QUEUE_SUMMARY_FILTER_HIERARCHY_DESIGN.md`.
- Music Queue waiting and empty-state hierarchy: provider repair remains the
  one setup handoff, scheduled work explicitly says that no action is needed,
  and a truly clear queue offers a calm explanation plus an optional Discover
  path. Desktop and mobile browser proof verifies these states remain distinct.
  See `MUSIC_QUEUE_WAITING_EMPTY_STATE_DESIGN.md`.
- Music Queue stopped-release recovery hierarchy: next-match and scheduled
  rediscovery states now explicitly continue automatically, while exhausted or
  failed searches open one focused recovery panel with a single retry action.
  The normal row does not duplicate the review action, and browser proof covers
  desktop and mobile recovery states. See
  `MUSIC_QUEUE_STOPPED_RELEASE_RECOVERY_DESIGN.md`.
- Music Queue selected-review hierarchy: the release detail panel now leads
  with current status and the next decision, keeps only actionable matches in
  the normal path, and moves aggregate match/quality evidence behind an
  accessible disclosure. Browser proof covers collapsed, expanded, desktop,
  and mobile states. See `MUSIC_QUEUE_REVIEW_HIERARCHY_DESIGN.md`.
- Music Queue match decision evidence: actionable match cards now show
  quality, format, and track coverage before their existing actions. Score,
  file count, transfer size, source health, and detailed quality evidence stay
  available through a per-card native `Match details` disclosure, while the
  outer advanced-evidence surface retains its full card content. Browser proof
  covers keyboard activation and mobile overflow. See
  `MUSIC_QUEUE_MATCH_DECISION_EVIDENCE_DESIGN.md`.
- Music Queue release action feedback: match, retry, and fallback-quality
  results now remain inside the selected release review instead of becoming
  page-wide banners. One bounded release-keyed record announces working and
  successful actions politely, announces failures assertively, and leaves
  focus on the initiating control. See
  `MUSIC_QUEUE_RELEASE_ACTION_FEEDBACK_DESIGN.md`.
- Music Queue release-row transition clarity: successful scoped mutations now
  apply their authoritative returned release projection before the bounded list
  refresh. Recognized automatic states show one compact `Up next` explanation
  in the release row, while attention, complete, and unknown states do not
  receive inferred automation copy. See
  `MUSIC_QUEUE_RELEASE_ROW_TRANSITION_CLARITY_DESIGN.md`.
- Local Docker system alert hardening: repeated operator alerts on mostly
  unconfigured walkthrough stacks now collapse by root cause, metadata refresh
  operation retries can reacquire released job leases safely, and wanted-release
  reconciliation compares MusicBrainz text release dates through an explicit
  date-normalization expression instead of `text >= date`. See
  `SYSTEM_ALERT_HARDENING_DESIGN.md`.
- Provider prerequisite gating: automatic Library discovery dispatch now checks
  slskd dependency readiness before reading discovery snapshots or queuing
  operation runs. Missing slskd setup records a non-alerting `setup_required`
  heartbeat hint, while unavailable/degraded slskd remains an operator-paused
  condition. See `PROVIDER_PREREQUISITE_GATING_DESIGN.md`.
- Docker provider setup-state browser verification: packaged-runtime browser
  smoke now proves a clean unconfigured slskd walkthrough has no operator alert
  noise, Discovery dispatch reports a setup-required heartbeat, Downloader
  renders setup guidance, and the disabled Downloader page does not keep polling
  the provider-backed queue. See
  `DOCKER_PROVIDER_SETUP_STATE_BROWSER_VERIFICATION_DESIGN.md`.
- Metadata refresh idle dependency gating: clean walkthrough verification found
  MusicBrainz unavailability could still surface as a topbar alert even when no
  monitored artists were due for refresh. Metadata refresh now checks due work
  before probing MusicBrainz, while still pausing when a due artist exists and
  MusicBrainz is unavailable. See
  `METADATA_REFRESH_IDLE_DEPENDENCY_GATING_DESIGN.md`.
- Walkthrough connection-settings readiness: the local walkthrough Compose stack
  now provides a disposable `HARMONIARR_SECRET_ENCRYPTION_KEY` fallback so
  Settings can store encrypted provider credentials without manual env setup.
  Settings > Connections also exposes a saved-provider `Test connection` action
  backed by the existing dependency-health read model, shows toast feedback for
  the saved Soulseek connection result, and includes a healthy Soulseek
  descriptor in the provider-health row. The walkthrough docs call out the
  local-only key and write-only API-key behavior.
- Metadata canonical release materialization: metadata artist refresh now
  materializes one bounded canonical MusicBrainz release candidate for each
  policy-selected monitored release group before queuing operator artist
  reconciliation. This resolves the local Docker "artist is monitored but
  Downloader stays idle" gap where release groups existed but no canonical
  releases could feed desired-state planning. See
  `METADATA_CANONICAL_RELEASE_MATERIALIZATION_DESIGN.md`.
- Library discovery dispatch handoff observability: Wanted now shows discovery
  queue readiness, latest dispatch-run outcome, and a CSRF-backed `Run
  discovery now` control so operators can see and start the handoff from wanted
  releases to Soulseek search, Import Review candidates, and Downloader
  activity. See
  `LIBRARY_DISCOVERY_DISPATCH_HANDOFF_OBSERVABILITY_DESIGN.md`.
- Discovery dispatch execution handoff browser verification: added a
  deterministic browser scenario proving the Wanted `Run discovery now` action
  sends a CSRF-backed dispatch request, refreshes latest-run state, and exposes
  the downstream Import Review candidate created by the dispatch. See
  `DISCOVERY_DISPATCH_EXECUTION_HANDOFF_BROWSER_VERIFICATION_DESIGN.md`.
- Discovery dispatch result transparency: Wanted rows now summarize per-release
  discovery outcomes from existing dispatch evidence, including candidates
  produced, no-candidate cooldowns, failures, exhausted searches, and queued
  states without exposing provider secrets. See
  `DISCOVERY_DISPATCH_RESULT_TRANSPARENCY_DESIGN.md`.
- Wanted discovery candidate deep links: candidate-producing Wanted rows now
  expose an `Open candidates` handoff into Import Review filtered by the
  dispatch `sourceSearchId`, without routing provider secrets or adding a new
  privileged read path. See
  `WANTED_DISCOVERY_CANDIDATE_DEEPLINK_DESIGN.md`.
- Wanted Import Review workflow-state correlation: candidate-producing Wanted
  rows now include a bounded status aggregate from matching Import Review
  candidates, showing states such as pending review, selected for download,
  downloading, ready to import, failed, or applied without exposing raw provider
  payloads. See `WANTED_IMPORT_REVIEW_WORKFLOW_STATE_DESIGN.md`.
- Downloader correlation from Import Review execution: Wanted rows now derive a
  bounded download-execution summary from persisted Import Review execution
  items, showing whether selected candidates were blocked, failed before
  enqueue, or accepted by Downloader without polling slskd or exposing raw
  transfer payloads. See
  `DOWNLOADER_CORRELATION_FROM_IMPORT_REVIEW_EXECUTION_DESIGN.md`.
- Downloader import-candidate linkage: live Downloader rows now correlate
  persisted Import Review execution enqueue evidence back to the candidate that
  created the transfer. The row and diagnostics drawer expose `Open candidate`
  handoffs without exposing raw provider payloads, paths, or execution
  snapshots. See `DOWNLOADER_IMPORT_CANDIDATE_LINKAGE_DESIGN.md`.
- Downloader linked-transfer browser verification: added a focused Chromium
  scenario proving a linked Downloader row and its diagnostics drawer both hand
  off to the selected Import Review candidate. The scenario also hardened the
  native diagnostics drawer open path. See
  `DOWNLOADER_LINKED_TRANSFER_BROWSER_VERIFICATION_DESIGN.md`.
- Import Review Downloader transfer handoff: live execution transfer rows now
  expose `Open in Downloader`, routing to the matching Downloader transfer
  details drawer through bounded query state. See
  `IMPORT_REVIEW_DOWNLOADER_TRANSFER_HANDOFF_DESIGN.md`.
- Downloader stale-transfer handoff notice: direct Downloader transfer links
  now explain when the linked transfer is no longer visible in the live queue
  and let the operator clear only the handoff query state. See
  `DOWNLOADER_STALE_TRANSFER_HANDOFF_NOTICE_DESIGN.md`.
- Import Review transfer sync notice: execution detail now explains completed,
  failed, temporarily missing, and stale in-progress transfer summaries when no
  live Downloader row is available to open. See
  `IMPORT_REVIEW_TRANSFER_SYNC_NOTICE_DESIGN.md`.
- Import Review completed-download apply handoff: the apply runway now explains
  when completed downloads are ready to import, and browser coverage proves the
  path from completed transfer evidence to a queued import apply run. See
  `IMPORT_REVIEW_COMPLETED_DOWNLOAD_APPLY_HANDOFF_DESIGN.md`.
- Import Review apply-to-Library handoff: completed apply runs now show a
  bounded `Open Library` action that lands on the complete-release Library view,
  and browser coverage proves the applied release renders through the Library
  read model. See `IMPORT_REVIEW_APPLY_LIBRARY_HANDOFF_DESIGN.md`.
- Library discovery JSONB parameter casting: Library discovery evidence writes
  now cast placeholders passed into PostgreSQL `jsonb_build_object`, fixing the
  `could not determine data type of parameter $1` failures seen in Background
  Jobs. See `LIBRARY_DISCOVERY_JSONB_PARAMETER_CASTING_DESIGN.md`.
- Request-driven discovery retry readiness: explicit Missing and Release Detail
  requests now keep discovery rows automatic-dispatchable while bypassing stale
  cooldown only when the request is new, newer than the previous search, or a
  prior claim never recorded a search outcome. See
  `REQUEST_DRIVEN_DISCOVERY_RETRY_DESIGN.md`.
- slskd discovery response ingestion hardening: Import Review candidate
  ingestion now waits for asynchronous slskd search responses before recording a
  no-provider-response result, closing the local walkthrough gap where slskd
  logged responses but Wanted rows cooled down with `0` candidates. Artist
  Detail loading also clears safely after unexpected loader failures. See
  `SLSKD_DISCOVERY_RESPONSE_INGESTION_HARDENING_DESIGN.md`.
- Discovery response ingestion diagnostics: zero-candidate Soulseek searches now
  persist bounded aggregate diagnostics under discovery search evidence and
  Wanted rows explain why responses did not become Import Review candidates
  without exposing provider payloads, usernames, filenames, paths, or secrets.
  See `DISCOVERY_RESPONSE_INGESTION_DIAGNOSTICS_DESIGN.md`.
- Import candidate selection readiness: Wanted rows now distinguish
  high-confidence candidates ready for operator selection, ambiguous
  close-scoring candidates, low-confidence or unscored candidates, and active
  selected/download handoff state. This explains why successful searches may
  still show no Downloader activity until a candidate is selected in Import
  Review. See `IMPORT_CANDIDATE_SELECTION_READINESS_DESIGN.md`.
- Confidence-gated Import Review auto-selection: Library discovery dispatch now
  attempts automatic selection after successful slskd candidate ingestion when
  the existing selection-readiness model reports an unambiguous high-confidence
  candidate. The service reuses the existing Import Review `select` transition,
  audit/event writes, and JSONB discovery evidence. See
  `CONFIDENCE_GATED_AUTO_SELECTION_DESIGN.md`.
- Confidence-gated download execution start: high-confidence auto-selection now
  triggers the existing Import Review download-enqueue operation when Library
  automation is enabled and slskd is healthy. Operation summaries and discovery
  evidence preserve bounded trigger context (`auto_selection`, source search id,
  selected candidate id, and run id) without storing provider secrets or raw
  slskd payloads. Operators can disable this behavior in Settings > Library.
  See `CONFIDENCE_GATED_DOWNLOAD_EXECUTION_START_DESIGN.md`.
- Wanted Import Review selection handoff browser verification: added a
  deterministic browser scenario proving a high-confidence Wanted row opens the
  matching Import Review candidate queue, allows the operator to select the
  candidate, and returns through in-app navigation to a `Selected for download`
  Wanted state. See
  `WANTED_IMPORT_REVIEW_SELECTION_HANDOFF_BROWSER_VERIFICATION_DESIGN.md`.
- Import Review selected download execution handoff browser verification:
  extended the Wanted-to-Import Review proof through `Start download run`,
  verifying the selected summary, pending execution run, and persisted
  `execution-start` fixture action. See
  `IMPORT_REVIEW_SELECTED_DOWNLOAD_EXECUTION_HANDOFF_BROWSER_VERIFICATION_DESIGN.md`.
- Import execution selected-candidate readiness guidance: Wanted rows now show
  a separate next-step block for discovery, candidate review, selection,
  selected-but-not-run, queued, blocked, failed, and completed states. This
  makes the explicit Import Review `Start download run` boundary visible before
  Downloader activity is expected. See
  `IMPORT_EXECUTION_SELECTED_CANDIDATE_READINESS_GUIDANCE_DESIGN.md`.
- Import Review selected-run progress refresh visibility: the execution panel
  now renders a bounded progress notice for pending worker pickup, refreshing,
  transfer sync, current Downloader progress, diagnostic failure, and completed
  states so operators can stay in Import Review while transfer evidence changes.
  See `IMPORT_REVIEW_SELECTED_RUN_PROGRESS_REFRESH_VISIBILITY_DESIGN.md`.
- Wanted-started download transfer handoff browser verification: extended the
  same operator journey through execution transfer sync and direct Downloader
  detail drill-through for the accepted transfer. See
  `WANTED_STARTED_DOWNLOAD_TRANSFER_HANDOFF_BROWSER_VERIFICATION_DESIGN.md`.
- Provider-backed download acceptance diagnostics: import execution items now
  persist and render bounded diagnostics for planning blockers, no unlocked
  files, provider acceptance, partial provider rejection, and full provider
  rejection. See `PROVIDER_BACKED_DOWNLOAD_ACCEPTANCE_DIAGNOSTICS_DESIGN.md`.
- Docker provider acceptance evidence: the local walkthrough now has
  `npm run validate:docker-provider-acceptance`, which logs into the running
  Docker walkthrough, verifies configured provider state, path mapping
  evidence, durable Import Review download acceptance diagnostics, and the
  browser-visible diagnostic panel without serializing provider secrets. See
  `DOCKER_PROVIDER_ACCEPTANCE_EVIDENCE_DESIGN.md`.
- External download-path readiness: the walkthrough now permits a shell-only
  host-path override for completed downloads, while Media & storage presents a
  focused translation setup action whenever downloads are enabled without a
  saved source-to-Harmoniarr path mapping. Automatic file work remains
  fail-closed until the mapping validates. See
  `EXTERNAL_DOWNLOAD_PATH_READINESS_DESIGN.md`.
- Docker-backed schema generation and validation: database-backed schema
  commands now use disposable Testcontainers PostgreSQL instances instead of an
  ambient local database. `update:schema-snapshot`, `db:dump-schema`,
  `validate:schema-bootstrap`, and `db:check-schema` now replay or bootstrap
  against fresh Docker PostgreSQL state, while `check:schema-snapshot` remains a
  fast no-Docker deterministic text check. See
  `DOCKER_SCHEMA_GENERATION_DESIGN.md`.
- Discover browser keyboard verification: added a seeded Playwright suite for
  the Discover recommendation grid and monitored-artist chip band. The suite
  proves roving `tabindex` state, Arrow/Home/Control+Home/Control+End movement,
  visible focus outlines, and Tab entry points using shared browser keyboard
  helpers. The same helper pattern is now the standard for subsequent platform
  card-grid browser verification.
- Library/Search card-grid browser verification: extended the seeded Playwright
  keyboard proof to Library release cards and Search artist/release grids. The
  shared artwork-grid roving wrapper now removes inactive card actions from the
  Tab sequence while preserving the active card's action, and the metadata
  browser fixtures include a multi-result catalog query for deterministic Search
  coverage. Remaining browser follow-up is Home's mixed grid selector, then
  Missing/Activity/My Requests, then Artist Detail sections.
- Home mixed card-grid browser verification: added focused Playwright coverage
  for operator and requester Home monitored-artist grids, proving the mixed
  selector path (`.hx-media-card__link-area` plus each Discover tail card)
  participates in one roving tabindex composite with visible focus and inactive
  action management. Remaining browser follow-up is Missing, Activity, My
  Requests, then Artist Detail sections.
- Missing release-card grid browser verification: added focused Playwright
  coverage for the Missing wanted-release grid, including roving movement,
  visible focus, Tab from the active card into its Request action, inactive
  action suppression, and an active recovery card exposing both Retry discovery
  and Request controls. A narrow wanted browser fixture now seeds wanted
  summary, wanted releases, and reconciliation summary responses for this and
  later Activity Wanted coverage.
- Track-override remap review UX: Artist Detail now exposes a `Track review
  needed` section filter, affected release cards show text plus warning/danger
  review indicators, and Release Detail surfaces release-level review notes plus
  row-level matched-track status for saved `review_needed` / `orphaned` track
  overrides. The implementation uses the existing operator projection and
  Artist Policy save boundary; no new mutation route or migration was needed.
  See `TRACK_OVERRIDE_REMAP_REVIEW_UX_DESIGN.md`.
- Track-override remap repair workflow: Release Detail now provides explicit
  draft repair actions for ambiguous saved track overrides. `Keep this track`
  resolves a matched reviewed override without changing desired/suppressed
  intent, while `Clear override` removes stale reviewed overrides from the draft.
  Operators persist these repairs through the existing Save Policy action. See
  `TRACK_OVERRIDE_REMAP_REPAIR_WORKFLOW_DESIGN.md`.
- Artist Policy audit visibility: saved Artist Policy changes now emit bounded
  `artist_policy_saved` Activity events after the save transaction commits. The
  payload records monitoring/release/track change counts, repaired and cleared
  track-review counts, snapshot revision, reconciliation run id, and a link back
  to Artist Detail without storing the full draft body. See
  `ARTIST_POLICY_AUDIT_VISIBILITY_DESIGN.md`.
- Artist Policy Activity trail browser verification: added focused browser
  coverage for the saved-policy trail. The suite repairs a reviewed track
  override from Release Detail, saves Artist Policy, verifies the
  `artist_policy_saved` Activity row and bounded repair summary, then follows
  `Open artist policy` back to Artist Detail. See
  `ARTIST_POLICY_ACTIVITY_TRAIL_BROWSER_VERIFICATION_DESIGN.md`.
- Activity releases/wanted browser verification: added focused Playwright
  coverage for Activity Releases recent/upcoming card grids using a deterministic
  release-radar fixture, proving roving movement, visible focus, active-card
  Request actions, and inactive-card action suppression. Activity Wanted remains
  a native table; it now has an accessible table name and browser coverage for
  wanted rows, the download-recovery notice, and keyboard-triggered Retry
  discovery through the client API path. Remaining browser follow-up is My
  Requests, then Artist Detail sections.
- My Requests card-grid browser verification: added focused Playwright coverage
  for the request-card grid using a deterministic media-request fixture, proving
  roving movement, visible focus, status filtering, full-grid restoration, and
  keyboard activation into request detail. Fixed the view's filter bug by
  replacing the nonexistent `request.status` read with
  `getMyRequestFilterStatus(request)`, a pure presentation helper that maps
  `requestState` plus `fulfillmentStatus.code` into the existing pending /
  downloading / complete / failed filter buckets.
- Artist Detail per-section card-grid browser verification: added focused
  Playwright coverage for the discography section grids using the seeded
  metadata fixture with two Albums and two EPs. The suite proves each section is
  an independent roving composite, arrow/home movement stays in-section, focus
  remains visible, and operator selection controls are tabbable only for the
  active release card in their own section. The section list `aria-label` now
  uses the same `pluralizeReleaseType(section.type)` helper as the visible
  heading.
- Release Detail modal browser verification: added focused Playwright coverage
  for the modal opened from Artist Detail. The suite keyboard-opens a release
  card, proves initial focus, Escape/Close focus restoration, Tab containment,
  edition switching against a distinct fixture payload, and operator track
  override select reachability. Runtime hardening included explicit modal
  opener focus restoration, semantic pressed-state edition buttons, removal of
  unsupported ARIA menu roles from the edition overflow, visible edition focus
  rings, and explicit Enter/Space activation for `ReleaseCard`'s custom
  `role="button"` body.
- Request action browser verification: added focused Playwright coverage for
  Search release-card request actions and Release Detail direct requests. The
  suite proves keyboard reachability into the active card's Request button,
  confirmation-dialog initial focus and Tab containment, admin requester-for
  payload submission, requested disabled-state feedback, and successful Release
  Detail request focus restoration. The metadata browser fixture now records
  media-request payloads and seeds eligible admin/requester users. Remaining
  high-value follow-up is post-request My Requests refresh verification.
- Request failure and retry-state browser verification: extended the request
  browser fixtures with queued media-request failures and linked duplicate
  response state, plus shared Search/Release Detail request browser helpers.
  The suite proves failed card-confirm and Release Detail requests keep dialogs
  open, expose `role="alert"` errors, preserve requester-for selections, do not
  record media requests, and remain retryable; successful retries transition to
  requested feedback and Release Detail restores focus to the opener. Runtime
  hardening now focuses the retry button after request failure so disabled
  loading buttons do not drop keyboard focus out of the dialog.
- Requester-role request browser verification: added focused requester-session
  Playwright coverage using real requester creation/login and forced password
  change. The suite proves requester Search and Release Detail request flows
  have no requester-for controls, submit payloads without `requestedForUserId`,
  avoid admin `/api/v1/users` reads, and keep Artist Detail operator policy
  controls hidden. Runtime hardening added an explicit disabled mode to
  `useActiveUsers`, uses it for non-admin Release Detail sessions, and gates
  Artist Detail operator-policy editing to non-requester users.
- Post-request My Requests refresh verification: added focused requester-session
  Playwright coverage for the post-submit handoff. The suite verifies My
  Requests starts empty for a new requester, submits a release request from
  Search, then returns to My Requests and sees the submitted request card with
  release title, request kind, and `Searching` state. The metadata browser
  fixture now converts recorded request mutations into the scoped My Requests
  read model and summary/detail stubs. Next high-value follow-up is submitted
  request-detail handoff browser verification.
- Submitted-request detail handoff browser verification: added focused
  requester-session Playwright coverage for opening a newly submitted My
  Requests card into Request Detail by keyboard. The suite verifies the detail
  page renders the submitted request headline, request kind, journey, artist /
  release fields, requester attribution, empty pipeline state, and no admin-only
  controls. `RequestDetailView` now renders an explicit empty `Fulfillment
  pipeline` card when no import candidates are linked yet. Next high-value
  follow-up is requester Request Detail cancellation browser verification.
- Metadata artist monitoring DROP TABLE: dropped the legacy `metadata_artist_monitoring` table via `20260630_020000_metadata_artist_monitoring_drop.sql` (`DROP TABLE IF EXISTS`, transactional, no CASCADE — pre-flight audit confirmed zero FK/view dependents). Schema snapshot regenerated from the migration manifest (78 migrations); no anchors referenced the table. This completes the `metadata_artist_monitoring` retirement arc — the table, its store, its service, its route, and all reads/writes/backup-restore are gone; `operator_artist_monitoring` + `metadata_artist_refresh_state` are the sole monitoring source of truth.
- Metadata monitoring backup/restore migration: backup export no longer includes the redundant legacy `monitoring.artistMonitoring` snapshot (the canonical `operatorArtistMonitoring`/selections/overrides are already backed up); restore applies only canonical operator-scoped monitoring state and ignores the retired `artistMonitoring` field in old backups (forward/backward compatible). `metadata_artist_refresh_state` is treated as rebuildable operational state (not exported/restored). The legacy `metadata-monitoring-store.js` and its entire wiring chain (metadata-module, system-module, app.js, refresh-scheduler fallback shim) are removed — `metadata_artist_monitoring` is now an orphaned table with zero code references, ready for a DROP migration.
- Metadata monitoring write-path consolidation: the library browser's standalone monitor toggle is retired (links to the artist detail page), consolidating monitoring onto the canonical operator-scoped save surface (`saveOperatorArtist`) — the sole product-facing monitoring mutation. `PUT /api/v1/metadata/artists/:id/monitoring` returns 410 Gone pointing to `PUT /…/operator`; `metadata-monitoring-service.js` is removed entirely and `metadata-monitoring-store.upsertArtistMonitoring` is removed (store retains only backup/restore snapshot methods). The dead legacy `monitorArtist` client path is removed; `useArtistMonitoring.addArtistWithPolicy` is the single monitor entry point. Monitor side effects (`artist_monitored` activity event + household notification) now fire on the canonical save path's unmonitored→monitored transition (read-before-write detection, post-commit, idempotent across retries), fixing the prior inconsistency. The only remaining legacy `metadata_artist_monitoring` surface is backup/restore.
- Metadata artist-payload monitoring read-path cleanup: the artist-detail payload `monitoring` field (served by `GET /api/v1/metadata/artists/:artistId`) no longer reads `metadata_artist_monitoring`. `metadata-monitored-artist-store.js` gains `getArtistMonitoringStatus(metadataArtistId)` — one query assembling `isMonitored` and `monitoredReleaseGroupTypes` (aggregated via `EXISTS` + `ARRAY_AGG(DISTINCT ...)` over `CROSS JOIN LATERAL unnest`) from `operator_artist_monitoring`, plus `lastRefreshedAt` / `nextRefreshAt` from `metadata_artist_refresh_state`. `metadata-read-service.js` now depends on the monitored-artist store; the response shape is unchanged (library browser and artist-detail composable need no client changes). With this, every product-facing read of the legacy table is migrated; the remaining legacy surface is the write path (`PUT /metadata/artists/:id/monitoring` + library browser toggle) and backup/restore.
- Metadata monitored-artist read-path cleanup: the admin monitored-artist oversight list and the background artwork prefetch no longer read `metadata_artist_monitoring`. New dedicated `metadata-monitored-artist-store.js` (factory `createMetadataMonitoredArtistStore`) owns a global de-duplicated `listMonitoredArtistsForArtwork` read and an aggregated, paginated `listAdminMonitoredArtists` read over `operator_artist_monitoring`, with `lastRefreshedAt` sourced from `metadata_artist_refresh_state`. The admin response keeps its shape and adds an additive `monitoringOperatorCount`; a latent mapper bug that always nullled `monitoredByUsername` is fixed. The legacy `listMonitoredMetadataArtists` / `listAdminMonitoredMetadataArtists` repository functions and the dead, un-routed `metadata-search-service.listMonitoredArtists` method are removed. Sort keys resolved through a code-owned allow-list; all search/limit/offset values remain bind parameters. New `metadata-monitored-artist-store.test.js` plus updated search-service and prefetch tests.
- Dashboard surface consolidation: the standalone operator dashboard page has been removed. The canonical `dashboard` landing route now resolves to the main library-oriented home surface for operators and the requester home surface for requesters; `Activity` and `Discover` retain the non-library workflows. Bootstrap, login, and onboarding flows continue to target the same canonical `dashboard` route id.
- Admin user list SWR polling: `useAdminUserList` enhanced with `pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, and `attachVisibilityListener()`. `revalidate()` now uses `isRevalidating` ref and preserves stale data silently on error (consistent with other SWR composables). `reset()` cancels poll timer and clears `hasLoaded`. `SettingsUsersView` attaches visibility listener on mount, destroys on unmount. 7 new tests.
- Global search palette keyboard accessibility: `GlobalSearchPalette` now implements full WAI-ARIA APG combobox pattern. Focus trap (Tab/Shift+Tab cycle within panel), dynamic `aria-activedescendant` pointing to active result ID, focus restoration to trigger element on close, `inert` attribute on `#app` while open (prevents background interaction), and `scrollIntoView({ block: 'nearest' })` on active result during arrow-key navigation. Removed `@focusout` close-on-blur (replaced by inert + focus trap). `onBeforeUnmount` cleanup removes inert.
- SWR partial composables completed: `useMyRequests` and `useRequestMusicForm` upgraded from partial to full SWR lifecycle with `revalidateOnFocus`, `attachVisibilityListener()`, `revalidate()` (silent stale data preservation on error), and `destroy()` with visibility listener cleanup. `MyRequestsView` and `RequestMusicView` wired with lifecycle. 8 new tests.
- Ad-hoc polling composables migrated to standard SWR pattern: `useShellHeartbeat` (was `setInterval` 30s in `onMounted`), `useRecoveryStatus` (was `setInterval` in `startPolling()`/`stopPolling()`), `useOperationHistory` (was `setInterval` with injectable fns in `syncPolling()`), `useLibraryFilterOptions` (was `setInterval` 60s in `onMounted`). All four now use recursive `setTimeout` with `pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, `attachVisibilityListener()`, and `revalidate()`. Injectable `setIntervalFn`/`clearIntervalFn` params removed from `useOperationHistory` and `useLibraryFilterOptions`. `startPolling`/`stopPolling` removed from `useRecoveryStatus`. Views wired with lifecycle. 42 new/updated tests across four test files.
- `useArtworkSummary` SWR completion: upgraded from partial (recursive `setTimeout` with `onScopeDispose` cleanup) to full standard SWR lifecycle with `pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, `attachVisibilityListener()`, and `revalidate()`. Conditional polling guards on `isArtworkCleanupPollingStatus`. Removed `getCurrentScope`/`onScopeDispose` in favor of caller-managed `destroy()` (consistent with all other SWR composables). 13 new tests.
- `useNetworkSearchWorkflow` SWR migration: replaced hardcoded 2s `schedulePoll` injectable with standard `pollIntervalMs` (default 2000ms) using recursive `setTimeout`. Added `destroy()`, `revalidate()`, `isRevalidating`, `attachVisibilityListener()`, and `revalidateOnFocus`. Added `destroyed` guard to `runNetworkSearch` and all async callbacks. Removed public `clearPollTimer` (replaced by `destroy()`). `SearchView` wired with `onMounted`/`onBeforeUnmount` lifecycle. 14 new tests.
- Non-destructive operator library removal semantics: added operator-scoped
  release visibility state so Library removals hide releases from the current
  operator view without deleting media, metadata, requests, or reconciliation
  records. The Library grid now supports `Visible`, `Removed from view`, and
  `All` visibility filters plus remove/restore card actions. Server-side
  changes include a dedicated visibility table, modular store/service files,
  CSRF-protected route wiring, operator-role enforcement, and audit evidence.
- `useLibraryReleases` SWR standardization: upgraded from custom stale-data + `AbortController` pattern to full standard SWR lifecycle. Added `destroy()` (aborts in-flight requests, clears debounce/poll timers, removes visibility listener), `revalidate()` (uses `lastParams`, preserves stale data on error), `isRevalidating` ref, `attachVisibilityListener()` / `revalidateOnFocus`, and `pollIntervalMs`. Removed `setTimeoutFn`/`clearTimeoutFn` injectable params (use native `setTimeout`/`clearTimeout`). Kept `AbortController` race-condition protection and 300ms debounce on `filterState` watcher. `LibraryView` wired with `onMounted`/`onBeforeUnmount` lifecycle. 25 tests (rewritten from 12 legacy tests).
- `useBootstrapStatus` SWR: upgraded with `destroy()`, `revalidate()`, `isRevalidating`, `attachVisibilityListener()` / `revalidateOnFocus`, and `pollIntervalMs`. `revalidate()` preserves stale data silently on error. `BootstrapSetupView` wired with `onMounted`/`onBeforeUnmount` lifecycle. 13 tests (rewritten from 6 legacy).
- `useProviderStatus` SWR: upgraded with full standard SWR lifecycle (`destroy()`, `revalidate()`, `isRevalidating`, `attachVisibilityListener()` / `revalidateOnFocus`, `pollIntervalMs`). Currently zero consumers (dead code). 10 new tests. Ready for future use when provider status polling is needed.
- `useSearchMusicWorkflow` SWR audit: **intentionally excluded from SWR migration.** MusicBrainz catalog search is a one-shot mutation — user submits query, results return in a single response. No incremental polling (unlike `useNetworkSearchWorkflow` which polls Soulseek peers every 2s). No background state changes, no `revalidateOnFocus` benefit, no timers or listeners to clean up. Added JSDoc documenting the SWR decision. Existing 3 tests unchanged.
- `useSettingsForm` mutation invalidation: added `onSaveSuccess` callback option to `useSettingsForm` (called after successful `saveSettings()` with the response payload, following TanStack Query's `onSuccess → invalidateQueries` pattern). `useConnections` passes `onSaveSuccess` through to its inner `useSettingsForm`. `SettingsMediaStorageView` wires `onSaveSuccess` to revalidate artwork quota (`loadQuota()`) and quota history (`loadQuotaHistory()`) after saving artwork/path settings. 2 new tests.
- Admin session revocation: `adminRevokeUserSession` and `adminRevokeAllUserSessions` added to `account-security-service`. Two new admin-only CSRF-protected routes: `POST /api/v1/users/:userId/sessions/:refreshTokenId/revoke` and `POST /api/v1/users/:userId/sessions/revoke-all`. Client `users-api` exports `adminRevokeUserSession` and `adminRevokeAllUserSessions`. `useUserDetail` composable gains `revokeUserSession()` and `revokeAllUserSessions()` with optimistic session state updates. `UserDetailView` adds per-session revoke buttons and a header-level "Revoke all" button. 4 server + 4 client tests. Route inventory updated.
- Settings connections composable extraction: `useConnections` now owns `SettingsConnectionsView`'s view-specific connection behavior, including `secretStatus` application through `useSettingsForm(...extraApply)`, Spotify/YouTube OAuth start and clear action state, redirects, and success/error messaging. `SettingsConnectionsView` now delegates connection-specific logic to the composable while preserving the shared generic settings-form boundary. 6 new tests.
- Wanted releases full-page SWR wiring: `MissingView` and `ActivityWantedView` now instantiate `useLibraryWantedSummary` and `useLibraryWantedReleases` with `pollIntervalMs: 30000` and `revalidateOnFocus: true`, attach visibility listeners in `onMounted`, destroy polling on unmount, and reflect revalidation state in their refresh buttons.
- Per-operator wanted state follow-up: `library_wanted_releases` now stores `app_user_id`, enforces per-user release uniqueness, and drives wanted summary/release reads from the authenticated session. Wanted reconciliation reads `operator_artist_monitoring` directly, applies release-scope and wanted-automation policy gates, preserves source-user context for release-global discovery requests, and carries wanted row ownership through backup/restore.
- Onboarding summary SWR polling: `useOnboardingSummary` enhanced with `pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, and `attachVisibilityListener()`. Conditional polling uses outstanding setup issues (`issueCount > 0`) as the guard and automatically stops when onboarding becomes healthy. `OperatorDashboardPanel` passes `pollIntervalMs: 15000`, `revalidateOnFocus: true`, attaches visibility revalidation, and cleans up on unmount. 8 new tests.
- Requester home live refresh: `useMonitoredArtistSummaries` and `useReleaseRadar` now follow the shared SWR lifecycle (`pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, `attachVisibilityListener()`). `RequesterHomePanel` instantiates projection-backed monitored artist summaries, release radar, and activity feed with `pollIntervalMs: 30000`, `revalidateOnFocus: true`, attaches visibility listeners on mount, and destroys all three on unmount. 12 new tests.
- Operator dashboard SWR polling: `useOperatorRequests` extracted from `OperatorDashboardPanel` as a dedicated composable for request summary/list loading with `pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, and `attachVisibilityListener()`. `useLibraryWantedSummary` and `useLibraryWantedReleases` now also support the same SWR lifecycle, including stale-data preservation on revalidation failure. `OperatorDashboardPanel` passes `pollIntervalMs: 15000`, `revalidateOnFocus: true`, and cleans up on unmount. 16 new tests plus updates to pre-SWR wanted-summary expectations.
- Dashboard and import-review SWR expansion: `useSystemOverview`, `useImportCandidateRunSummary`, and `useImportReviewQueue` now support `pollIntervalMs`, `revalidateOnFocus`, `isRevalidating`, `destroy()`, and `attachVisibilityListener()` with stale-data preservation on revalidation failure. `ImportReviewView` and the admin workflow now pass 15s polling and manage lifecycle cleanup; the system overview composable now supports background refresh for dashboard surfaces. 23 new tests across the queue, run-summary, and system-overview composables.
- Request detail pipeline SWR polling: `useMediaRequestPipeline` enhanced with `pollIntervalMs` (15s), `revalidateOnFocus`, `isRevalidating`, `destroy()`, `attachVisibilityListener()`. Conditional polling via `hasActiveCandidates` guard — polls only while any candidate status is pending/selected/downloading/import_pending, stops when all candidates reach terminal status (applied/rejected/failed). Stale candidates preserved on revalidation failure. `RequestDetailView` passes `pollIntervalMs: 15000`, `revalidateOnFocus: true`, shows spinning indicator on pipeline heading, calls `destroyPipeline()` in `onBeforeUnmount`. 9 new tests. 1552 server / 2892 client tests pass.
- Request detail SWR polling: `useMediaRequestDetail` enhanced with `pollIntervalMs` (15s), `revalidateOnFocus`, `isRevalidating`, `destroy()`, `attachVisibilityListener()`. Conditional polling via `hasActiveFulfillment` guard — only polls while fulfillment code is downloading/import_pending/queued/needs_fetch/searching/selected, stops when fulfilled/failed/cancelled. Tracks `currentMediaRequestId` for poll re-fetches. Stale mediaRequest/events preserved on revalidation failure; cleared only on first-load failure. `RequestDetailView` passes `pollIntervalMs: 15000`, `revalidateOnFocus: true`, shows spinning indicator during revalidation, calls `destroy()` in `onBeforeUnmount`. 10 new tests. 1552 server / 2883 client tests pass.
- Activity feed real-time SWR updates: `useActivityFeed` enhanced with `pollIntervalMs` (30s background refresh), `revalidateOnFocus` (tab visibility revalidation), `isRevalidating` (stale-while-revalidate state), `destroy()` cleanup. Stale events/checkedAt/total preserved on revalidation failure. `useActivityHistory` passes `pollIntervalMs`/`revalidateOnFocus` through to `useAsyncResource`, exposes `isRevalidating`/`lastRefreshedAt`. Both `ActivityFeedView` and `ActivityHistoryView` show spinning revalidation indicator during background refresh. 13 new tests (8 useActivityFeed SWR + 5 useActivityHistory SWR). 1552 server / 2873 client tests pass.
- Activity feed composable consolidation: `useActivityFeedPagination` extracted from `useSystemOverview` — cursor-based pagination composable with `entries`, `checkedAt`, `pageInfo`, `hasMore`, `isLoadingMore`, `loadMore`, `reset` (injectable `fetchActivityFeed`). `useSystemOverview` delegates activity feed state to the new composable, reducing its responsibilities. `useActivityHistory` composable extracts inline `useAsyncResource` usage from `ActivityHistoryView` — injectable `fetchSystemActivityFeed`, configurable `limit`, `entryCount` computed. `ActivityHistoryView` now uses `useActivityHistory` instead of raw `useAsyncResource`. 15 new tests (8 useActivityFeedPagination + 7 useActivityHistory). 1552 server / 2860 client tests pass.
- SWR conditional polling with tests (`b0d24e2`): `useAsyncResource` enhanced with `isRevalidating`, `pollWhile(data => boolean)` guard, `revalidateOnFocus`. `useMyRequests` and `useRequestMusicForm` gain `pollIntervalMs`, `isRevalidating`, `destroy`. `MyRequestsView`/`RequestMusicView` pass `pollIntervalMs: 15000` with `onBeforeUnmount` cleanup. 10 new tests. 1552 server / 2845 client tests pass.
- Request detail fulfillment pipeline: new `GET /api/v1/library/media-requests/:id/pipeline` endpoint aggregates all import candidates with their execution and apply run items. Server: `library-media-request-pipeline-service.js` joins `import_candidates`, `import_execution_run_items`, and `import_apply_run_items`. Client: `useMediaRequestPipeline` composable, `request-pipeline-presentation.js` with step builder and formatting helpers, enhanced `RequestDetailView` showing expandable candidate list with visual pipeline steps (discovery → review → download → import). Old single-candidate card retained as fallback when pipeline has no candidates. 34 new tests (5 server + 29 client). 1552 server / 2835 client tests pass.
- Library as home page: `LibraryView` now renders at `/app` default route (`name: 'dashboard'`), `DashboardView` moved to `/app/dashboard` (`name: 'dashboard-panel'`), `/app/library` redirects to `/app`. Sidebar nav updated: "Home" uses library icon and links to `dashboard` route, operators get a separate "Dashboard" item. Duplicate "What do you want to listen to?" search widget removed from `OperatorDashboardPanel` (already covered by `/app/requests`). Dashboard-specific route helpers (`dashboard-route-state.js`, `operator-notifications-presentation.js`) updated to target `dashboard-panel`. 12 test assertions updated. 1547 server / 2801 client tests pass.
- Settings notifications composable extraction (`62c9d1e`): `useNotificationCategories` extracted from `SettingsNotificationsView` — owns pending toggle state, effective value resolution, category visibility (admin-only filtering), and persistence through `useAccountPreferences`. View script reduced from 63 to 14 lines. 8 new tests. 2801 client tests pass.
- Admin user detail view implemented (`1093faa`): `GET /api/v1/users/:userId/detail` returns user profile, media request summary (by requester/target role), and active sessions; `GET /api/v1/users/:userId/activity` returns cursor-paginated audit trail. Client includes `useUserDetail` composable, `UserDetailView.vue` with stat cards, Plex profile, session table, and timeline. 11 new tests (5 server, 6 client). 1547 server / 2793 client tests pass.
- User detail navigation wiring (`03cc4ca`): "View detail" ghost link on each user card in `SettingsUsersView` navigates to `settings-user-detail` route.
- Settings composable extraction (`1687008`): `useSettingsForm` shared by General/MediaStorage/Connections views; `useSettingsUserMutations` extracted from Users view. General 275→138 lines, MediaStorage 694→562, Connections 529→386, Users 751→476. 31 new tests. 2787 client tests pass.
- Event timeline cursor-based pagination (`4642b46`): keyset pagination via composite `(occurred_at, id)` cursor with opaque base64url-encoded JSON.
- Admin user list with server-side search, filter, pagination (`8d03dd5`): backward-compatible `GET /api/v1/users`.
- Prior items: URL-backed filter/sort state, request list sort, cascade-aware cancel toast, fan-out child cancellation, request list pagination, import candidate fulfillment, admin reassign, request list filtering, cancellation with event trail, request detail view, RequestCard navigation, admin reassignment UI, shared release-event contract, per-run drilldown, async push worker, fulfillment signals, E2E UI, multi-target fan-out, audited reassignment, maintenance locks, integration tests, 57P01 FK fix.

## Current Status (2026-05-04)

- Initial implementation planning exists in `docs/harmoniarr.md`.
- Execution phases are defined, but no phase is complete yet.
- The repo-level `npm run validate` contract currently passes end to end on Node 25.4.0, and the supported local baseline now tracks the Node 25.4 line through `.nvmrc`, `engines`, `devEngines`, and the Docker builder image.
- Validation infrastructure now includes native ESM ESLint flat-config coverage across server, shared, client, scripts, and tests, plus segmented native `node:test` entrypoints for `server`, `client`, `scripts`, and `integration` slices.
- The integration harness now reuses one bounded PostgreSQL runtime per suite, isolates each scenario into its own temporary database, applies explicit startup/request/shutdown timeouts plus small pool limits, and skips cleanly with a concrete message when neither external PostgreSQL nor a supported container runtime is available locally.
- The main repository validation workflow now also provisions a PostgreSQL service and passes the shared env contract into `npm run validate`, so the native integration slice runs as real CI evidence instead of silently degrading to local-only or skipped coverage.
- Integration coverage now also exercises import-review route transitions, import execution run creation, operation-history lease visibility, and import-run maintenance-lock conflicts against the real static ESM server graph plus temporary PostgreSQL state.
- Integration coverage now also exercises operator-driven operation-run cancel/retry controls plus library discovery, organize, and scan maintenance-lock conflicts through the real HTTP and database-backed server graph, with shared fixture helpers for operation runs and recovery lock actions.
- Integration coverage now also proves a claimed library-scan worker run pauses and returns to `pending` through the real database-backed operation-run path when a blocking maintenance lock becomes active before worker startup, preserving retry budget and clearing the queue claim without reopening production worker logic.
- Integration coverage now also exercises backup export creation, artifact list or detail inspection, restore preview lock readiness, restore-apply lock conflict, and successful backed-up settings restoration through the real HTTP and database-backed recovery graph, reusing shared integration recovery helpers instead of route-local request setup.
- Integration coverage now also exercises the public bootstrap-admin recovery status and completion routes against the real HTTP and database-backed server graph, including session revocation, lock-conflict behavior, invalid-attempt invalidation, and the guarantee that recovery completion does not mint a new authenticated session cookie.
- Integration coverage now also exercises the public app-user claim flow against the real HTTP and database-backed server graph, including admin-issued claim code creation, no auto-login on completion, and a subsequent normal login with the newly claimed password.
- Integration coverage now also proves the documented bootstrap-admin recovery runbook seam across the real database-backed `harmoniarrctl` arm/status/cancel commands plus a post-recovery fresh login through the public auth routes, leaving packaged-runtime `docker exec ... harmoniarrctl` execution as the main remaining validation gap for release evidence.
- Operator-visible control-plane reads now also pass through a shared server-side redaction boundary, so recovery diagnostics, operation history, maintenance-lock responses, restore-preview lock conflicts, and recent audit detail reads omit or sanitize secret-bearing values, emails, bearer tokens, and filesystem paths before they reach the UI.
- Structured runtime and security log rendering now also pass through the same shared redaction policy, and an admin-only diagnostics export route now emits compact redacted JSON evidence bundles for support-oriented sharing without exposing plaintext recovery codes, session material, or filesystem paths.
- Runtime operations now also flow through shared resource and monitoring boundaries, so sharp concurrency/cache tuning, ffmpeg/ffprobe timeout-plus-kill behavior, stale-heartbeat detection, memory-pressure diagnostics, and prefixed warning logging are owned centrally instead of drifting across workers and route-local command calls.
- Deployment-path validation now also routes through a shared Docker smoke validator that proves read-only-rootfs posture, fail-closed startup refusal, FFmpeg/FFprobe availability, embedded PostgreSQL startup plus restart persistence, and optional machine-readable evidence emission without introducing workflow-local shell composition.
- Deployment-path validation now also uses that shared Docker smoke validator to prove one packaged-runtime delegated Request Music journey through real HTTP APIs, covering admin-on-behalf request creation plus target-user scoped summary, list, and notification visibility without adding test-only runtime seams.
- Remaining delivery risk is now concentrated more in deployment-path validation and release closure than in first-pass feature construction.
- The unchecked start-gate and Phase 0 alignment items are now mostly documentation-governance follow-through, not evidence that the core implementation is still blocked from progressing.
- The Docker runtime now boots a real minimal Express plus Vue application instead of a placeholder-only shell.
- Embedded PostgreSQL startup, tracked timestamped migrations, bootstrap-admin creation, login/logout/session routes, and allowlisted settings persistence are now implemented.
- The client now includes first-run bootstrap-admin, login, and protected settings views backed by shared auth and settings API modules.
- First-run bootstrap can now optionally run in a preseeded owner-claim mode driven by environment configuration, requiring a one-time claim code plus matching owner username or email before the initial admin is created; local auth can now also match users by username or email.
- Plex onboarding decisions are now explicit: `app_users` remains the canonical internal identity table, Plex import should create or update Plex-linked `app_users`, and Plex managed accounts may be imported as request and ownership profiles even though they should not be assumed to support direct Harmoniarr sign-in.
- Request Music decisions are now explicit: request ownership must distinguish `requestedByUserId` from `requestedForUserId`, admins should be able to submit requests on behalf of another user, and final destination or ownership semantics should follow the target user rather than the acting admin.
- The shared client API layer now also clears local auth state and redirects back to login when protected routes fail with `401 auth_required`, so expired browser sessions no longer leave the authenticated shell stranded on stale state.
- Planning and implementation posture now explicitly targets a self-hosted companion app similar to Radarr/Sonarr, so security and automation scope should stay proportional to a trusted operator-run Docker deployment rather than drifting toward enterprise control-plane features.
- Canonical MusicBrainz metadata foundation now exists for artists, release groups, releases, media, recordings, tracks, and provider snapshots with timestamped migrations.
- The metadata workspace now uses shared client API modules, composables, and static Vue SFCs for provider search/import plus local reopen flows.
- Metadata drill-through now also normalizes provider release-group selections onto local canonical route ids, and shared client helper coverage now locks metadata route hydration and activity-feed link-target mapping to the same route-owned behavior.
- The server bootstrap now composes metadata read/search/catalog/import capabilities through a shared native ESM metadata module instead of hand-wiring that service graph directly in the app composition root.
- The server bootstrap now also composes system overview and settings route dependencies through a shared native ESM system module, keeping the control-plane wiring out of the app composition root.
- The server bootstrap now also composes auth route dependencies through a shared native ESM auth module, and auth route registration accepts injected dependencies for native contract testing without module-mocking hacks.
- The app composition root now accepts injected module factories and route registrars for direct native contract testing, while preserving static ESM imports and the existing API plus SPA fallback behavior.
- The server bootstrap now also owns a shared HTTP hardening boundary for browser-facing security headers, JSON body-size enforcement, API `Accept` and `Content-Type` contract checks, and normalized invalid-JSON and oversized-payload failures instead of leaving those controls to ad hoc route behavior.
- The shared HTTP hardening boundary now also applies `Cache-Control: no-store` across browser-consumed API responses, so auth and control-plane state do not drift into browser caches through route-local omissions.
- The app composition root now also owns a shared in-memory abuse limiter service for bootstrap, login, refresh, and control-plane run-trigger routes, so abuse-prone entrypoints reuse the same native ESM rate-limit boundary and emit observable 429 behavior without route-local state.
- Shared outbound base-URL normalization now also routes through a native ESM outbound URL policy used by slskd settings/runtime config and MusicBrainz client construction, with exact-host and suffix allowlisting support plus redirect denial to reduce SSRF-style validation bypasses.
- A shared server route inventory manifest now lives in code and is validated against the actual registrar output in native tests, so new routes cannot drift in without explicit method/path/access classification.
- Native auth route coverage now exercises bootstrap-admin, login, refresh, logout, and session contracts against the injected auth boundary with native fetch and node:test.
- System route registration now accepts injected auth helper dependencies like the metadata route layer, and native control-plane route coverage now exercises health, settings read/update, and system overview contracts.
- Shared request-auth helper defaults now live behind a native ESM auth-module surface reused by auth, metadata, and system route layers instead of being hand-wired separately in each route file.
- Auth and system route contract coverage now also proves shared JSON error behavior for injected auth-required, CSRF, and invalid-credential failures without introducing module-mocking or non-native test tooling.
- The auth boundary now also owns a shared account-security service for password change, active-session listing, and per-session revocation, and forced re-auth now routes authenticated users to a dedicated account-security flow instead of trapping them in a login loop.
- The shared settings allowlist now also exposes artwork fetch, extraction, derivative, retention, and automatic refresh controls through the existing settings service and operator UI, so artwork workers can reuse one normalized configuration boundary instead of inventing ad hoc runtime flags.
- A shared artwork module now also converts that allowlisted settings contract into one runtime policy surface for storage paths, fetch behavior, derivative profiles, cleanup thresholds, and automatic refresh posture, and system overview can expose that policy without future workers re-reading raw settings independently.
- The shared artwork module now also owns a sharp-backed ingestion service that allowlists safe raster formats, enforces configured size and dimension ceilings, rewrites images before storage, writes them under the app-owned artwork tree, and persists deduplicated asset descriptors through the shared repository instead of leaving each future worker to parse and store image data differently.
- Library tag extraction now also routes embedded cover art through shared library and artwork services, selecting one preferred embedded cover from `music-metadata`, ingesting it through the shared artwork safety boundary, and assigning it to the scanned `library_file` without letting missing or invalid artwork block library scans.
- Library scans now also route folder and sidecar artwork through shared library and artwork services, selecting one preferred folder candidate per scanned directory, ingesting it once through the shared artwork safety boundary, and reconciling it against existing embedded or sidecar assignments without letting invalid artwork block scans.
- The shared artwork assignment service now also reconciles source-scoped preferred assignments by priority and can clear stale embedded or sidecar sources so the next-best remaining assignment is promoted instead of leaving library-file artwork stuck on stale sources.
- The shared artwork boundary now also tracks `unassigned_at` state for durable assets and exposes an explicit cleanup service that prunes retention-eligible unassigned originals or extracted files from database-owned candidates instead of guessing cleanup age from ingest time or blind filesystem scans.
- The artwork boundary now also exposes a dedicated admin summary and cleanup-run API surface through shared run-store, worker, and route seams, so retention cleanup follows the same operation-run and fresh-session control-plane model already used by other maintenance workflows.
- The authenticated dashboard now also consumes that dedicated artwork summary and cleanup-run surface through shared client API and composable modules, giving operators a retention-aware maintenance panel without mixing artwork cleanup controls into unrelated dashboard sections.
- The artwork maintenance surface now also exposes recent cleanup-run history plus persisted per-asset failure details through the shared operation-run seam, so operators can diagnose failed cleanup attempts without leaving the dashboard or depending on ad hoc log inspection.
- The artwork maintenance surface now also exposes a dedicated single-run detail read path and only polls while cleanup is still pending or running, so operators get current failure and completion data without turning the dashboard into a constant background refresh client.
- The protected system overview now also consumes a compact artwork-maintenance diagnostic from the shared artwork summary boundary, so cross-cutting runtime status can surface cleanup pressure and recent failures without duplicating artwork ownership inside the system route layer.
- The dashboard now also keeps artwork cleanup run selection in URL state and lets the system-overview artwork card jump directly into the dedicated artwork maintenance panel, so specific cleanup runs remain linkable without moving run-detail ownership out of the shared artwork boundary.
- The authenticated account-security surface now also consumes a shared recent-audit-events read boundary, and artwork cleanup audit entries can deep-link back into the existing dashboard run-detail state instead of creating a separate audit-only operation viewer.
- Settings validation now throws normalized API-style 400 errors from the shared validator boundary, and native service plus route coverage proves malformed settings patches do not leak as generic 500 responses.
- Metadata route coverage now also proves MusicBrainz provider failure normalization for unavailable, misconfigured, and upstream request-failed cases, preserving shared JSON 503 and 502 contracts through the Express layer.
- MusicBrainz client coverage now proves retry behavior, throttling `Retry-After` handling, exhausted retry details, and non-retryable upstream failure classification at the provider boundary.
- MusicBrainz search, catalog, and import service coverage now proves shared-client request normalization, validation-before-provider-call behavior, provider failure detail preservation, and import audit dependency injection without module mocking or lazy loading.
- Shared dependency-health classification now maps MusicBrainz provider failures into safe diagnostics statuses for throttled, unavailable, misconfigured, request-failed, and not-found outcomes without leaking raw upstream URLs or causes, and system overview can surface injected dependency health.
- A shared provider-health recorder now captures the last observed MusicBrainz health from real search, catalog, and import provider calls, and the app composition root shares that recorder with system overview diagnostics through static ESM module wiring.
- The authenticated dashboard now uses a shared system-overview composable and modular dependency-status component to surface MusicBrainz provider health observations from the protected system overview API.
- The slskd adapter boundary now has static ESM client, service, and module layers with API-key request support, normalized search/connection contracts, provider-health observation hooks, and safe dependency-health classification for unavailable, unauthorized, misconfigured, and request-failed outcomes.
- The app composition root now wires the static ESM slskd module into the shared provider-health recorder and authenticated system overview dependency checks, while `/healthz` remains a lightweight local health summary without live provider probing.
- Authenticated slskd discovery routes now expose connection status, search start, search polling, and normalized search responses through the shared slskd service/module boundary with CSRF enforcement on mutating search starts.
- The mutating slskd search-dispatch route now also requires a fresh admin session, keeping operator-triggered discovery execution aligned with the same re-auth posture already used by other privileged mutation paths.
- Import candidate ingestion now persists normalized slskd search responses into durable review-ready candidate and candidate-file tables, keeping queryable domain fields separate from raw provider JSONB payloads.
- Import candidate read-side services and routes now expose authenticated list/detail review queue contracts with status, slskd search, username, and folder filters over the persisted candidate state.
- Import candidate review transitions now support hold, select, reject, and reopen actions with optimistic status guards, append-only candidate events, audit evidence, and CSRF-protected route contracts.
- The authenticated frontend now includes a persisted import review queue surface with shared ESM API/composable modules, URL-backed filter and selected-candidate state, candidate detail inspection, and operator hold/select/reject/reopen actions over the review routes.
- The import review workspace now routes queue, detail, preview, and transition refresh orchestration through a shared route-aware composable, and the queue shows the last successful refresh time so operators can see when the review read model was last reloaded.
- The import review detail surface now also exposes a read-only planning preview for current downloads-root resolution, staging targets, mirrored library naming, and explicit warnings where full slskd path mappings do not exist yet.
- Import planning preview now also routes discovery-linked candidates through a shared canonical naming boundary that applies the documented artist/album/track default templates with Windows-safe filename sanitization, while preserving an explicit mirrored-path fallback when canonical release context or track counts are not trustworthy enough to rename.
- The import workflow now also exposes a dedicated selected-candidate readiness summary through a protected read model and shared client composable, so operators can see which selected items are ready, warning-bearing, or blocked before download or apply behavior exists.
- The import workflow now also persists planning-only execution runs for selected candidates through the shared operation-run model, with protected start/read routes and an operator-facing run panel that snapshots per-candidate readiness without starting downloads.
- Import execution runs now also enqueue unlocked files to slskd for operator-selected candidates, while persisting queued, queued-with-warnings, blocked, and enqueue-failed outcomes through the shared execution-run surface.
- The import execution summary now also reconciles persisted enqueue results against live slskd transfer detail, so operators can see queued, active, completed, failed, and percent-complete transfer state without leaving the review workflow.
- Import candidate workflow state now also advances durably from `selected` into `downloading`, `failed`, and `import_pending` through shared execution services, so completed slskd transfers can be persisted back into Harmoniarr instead of remaining live-read-only observations.
- Import execution reconciliation now also falls back to the `includeRemoved` slskd download listing when per-transfer detail disappears, and only marks a transfer orphaned after a configurable grace window when it still cannot be found.
- The slskd boundary now also owns a shared transfer snapshot service that batches `getDownloads({ includeRemoved: true })` lookups by username, and the execution summary reuses that indexed snapshot instead of issuing per-transfer detail reads.
- Import execution reconciliation now also persists a lightweight last-seen transfer snapshot onto each execution run item when live transfer detail is still present, so operator-facing audit survives later slskd eviction without turning the execution summary read model into a write path.
- Missing-transfer grace now also keys off persisted execution timestamps such as the latest live transfer sighting or original enqueue request, instead of the run-item row update clock, so later snapshot writes do not accidentally extend orphan detection.
- Import execution reconciliation now also persists explicit missing-transfer state, including `missingSince` and `lastCheckedAt`, onto execution run items when slskd transfers disappear, so repeated orphan checks remain durable and operator-facing review can show the last observed disappearance timeline.
- The execution summary read model now also exposes normalized persisted transfer observation and missing-transfer fields per run item, so the client can render durable execution state without reaching into raw execution snapshot internals.
- The import workflow now also exposes a dedicated `import_pending` summary route and shared read model, so completed downloads can be reviewed as a distinct import-ready stage with the same staging and path-preview evidence reused from the existing preview service.
- Import-pending candidates now also expose a dedicated apply-preview service and protected detail route, reusing shared planning preview output to surface missing-source files, target collisions, and guarded import-readiness evidence before any filesystem mutation exists.
- The import workflow now also persists durable import-apply runs for `import_pending` candidates, using a guarded shared mutation service plus protected start/read routes to stage exclusive file moves, preserve per-file outcomes, and only transition candidates to `applied` after successful library finalize steps.
- Import apply now also routes filesystem mutation through a dedicated shared media-filesystem boundary that owns root containment, exclusive destination checks, verified hardlink/copy outcomes, and explicit hardlink fallback reporting instead of leaving guarded file operations embedded inside one workflow service.
- The import workflow now also persists durable `import_operations` history for each apply-stage filesystem step, keyed to apply runs plus candidate-file identities so stage/finalize, failed, and not-attempted outcomes remain auditable beyond run snapshots.
- Import review now also keeps exact execution and apply run selection in URL state, backed by dedicated protected run-detail reads, so audit activity can reopen a specific durable import run instead of collapsing operators back onto whichever run happens to be current or latest.
- Import-pending collision review now also persists explicit per-file skip decisions keyed to candidate-file identity, reusing the apply-preview seam to convert reviewed collisions into warning-level skips and durable `skipped` apply history without allowing overwrite behavior.
- Server startup now also owns a small in-process import execution reconciliation heartbeat that periodically reuses the shared execution summary plus reconciliation service to persist `downloading`, `failed`, and `import_pending` transitions without requiring a manual route trigger.
- Settings now allow explicit slskd-to-Harmoniarr download path mappings, and the import planning preview resolves candidate paths through that shared mapping service before falling back to legacy downloads-root assumptions.
- The shared settings boundary now also returns non-destructive path validation status for local roots and download mappings, giving the settings UI immediate health feedback without introducing a separate ad hoc validation route.
- The anonymous bootstrap status boundary now reuses that shared path-validation summary during first-run setup, so onboarding surfaces the same lightweight preflight signal before the admin account is created.
- The protected dashboard now also consumes a dedicated onboarding summary boundary that turns shared path, slskd, migration, MusicBrainz, and worker checks into contextual next-step guidance instead of a separate setup wizard.
- The system boundary now also exposes a shared library-scan summary that derives first-scan readiness from path validation and latest durable scan-run state from operation history, so dashboard onboarding can move from infrastructure checks into existing-library status without inventing scan execution locally.
- A dedicated native ESM library module now owns library-scan run persistence, a thin background worker entrypoint, protected scan-start route wiring, and the dashboard start/rescan action so the existing-library status surface now launches real scan work instead of remaining passive.
- The library boundary now also exposes a shared reconciliation summary read service and protected route, and the dashboard consumes that dedicated summary through a separate composable and panel instead of folding release-coverage state into the system overview surface.
- The metadata boundary now also owns a canonical artist-monitoring baseline through a shared monitoring store/service, protected artist monitoring route, and metadata workspace toggle, establishing the prerequisite state needed before wanted reconciliation can be implemented safely.
- Shared observability history now exposes bounded cursor-paged activity-feed and metadata detection-event APIs with client drill-through into dashboard, jobs, and metadata route state instead of keeping those timelines as fixed embedded snapshots.
- Backup at-rest encryption now reuses the shared `HARMONIARR_SECRET_ENCRYPTION_KEY` through a dedicated `backup-encryption-service.js` boundary, encrypting backup payloads with AES-256-GCM and a self-describing envelope format, persisting a key fingerprint column on `backup_artifacts`, and handling transparent decrypt-or-passthrough in restore preview and apply paths so encrypted backups fail closed when the key is unavailable while plaintext backups remain functional when no key is configured.
- Control-plane idempotency now also owns hourly expired-record cleanup through a shared `idempotency-record-cleanup-heartbeat.js` wired into the startup service supervisor, so idempotency key storage does not grow unbounded without manual operator intervention.
- Bootstrap-admin recovery now implements the full emergency recovery lifecycle through a dedicated `admin-recovery-store.js` table-backed persistence layer and `admin-recovery-service.js` business logic boundary, with one-time `HARM-XXXX-XXXX-XXXX` recovery codes hashed at rest using SHA-256 with constant-time comparison, a five-state state machine (`armed`/`completed`/`cancelled`/`expired`/`invalidated`), 15-minute default TTL with 5-30 minute clamping, max 5 invalid attempts before automatic invalidation, maintenance lock conflict checks during arm and complete, `admin_recovery` lock acquisition during completion, admin user creation or re-enablement, full interactive session revocation, and structured audit events for armed/cancelled/expired/invalidated/completed/session-revoked transitions.
- Public recovery status and completion routes (`GET /api/v1/recovery/bootstrap-admin/status`, `POST /api/v1/recovery/bootstrap-admin/complete`) are now registered with IP-based rate limiting (30/5min for status, 5/15min for complete), CSRF exemption for pre-auth access, and no session cookie emission on completion.
- The authenticated shell now also exposes a dedicated `/app/recovery` workspace backed by shared ESM recovery API and composable modules, so backup export/list/detail, restore preview/apply, maintenance-lock control, and diagnostics history all reuse URL-backed state and the existing jobs drill-through instead of route-local control-plane wiring.
- Recovery code generation uses an unambiguous alphanumeric charset excluding `0/O/1/I`, with 30 dedicated tests covering code format, hashing, constant-time verification, arm/status/cancel/complete lifecycle, lock conflicts, attempt threshold invalidation, password validation, existing-user re-enablement, and lock acquisition/release guarantees.
- The library boundary now also recalculates a release-level wanted projection for monitored album and EP releases after library reconciliation, and the dashboard exposes that shared wanted summary through a dedicated route, composable, and panel. The 2026-06-13 read-path cleanup moved wanted reconciliation and wanted-summary monitored-artist counts onto a shared operator-monitoring compatibility projection over `operator_artist_monitoring`, removing their direct dependency on the legacy `metadata_artist_monitoring` table while preserving the current global wanted projection.
- The library boundary now also recalculates a durable discovery-intent projection from wanted releases, exposing release-date and cooldown eligibility through a shared summary route and dashboard panel before real search dispatch exists.
- The library boundary now also dispatches ready automatic discovery requests through shared slskd and import-candidate services at the end of library scan reconciliation, recording search attempts and cooldown state without introducing a second search workflow surface.
- The library boundary now also exposes a dedicated discovery-run worker and protected manual trigger backed by shared operation-run storage, so discovery dispatch can be started independently of a full library scan while keeping the same queue and import seams.
- Server startup now also owns a small in-process discovery heartbeat that periodically starts the shared discovery-run service, so dispatch cadence is no longer tied to the library scan worker.
- The dashboard now also keeps library scan and discovery run selection in URL state, backed by dedicated protected run-detail reads, so audit activity can reopen a specific durable library run inside the existing dashboard panels instead of collapsing operators onto whichever run is latest.
- Discovery heartbeat cadence now comes from a shared environment-backed config helper and is surfaced through both the discovery summary payload and protected system overview, so automatic execution is visible to operators instead of remaining implicit startup behavior.
- The library boundary now also exposes a dedicated existing-library organize preview route backed by shared scan-root metadata, canonical naming helpers, and duplicate-target blocking, so matched files can show before/after rename plans without introducing lazy-loaded or mutation-coupled media logic.
- Startup-owned discovery and import-execution heartbeats now also share a small interval-runner utility for `setInterval` lifecycle, `unref()`, and no-overlap guards, while keeping each heartbeat's due-check and outcome-recording logic inside its own module.
- Startup-owned discovery and import-execution heartbeats now also share a small heartbeat-state helper for common outcome timestamps, skip/error metadata, and last-triggered tracking, while heartbeat-specific state such as transition counts remains an explicit module-level extension.
- Startup-owned discovery and import-execution heartbeats now also share a small interval-config helper for environment-backed cadence parsing and human-readable interval labels, while each heartbeat module still owns its env var name and default cadence.
- Media tooling and inspection now also share a dedicated `media-command-service.js` execution boundary for allowlisted binaries, timeout and buffer caps, and no-shell process execution defaults, so ffmpeg and ffprobe command policy does not drift across services.
- Process startup now also uses a small shared service supervisor to register long-lived background services, start them in one place, and own graceful signal-driven shutdown ordering instead of wiring each startup-owned service directly inside `index.js`.
- Process startup now also uses a dedicated startup-runtime helper so the real server composition path, service registration, listen callback, and graceful shutdown behavior can be tested without turning `index.js` into an orchestration blob.
- Process-owned server entrypoints now also share a small prefixed runtime reporter for stdout/stderr lines and unknown-error formatting, while each caller still owns its domain-specific message text.
- Process-owned migration entrypoints now also share a small async CLI runtime helper for task execution, failure exit-code handling, and always-run cleanup, while each script still owns its task function and success message.
- Process-owned migration entrypoints now also share a migration-specific CLI composition helper for the remaining reporter/pool-cleanup wiring, leaving each script with only its prefix, migration task, and success-message rendering.
- Repo-maintenance validation scripts under `scripts/` now also share a small scripts-local CLI runtime helper for prefixed operator-facing success/error reporting and graceful non-zero exit handling, leaving each entrypoint with only its validation task and success-message rendering.
- Repo-maintenance scripts that invoke external tooling now also share a buffered process runner for captured stdout/stderr, exit-code enforcement, and Windows-safe command execution, so npm audit, Docker smoke validation, and release-mirror verification no longer each carry their own child-process wrapper.
- Repo-maintenance copyright entrypoints now also share a small copyright-maintenance helper aligned to the real `src/server`, `src/client`, and migration layout, including Vue, HTML, and CSS client sources, while `create-migration.js` reuses the same scripts-local runtime with raw stdout so filename-only tooling output survives shared graceful failure handling.
- Repo-maintenance ESM enforcement now also routes through a small helper that scans Vue SFC `<script>` and `<script setup>` blocks in addition to plain `.js` files, so the client runtime cannot bypass the repo's native-ESM guardrails.
- Repo-level validation now runs through a single `npm run validate` contract that composes copyright, migration filename, ESM, test, and build checks, and the existing GitHub Actions workflow now reuses that same command instead of maintaining a separate CI-only check list.
- CI validation now also replays the built migration CLI against a disposable PostgreSQL service through a shared `npm run validate:database` contract, and the shared database env boundary now honors standard password env so the same native ESM runtime can connect safely in CI and future external-Postgres deployments.
- PostgreSQL-backed validation now also waits for a real authenticated query through a shared `npm run wait:database` script before replaying migrations, avoiding the transient init-server readiness window that can satisfy weaker socket-only probes before the final TCP listener is actually usable.
- Migration lineage now also generates a deterministic executable schema snapshot at `src/server/schema-snapshot.sql` through shared migration-manifest and schema-snapshot helpers, and validation now blocks stale snapshots in the same local/CI contract that already enforces filenames, ESM, tests, and builds.
- Repo runtime policy is now explicit through `packageManager`, `engines`, `devEngines`, and `.nvmrc`, so local development and GitHub Actions share a single Node 25.4 plus npm 11 expectation instead of relying on whatever host toolchain happens to be installed.
- Fresh-install startup can now detect an empty public schema, load the checked-in snapshot through a shared schema-bootstrap helper, and then fall through to the existing migration verifier so bootstrap and upgrade paths stay on the same lineage contract instead of diverging.
- Database validation now also proves the snapshot consumption path by creating a disposable database, loading the checked-in snapshot, and asserting that no migrations remain pending, all through the same shared `npm run validate:database` contract already used by CI.
- Docker fresh-install parity now reuses a shared database-preparation service and passes an executable Compose smoke test, and the default Compose baseline now carries the non-root `PUID`/`PGID` contract through `user:` instead of relying on runtime privilege dropping.
- The default Compose baselines now also run with `read_only: true`, the Docker smoke validator proves the container really started with a read-only root filesystem, and Dependabot now raises reviewable update PRs for npm dependencies, Dockerfile bases, Compose image tags, and pinned GitHub Actions.
- The repo now also enforces explicit Compose image version pins through a shared local script, the checked-in `slskd` example no longer floats on `latest`, and a dedicated GitHub Actions security workflow runs npm audit, OSV, Trivy config scanning, and Trivy-backed secret scanning.
- The repo now also emits supply-chain metadata through a dedicated GitHub Actions workflow that builds the distributable artifacts, generates an SPDX SBOM, submits dependency snapshots to GitHub, and attests the built outputs plus emitted SBOM for public-repo runs; release guidance now also distinguishes checked-in version pins from post-publish digest pins.
- Published GitHub releases now also run through a dedicated GHCR image workflow that builds and pushes the multi-architecture container image, records the immutable digest for operator consumption, publishes an SPDX SBOM release asset, and attaches a release verification note with concrete attestation commands.
- Release publication policy now also routes canonical-vs-mirror registry behavior through a shared native ESM registry-capability helper, so GHCR trust metadata, Docker Hub mirror constraints, and a future ORAS-backed referrer-copy promotion path can evolve without re-encoding registry behavior across scripts.
- Release-registry planning now also returns structured canonical and mirror bindings, including capability and credential expectations, and the existing GitHub-output writer publishes those plan keys for workflow consumers instead of requiring each release step to rediscover registry roles.
- Release-registry planning now also carries ORAS-ready referrers distribution-spec guidance per registry, and the registry-config writer exports canonical and Docker Hub referrers-mode fields so a future trusted-mirror workflow can choose `v1.1-referrers-api` versus `v1.1-referrers-tag` without rebuilding registry compatibility logic.
- Trusted-mirror groundwork now also includes shared registry-auth resolution plus ORAS discover/copy helpers with Docker Hub fallback handling, and thin script entrypoints exist for recursive mirror promotion and canonical-vs-mirror referrer verification without introducing workflow-local shell composition.
- Trusted-mirror execution now also includes a lightweight ORAS discovery probe ahead of mirror promotion, so the release workflow records which referrers distribution-spec mode the target registry actually accepted instead of relying only on static Docker Hub fallback assumptions.
- The release-image workflow now also has focused contract coverage for the trusted-mirror path, including the probe step id, shared env boundary, downstream promotion and verification commands, and summary wiring, so future workflow edits cannot silently drift away from the shared ESM release scripts.
- Release validation now also has a fixture-driven workflow-composition test that writes real `GITHUB_OUTPUT`-style files, generates the release metadata assets, and verifies the release contract from those emitted values, so the shared script boundary is executable locally without needing a live GitHub Actions run.
- Release-facing script outputs now also route through a shared native ESM GitHub environment-file helper, so structured `GITHUB_OUTPUT` emission, UTF-8 writes, and multiline heredoc formatting are no longer reimplemented separately across registry-plan and trusted-mirror probe scripts.
- GitHub Actions Markdown summary generation now also has a shared native ESM helper for script-owned summaries, and Docker Hub maintenance reuses it for UTF-8 summary writes plus bullet-list rendering instead of maintaining a one-off append routine.
- Release and container-maintenance workflows now also delegate their remaining summary blocks to thin Node entrypoints backed by the shared summary helper, so workflow YAML no longer owns those Markdown layouts directly and the summary contract is testable in the same ESM layer as the release scripts.
- Workflow-facing scripts now also share a small native ESM environment helper for trimmed required/optional env access and boolean parsing, so release metadata writers, registry-plan probes, mirror verification entrypoints, maintenance scripts, and workflow summary scripts no longer each carry their own env-reading helpers.
- Workflow-facing script entrypoints now also share a small native ESM direct-execution helper that prefers `import.meta.main` when the active Node runtime exposes it and otherwise falls back to the existing `process.argv[1]` plus `pathToFileURL()` comparison, so release, maintenance, smoke-validation, and database-wait scripts no longer duplicate their main-module guard.
- Script entrypoints under `scripts/` now also share a direct-entrypoint runner in `scripts/script-runtime.js`, so validation, release, maintenance, migration, schema-bootstrap, and workflow-summary CLIs all reuse the same import-safe `runDirectScriptTask(import.meta, ...)` boundary instead of mixing top-level side effects with hand-written `runScriptTask` wrappers.
- Script entrypoints that still need positional CLI input now also share a small native ESM `util.parseArgs` wrapper in `scripts/script-arguments.js`, so workflow-summary kinds and migration descriptions no longer read `process.argv` directly outside a single tested argument boundary.
- Script-facing input resolution now also shares a small native ESM helper layer in `scripts/script-input-resolution.js`, so trimmed string lookup, boolean/env fallback, required string-list handling, and strict option parsing with optional positionals no longer need to be reimplemented across release and maintenance entrypoints.
- Release-facing workflow scripts now also share a typed CLI-plus-env input helper in `scripts/release-script-inputs.js`, so registry-plan, release-contract, release-metadata, and trusted-mirror entrypoints can accept strict native `util.parseArgs` options for local/operator use while preserving the existing environment-driven GitHub Actions contract.
- Workflow summary and container-maintenance entrypoints now also share typed CLI-plus-env input helpers in `scripts/workflow-summary-inputs.js` and `scripts/container-maintenance-inputs.js`, so release-summary and Docker Hub maintenance scripts can accept strict native flags for local/operator runs while reusing the same env-driven workflow contract in GitHub Actions.
- The release and maintenance script layer now also has a documented native Node local replay path in `docs/WORKFLOW_SCRIPT_LOCAL_REPLAY.md`, so operators can preflight registry-plan, metadata, contract, trusted-mirror, summary, and Docker Hub maintenance commands with layered `--env-file` inputs and local GitHub output files instead of waiting for the first GitHub Actions execution.
- Release publication now also reuses a shared Docker smoke validator to verify the published immutable image against both fresh-install and existing-data startup paths, emits a machine-readable release manifest asset, records GHCR as the canonical provenance and attestation trust boundary by default, verifies Docker Hub as an optional digest-parity mirror by default, can opt into ORAS-backed trusted mirror promotion plus referrer verification when explicitly configured, publishes a ready-to-use immutable Compose override asset for operators, mirrors release tags to Docker Hub through GitHub-stored Docker credentials, and schedules stale-image cleanup for both registries.
- The release-image workflow now also supports optional published-image upgrade-path validation by taking a prior immutable baseline image through workflow input or repository variable, reusing the shared Docker smoke upgrade contract, and uploading machine-readable upgrade evidence as a retained workflow artifact.
- A shared `npm run validate:docker-deployment-path` wrapper now orchestrates fresh-install plus optional released-image and upgrade-path validation from one native ESM entrypoint, so live release evidence can be replayed with a stable evidence-directory contract instead of remembering three separate commands and filenames.
- That deployment-path wrapper now also supports an optional machine-readable summary manifest, so one live Docker run can emit a top-level record of which packaged-runtime checks ran and which per-step evidence files were produced without moving that orchestration into workflow-local shell logic.
- The release-image workflow now also writes and uploads a machine-readable deployment summary artifact from the archived published-image and optional upgrade-path smoke evidence files, so release consumers can fetch one top-level packaged-runtime evidence record without re-deriving it from multiple artifacts.
- The protected system overview now reuses that same shared validation boundary to surface a lightweight path-validation summary on the dashboard instead of building a second health-check model.
- Local metadata read and search routes now exist for imported artists, release groups, and releases, and substring search groundwork is in place through a timestamped `pg_trgm` index migration.
- A native Node.js test runner is now wired into the repo, with executable coverage around the shared local metadata search service, local-search workflow modules, the artist and release workflow local-first behaviors, and broader route-level metadata HTTP contracts backed by a shared native HTTP test helper.
- The release detail modal surface now ships as `ReleaseDetailModal.vue` (opened from `ReleaseCard` click in `SearchView` and `ArtistDetailView`), backed by a dedicated tracklist endpoint (`GET /api/v1/metadata/musicbrainz/release-groups/:rgMbid/tracklist`) and canonical-override endpoint (`PATCH /api/v1/metadata/releases/:releaseId/canonical`). The modal renders the full tracklist disc-grouped with owned-track indicators, an edition switcher with admin-only "Set as Default Edition" action, an ownership callout, a request action row with requester-for selector for admins, and a MusicBrainz source note when local metadata is not yet imported. `canonical-release-service.js` owns a pure five-step canonical selection algorithm (official filter → deluxe exclusion → earliest date → country preference → created_at tie-break) plus user-override and algorithm-driven persistence paths. `release-group-tracklist-service.js` serves the local path with ownership and per-track indicators and falls back to MusicBrainz with a fire-and-forget background import. `useReleaseDetail` and `useActiveUsers` client composables manage abort-safe loading, edition switching, canonical override, and module-level active-user caching. DB migration adds `is_canonical` column with partial unique index to `metadata_releases`. Test suites add 39 new passing tests: 14 canonical-release-service, 7 release-group-tracklist-service, 3 metadata route, 6 useActiveUsers, 9 useReleaseDetail. Total: 982 server / 558 client tests pass.
- The target-user inbox surface now closes the delegated-request notification loop for requesters: `MyRequestsView` renders `RequestNotificationsPanel` above the request grid when the current user has delegated-request receipts, fulfillment progress updates, or failure notifications. `useMyRequestNotifications` composable wraps the existing `media-request-summary?scope=mine` endpoint with injectable deps, tracking reactive `notifications`, `counts`, `checkedAt`, `isLoading`, and `errorMessage`. `AppShell` polls the same endpoint every 60 s for requester sessions and injects a live count badge onto the "My Requests" sidebar nav item via a `visibleNav` computed. `fetchMyRequestSummary` added to `media-request-api.js`. Test suites: `useMyRequestNotifications.test.js` (9 tests), 1 new test in `media-request-api.test.js`. Total: 982 server / 568 client tests pass.
- Release Radar and Coming Soon slices now ship as a unified `GET /api/v1/library/release-radar` read route: `recent` returns monitored-artist releases in the last 30 days (newest-first), `upcoming` returns releases in the next 90 days (soonest-first). Pure SQL over existing `metadata_release_groups` / authenticated-user `operator_artist_monitoring` rows — no new schema, no background job. `library-release-radar-store.js` owns the parameterized SQL window query; `library-release-radar-service.js` owns window computation, today-split ordering, authenticated app-user scope, and limit clamping (1–250). Client: `fetchReleaseRadar` in `library-api.js`, `release-radar-normalization.js` (`normalizeRadarReleaseForCard`, `getRadarWindowLabel`), `useReleaseRadar.js` composable. `ActivityReleasesView.vue` at `activity-releases` route replaces `ActivityComingSoonView` — full-page recent + upcoming card grids with `ConfirmRequestModal`. `RequesterHomePanel.vue` gains a horizontal-scroll radar strip (up to 8 items, "See all" link to `activity-releases`) above the artist grid. Route inventory updated. Test suites: `library-release-radar-service.test.js`, `library-release-radar-store.test.js`, route coverage in `library-routes.test.js`, `library-module.test.js` updated, `release-radar-normalization.test.js` (21 client), `useReleaseRadar.test.js` (13 client). The 2026-06-13 cleanup removed the legacy `metadata_artist_monitoring` read from this Release Radar path.
- Household activity feed now ships as `GET /api/v1/activity/feed`: a session-authenticated read endpoint returning the household-level event stream for requests created, artists monitored, downloads completed, releases added, and requests fulfilled. New `activity_events` table (migration `20260601_100000_create_activity_events.sql`) with `event_type` check constraint, actor/entity columns, and denormalized title + artist for tombstone safety. `activity-event-store.js` (INSERT + parameterized SELECT), `activity-event-service.js` (fire-and-forget `recordActivityEvent`, `buildActivityFeed` with limit clamping and eventType validation), `activity-module.js` (factory wiring), `activity-routes.js` (Express route registration). Emitters fire-and-forget into `library-media-request-service.js` (`request_created`) and `metadata-monitoring-service.js` (`artist_monitored`, with `actorUserId` forwarded from the route session). Activity module wired into `app.js`; library and metadata modules receive `recordActivityEventFn`. Client: `activity-api.js` (`fetchActivityFeed`), `activity-event-normalization.js` (`normalizeActivityEvent`, `getActivityEventLabel` with owner-specific `request_fulfilled` variant, `getActivityEventIcon`), `useActivityFeed.js` composable (injectable `fetchFeedFn`, `limit` option, reactive `events`/`checkedAt`/`total`/`hasEvents`/`isEmpty`/`isLoading`/`errorMessage`). `ActivityFeedView.vue` at `/app/activity/feed` (operator-only full-page view). Inline "Recent Activity" panel added to `RequesterHomePanel.vue` (last 10 events, compact list, hides when empty). Route inventory updated; `activity-feed` added to `requesterRestrictedRouteNames`. Schema snapshot regenerated. `route-inventory.test.js` and `metadata-routes.test.js` updated. Test suites: `activity-event-service.test.js` (14 server), `activity-routes.test.js` (6 server), `activity-event-normalization.test.js` (24 client), `useActivityFeed.test.js` (14 client). Total: 1014 server / 640 client tests pass, no regressions.
- Release-added activity now also routes through a shared `src/shared/release-activity-presentation.js` contract, with versioned payload normalization, legacy-payload fallback for persisted rows, a dedicated server-side `release-added-activity-presentation-service.js` emitter boundary, and client rendering that no longer hand-interprets loosely coupled multi-release payloads. Organize-apply and import-apply workers now emit the same normalized release presentation plus operation-run source metadata, and multi-release labels now render as `N releases added to library` instead of incorrectly appending one primary artist name across the whole batch.
- Audited request reassignment now ships as an admin-only ownership transfer flow. New `media_request_events` append-only table (migration `20260522_030000_media_request_events.sql`) records reassigned events with previous/new `requested_for_user_id`, optional reason, actor, and request-context details. Store layer adds `updateRequestedForUserId`, `insertMediaRequestEvent`, and `listMediaRequestEvents`. Service layer adds `reassignMediaRequest` (admin guard, target-eligibility check, atomic update + domain event + audit trail + activity event) and `getMediaRequestReassignmentHistory`. Routes: `POST /api/v1/library/media-requests/:mediaRequestId/reassign` (fresh admin session + CSRF), `GET /api/v1/library/media-requests/:mediaRequestId/reassignment-history` (admin session). Route inventory, library module, and route-inventory test updated. Test suites: 7 new service tests, 3 new route tests, module test updated. Total: 1490 server / 2660 client tests pass.
- Maintenance-lock pause proof now covers every in-flight operation worker with dedicated native tests: organize apply, import apply, transcode orchestration, media inspection, artwork cleanup, and external intake planning all requeue paused runs with correct summary metadata and lease release without consuming retry budget. Combined with existing library scan, library discovery, and import execution pause proofs plus the integration-level library scan worker pause test, every queued background operation now has verified pause behavior through the shared interruption gate. Total: 1524 server / 2660 client tests pass, no regressions.
- Integration coverage now also exercises import apply run store lifecycle (create, claim, start, lease, complete, and summary/detail route reads), media inspection run start via HTTP with operation-history and audit-trail verification, and stranded-run recovery (detect, retry, fail, and double-recovery guard) against the real HTTP and database-backed server graph. Total: 1518 server / 2660 client tests pass, 5 new integration scenarios, no regressions.
- Client UI for request reassignment now ships as an admin-facing `ReassignRequestModal.vue` component (native `<dialog>`, accessible markup, user selector with eligibility filtering, optional reason, inline event history timeline, loading/error/reassigning states) plus a standalone `RequestEventTimeline.vue` component for inline event display. New `useMediaRequestReassignment` composable manages history loading, eligible-user loading, and reassignment submission with injectable API functions. Client API: `reassignMediaRequest` and `fetchMediaRequestReassignmentHistory` in `library-api.js`. Presentation helpers: `getReassignmentEventLabel`, `getReassignmentEventTone`, `formatReassignmentEventDescription` in `request-music-form.js`. `RequestMusicView.vue` gains admin-only "Reassign" button per request in "All requests" scope, wired to the modal with toast feedback and list refresh. Test suites: `useMediaRequestReassignment.test.js` (15 client), `library-api.test.js` (3 new), `request-music-form.test.js` (7 new). Total: 1518 server / 2684 client tests pass, no regressions.
- Request detail view now ships as a dedicated route at `/app/requests/:id` (`RequestDetailView.vue`). Server: new `buildMediaRequestDetail` service method fetches a single request, enriches with fulfillment status via the shared fulfillment service, and loads event history. New route `GET /api/v1/library/media-requests/:mediaRequestId` (authenticated read). Route inventory updated. Client: `useMediaRequestDetail` composable with injectable fetch, `fetchMediaRequestDetail` API function, `RequestDetailView.vue` with stat grid (status, created, fulfillment, fan-out), detail fields (artist, release, track, source, notes, requested by/for, matched release), and inline `RequestEventTimeline`. `RequestMusicView.vue` request headlines now link to the detail route. Test suites: 2 new server route tests, 7 new client composable tests, 2 new client API tests. Total: 1520 server / 2693 client tests pass, no regressions.
- RequestCard in the My Requests grid is now fully clickable, navigating to `/app/requests/:id`. Uses `<router-link custom>` with keyboard navigation, focus-visible outline, and native link semantics. Total: 1520 server / 2693 client tests pass.
- Import candidate fulfillment pipeline section on request detail view. When `fulfillmentStatus.importCandidateId` exists, an "Import pipeline" card shows the candidate status pill (using `candidateStatusLabel`/`candidateStatusTone` from `import-candidate-presentation.js`), fulfillment detail text, and a link to open the candidate directly in the import review workspace (`/app/activity/candidates?candidate=<id>`). No server changes needed — the `fulfillmentStatus` enrichment already includes `importCandidateId` and `importCandidateStatus`. Total: 1520 server / 2693 client tests pass, no regressions.
- Admin reassign action wired into request detail view (`RequestDetailView.vue`). Admin-only "Reassign" button in the page header opens `ReassignRequestModal`. After successful reassignment the detail reloads to reflect updated ownership. Follows the same `useMediaRequestReassignment` composable pattern as `RequestMusicView`. Total: 1520 server / 2693 client tests pass, no regressions.
- Request cancellation with append-only event trail. Migration `20260622_010000` expands `media_requests.request_state` CHECK constraint to include `cancelled` and `failed`. Server: `updateRequestState` store method, `cancelMediaRequest` service method (owner-or-admin authorization, state validation, event insertion, audit + activity events). Route: `POST /api/v1/library/media-requests/:mediaRequestId/cancel` (authenticated, CSRF). Client: `cancelMediaRequest` API function, `isRequestCancellable` / `getRequestStateTone` presentation helpers, cancel button on `RequestDetailView` header and `RequestMusicView` per-request row. 2 new server route tests. Total: 1524 server / 2705 client tests pass, no regressions.
- Request list filtering and search. Server: `buildListFilter` replaces `buildVisibilityFilter` in `library-media-request-store.js`, supporting `requestState`, `requestKind`, `search` (ILIKE on artist/release/track), and `limit`/`offset` pagination alongside existing `requestedForUserId` scope. `listMediaRequests` in service and store layers pass through all filter params. Route `GET /api/v1/library/media-requests` parses new query params (`requestState`, `requestKind`, `search`, `limit`, `offset`). Client: `useRequestListFilters` composable with reactive filter state, `activeFilterCount`, `toApiParams()`, `resetFilters()`, `updateFilter()`. `RequestListFilters.vue` controlled component (search input, status select, type select, Apply/Reset buttons) following `ImportCandidateFilters` pattern. `fetchMediaRequests` in `library-api.js` passes filter params via `URLSearchParams`. `useRequestMusicForm.loadRequestDashboard()` accepts optional filter overrides. `RequestMusicView.vue` renders filter card between notifications and request history. 2 new server route tests, 12 new client composable tests. Total: 1522 server / 2705 client tests pass, no regressions.
- Fan-out child request cancellation cascade. Cancelling a parent request with `fanOutChildCount > 0` now atomically cancels all children still in a cancellable state (`needs_fetch`, `needs_review`). Store: `cancelFanOutChildren` bulk-updates child rows by `fan_out_parent_id`, returns affected IDs. Service: `cancelMediaRequest` checks `fanOutChildCount`, cascades to children after parent cancellation, inserts per-child `cancelled` events with `cascadeFromParentId` detail, records a `media_request_fan_out_cancelled` audit event, returns `cancelledChildCount`. Children already in terminal states (`already_exists`, `cancelled`, `failed`) are skipped. 2 store tests, 2 service tests. Total: 1528 server / 2705 client tests pass, no regressions.
- Client cascade-aware cancel toast feedback. `getCancelToastMessage` in `request-music-form.js` produces singular/plural child count messages when `cancelledChildCount > 0`, otherwise falls back to the existing `Request cancelled.` message. Both `RequestDetailView` and `RequestMusicView` read `result.mediaRequest.cancelledChildCount` from the cancel API response and pass it through the presentation helper. 5 new client tests. Total: 1528 server / 2710 client tests pass, no regressions.
- Request list sort options. Client-side sorting via `sortRequests` in `useRequestListFilters` composable — supports newest-first (default), oldest-first, by status, and by type. Sort state (`sortBy`) lives in the filter reactive state but is excluded from `activeFilterCount` and `toApiParams` (purely client-side reordering, no server round-trip). `RequestListFilters.vue` gains a Sort dropdown with the same visual pattern as the existing Status/Type selects. `RequestMusicView` uses a `sortedRequests` computed that wraps `filters.sortRequests(rm.mediaRequests.value)` for the `v-for`. 8 new client tests covering all sort modes, immutability, filter-count exclusion, and reset behaviour. Total: 1528 server / 2718 client tests pass, no regressions.
- Request list URL-backed filter and sort state. New `request-list-route-state.js` normalisation library following the established `import-review-route-state.js` pattern — `normalizeRequestListRouteState` validates query values against allowlisted states/kinds/sorts, `buildRequestListRouteQuery` serialises non-empty fields, `getRequestListRouteStateKey` produces a deterministic JSON key for dedup. `useRequestListFilters` now accepts optional `route`/`router` injections: initial state hydrates from `route.query`, `applyFilters` and `resetFilters` write back via `router.replace` (no history pollution), `hydrateFromRoute` supports re-hydration on back-button navigation. `RequestMusicView` passes its `useRoute()`/`useRouter()` instances and watches the four filter query keys to re-hydrate and re-load on URL change. Composable still works without route/router (tests pass either way). Unrelated query params are preserved. 10 route-state tests, 8 composable route tests. Total: 1528 server / 2736 client tests pass, no regressions.
- This file is the operational execution tracker for the initial V1 build.

## Remaining Priority Snapshot (2026-05-04)

Highest-priority remaining product-risk slices:

1. Validate the supported deployment path end to end: fresh install, upgrade, restore preview/apply, and rollback-aware behavior.
2. Finish the remaining critical-path validation depth: broader packaged-runtime scenarios with linked fulfillment evidence, fixture packs, and practical UI end-to-end coverage for the operator workflows already implemented.
3. Close the remaining runtime/deployment hardening gaps that still affect operability, especially whole-system maintenance-lock pause proof and upgrade plus restore safety under realistic containerized startup conditions.

Highest-priority product-value slices if feature work is intentionally pulled forward:

1. Build a shared release-event presentation contract across server/client. Release activity now has better identity and richer detail, but the payload shape is still loosely coupled rather than formally normalized.
2. Add per-run release drilldown from activity entries. Inline multi-release detail is useful, but the next step is linking those entries into existing operations/import detail patterns for full drilldown.
3. Implement the actual async push delivery worker around `notification_queue`. The queue table and helpers exist, and we now use it as durable history, but a full worker-based delivery path would unlock true decoupled push dispatch.

Completed product-value slices:

1. Split Request Music ownership into `requestedByUserId` and `requestedForUserId`, then add target-user inbox and notification visibility for delegated requests.
2. Extend the shipped Plex import base with conflict-safe merge/relink actions, richer library-access awareness, and lifecycle-safe refresh semantics on `app_users`.
3. Add direct Plex sign-in for direct-capable Plex accounts plus local invite/claim/password fallback for imported Plex managed users, all bound to the same shared `app_users` identity model.

Lower-priority or conditional slices:

- Plex-linked onboarding remains a product-fit feature, but it is not currently on the shortest path to V1 readiness.
- If Plex onboarding is pursued before broader release-closure work, the preferred sequence is: connect a Plex owner account, import Plex users into `app_users`, add admin-targeted Request Music ownership (`requestedForUserId`), add direct Plex sign-in for direct-capable Plex accounts, add local credential fallback for imported Plex managed users, then extend requests into explicit per-target fan-out records.
- Planned Plex and request follow-ons should stay explicit:
  - implement direct Plex sign-in only after Plex import and admin-targeted request ownership exist, so the imported `app_users` table stays the durable identity boundary
  - implement a local invite, claim, or password-set fallback for imported Plex managed users so they can access Harmoniarr directly even though Plex does not provide direct login semantics for them
  - implement Plex user re-sync as an admin-triggered import or refresh operation with visible diff results before considering any later automatic reconciliation
  - implement multi-user request fan-out as explicit per-target records rather than one ambiguous shared request
  - implement conflict-safe Plex identity merge, relink, and unlink flows for cases where imported Plex users match existing local Harmoniarr users
  - implement request reassignment as an explicit audited transition with append-only `media_request_events` table, admin-only `POST /api/v1/library/media-requests/:mediaRequestId/reassign` route, target-eligibility guard, domain event plus global audit trail, and reassignment-history read endpoint
  - implement target-user notifications and inbox visibility so users can see when an admin requested, reviewed, queued, or fulfilled media on their behalf
  - implement Plex library-access awareness on imported users so Harmoniarr can reflect which Plex-linked users should receive request-targeting and fulfillment affordances
  - implement request completion signals that combine Harmoniarr workflow state with Plex webhook evidence when available, without letting Plex become the authoritative workflow source
  - implement Plex webhook intake, when the operator's Plex environment supports it, for high-value playback and library events that can enrich request status, fulfillment visibility, or user activity diagnostics
- Personal or integration token flows remain conditional and should not be built unless a concrete non-browser automation need exists.
- Remaining Phase 0 and start-gate items should be treated as documentation and contract-closure work unless they uncover a real architectural conflict.

## Component Task Lists

These companion docs break the implementation plan into component-specific execution tracks:

- `docs/SCHEMA_MIGRATION_TASK_LIST.md`
- `docs/API_ROUTE_CONTRACT_TASK_LIST.md`
- `docs/FRONTEND_SCREEN_NAV_TASK_LIST.md`
- `docs/RELEASE_VALIDATION_TASK_LIST.md`
- `docs/DEFERRED_V1_1_TASK_LIST.md`

## Implementation Start Gate

Before implementation starts in earnest, confirm all of the following:

Status note:
- Most of these boxes now represent documentation-governance closure rather than true implementation blockers, because the repo has already progressed through Phases 1 to 6 feature delivery and validation work.

- [ ] Review `docs/harmoniarr.md` implementation plan section end to end.
- [ ] Confirm `docs/SECURITY_POLICY.md` remains the authoritative source for auth, secret handling, and recovery-sensitive controls.
- [ ] Confirm `docs/BACKUP_RESTORE_DESIGN.md` remains the authoritative source for maintenance locks, backup/export, and restore semantics.
- [ ] Confirm `docs/ADMIN_RECOVERY_RUNBOOK.md` remains aligned with planned bootstrap-admin recovery behavior.
- [ ] Confirm `docs/DATABASE_MODEL.md` includes the minimum V1 tables and relationships needed for the first migration package.
- [x] Lock timestamp-based migration naming and schema snapshot update expectations.
- [ ] Lock route contract rules: validation, normalized success/error payloads, audit expectations, and idempotency expectations.
- [ ] Lock workflow state-machine vocabulary for import review, job execution, restore operations, and maintenance mode.
- [ ] Confirm destructive media actions remain preview-first and operator-gated.

## Phase Mapping (Plan To Task List)

The implementation plan is the architecture and sequencing source of truth. This file is the execution tracker.

| Implementation plan phase | Task list phase |
|---|---|
| Phase 0 - Alignment, Contract Freeze, And Execution Gates | Phase 0 - Prep and Alignment |
| Phase 1 - Platform Bootstrap, Runtime Shell, And Persistence Foundation | Phase 1 - Bootstrap, Packaging, and Schema Foundation |
| Phase 2 - Authentication, Authorization, Settings, And Control-Plane Basics | Phase 2 - Auth, Sessions, and Settings Contracts |
| Phase 3 - Canonical Music Model, Import Discovery, And Review-First Workflow State | Phase 3 - Canonical Model and Import Review |
| Phase 4 - Background Jobs, Media Operations, And Notification Surfaces | Phase 4 - Jobs, Media Operations, and Notifications |
| Phase 5 - Recovery, Backup/Restore, Diagnostics, And Operational Hardening | Phase 5 - Recovery, Restore, and Diagnostics |
| Phase 6 - Testing, Packaging, Upgrade Safety, And V1 Release Closure | Phase 6 - Validation, Release, and Closure |

## Critical Path

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4 and Phase 5 after Phase 3 contracts stabilize
6. Phase 6

Parallelizable after contract stabilization:

- Frontend app-shell work during late Phase 1.
- Backup/restore UI scaffolding during Phase 5 after maintenance-lock schema and route contracts are fixed.
- README and packaging-document updates during Phase 6, but not marked complete until validation gates pass.

## Phase 0 - Prep and Alignment

Status note:
- These items should now be closed as explicit documentation and policy decisions. They are still important, but they should no longer be treated as prerequisites for the already-shipped implementation slices unless a contradiction is discovered.

- [ ] Confirm V1 scope boundaries in `docs/harmoniarr.md` are accepted with no unresolved blockers.
- [ ] Record any explicit V1 deferrals or out-of-scope decisions as durable documentation rather than implicit assumptions.
- [ ] Confirm authoritative docs and ownership boundaries for security, backup/restore, admin recovery, and database model.
- [ ] Lock initial Docker-first deployment assumptions for embedded Postgres, persistent volumes, FFmpeg presence, and slskd dependency shape.
- [ ] Confirm no route group will ship without validation, normalized errors, audit rules, and permission requirements.
- [x] Lock API exposure rules for public vs privileged routes, request size/content-type limits, browser security headers, rate limits, and outbound host controls.
- [x] Add a code-level route inventory manifest and validation so registered routes cannot drift without explicit method/path/access classification.
- [ ] Confirm no filesystem mutation path bypasses preview, logging, and operator confirmation rules.

## Phase 1 - Bootstrap, Packaging, And Schema Foundation

- [x] Create server bootstrap skeleton with config loading, startup validation, logger wiring, and HTTP app construction.
- [x] Add fail-closed startup checks for required directories, secrets, database reachability, and invalid configuration combinations.
  - Startup now routes through a dedicated `startup-validation-service.js` boundary before the server begins listening, so invalid bootstrap-owner configuration, invalid secret-encryption-key configuration, database reachability failure, and unhealthy runtime roots all fail closed before any HTTP listener is exposed.
  - The startup gate reuses the existing path-validation boundary for app-data, downloads, staging, music, and transcode-temp roots instead of adding route-local or module-local filesystem checks.
- [x] Add fail-closed HTTP perimeter defaults for body-size limits, supported content types, safe browser-facing security headers, and generic error/not-found behavior.
- [x] Create base repository/module structure for routes, validators, services, repositories, jobs, adapters, and shared utilities.
- [x] Add initial database connection layer and migration runner.
- [x] Create first migration package for users, refresh tokens, settings/config, audit events, maintenance locks, operation runs, and job leases.
- [x] Add health and readiness endpoints with structured status payloads.
- [x] Create initial Vue app shell, router, API client, and guarded bootstrap state.
- [x] Add initial Docker image/build files and compose layout for app container, embedded Postgres persistence, and startup ordering.
- [ ] Verify FFmpeg and required media inspection tooling are present in the standard image.
  - A shared `media-tooling-status-service.js` now probes `ffmpeg -version` and `ffprobe -version` and publishes safe availability flags (`ffmpegAvailable`, `ffprobeAvailable`) through the existing dependency-health surface.
  - App composition now includes a `media_tooling` dependency check alongside `slskd`, so system overview and diagnostics can expose tooling readiness before media inspection/transcoding execution paths are enabled.
  - The shared Docker smoke validator now also executes `ffmpeg -version` and `ffprobe -version` inside the running container and can emit machine-readable evidence for release workflows, but the task remains open until one live Docker-capable execution proves the standard image path end to end.
- [x] Update schema snapshot/documentation once the initial migration package is stable.

## Phase 2 - Auth, Sessions, And Settings Contracts

- [x] Implement bootstrap-admin creation flow for first-run setup.
  - The first-run bootstrap flow now supports an optional owner-claim mode driven by `HARMONIARR_BOOTSTRAP_OWNER_USERNAME`, `HARMONIARR_BOOTSTRAP_OWNER_EMAIL`, and `HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE`, so a deployment can preseed the expected administrator identity and require a one-time claim secret instead of leaving first-user creation open to whoever reaches the UI first.
- [x] Implement password hashing, login, logout, and refresh-token rotation.
- [x] Complete forced re-auth behavior, including password-change and active-session management resolution flows reachable without fresh-admin session requirements.
- [x] Add CSRF protection for cookie-authenticated write routes, with an explicit deployment-level opt-out for tightly trusted local-only installs.
- [ ] Extend route-tier enforcement beyond the now-admin-gated settings, system, and slskd operational routes to the remaining privileged, maintenance-locked, and import/library mutation contexts; metadata, import, and library mutations now require fresh admin sessions.
- [x] Add explicit API perimeter hardening for auth/bootstrap/control-plane surfaces, including rate limits, method/content-type enforcement, and abuse logging for repeated contract failures.
- [x] Implement settings/config service with allowlisted keys, validation, normalization, path validation feedback, and audit logging.
- [x] Add masking, preservation, and clear semantics for the first secret-bearing settings surface (`slskd.apiKey`) with encrypted-at-rest persistence and environment fallback.
- [x] Extend allowlisted settings with artwork-fetch, extraction, derivative, and cleanup controls needed before artwork workers ship.
- [ ] If non-browser automation is actually needed, implement lightweight personal/integration token create-revoke-expire flows for local companion-app use without turning Harmoniarr into a production-style API key platform.
- [ ] Add outbound-request hardening for configurable integrations, including SSRF-aware host validation, redirect posture, and deployable egress restrictions; base-URL validation, redirect denial, and host allowlisting now exist, but deployable egress restrictions and DNS/network-layer containment are still missing.
- [x] Add frontend login and bootstrap-admin flows.
- [x] Add frontend session-expiry flows.
- [x] Add frontend settings surfaces for core system config and validation feedback.
- [x] Add frontend secret entry, masking, and clear UX for the initial protected settings field (`slskd.apiKey`).
- [x] Verify the first protected settings field does not round-trip in plaintext after initial write.
- [x] Add an admin-managed local user directory with shared role-permission presets and protected create/update flows as the durable identity baseline for non-bootstrap accounts.
- [ ] Implement provider-linked onboarding for Plex users using server-side Plex PIN auth, shared-server user import or claim flows, and explicit role mapping without ever collecting Plex passwords locally.
  - Owner-claim groundwork now exists for the local path: first-run bootstrap status can advertise a preseeded owner identity hint, and the bootstrap route can require a matching one-time claim code plus owner username/email before creating the initial admin account.
  - Next work on this item should bind Plex PIN auth onto that same shared owner-claim boundary rather than creating a second parallel first-run ownership flow.
  - Decision: Plex import and Plex sign-in are related but not identical features. The first Plex slice should import users from Plex into `app_users` and keep that as the durable identity boundary before direct Plex sign-in is added.
  - Progress: the first Plex slice now exists. Admins can link a Plex owner account through the shared provider-link boundary, preview Plex Home users, import non-conflicting Plex-linked `app_users`, and refresh metadata for already-linked identities without creating a second local identity store.
  - Decision: Plex managed accounts may be imported as Harmoniarr users for request ownership, permissions, notifications, and managed-library provisioning, but they should not be treated as direct-sign-in-capable identities unless Plex exposes a supported direct auth path for them.
  - Decision: Harmoniarr should never collect or proxy Plex passwords. Browser auth must use the current Plex PIN/JWT flow server-side.
  - Decision: imported Plex managed users should get a first-class local invite, claim, or password-set fallback bound to the existing `app_users` record rather than attempting to emulate unsupported Plex login semantics.
  - Decision: Plex directory synchronization should start as an explicit admin-run import or refresh action with visible diff results, conflict reporting, and operator confirmation rules. Automatic removal or disabling of existing Harmoniarr users based on Plex state should wait until lifecycle semantics are proven through that manual flow.
  - Decision: Plex import should include conflict-safe merge, relink, and unlink actions so existing local users can be bound to imported Plex identities without unsafe silent reassignment.
- [ ] Implement direct Plex sign-in for imported direct-capable Plex accounts through the same shared session and route-tier model as local auth, without introducing a second identity store.
- [ ] Implement a local invite, claim, or password-set flow for imported Plex managed users so they can authenticate into Harmoniarr directly while remaining linked to the imported `app_users` identity.
  - Progress: the shared admin-managed user boundary now supports issuing a temporary local password for any existing user, revokes active sessions, and forces a password change on next login, giving Plex-linked managed users a practical operator-driven fallback path.
  - Progress: existing users now also support one-time admin-issued claim codes through the shared auth boundary, letting a Plex-linked or otherwise pre-created account set its own local password on the public claim screen without auto-login while preserving the same `app_users` identity and session model.
- [ ] Extend the admin-run Plex directory import or refresh surface with conflict-safe merge or relink actions and safe no-auto-delete lifecycle semantics.
  - Progress: a shipped base flow now covers owner-account linking, preview or diff classification, non-conflicting user import into `app_users`, and metadata refresh for already-linked Plex users.
  - Progress: the shared Plex import boundary now also exposes a conflict-safe relink action, so admins can bind a previewed conflicting Plex identity onto the matching existing `app_users` record without silent reassignment or auto-delete behavior.
  - Progress: the existing Settings view now surfaces that relink action directly inside the Plex directory preview, so operators can resolve one-to-one conflicts without leaving the shared import workflow or falling back to manual API calls.
  - Progress: Plex-linked users now expose a shared local-auth readiness summary keyed to real local password establishment instead of the imported placeholder hash, and admins can remove a Plex link only when that fallback path is ready, preserving the `app_users` record while clearing the linked Plex profile metadata.
- [ ] Extend Plex library-access awareness on imported users so Harmoniarr can distinguish which Plex-linked users have relevant server or library visibility when presenting request-targeting, provisioning, and fulfillment affordances.
  - Progress: imported Plex profiles now persist coarse access-state metadata and raw evidence; follow-on work should turn that into stricter request-targeting and fulfillment policy.
  - Progress: imported and linked Plex profiles now also expose a shared derived access-policy summary that distinguishes confirmed owner or shared-library visibility from review-required Plex Home membership, giving future request-targeting and fulfillment UI a stable server-owned eligibility contract without another schema change.
- [ ] Verify admin recovery assumptions remain compatible with `docs/ADMIN_RECOVERY_RUNBOOK.md`.

## Phase 3 - Canonical Model And Import Review

- [x] Create canonical artist, release, release group, track, file, external-identity, import-candidate, and review-decision data models.
- [x] Add artwork asset, artwork assignment, and observed file-tag tables as part of the first canonical metadata expansion beyond the auth/platform foundation.
- [x] Implement MusicBrainz-first identity normalization and provenance storage for canonical metadata imports.
- [x] Add local metadata read and search surfaces for imported artists, release groups, and releases so imported entities can be reopened without provider-first search.
- [x] Implement slskd adapter boundary with normalized request/result/error contracts.
- [x] Add authenticated slskd discovery routes for search start, polling, and response reads.
- [x] Add discovery/import candidate ingestion that stores normalized domain state separately from raw provider payloads.
- [x] Add external playlist and collection URL intake for Spotify, YouTube, Apple Music, and similar sources, normalizing provider URLs into canonical IDs and paged artist, album, and track ingest requests before review-candidate generation.
  - Canonical URL normalization now runs through a shared `normalizeExternalMediaSource` parser that parses Spotify, YouTube, and Apple Music URLs into provider-agnostic resource descriptors with type, identifier, storefront, and canonical URL fields.
  - Supported `external_url` requests now auto-dispatch a durable `library_external_intake_planning` operation run via the shared queue and operation-run-descriptor model.
  - The planning worker materializes normalized `provider_ingest_requests` rows from a durable `buildProviderIngestPlan` call, patches `evidence.providerRequest` and `evidence.providerAutomation` on the request row, and records audit events through the shared boundary.
  - Duplicate planning runs are prevented by an idempotency check in `library-external-intake-service.js` before any run is created.
  - Migration `20260502_000011_provider_ingest_request_intents.sql` adds the `provider_ingest_requests` table with provider, resource type, ingest target, identifier, canonical URL, pagination state, status, and evidence columns.
- [x] Model playlist import expansion policy so operators can keep selection bounded to playlist albums or opt into additional album discovery for artists referenced by the playlist.
- [x] Add a dedicated Request Music dashboard and persisted user-owned media request inbox for release, track, and provider URL submissions, with requester-scoped history and admin all-request visibility separate from import review.
- [x] Split Request Music ownership into acting user vs target user so admins can submit requests for another Harmoniarr user.
  - Decision: request persistence should distinguish `requestedByUserId` from `requestedForUserId` instead of overloading one field to mean both.
  - Decision: non-admin users remain self-only, while admins can choose any eligible user as the request target.
  - Decision: request history and detail views should show both "requested by" and "requested for", and import or apply ownership plus managed-library routing should follow `requestedForUserId`.
  - Progress: media requests now persist both acting and target users, the shared request service validates delegated targets against a server-owned eligibility contract, and Request Music intake plus history now surface delegated "requested by" versus target-owned "requested for" behavior without introducing a second request model.
  - Decision: initial implementation should land the single-target ownership split first, then extend into multi-user fan-out through explicit per-target child requests or equivalent durable target-owned records rather than one ambiguous request shared across many users.
  - Decision: target users should receive explicit inbox and notification visibility for admin-on-behalf request creation, review, queueing, fulfillment, and failure states.
- [x] Extend admin-targeted Request Music into explicit per-target fan-out records so a single admin action can materialize durable target-owned requests for multiple users without collapsing ownership or audit history.
  - Added `fan_out_parent_id` and `fan_out_child_count` columns to `media_requests` via migration `20260522_020000_media_request_fan_out.sql`.
  - The admin multi-target path is activated by sending `requestedForUserIds` (array) instead of a single `requestedForUserId` in the request payload.
  - The first eligible target becomes the parent request (full classification, dedup, and audit). Remaining eligible targets become fan-out child rows that inherit all classification metadata from the parent.
  - Ineligible targets are reported back in the response (`fanOutIneligibleTargets`) but do not block creation for eligible ones.
  - Child rows carry `fan_out_parent_id` referencing the parent, enabling future aggregate queries and lifecycle management.
  - Fan-out creation records a dedicated `media_request_fan_out_created` audit event with parent/child counts, plus individual activity events for each child request.
  - The client form helper (`buildMediaRequestPayload`) prefers `requestedForUserIds` over `requestedForUserId` when multi-target selection is active, and the success message builder surfaces `fanOutMessage` when present.
  - Fan-out is admin-only and validated to a maximum of 50 target user IDs. A single-element array falls through to the existing single-target path for backward compatibility.
  - Test suites: 6 new server tests covering multi-target creation, ineligible-target skipping, single-target passthrough, non-admin rejection, all-ineligible rejection, and array-length validation; 4 new client tests covering payload builder multi-target selection, preference order, single-target fallback, and fan-out success message rendering.
- [ ] Add explicit audited request reassignment flows so admins can change the target user only through a visible state transition that preserves prior ownership history.
- [ ] Add target-user request notifications and inbox visibility so users can see when media was requested, reviewed, queued, fulfilled, or failed on their behalf.
  - Progress: import-candidate read access now follows delegated target ownership through a shared server visibility policy, so non-admin users only see import queue, selected, import-pending, preview, and apply-preview state for candidates whose `sourceRequestedForUserId` matches their app user.
  - Progress: the import review workspace now presents that scoped data as a read-only fulfillment surface for non-admin users while keeping review transitions and execution or apply run controls admin-only.
  - Progress: the Request Music summary and inbox now also project linked import-candidate fulfillment state through a shared server-owned media-request fulfillment service, so target users can see under-review, queued, downloading, import-pending, fulfilled, and failure signals without opening the operator-only import review workspace.
  - Progress: the Request Music summary now also exposes a shared notification feed for delegated requests, so target users see concise in-app messages for on-behalf creation, review state, queueing, downloads, fulfillment, and failures without needing a separate notification persistence layer yet.
  - Progress: native integration coverage now exercises the delegated Request Music path end to end through the real HTTP and database-backed server graph, proving on-behalf request creation, target-user summary or list scoping, linked import-candidate fulfillment status, derived notifications, and fail-closed visibility for unrelated import candidates.
- [x] Add fulfillment and completion signals that can combine Harmoniarr workflow state with supplemental Plex webhook evidence when the operator has Plex webhook support enabled, without making Plex the source of truth for request completion.
  - Added `fulfillment_evidence` table storing immutable evidence records from external sources (Plex webhooks), with correlation keys, metadata, and matched-activity-event linkage.
  - Created `src/shared/fulfillment-evidence-contract.js` — versioned shared contract with `deriveCorrelationKey()` and `normalizePlexWebhookPayload()` for consistent artist:album correlation key derivation and payload normalization across server and client.
  - Created `src/server/fulfillment/fulfillment-evidence-store.js` — SQL store for evidence CRUD, correlation queries, match updates, and summary aggregation.
  - Created `src/server/fulfillment/fulfillment-evidence-service.js` — business logic service for recording evidence, inline correlation, background correlation of unmatched evidence, and expired-evidence cleanup.
  - Created `src/server/integrations/plex/plex-webhook-ingestion-service.js` — validates Plex link status, normalizes webhook payloads, stores evidence, and performs inline correlation against recent `release_added` activity events.
  - Created `src/server/fulfillment/fulfillment-correlation-heartbeat.js` — 60s interval startup-owned worker that correlates unmatched evidence and prunes expired rows.
  - Created `src/server/fulfillment/fulfillment-module.js` — wires store and service together.
  - Created `src/server/routes/plex-webhook-routes.js` — unauthenticated `POST /webhooks/plex` endpoint with custom multipart parser, 2MB body limit, and rate limiting (60/min); authenticated `GET /api/v1/webhooks/plex/status` endpoint.
  - Plex is NOT authoritative: correlation matches are informational only. Harmoniarr's canonical workflow state (`release_added` activity events) remains the source of truth. Correlation failures do not affect fulfillment status.
  - Only `library.new` and `media.scrobble` events are ingested; non-music library sections are filtered out at the contract level.
  - Evidence records auto-expire after 30 days and are pruned by the correlation heartbeat.
  - Correlation uses normalized artist:album keys matched against recent `release_added` activity events within a 7-day lookback window.
- [x] Move per-user import destination ownership toward `app_users` by storing managed library subdirectories on user records and preferring them during preview planning, while keeping `paths.userMusicRoots` as a compatibility fallback during the transition.
- [x] Add an explicit admin provisioning flow for managed library directories so user-owned subdirectory assignments can be materialized under the shared music root without relying on settings-era path creation behavior.
- [x] Add a user-owned folder-access model and provisioning flow so admin-created or Plex-onboarded users can claim or generate managed library subdirectories without relying on settings-only mappings long term.
  - Added a self-service authenticated route `POST /api/v1/users/me/claim-managed-library-root` that claims a managed root for the current user and provisions the directory in one shared flow.
  - Claiming now runs through `app-user-provisioning-service.js` so root ownership and provisioning behavior stay centralized, with generated defaults (`listeners/<username-slug>`) when no explicit root is supplied.
  - Existing admin provisioning remains available at `POST /api/v1/users/:userId/provision-managed-library-root`, while route inventory and server tests now cover both admin and self-service flows.
- [x] Extend the self-service request boundary so release-backed `needs_fetch` requests that resolve to canonical metadata releases feed discovery reconciliation and dispatch instead of stopping at request classification alone.
  - Progress: request-driven discovery reconciliation now preserves both acting and target user ids from delegated Request Music intake, so downstream fulfillment seams can follow `requestedForUserId` without losing the original acting-user audit link.
- [x] Extend provider-URL request handling so external playlist and collection requests dispatch into provider fetch and import automation instead of remaining classified-only.
  - `library-media-request-service.js` now calls `externalIntakeService.queueExternalMediaRequestPlanning` inline after persisting a supported `external_url` request, making dispatch synchronous with request creation rather than deferred.
  - The planning operation type `library_external_intake_planning` is registered in the shared `operationRunRegistry` and dispatched by the shared `operation-queue-dispatcher` poll loop alongside existing operation types.
  - Live provider fetch execution now runs as a second durable operation type `library_external_intake_execution` dispatched automatically after planning completes. Spotify, YouTube, and Apple Music API clients call the appropriate provider endpoint for each planned `provider_ingest_requests` row, persist response evidence, and derive child rows for playlist pages, artist albums, and artist discovery targets.
  - Provider credentials are stored as AES-256-GCM encrypted secrets via the shared `provider-credentials-service.js` boundary, with per-provider settings namespaces (`spotify`, `youtube`, `appleMusic`) including `requestTimeoutMs` and `playlistExpansionPolicy` validated through the shared settings boundary.
  - Playlist expansion policy now routes through a shared native ESM policy service with explicit bounded and artist-discovery modes, provider-client resolution is centralized for Spotify, YouTube, and Apple Music execution, and the protected settings UI exposes provider credentials plus the playlist expansion policy without returning stored secrets to the browser.
  - Spotify provider intake now also supports an admin-started Authorization Code with PKCE linking flow, stores refreshable user tokens through the encrypted-secret boundary, and has provider-client resolution prefer linked user access tokens before falling back to client credentials so current Spotify playlist access restrictions can be handled without moving OAuth logic into workers.
  - YouTube provider intake now mirrors the same admin-started OAuth shape for private/account-scoped playlist reads, using Google server-side OAuth with PKCE, offline refresh tokens, encrypted pending-state/token storage, and provider-client resolution that prefers linked Bearer tokens before falling back to API-key requests.
  - Apple Music auth remains a split model: catalog access stays server-side through signed developer tokens, while personal iCloud Music Library access should be handled as a later MusicKit/Music User Token browser authorization slice rather than forcing it through the server OAuth callback model.
  - OAuth PKCE infrastructure now runs through a shared `oauth-helpers.js` pure utility layer and a shared `oauth-pkce-service.js` configurable factory, so Spotify and YouTube OAuth services are thin provider-specific wrappers (~50 lines each) that inject provider URLs, scopes, credential resolvers, and optional token-revocation hooks instead of duplicating the full PKCE lifecycle independently.
  - YouTube OAuth now also revokes tokens at `https://oauth2.googleapis.com/revoke` during authorization clear before removing local encrypted state, while Spotify has no equivalent revocation endpoint.
  - A shared `apple-music-status-service.js` now checks whether Apple Music developer-token credentials (team ID, key ID, private key) are configured through the encrypted-secret boundary, providing a non-OAuth credential health read path for unified provider status.
  - A new authenticated `GET /api/v1/providers/status` route now returns unified `{ spotify, youtube, appleMusic }` provider status, wired through the shared provider module and registered in the code-level route inventory manifest.
  - The protected system overview now includes a `providers` section with Spotify/YouTube OAuth linked state and Apple Music credential configuration state, consumed through a `providerStatus` computed property on the shared `useSystemOverview` composable.
  - A shared `ProviderStatusPanel.vue` component now renders provider authorization state on the authenticated dashboard using the same `panel-light`/`dependency-grid`/`dependency-card` visual pattern as the existing `DependencyStatusPanel`, surfaced through the `useSystemOverview` composable's `providerStatus` computed property.
- [x] Add per-user import destinations that map reviewed media into user-owned subdirectories while keeping canonical media reuse available across users.
  - Progress: request-driven discovery ingest now persists delegated Request Music ownership on import candidates, and shared import preview planning prefers that candidate-owned target user when resolving per-user library placement.
- [x] Implement the import review state baseline with durable pending, held, selected, rejected, and reopen transitions, while reserving apply/download execution semantics for later slices.
- [x] Implement path mapping, staging resolution, root-folder policy, and naming-preview generation for the read-only import planning preview.
- [x] Build an initial frontend metadata workspace for provider search/import, local reopen, and local search over canonical metadata.
- [x] Build frontend review queue and candidate detail views with operator decision actions.
- [x] Verify no media mutation occurs yet; review state remains durable and replay-safe while the workflow stays preview-first.

## Phase 4 - Jobs, Media Operations, And Notifications

- Shared server lease handling now runs through a dedicated `job-lease-store` boundary that centralizes lease keying, owner identity, heartbeat renewal, expiry-state normalization, and Jobs diagnostics payloads for operation runs, while durable queue claiming now runs separately through shared `operation_runs` queue metadata so lease renewal and queue dispatch stay decoupled.
- Current artwork, import, and library operation workers now also share an operation-run lease heartbeat helper built on the existing interval runner, so active worker leases renew through one modular ESM boundary instead of each worker owning its own timer lifecycle.
- Operation runs now also carry durable cancel-request state plus queue and retry metadata through a shared queue store, startup-owned dispatcher, guarded admin cancel and retry routes, worker cancellation checkpoints, automatic retry backoff, timeout-driven stranded-run recovery, and Jobs view controls, while a shared static ESM operation descriptor registry now centralizes operation keys, started-event types, titles, and cancel/retry capability rules across server and client consumers.
- Operation-oriented client surfaces now share one status label/class helper for durable run states, and metadata artist pages can now queue a first shared `metadata_artist_refresh` operation that refreshes MusicBrainz artist and release-group catalog state through the startup-owned queue, worker lease, retry, and recovery path before triggering wanted-release reconciliation.
- Metadata refresh cadence now persists in `metadata_artist_refresh_state` as one provider-refresh schedule per metadata artist. The startup-owned metadata refresh heartbeat derives due artist eligibility from canonical `operator_artist_monitoring` rows, then enqueues the same shared `metadata_artist_refresh` operation through the jittered refresh scheduling policy instead of a separate cron-only execution path.
- Scheduled metadata refresh dispatch now also consults shared MusicBrainz dependency health before enqueueing new work, records explicit paused reason and next-retry timing in heartbeat state, and exposes that scheduler status through the protected system overview and dashboard instead of silently skipping due work.
- Metadata refresh cadence now also uses monitored release-group timing to shorten refresh intervals for recent or upcoming releases and back off stable catalogs, while the protected dashboard consumes a shared heartbeat-summary surface for discovery, import reconciliation, and metadata refresh instead of another metadata-only status card.
- [x] Implement automatic retry backoff and timeout-driven stranded-run recovery on top of the shared queue and lease contracts.
- [x] Add execution paths for metadata refresh, import apply, rename/organize, media inspection, and notification fan-out.
  - Added shared queued `library_organize_apply` execution with guarded admin start route (`POST /api/v1/library/organize-runs`), startup queue-dispatch wiring, lease heartbeat/cancellation handling, and filesystem-safe move application through `media-filesystem-service.js`.
  - Added shared queued `operator_notification_fanout` execution with guarded admin start route (`POST /api/v1/system/operator-notification-fanout-runs`), startup queue-dispatch wiring, and durable operation-run summary output for actionable notification fan-out attempts.
  - Added shared queued `import_candidate_media_inspection` execution with guarded admin start route (`POST /api/v1/import-candidates/media-inspection-runs`), startup queue-dispatch wiring, lease heartbeat/cancellation handling, and durable warning/unavailable-count summaries derived from apply-preview inspection payloads.
  - Metadata refresh and import apply execution paths were already wired via shared queue handlers and worker boundaries.
- [x] Implement guarded filesystem copy/move/link behavior with collision handling, same-volume hardlink reuse across user subdirectories when media already exists, and post-action verification.
  - Import apply now checks for existing same-relative-path lossless files across configured user roots and shared library root when per-user reuse policy is enabled, then finalizes from that existing source instead of restaging duplicates.
  - Reuse finalization keeps the source file intact (`hardlink_only` or `copy_only_after_hardlink_fallback`) while preserving the existing guarded destination collision checks, root-boundary enforcement, and post-action verification in `media-filesystem-service.js`.
  - Apply operation history now records explicit reuse-stage transport (`reuse_existing_lossless`) and tracks reuse counts in summary output for operator/audit visibility.
- [x] Implement previewable rename and organize flows before apply operations.
- [x] Add FFmpeg-backed inspection and initial transcoding orchestration with policy checks and explicit warnings.
  - Added a shared `media-inspection-service.js` boundary that runs `ffprobe` with static ESM process execution, parses JSON metadata, and emits explicit inspection warnings (`media_inspection_unavailable`, `media_inspection_probe_failed`, `media_inspection_no_audio_stream`, `media_inspection_duration_exceeds_policy`) without mutating media.
  - `import-candidate-apply-preview-service.js` now composes that shared inspection boundary and surfaces per-file inspection metadata plus warnings in apply preview responses, including an attention-level summary state when inspection policy warnings are present.
  - App composition now injects the shared `media_tooling` readiness check into import-candidate inspection wiring, preserving one modular health/inspection source instead of route-local probing.
  - Added a shared `media-transcode-planning-service.js` boundary that consumes inspection metadata and emits planning-only transcode recommendations (`keep_original`, `transcode_candidate`) with explicit warnings (`media_transcode_inspection_unavailable`, `media_transcode_no_audio_stream`, `media_transcode_lossy_source_detected`, `media_transcode_unknown_codec_family`) while keeping mutation and encode execution disabled.
  - `import-candidate-apply-preview-service.js` now composes transcode planning next to inspection and returns per-file `transcodePlan` plus aggregate `transcodeWarnings` for operator-visible policy review before any transcoding path is enabled.
  - Added a shared `media-transcode-execution-service.js` boundary for ffmpeg-backed preflight orchestration (decode/encode-to-null validation only), routed through the shared `media-command-service.js` policy seam and media-tooling readiness checks.
  - Import apply execution now records per-file `transcodeExecution` preflight outcomes plus aggregate summary counts (`transcodePreflightPassedCount`, `transcodePreflightFailedCount`, `transcodePreflightUnavailableCount`), and auto-upgrades candidate apply status to warning-level when transcode preflight fails or tooling is unavailable.
  - Added shared queued `import_candidate_transcode_orchestration` execution with guarded admin start route (`POST /api/v1/import-candidates/transcode-runs`), startup queue-dispatch wiring, lease heartbeat/cancellation handling, and per-file transcode-preflight aggregation for selected candidate files with `transcode_candidate` recommendations.
- [x] Add hostile file and path input controls for media operations, including filename normalization, archive/path traversal guards, decompression limits, and parser-safe staging rules.
  - Added a shared `media-staging-safety-service.js` boundary that classifies candidate files before staging, blocks traversal-style source filenames, blocks unsupported control characters, and marks archive payload extensions as non-stageable until guarded extraction rules exist.
  - Import preview now consumes that shared staging-safety boundary and surfaces deterministic validation blockers (`unsafe_source_filename_traversal`, `archive_payload_unsupported`) so apply execution fails closed before any filesystem mutation is attempted.
  - Existing naming sanitization remains in the shared `library-naming-service.js`, and import apply keeps all mutation paths behind `media-filesystem-service.js` root-boundary checks and exclusive destination enforcement.
- [x] Enforce default retention of original lossless files, avoid duplicate lossless copies across user libraries, and require explicit warning flows when an operator chooses a lossy derivative instead of the shared canonical source.
  - Added a shared `media-lossless-retention-policy-service.js` boundary that evaluates transcode recommendations against explicit per-file decisions and emits policy warnings for both required and acknowledged lossy-derivative paths.
  - `import-candidate-apply-preview-service.js` now blocks apply preview readiness for lossy transcode candidates until an explicit `allow_lossy_derivative` decision is recorded, while preserving warning-level visibility after acknowledgment.
  - Added a guarded admin route (`/api/v1/import-candidates/:importCandidateId/files/:importCandidateFileId/allow-lossy-derivative`) and file-decision service path for explicit operator acknowledgement, with event and audit evidence through existing modular decision boundaries.
- [x] Add in-app operator notifications for queued work, failures, recoveries, and manual-intervention needs.
  - Added a shared `operator-notification-service.js` boundary that derives deduplicated actionable notifications from durable operation-run state (`pending`, `failed`/`cancelled`, retry-based recovery) plus heartbeat pause/error state.
  - Added a protected admin route (`GET /api/v1/system/operator-notifications`) through the shared system module and route dependencies, keeping notification composition out of route handlers.
  - The dashboard now consumes this dedicated notification surface through the shared `useSystemOverview` composable and `OperatorNotificationsPanel.vue`, with drill-through links to the existing run-detail and dashboard workflows.
- [x] Add job-history and job-detail UI surfaces with audit-friendly event views.
- [x] Add bounded activity-feed and metadata detection-history pagination plus client drill-through from those observability surfaces.
- [x] Build a shared release-event presentation contract across server/client so release activity payloads carry formally normalized identity, detail, and rendering metadata instead of loosely coupled shapes.
  - Release-added activity now uses a shared `src/shared/release-activity-presentation.js` contract with `schemaVersion`, `presentationType`, normalized release summaries, and optional operation-run source metadata instead of worker-specific `extraPayload` shapes.
  - The server now emits that contract through a dedicated `release-added-activity-presentation-service.js` boundary reused by both organize-apply and import-apply workers, while the client consumes the same shared normalization helpers with legacy fallback for already-persisted rows.
- [x] Add per-run release drilldown from activity entries so multi-release activity events link directly into existing operations/import detail patterns for full drilldown instead of remaining inline-only.
  - Household activity feed entries now derive drillthrough targets from the shared release presentation source metadata, so import-apply releases reopen the existing import-review apply panel and organize-apply releases reopen the matching Jobs run detail without a new read model or duplicate route surface.
- [x] Implement the actual async push delivery worker around `notification_queue` so queued notifications flow through a full decoupled worker-based delivery path instead of remaining in the durable-history-only posture.
  - Notifications now enqueue through a shared `push-notification-dispatch-service.js` boundary that writes one durable queue row per active subscription, supports 2-minute coalescing updates for matching pending work, and preserves the existing app-facing `sendNotificationToUser` seam for higher-level broadcast services.
  - A startup-owned `push-notification-delivery-heartbeat.js` worker now claims pending rows with a bounded claim window, delegates actual delivery through the existing web-push service, respects invalid or missing subscriptions, retries transient failures with exponential backoff plus `Retry-After` support, and marks terminal rows `failed` or `expired` without blocking the event emitter path.

## Phase 5 - Recovery, Restore, And Diagnostics

- [x] Implement backup/export manifests and artifact metadata per `docs/BACKUP_RESTORE_DESIGN.md`.
  - Added shared recovery boundaries (`backup-manifest-service.js`, `backup-artifact-repository.js`, `backup-export-service.js`) for manifest generation, artifact metadata persistence, and export orchestration using static ESM imports.
  - Added durable `backup_artifacts` metadata storage via migration `20260502_000008_backup_artifact_metadata.sql`, including scope metadata, payload digest, file size, storage path, and actor linkage.
  - Added guarded backup export/list/inspect routes through system route wiring (`POST /api/v1/recovery/backups`, `GET /api/v1/recovery/backups`, `GET /api/v1/recovery/backups/:backupArtifactId`) with CSRF and fresh-admin enforcement on export create.
  - Added shared backup artifact download/delete orchestration through static ESM service boundaries, including managed-storage path boundary checks, attachment download route wiring (`GET /api/v1/recovery/backups/:backupArtifactId/download`), and guarded fresh-admin + CSRF delete route wiring (`DELETE /api/v1/recovery/backups/:backupArtifactId`) with delete audit evidence.
  - Added shared `backup-encryption-service.js` boundary that encrypts backup payloads with AES-256-GCM using the same `HARMONIARR_SECRET_ENCRYPTION_KEY` as encrypted secrets, produces a self-describing `{ encrypted: true, encryption: { algorithm, ciphertext, iv, tag, keyFingerprint } }` envelope, and handles transparent decrypt-or-passthrough in restore preview and apply paths.
  - Added `encryption_key_fingerprint TEXT NULL` column to `backup_artifacts` via migration `20260503_002533_backup_artifact_encryption_key_fingerprint.sql`, persisted by the export service when a key is configured and exposed through the existing `sanitizeArtifact` surface.
  - Restore preview and apply now detect encrypted envelopes and decrypt transparently, returning `payload_encrypted_no_key` when the key is unavailable so operators get a clear diagnostic instead of a silent parse failure.
  - Backup export now marks the manifest as encrypted when the key is configured, and `payloadSha256` hashes the plaintext content for post-decryption integrity verification.
  - Added 12 dedicated tests for the encryption service covering round-trip, IV randomness, tamper detection, key mismatch, envelope detection, and missing-key error paths.
- [x] Implement restore preview, restore apply, maintenance lock entry/exit, and restore operation-run/event history.
  - Added shared `maintenance-lock-service.js` plus `backup-restore-preview-service.js` boundaries and a guarded restore-preview route (`GET /api/v1/recovery/backups/:backupArtifactId/restore-preview`) that evaluates artifact integrity, schema compatibility, and active maintenance-lock conflicts.
  - Added shared `backup-restore-apply-service.js` orchestration with operation-run lifecycle integration, restore lock acquire/release mutation, and `backup_restore_started|completed|failed` audit/event evidence.
  - Broadened restore-apply scope handling so backup payloads can provide `data.scopeSettings` per scope and restore orchestration reports `requestedScopes`, `appliedScopes`, and `skippedScopes` while preserving static ESM service boundaries.
  - Added shared `backup-restore-scope-apply-service.js` boundary and wired restore handlers for `monitoring` and `wanted` scopes via module-injected shared stores (`metadataMonitoringStore.replaceArtistMonitoringSnapshot`, `libraryWantedReleaseStore.replaceLibraryWantedReleases`) while retaining settings-backed scope patching.
  - Extended backup export snapshots so `data.scopeSettings` now includes current `monitoring.artistMonitoring`, `wanted.wantedReleases`, `trust.sourceUsers`, and `overrides.manualOverrides` payloads in addition to settings-derived scope payloads.
  - Added shared `restore-scope-runtime-snapshot-store.js` boundary with table-backed snapshot persistence (`recovery_trust_snapshots`, `recovery_override_snapshots`) so trust and override scopes are exported/restored through stable module seams without route-level coupling.
  - Added guarded restore-apply route (`POST /api/v1/recovery/backups/:backupArtifactId/restore-apply`) with fresh-admin and CSRF enforcement wired through the system module shared dependencies.
  - Added shared `maintenance-lock-control-service.js` plus guarded maintenance-lock control routes (`GET /api/v1/recovery/maintenance-locks`, `POST /api/v1/recovery/maintenance-locks`, `POST /api/v1/recovery/maintenance-locks/:lockId/release`) with admin/fresh-admin + CSRF boundaries and idempotent-safe release behavior.
  - Added shared control-plane idempotency boundaries (`control-plane-idempotency-store.js`, `control-plane-idempotency-service.js`) plus durable table-backed key storage (`control_plane_idempotency_records`) and route integration for backup create/delete, restore apply, and maintenance lock enter/release mutations through static ESM module wiring.
  - Idempotency store now owns `deleteExpiredRecords` for expired-key cleanup, wired through a shared `idempotency-record-cleanup-heartbeat.js` into the startup service supervisor so expired records are pruned hourly without manual intervention.
  - Service and store edge-case coverage now includes 10 idempotency-service tests, 3 idempotency-store tests (including expired record cleanup), and 4 cleanup-heartbeat tests, plus 3 route-level idempotency tests proving backup create/delete and restore apply reject replayed requests with `idempotency_key_replay`.
  - The authenticated recovery workspace now consumes those shared restore and maintenance seams through static ESM route state, restore-preview/apply controls, and jobs drill-through, leaving future trust/override schema evolution as a follow-up once those richer domain tables are finalized.
- [x] Implement bootstrap-admin recovery issuance, verification, use, cancellation, and audit evidence handling.
  - Added shared `admin-recovery-store.js` boundary for `admin_recovery_runs` table persistence, including active-armed-run lookup, insert, increment-invalid-attempt, invalidate, complete, cancel, expire-stale, and bulk session revocation.
  - Added shared `admin-recovery-service.js` boundary with `armBootstrapAdminRecovery`, `getBootstrapAdminRecoveryStatus`, `cancelBootstrapAdminRecovery`, and `completeBootstrapAdminRecovery` through a modular factory with injectable store, lock service, audit, pool, password hashing, username normalization, and password validation dependencies.
  - Added `admin_recovery_runs` table via migration `20260503_003100_admin_recovery_runs.sql` with `status` state-machine constraint, `recovery_code_hash`, `expires_at`, `invalid_attempt_count`, `max_attempts`, completion metadata, and partial index for active armed runs.
  - Added dedicated recovery routes through `admin-recovery-routes.js` registered in the code-level route inventory manifest with public access classification and IP-based rate limiting.
  - Added 30 dedicated tests for code generation, hashing, constant-time verification, full arm/status/cancel/complete lifecycle, lock conflicts, attempt threshold invalidation, existing-user re-enablement, and lock lifecycle guarantees.
  - Added `harmoniarrctl` CLI entrypoint (`src/server/cli/harmoniarrctl.js`) with subcommand routing for `recovery arm-bootstrap-admin`, `recovery bootstrap-admin-status`, and `recovery cancel-bootstrap-admin`, using shared `cli-runtime.js` for stable exit codes (0-4), JSON envelope formatting, and human-readable output, plus `recovery-commands.js` command handlers that delegate to the shared `admin-recovery-service` boundary.
  - Added Docker shell wrapper (`docker/harmoniarrctl`) installed at `/usr/local/bin/harmoniarrctl` via the Dockerfile, enabling `docker exec harmoniarr harmoniarrctl recovery arm-bootstrap-admin` usage.
  - Added 20 dedicated CLI tests covering exit code mapping, JSON output schema compliance, human-readable output formatting, `--json`/`--force`/`--ttl-minutes`/`--reason` flag handling, error envelope formatting for all recovery error codes, and verification that status output never exposes the plaintext recovery code.
  - Added frontend recovery UI surface at `/recover/bootstrap-admin` with status polling, countdown timer, lock-conflict display, completion form, and post-completion checklist with login redirect.
  - Added public-route and real-database integration coverage for bootstrap-admin recovery status and completion, including session revocation, restore-lock conflict handling, invalid-attempt invalidation, and no-cookie completion behavior.
- [x] Add control-plane diagnostics for health, queue state, failed jobs, maintenance state, and recent privileged actions.
  - Added shared `recovery-diagnostics-service.js` boundary with guarded diagnostics routes (`GET /api/v1/system/diagnostics/queue-state`, `GET /api/v1/system/diagnostics/recovery-state`) so queue counts, active maintenance locks, recent failed runs, and recovery privileged audit actions are composed through static ESM service wiring.
  - The authenticated recovery workspace now also surfaces those diagnostics directly in the control plane, including queue pressure, active locks, recent failed runs, and audit-backed privileged recovery actions.
- [x] Enforce redaction rules for logs, diagnostics, exported evidence, and operator-visible payloads.
  - Added shared `control-plane-redaction-service.js` and wired operator-visible audit, operation-history, recovery-diagnostics, maintenance-lock, and restore-preview read models through that boundary instead of relying on view-local filtering.
  - The shared policy now also sanitizes runtime reporter output, security/rate-limit log lines, and sensitive query-style key-value pairs before those messages hit stderr/stdout.
  - Added shared `diagnostics-export-service.js` plus an admin-only `/api/v1/system/diagnostics/export` attachment route so compact support-oriented diagnostics bundles reuse the same redaction boundary instead of inventing a second export-specific masking implementation.
  - If future persisted support bundles, annotations, or richer incident exports are introduced, they should extend this same shared redaction boundary rather than creating route-local exceptions.
- [x] Add failure classification for external dependencies such as slskd and metadata providers.
- [x] Add shared runtime resource policy, subprocess guardrails, and heartbeat-aware stuck-process diagnostics.
  - Added shared `runtime-resource-service.js` so CPU-parallelism detection, sharp cache/concurrency tuning, ffmpeg thread defaults, subprocess timeout/buffer policy, and runtime warning thresholds are configured once through native ESM server code.
  - Added shared `runtime-resource-monitor.js`, wired into startup supervision and system overview, so stale background-work heartbeats plus process RSS/heap pressure are sampled on a bounded interval and reported through prefixed runtime warning logs and operator-visible runtime diagnostics.
  - Hardened `media-command-service.js` around allowlisted no-shell spawn execution, bounded stdout/stderr capture, timeout and abort handling, graceful terminate-plus-escalate behavior, and structured lifecycle logging so stuck ffmpeg/ffprobe child processes fail fast instead of hanging the app indefinitely.
- [x] Verify maintenance locks pause unsafe writes and background work consistently.
  - Integration coverage already exercises many lock-conflict entrypoints, but the remaining gap is whole-system proof that queued or background execution paths also pause predictably during restore or recovery windows.
  - Added shared `maintenance-lock-write-guard-service.js` boundary and wired import-candidate execution/apply/media-inspection/transcode run start services to fail closed with `recovery_lock_conflict` when blocking maintenance locks are active.
  - Extended the same guard to library discovery-dispatch, organize-apply, and scan run-start services so filesystem-affecting/background library workflows now fail closed during active maintenance/recovery locks.
  - Automatic import-reconciliation, library-discovery, and metadata-refresh heartbeats now also share a maintenance-lock pause boundary and pause-aware heartbeat state, so active `maintenance`/`restore`/`upgrade`/`admin_recovery` locks are surfaced through operator-visible heartbeat diagnostics instead of only failing at route-trigger time.
  - The shared startup-owned operation queue dispatcher now also consults `maintenance-lock-operation-pause-service.js` before claiming new runs, so queued work is not newly claimed while blocking maintenance locks are active and queue diagnostics expose that paused dispatcher state through the existing recovery control-plane surface.
  - In-flight queue workers now share the same interruption gate and paused-run requeue path, so discovery, scan, organize, import execution/apply/media-inspection/transcode, metadata refresh, provider ingest, artwork cleanup, and operator notification fan-out all release their leases with `paused` status and return their runs to `pending` without consuming retry budget when a blocking maintenance lock becomes active mid-run.
  - Focused native worker coverage now also proves that shared pause metadata reaches the `library_scan` and `import_candidate_execution` worker slices in addition to the original `library_discovery` proof, and the shared pause-service readiness branch is covered directly.
  - Added integration coverage proving active maintenance locks reject import execution, apply, media inspection, and transcode run-start routes with normalized `409 recovery_lock_conflict` failures through the real HTTP and database-backed server graph.
  - Added matching integration coverage proving active maintenance locks also reject library discovery, organize, and scan run-start routes with the same normalized `409 recovery_lock_conflict` contract.
  - Added native worker pause tests for all remaining operation workers: organize apply, import apply, transcode orchestration, media inspection, artwork cleanup, and external intake planning, so every in-flight worker now has a dedicated proof that the shared interruption gate requeues paused runs with correct summary metadata and lease release without consuming retry budget.
  - Remaining work is now concentrated in broader end-to-end Docker-backed validation evidence across the packaged runtime rather than another unimplemented maintenance-lock control path.
- [x] Add frontend surfaces for backup/export, restore preview/apply, maintenance state, and diagnostics history.
  - Added shared recovery API client module (`src/client/lib/recovery-api.js`) with `fetchRecoveryStatus()` and `completeRecovery()` thin wrappers over the base `apiRequest` helper.
  - Added `useRecoveryStatus` composable (`src/client/composables/useRecoveryStatus.js`) with reactive status polling (10s interval), computed expiry countdown, lock-blocked detection, remaining-attempts tracking, and completion submission with DI-injected API functions for testability.
  - Added `RecoveryView.vue` page SFC (`src/client/views/RecoveryView.vue`) using the `auth-layout` CSS pattern with status panel (countdown timer, remaining attempts, lock conflicts), completion form (recovery code, username, password, confirmation), and post-completion checklist display with login redirect.
  - Added `/recover/bootstrap-admin` route (name: `recovery`) to the Vue router as a top-level public route, accessible with or without an active session, not subject to `anonymousOnly` or `requiresAuth` guards.
  - Added shared authenticated recovery client boundaries (`useRecoveryBackups`, `useRecoveryDiagnostics`, `recovery-route-state`, `control-plane-idempotency`) plus `RecoveryWorkspaceView.vue` on `/app/recovery`, so backup export/list/detail, restore preview/apply, maintenance-lock enter/release, and diagnostics history all reuse static ESM composables instead of route-local fetch logic.
  - Recovery workspace mutations now send native idempotency headers from the client, and backup restore runs plus recovery audit events now drill through the existing jobs route via shared operation-run link targeting instead of introducing a parallel recovery-only run-detail surface.

## Phase 6 - Validation, Release, And Closure

- [x] Add repo-level ESLint validation, segmented native test commands, and suite conventions that match the current ESM-native stack.
  - Added native ESM `eslint.config.js` using ESLint flat config plus Vue flat essentials, with explicit server, shared, client, scripts, and test targets instead of a single catch-all lint surface.
  - Added `npm run lint`, `lint:server`, `lint:shared`, `lint:client`, `lint:test`, and `lint:scripts`, and wired lint into the repo-level `npm run validate` contract before tests and builds.
  - Replaced the monolithic `node --test` package script with segmented `test:server`, `test:client`, `test:scripts`, `test:integration`, and `test:coverage` commands while keeping the top-level `npm test` aggregator native, ESM-only, and responsible for lint plus test-hygiene gating before Node suites run.
  - Introduced native `suite()` grouping in representative server, client, and script tests to establish the repo convention for static suites without forcing a churn-heavy test rewrite.
  - Added a shared `scripts/test-hygiene.js` boundary plus `npm run check:test-hygiene` so committed `only`/`skip`/`todo` test markers and explicit `{ only|skip|todo: true }` options fail the same repo-level contract instead of silently swallowing coverage.
- [x] Add unit tests for validators, service rules, workflow-state logic, and normalization helpers.
- [x] Establish a shared temporary-Postgres integration harness plus first real auth/session, settings, and recovery route suites.
  - Added reusable integration helpers under `testing/` for cookie-aware HTTP flows, Docker-backed PostgreSQL fallback via Testcontainers, and one-app-per-scenario runtime bootstrapping against the real static ESM server module graph.
  - Added first integration coverage for bootstrap/login/refresh/logout session flow, authenticated settings read/update persistence, and maintenance-lock idempotency plus recovery diagnostics against real database state.
  - Tightened the harness with shared suite-level PostgreSQL runtime reuse, per-scenario temporary databases, explicit request and startup/shutdown timeouts, reduced node-postgres pool sizing for integration runs, deterministic container stop/workspace cleanup, and graceful skip behavior when no supported local container runtime or external PostgreSQL admin connection is available.
- [ ] Expand integration tests for import review, job ownership, and the remaining critical-path route behavior.
  - The initial integration baseline already covers auth/session, settings, recovery, import-review transitions, operation cancel/retry, job-lease visibility, and lock conflicts.
  - Remaining expansion should focus on import apply, media/transcode execution, stranded-run recovery, and fresh-install or upgrade-oriented end-to-end scenarios.
  - Added database-backed integration coverage for import review queue list/detail plus hold/select/reject/reopen transitions, with persisted candidate-event evidence verified through the real import-candidate tables.
  - Added database-backed integration coverage for import execution run creation plus operation-history and run-detail lease attachment, proving worker lease ownership shows up through the operator-facing operations API once a run is claimed.
  - Added database-backed integration coverage for operation-run cancel/retry controls, including durable cancellation intent persistence, duplicate-cancel rejection, and failed-run retry rescheduling against the real operations API.
  - Added database-backed integration coverage for the public bootstrap-admin recovery status and completion routes, including session revocation, restore-lock conflict behavior, invalid-attempt invalidation, and the guarantee that recovery completion does not silently create a new authenticated browser session.
  - Added shared ESM integration helpers for seeding `operation_runs` state and for entering/releasing maintenance locks so future critical-path suites can reuse the same test boundaries instead of embedding route-local setup.
  - Added database-backed integration coverage for import apply run store lifecycle, proving create, claim via queue store, mark-started, lease acquisition, operation-history visibility, run-detail lease attachment, mark-completed, and apply-summary/run-detail route reads all work through the real HTTP and database-backed server graph.
  - Added database-backed integration coverage for media inspection run start via HTTP, proving seeded selected candidates trigger run creation, store-level mark-started and lease acquisition work against real database state, and the run appears in operation history with audit trail evidence including the started event type.
  - Added database-backed integration coverage for stranded-run recovery, proving `listRecoverableRuns` detects running runs with expired claims, `recoverRunForRetry` resets them to pending with cleared claim fields while preserving attempt count, the recovered run is claimable by a new worker, `markStrandedRunFailed` correctly transitions exhausted runs to failed with persisted error state and cleared claim fields, and double-recovery of an already-recovered run returns null as a safety guard.
- [x] Add route-contract tests for normalized success/error payloads and permission enforcement.
- [x] Extract shared settings form composable from General, MediaStorage, and Connections views (`useSettingsForm`), and user mutation composable from Users view (`useSettingsUserMutations`).
  - `useSettingsForm` owns form reactive, applySettings normalization, loadSettings, saveSettings, and error/success state. Accepts `extraApply` callback for view-specific state extraction (pathValidation, secretStatus). Adopted by all three settings views: General (275→138 lines), MediaStorage (694→562 lines), Connections (529→386 lines).
  - `useSettingsUserMutations` owns user CRUD (create, update, provision, claim code, password reset, Plex unlink) and Plex link operations (connect, disconnect, import, relink, reconcile) with injectable API functions. Adopted by Users view (751→476 lines, script 380→130).
  - 31 new tests (10 for useSettingsForm, 21 for useSettingsUserMutations). 2787 client tests pass.
- [x] Keep ESM-only enforcement active in validation and CI so new CommonJS patterns do not regress into runtime code or scripts.
- [x] Add migration replay and schema snapshot validation.
  - Applied-migration checksum drift is now detected at startup via `assertNoMigrationChecksumDrift`, which compares the stored checksums for previously-applied migrations against the current file checksums and aborts startup if any mismatch is found, preventing silent schema divergence from in-place migration edits.
- [ ] Add end-to-end UI coverage for bootstrap, login, settings, review queue, job feedback, and recovery-sensitive flows where practical.
  - Added requester Request Detail cancellation browser verification. The suite drives Search -> release request -> Request Detail -> shared cancellation `alertdialog` -> cancel mutation -> toast/status feedback -> cancelled journey state -> My Requests refresh. The metadata browser fixture now persists `cancelled` media-request read models and returns production-shaped `409` responses for stale/non-cancellable cancel attempts. See `docs/REQUEST_DETAIL_CANCELLATION_BROWSER_VERIFICATION_DESIGN.md`.
  - Added requester Request Detail cancellation failure/conflict browser verification. The suite proves transient cancellation failures show `role="alert"` feedback while leaving the request retryable, and stale `409 Conflict` responses refresh Request Detail/My Requests to the durable `cancelled` state. `RequestDetailView` now revalidates on cancellation conflicts, and the metadata browser fixture has cancellation-specific failure/state helpers. See `docs/REQUEST_DETAIL_CANCELLATION_FAILURE_BROWSER_VERIFICATION_DESIGN.md`.
  - Added requester Request Detail event timeline browser verification. The suite seeds first-page and cursor-paginated request events, verifies requester-safe cancellation/creation/reassignment copy, asserts raw fixture user IDs are not exposed, and proves the `Load more events` path through the production-shaped event endpoint. `RequestEventTimeline` now uses generic request-event helpers and exposes an accessible `Request event history` list. See `docs/REQUEST_DETAIL_EVENT_TIMELINE_BROWSER_VERIFICATION_DESIGN.md`.
  - Added Request Detail fulfillment pipeline event/status parity browser verification. The suite seeds an import-pending request, raw operator-shaped pipeline candidate data, and matching fulfillment events, then verifies the requester fulfillment stat, journey, pipeline candidate, and event history agree while source-user names, private paths, candidate IDs, run IDs, diagnostics, and import-review links remain hidden. Request Detail now exposes named `Request journey` and `Linked import candidates` lists. See `docs/REQUEST_DETAIL_PIPELINE_PARITY_BROWSER_VERIFICATION_DESIGN.md`.
  - Added Operator Request Detail pipeline diagnostics browser verification. The suite creates an admin request, seeds a raw failed pipeline candidate, verifies source-user/folder context, download/import status messages, operation run IDs, import-candidate IDs, and run errors are visible, then keyboard-activates the import-review drill-through. Request Detail now has small presentation helpers for operator source labels and projected run diagnostics. See `docs/REQUEST_DETAIL_OPERATOR_PIPELINE_DIAGNOSTICS_BROWSER_VERIFICATION_DESIGN.md`.
  - Added Request Detail failed-import recovery handoff browser verification. The suite creates an admin request, seeds a failed linked import candidate plus matching Import Review detail/preview data, keyboard-activates `Open in import review`, and verifies `/app/activity/candidates?candidate=...` selects the failed candidate, shows failure context, and exposes a focusable `Reopen` recovery action even while the queue remains filtered to pending candidates. The metadata browser fixture now also serves Import Review queue/detail/preview/summary endpoints for future recovery-action tests. See `docs/REQUEST_DETAIL_FAILED_IMPORT_RECOVERY_HANDOFF_DESIGN.md`.
  - Added Import Review failed-candidate recovery action browser verification. The suite executes `Reopen` from a seeded failed candidate, verifies the candidate transitions to `Pending`, the pending queue refreshes, pending action buttons appear, and focus moves to a visible status message. A paired queued-failure scenario verifies assertive alert feedback, stable failed state, and retryable focus on `Reopen`. `useImportReviewWorkspace` now skips route/summary/preview refreshes after failed transitions, and `ImportCandidateDetailPanel` exposes success/error action feedback through status/alert roles. See `docs/IMPORT_REVIEW_FAILED_CANDIDATE_RECOVERY_ACTION_DESIGN.md`.
  - Added Import Review review-state transition matrix browser verification. The suite verifies `Pending -> Held -> Selected` plus `Selected -> Rejected -> Pending` through the real Import Review client API paths, including reject confirmation gating, focused success status messages, visible focus rings, queue count refreshes, selected-summary refreshes, route stability, and persisted fixture state. `useImportReviewQueue` now preserves the transitioned candidate detail after successful actions even when the active queue filter excludes it. See `docs/IMPORT_REVIEW_TRANSITION_MATRIX_DESIGN.md`.
  - Added Import Review requester/non-admin read-only access browser verification. The suite proves requester deep links to Import Review redirect to Home before any import-candidate API request, and operator sessions can inspect candidate queue/detail context without filters, review notes, management buttons, operator runway panels, or transition endpoint calls. Browser user helpers now support generic role creation/login while preserving existing requester helper exports. See `docs/IMPORT_REVIEW_READ_ONLY_ACCESS_DESIGN.md`.
  - Added Import Review operator runway start/reconcile controls browser verification. The suite proves empty queues disable media inspection, download execution, and import apply starts; selected/import-pending candidates enable the right controls; execution reconciliation refreshes heartbeat state; import apply stays behind the destructive type-to-confirm dialog; and failed execution starts expose retryable `role="alert"` feedback. Shared start predicates now require eligible candidate counts before enabling starts, post-mutation queue refreshes preserve the owning runway panel hash, and the metadata browser fixture now supports Import Review run start/reconcile POST endpoints plus durable run summary state. See `docs/IMPORT_REVIEW_OPERATOR_RUNWAY_CONTROLS_DESIGN.md`.
  - Added Import Review selected-run deep-link and historical run-detail browser verification. The suite proves direct `mediaInspectionRunId`, `executionRunId`, and `applyRunId` URLs load the selected historical run, recent-run `View` actions update query/hash state, and panel refresh preserves the selected historical detail. Runway refreshes now go through `useImportReviewAdminWorkflow` selected-run handlers, recent-run tables expose a visible `Run` column, and browser fixtures include reusable run/summary builders for the next diagnostics slices. See `docs/IMPORT_REVIEW_SELECTED_RUN_DEEP_LINKS_DESIGN.md`.
  - Added Import Review run-detail failure diagnostics browser verification. The suite proves failed historical media inspection, download execution, and import apply run URLs render operator-visible diagnostics. A shared `ImportCandidateRunFailureNotice` now exposes durable run errors as polite `role="status"` content across runway panels; execution coverage verifies degraded transfer state, transfer exceptions, and persisted transfer observations; apply coverage verifies failed and not-attempted file operations. Media inspection remains aggregate-only until per-file diagnostics are persisted. See `docs/IMPORT_REVIEW_RUN_DETAIL_FAILURE_DIAGNOSTICS_DESIGN.md`.
  - Added media-inspection per-file diagnostic persistence and browser verification. Media inspection workers now persist bounded `inspectionDiagnostics` rows in the operation-run JSONB summary, the run store normalizes them on read, and the media inspection panel renders a named file diagnostics table for selected runs. The payload excludes raw probe output and stores only candidate/user/folder/file/warning context. Focused server, route, and browser tests cover the write, read, API, and UI paths. See `docs/MEDIA_INSPECTION_PER_FILE_DIAGNOSTICS_DESIGN.md`.
  - Added Import Review diagnostic row handoff browser verification. Media inspection diagnostic rows now expose keyboard-accessible `Open candidate` actions that update route state to the affected candidate, preserve the selected `mediaInspectionRunId`, focus the selection workspace, and leave the historical run selected. The route-state normalizer now accepts internal `candidateId` state keys so composables can merge candidate and run state safely. See `docs/IMPORT_REVIEW_DIAGNOSTIC_ROW_HANDOFF_DESIGN.md`.
  - Added Import Review diagnostic file focus handoff. Diagnostic row actions now carry the affected file as `candidateFile` route state, preserve the selected media-inspection run, and focus/highlight the matching file row after candidate detail renders. Browser coverage proves `candidate`, `candidateFile`, and `mediaInspectionRunId` remain synchronized from selected-run diagnostics into the file-level candidate context. See `docs/IMPORT_REVIEW_DIAGNOSTIC_FILE_FOCUS_HANDOFF_DESIGN.md`.
  - Added Import Review diagnostic-driven repair-state verification. Browser coverage now opens a diagnostic file from selected-run media-inspection detail, executes `Reopen`, verifies success status focus, preserves `candidate`/`candidateFile`/`mediaInspectionRunId`, and proves normal queue candidate selection clears stale file focus while keeping selected-run state. Workspace route replacements now preserve current run IDs, diagnostic file state during repair, and the current hash when replacing query state. See `docs/IMPORT_REVIEW_DIAGNOSTIC_REPAIR_STATE_DESIGN.md`.
  - Added Import Review diagnostic repair failure-state verification. Browser coverage now queues a failed `Reopen` from the focused diagnostic-file context, verifies assertive alert feedback, retry focus on `Reopen`, preserved `candidate`/`candidateFile`/`mediaInspectionRunId`, selected-run continuity, and no false success status. Shared diagnostic Import Review browser workspace builders now live in `testing/browser/import-review-browser-helpers.js`. See `docs/IMPORT_REVIEW_DIAGNOSTIC_REPAIR_FAILURE_STATE_DESIGN.md`.
  - Added Import Review diagnostic repair retry-success verification. Browser coverage now drives a failed diagnostic `Reopen`, retries the same action successfully, verifies the stale alert clears, success status receives focus, the candidate moves to `Pending`, and `candidate`/`candidateFile`/`mediaInspectionRunId` plus the selected historical run remain intact. See `docs/IMPORT_REVIEW_DIAGNOSTIC_REPAIR_RETRY_SUCCESS_DESIGN.md`.
  - Added Import Review direct diagnostic route reload verification. Browser coverage now opens `/app/activity/candidates` directly with `candidate`, `candidateFile`, `mediaInspectionRunId`, and the selection-stage hash, verifies the selected candidate/file/run context hydrates, reloads the browser, and verifies the same context again without relying on a diagnostic-row click event. See `docs/IMPORT_REVIEW_DIRECT_DIAGNOSTIC_ROUTE_RELOAD_DESIGN.md`.
  - Consolidated Import Review diagnostic browser fixture packs. Diagnostic suites now share selected diagnostic candidate/run/file IDs, route suffix helpers, comparison candidate setup, and repair-failure copy through `testing/browser/import-review-diagnostic-fixtures.js`, reducing drift across media-inspection, handoff, repair, retry, and reload coverage. See `docs/IMPORT_REVIEW_DIAGNOSTIC_FIXTURE_PACK_CONSOLIDATION_DESIGN.md`.
- [ ] Add fixture packs for canonical music identity, import review states, file-operation edge cases, auth failures, and restore/recovery scenarios.
- [ ] Validate fresh install, upgrade, restore preview/apply, and rollback-aware deployment behavior.
  - The shared Docker smoke validator now covers fresh-install schema bootstrap, fail-closed startup refusal, FFmpeg/FFprobe availability, embedded PostgreSQL readiness plus persistence, backup export plus restore preview/apply validation, existing-data restart behavior, and optional machine-readable evidence output through `HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH`.
  - That evidence emission path now also fail-closes on missing required sections for known smoke kinds, so packaged-runtime Request Music proof cannot silently disappear from fresh-install or released-image evidence artifacts.
  - The release workflow now also re-validates published-image and optional upgrade-path smoke evidence files before artifact upload, keeping archived JSON proof aligned with the same shared contract instead of trusting file presence alone.
  - The release-contract job now also downloads and re-verifies the archived published-image smoke artifact before final summary publication, so release consumers fail closed on malformed archived proof instead of only trusting earlier producer-side checks.
  - When upgrade-path validation actually runs, the release-contract job now also downloads and re-verifies the archived upgrade smoke artifact while using `always()` plus `needs.verify-upgrade-path.result` guards to keep the normal no-baseline release path valid.
  - A dedicated `npm run validate:docker-upgrade` wrapper now also validates a baseline-to-candidate image upgrade path against the same bind-mounted state, proving post-upgrade startup plus persisted settings continuity without introducing a separate validation harness.
  - The `release-image` workflow now also preserves released-image smoke evidence as a first-class artifact by setting `HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH` during `npm run validate:docker-released-image` and uploading the emitted JSON file, so release verification retains structured proof instead of only console logs.
  - Added queued-worker maintenance-lock pause proof. The operation queue dispatcher now checks maintenance-lock readiness before stranded-run recovery and queue claiming. The operations/library integration suite verifies a pending queued library scan remains unclaimed while a restore maintenance lock is active, no stranded-run recovery runs during the lock, structured pause metadata is returned, and the run is claimed/launched by the same dispatcher after lock release. See `docs/QUEUED_WORKER_MAINTENANCE_LOCK_PAUSE_PROOF_DESIGN.md`.
  - Executed Docker-backed deployment-path validation in a live Docker-capable local environment. Fresh-install evidence passed for the workspace image path, including embedded PostgreSQL readiness and persistence, zero pending migrations, FFmpeg/FFprobe, backup export, restore preview/apply with maintenance-lock conflict proof, delegated Request Music smoke, existing-data restart, fail-closed startup refusal, JSON evidence verification, and no leftover validation containers or volumes. Released-image and upgrade-path evidence were later executed with local image tags. See `docs/DOCKER_BACKED_DEPLOYMENT_PATH_VALIDATION_EXECUTION.md`.
  - Executed released-image and baseline-upgrade evidence against the packaged runtime. `npm run validate:docker-deployment-path` passed with `HARMONIARR_IMAGE=ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta` and `HARMONIARR_BASELINE_IMAGE=harmoniarr-walkthrough:latest`, produced fresh-install, released-image, upgrade-path, and deployment-summary JSON under `.tmp/docker-release-upgrade-evidence`, and each smoke evidence file passed `npm run validate:docker-smoke-evidence`. The local environment could not prove GHCR digest pull availability because registry access returned `denied`, so final release closure should repeat with authenticated immutable digest refs. See `docs/RELEASED_IMAGE_BASELINE_UPGRADE_EVIDENCE_EXECUTION.md`.
  - Executed packaged-runtime browser-smoke evidence against the Docker walkthrough stack. `npm run validate:docker-browser-smoke` passed for the walkthrough admin, emitted verified browser-operator JSON under `.tmp/docker-browser-smoke-evidence`, captured seven checkpoint screenshots, and the runner now supports `HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR` for release artifacts. The release-image workflow now uploads `harmoniarr-docker-smoke-browser-screenshots` alongside the browser JSON artifact. See `docs/PACKAGED_RUNTIME_BROWSER_SMOKE_EXECUTION.md`.
  - Remaining work is final registry-authenticated immutable digest replay and any additional rollback-oriented scenarios that go beyond the current baseline-upgrade and restore-apply seam.
- [ ] Finalize Docker artifacts, README/doc index updates, compose examples, and operator setup guidance.
- [ ] Record V1 no-go conditions, smoke-test checklist, and release sign-off criteria.

Recommended next execution slice:

1. Repeat deployment-path and browser-smoke evidence with registry-authenticated immutable digest refs before final release sign-off.
2. Archive the deployment summary, smoke JSON, and browser screenshots together as one release evidence pack.
3. After immutable replay is green, close the remaining E2E and release-doc items as the immediate release-closure wave.

## Dependencies

1. Phase 1 depends on Phase 0.
2. Phase 2 depends on Phase 1.
3. Phase 3 depends on Phases 1 and 2.
4. Phase 4 depends on Phase 3.
5. Phase 5 depends on Phases 2 through 4.
6. Phase 6 depends on Phases 1 through 5.

## Definition Of Done

- [ ] Fresh install reaches guarded bootstrap flow and completes initial admin setup successfully.
- [ ] Auth, session, settings, and audit contracts are stable and tested.
- [ ] Import candidates can be reviewed and applied through durable workflow state.
- [ ] Filesystem mutation and transcoding behavior are previewable, auditable, and operator-gated.
- [ ] Backup/restore, maintenance locks, and admin recovery are implemented and documented coherently.
- [ ] Critical-path validation passes for fresh install, upgrade, and restore scenarios.
- [ ] Documentation, packaging, and shipped runtime behavior are synchronized.

## Follow-Up Component Rule

- [ ] Keep the component task lists synchronized with this phase tracker whenever scope, sequencing, or acceptance rules change.

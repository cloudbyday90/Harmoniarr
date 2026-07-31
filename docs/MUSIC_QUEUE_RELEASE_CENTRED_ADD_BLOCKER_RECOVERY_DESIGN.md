# Music Queue Release-Centred Add-Blocker Recovery Design

Status: **Implemented.**

Date: 2026-07-31.

## 1. Problem

Harmoniarr already stops unsafe library adds, but the release-level read model
largely collapsed those stops into a generic message and routed the primary
Music Queue action directly to Library-add diagnostics. That exposes a
candidate/import implementation boundary before explaining what the release
needs.

The normal path must instead be:

`completed download -> safe add check -> Needs help adding -> review this release -> optional advanced diagnostics`

Candidate, path, provider, and worker evidence remain available to operators,
but are not the primary recovery workflow.

## 2. Official Sources Reviewed

The following official sources were reviewed for the requested June 2026 design
baseline. They were rechecked on 2026-07-31 because current-source validation
is more reliable than assuming a historic URL.

| Source | Design input |
| --- | --- |
| [FFprobe documentation](https://ffmpeg.org/ffprobe.html) | `ffprobe` provides machine-readable media/container evidence and exits nonzero when it cannot recognize an input. Failed or insufficient audio verification must stop an automatic library write. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Every release-detail and diagnostics read continues to require server-side authorization. A Music Queue handoff is not authorization for another release or candidate. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Apply equivalent safety principles to downloaded media: do not trust a claimed type, validate before accepting it into the library, and keep filesystem operations constrained. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Activity needs useful action/outcome records without paths, provider responses, credentials, or stack traces. Raw worker evidence belongs in protected diagnostics. |
| [WCAG 2.2 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) | A visible status must identify the failed step and give a clear corrective direction; visual warning tone alone is insufficient. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Link `Needs help adding` directly to Library-add diagnostics | Minimal change and retains every implementation detail. | Makes candidates/import runs the first thing a household user sees; weakens the Music Queue ownership model. | Reject. |
| Treat every post-download stop as a generic retry | Simple action model. | Can repeat an unsafe operation, cannot distinguish folder setup from a collision, and hides quality evidence. | Reject. |
| Put raw paths and worker messages in the Music Queue row | Gives maximal detail immediately. | Leaks internal filesystem/worker data into normal UI and makes the row noisy. | Reject. |
| Persist a small allow-listed blocker category, project a release-centred repair, and keep the diagnostic route secondary | Explains the safe next step, preserves operator evidence, works with Activity handoffs, and has a narrow security boundary. | Requires one more bounded read-model field and presentation mapping. | Adopt. |

## 4. Final Recommendation Stack

### Persisted And Read-Model Contract

- Use only these blocker categories in the Music Queue projection:
  - `source_path_unavailable`
  - `library_collision`
  - `media_verification`
  - `unsafe_add_plan`
  - `add_failed`
- Persist the category in the existing apply-run snapshot, not a raw source
  path or status-message copy.
- Project a safe `status.repair` object from the release read model. It has a
  friendly title, a bounded explanation, a suggested next step, and an
  optional Settings route for folder visibility. It never contains a candidate
  ID, source username, provider payload, path, or worker error.

### Music Queue And Activity UX

- A blocked release remains `Needs help adding` and its primary row action is
  `Review what needs fixing`, which opens that release in Music Queue.
- The release panel explains the category before presenting any low-level
  action.
- A missing download path offers `Set up folders` from the release panel.
- Library collision, unsafe-plan, media-verification, and unknown add-failure
  cases offer one secondary `Advanced diagnostics` handoff. They do not
  reintroduce candidate-first navigation.
- Record the existing release-scoped `music_queue_import_blocked` Activity
  event with only the allow-listed category. Activity links back to the same
  release detail.

### Security Stack

- Keep existing route-level authorization for Music Queue release detail and
  diagnostic routes; a copied release URL remains non-enumerable and scoped.
- Do not place filesystem paths, secret-bearing provider values, usernames,
  raw ffprobe output, or error stacks in Activity or the Music Queue API
  response.
- Preserve guarded preview, collision, media-verification, maintenance-lock,
  and operation-lease checks. This work changes only projection and recovery
  presentation, never the condition for writing a library file.

### Validation Stack

- Unit tests cover preview blocker classification, snapshot/read-model
  projection, status precedence, Activity payload redaction, and client action
  presentation.
- Browser coverage proves the row opens a release-centred repair panel, uses a
  Settings handoff only for a path blocker, and keeps library-add diagnostics
  secondary.
- The full test/build suite and controlled Docker pipeline run verify that the
  automatic happy path remains intact.

## 5. Outcome

Implemented the first release-centred add-blocker recovery slice:

- safe add-preview blockers now have a durable, allow-listed reason code;
- Music Queue turns that code into a concise repair explanation;
- the normal row action opens the selected release instead of the import
  workbench;
- Activity records a release-scoped safety stop without diagnostic leakage;
- detailed add/candidate records remain available only through the explicit
  Advanced diagnostics handoff.

Focused validation passed on 2026-07-31:

- 97 focused server/client tests covering blocker classification, recovery,
  read-model projection, action presentation, and Activity redaction;
- Playwright verification of an unsafe FLAC from Music Queue through its
  release repair panel and release-scoped Activity handoff.
- `npm run validate` passed: copyright, migrations, schema snapshot, ESM,
  lint, 2,977 unit/script tests, 30 PostgreSQL integration tests, and the
  production build.
- The walkthrough application image rebuilt with `--no-cache`, started
  healthy, and completed bootstrap validation.
- `npm run validate:docker-controlled-provider-pipeline -- --no-cache`
  passed with 17 synthetic fixtures and 20 ingested matches, including
  strict-quality exhaustion projecting `Needs help adding` with a
  `media_verification` recovery category and no library write.

## 6. Follow-Up

The next high-value item is to make **advanced library-add diagnostics
release scoped**. A release-centred handoff should open diagnostics already
filtered to that release and show the newest safe plan outcome first, without
exposing unrelated candidates or requiring the operator to reconstruct the
relationship manually.

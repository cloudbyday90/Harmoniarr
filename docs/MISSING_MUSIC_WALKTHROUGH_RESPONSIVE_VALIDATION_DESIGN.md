# Missing Music walkthrough and responsive validation design

**Status:** Implemented
**Date:** 2026-08-27
**Scope:** local walkthrough Compose rebuild; Missing Music responsive and
keyboard-visible inspection; Node 24 LTS image-availability review

## Goal

The completed Missing Music scope and keyboard work needs packaged-runtime
evidence, not only source-tree browser coverage. Rebuild the disposable local
walkthrough image, retain its existing local data, and inspect the canonical
Missing Music page at the desktop, collapsed-sidebar, and mobile layouts.

The same rebuild must use a supported Node 24 LTS image. The upstream Node
24.20.0 LTS patch is newer than the currently published Alpine image. Because
the exact 24.20.0 Alpine tag cannot be built yet, this round retains the
verified 24.19.0 Alpine image rather than introducing an unbuildable or
mutable reference.

## Evidence and constraints

- The walkthrough is explicitly local-only: its port is bound to
  `127.0.0.1:47956`, its data is under `.data/walkthrough`, and it is separate
  from the production `compose.yaml` baseline.
- The current engine policy is Node 24 LTS with npm 12.0.2. The development
  shell and published Docker image remain within the declared range.
- `node:24.20.0-alpine` is unavailable from Docker Hub. The current
  `node:24-alpine3.23` image executes Node 24.19.0, so a local build cannot
  honestly claim Node 24.20.0 coverage.
- Dependabot PR #40 proposes Node 26.7.0 for the controlled-provider fixture.
  Node 26 is still a Current line, and the repository deliberately declares
  `<25.0.0`. Applying it would make the fixture and engine policy disagree.
- The inspection must test a `320 CSS px` layout, not merely a popular phone
  size. It must also check that fixed navigation does not hide keyboard focus.
- The first mobile inspection found that off-canvas primary-navigation links
  could still receive keyboard focus while the drawer was closed. The final
  implementation makes that closed drawer inert and hidden from assistive
  technology, moves focus to its first link when it opens, and restores focus
  to the menu trigger when it closes or initiates a route change.

## Options considered

| Option | Benefits | Costs |
| --- | --- | --- |
| Rebuild the verified Node 24.19.0 image | Reproducible, currently published LTS image and no version-policy drift | Docker Official Images has not yet caught up with Node 24.20.0. |
| Apply Dependabot PR #40 exactly | Tests Node 26.7.0 quickly | Uses a Current, not LTS, production-adjacent image and conflicts with the declared Node 24 engine policy. |
| Use a floating `node:24-alpine` tag | May receive Node 24.20.0 when Docker Hub publishes it | Loses the current exact-image reproducibility and makes validation results time-dependent. |

## Recommendation stack

1. Keep the current exact `node:24.19.0-alpine` pin in `.nvmrc`, the
   application Dockerfile, and the isolated controlled-provider fixture until
   Docker Hub publishes the corresponding 24.20.0 Alpine image.
2. Do not apply PR #40 locally or merge it. Record its review outcome: its Node
   26 Current upgrade is not compatible with the security/runtime policy.
3. Run `npm run validate` before the packaged-runtime rebuild.
4. Run the documented clean walkthrough build, start only the `harmoniarr`
   service with health waiting, and invoke the disposable bootstrap helper.
   Do not reset or remove walkthrough data.
5. Use an authenticated browser context against the rebuilt Compose service to
   inspect Missing Music at `1440px`, `800px`, and `320px` viewport widths.
   Verify the canonical page heading and navigation, no document-level
   horizontal overflow, visible keyboard focus, and no page console errors.
6. Preserve screenshots and a bounded inspection summary under ignored local
   evidence paths. They must not contain credentials, provider keys, paths, or
   API payloads.

## W3C and deployment acceptance criteria

| Concern | Acceptance criterion |
| --- | --- |
| Reflow | At `320 CSS px`, the page retains content and controls without document-level horizontal scrolling. |
| Responsive navigation | Desktop uses the full sidebar, the intermediate viewport uses the collapsed pattern, and mobile retains a reachable navigation control without covering the focused control. |
| Keyboard visibility | A focused Missing Music navigation link and primary page heading have a visible outline and are not hidden by author-created fixed content. |
| Mobile drawer | A closed drawer has no reachable links; opening it places focus in its primary navigation; Escape, the backdrop, and a drawer-initiated route change return focus to the menu trigger. |
| Understandable structure | The canonical `Missing Music` level-one heading is present and the user does not need a legacy Music Queue or Acquisition route to reach it. |
| Packaged runtime | Compose reports the rebuilt service as healthy before browser inspection begins. |

## Security boundaries

- This task does not change authorization: Missing Music scope remains derived
  by the server from the authenticated actor.
- The local walkthrough credential is read only into the transient browser
  process; it is not passed as a command-line value or committed to evidence.
- The rebuild does not run `docker compose down`, delete walkthrough volumes,
  or alter production Compose resources.
- Exact image tags, `npm ci`, the existing npm pin, blocked lifecycle scripts,
  and Compose's localhost-only walkthrough port remain in force.

## Sources checked 2026-08-27

- [Node.js releases](https://nodejs.org/en/about/previous-releases) — Node
  24.20.0 is the current LTS release; Node 26.8.1 is Current. The project says
  production applications should use Active or Maintenance LTS releases.
- [Node Docker Official Image](https://github.com/nodejs/docker-node) — the
  project recommends LTS for production and notes that image availability can
  lag upstream Node releases while variants are built and published.
- [Docker Compose build reference](https://docs.docker.com/reference/cli/docker/compose/build/)
  — rebuilding a service is the supported way to apply changed Dockerfile or
  build-context content.
- [W3C WCAG 2.2 — Reflow](https://www.w3.org/TR/wcag/#reflow) — content must
  retain information and functionality at the equivalent of a 320 CSS-pixel
  viewport without two-dimensional scrolling, except where it is essential.
- [W3C WCAG 2.2 — Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)
  — author-created persistent content must not entirely hide a focused control.

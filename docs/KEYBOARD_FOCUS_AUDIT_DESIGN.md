# Keyboard Sweep + Focus-Ring Audit (Roving Surfaces)

Status: **Implemented (static audit + fixes).** This document records the design
and outcome for proposal #1 (current cycle) in
[DISCOVER_FOLLOWUP_DESIGN_AREAS.md](DISCOVER_FOLLOWUP_DESIGN_AREAS.md): a
consolidated audit of keyboard behavior and focus indicators across every
roving-tabindex surface (Batches D–K), with fixes for the gaps found.

It caps the platform-wide roving work: Batch D
([DISCOVER_ROVING_TABINDEX_DESIGN.md](DISCOVER_ROVING_TABINDEX_DESIGN.md)),
Batch F ([DISCOVER_MONITORED_CHIP_ROVING_DESIGN.md](DISCOVER_MONITORED_CHIP_ROVING_DESIGN.md)),
Batch J ([CARD_GRID_ROVING_DESIGN.md](CARD_GRID_ROVING_DESIGN.md)), and Batch K
([ARTIST_DETAIL_SECTION_ROVING_DESIGN.md](ARTIST_DETAIL_SECTION_ROVING_DESIGN.md)).

---

## 1. Purpose

Batches D–K made every card grid and the chip band a roving-tabindex surface,
each closing its batch with "recommended confirmation: a keyboard/axe pass." No
consolidated verification was ever run. This batch performs that verification at
the code level (a runtime Playwright pass needs a seeded full-stack environment
that is not available in-env), catalogues every focusable roving cell and its
focus indicator, and fixes the gaps so the focus rings are consistent and
WCAG-compliant in the source.

---

## 2. Research (verified sources)

Sources were located via web search (no assumed URLs).

| Topic | Source | Takeaway applied |
| --- | --- | --- |
| Focus Appearance (AA) | WCAG 2.2 §2.4.11 (testparty.ai guide) | Focus indicator needs **≥2px thickness** (or 1px perimeter) and **3:1 contrast** against adjacent colors; browser defaults "often fail." |
| Focus Not Obscured (AA) | WCAG 2.2 §2.4.12 | The focused element must not be entirely hidden. |
| Focus Appearance (AAA) | WCAG 2.2 §2.4.13 (wcag.com) | Reinforces 3:1 contrast + size; "design focus states for **all** interactive elements." |
| `:focus-visible` | testparty.ai / MDN | Use `:focus-visible` (not `:focus`) so the ring shows for keyboard users but not on mouse click. |
| Implementation pattern | testparty.ai | `outline: 2–3px solid <color>; outline-offset: 2px;` — outline (not box-shadow) so it survives forced-colors modes. |

**Standard applied:** every roving cell gets `outline: 2px solid var(--hx-accent);
outline-offset: 2px;` on `:focus-visible` (2px meets §2.4.11's thickness
exception; offset seats it on the surrounding surface for contrast).

---

## 3. Audit findings

Every focusable roving cell and its indicator, before this batch:

| Surface / cell | `cellSelector` | Focus indicator before | Verdict |
| --- | --- | --- | --- |
| Card link-area (Artist/Release/Discover cards) | `.hx-media-card__link-area` | `outline: 2px var(--hx-accent)` (centralized, Batch J) | ✅ compliant |
| RequestCard (MyRequests) | `.request-card` | `outline: 2px var(--hx-accent)` | ✅ compliant |
| Monitored chips (Discover) | `.discover-monitored-chip` | `outline: 2px var(--hx-accent)` | ✅ compliant |
| **`.hx-btn`** (Show more, Add, all buttons) | — | **none** — relied on browser default | ❌ gap (platform-wide) |
| **`.requester-home-discover-card`** (RequesterHome roving cell) | union selector | **none** — focus was invisible | ❌ gap |
| **`.operator-home__discover-card`** (OperatorHome roving cell) | union selector | inner art color change only — no perimeter ring | ⚠️ weak / inconsistent |

Wiring audit (template ref + `useArtworkGridRoving`/`useRovingTabindex` + count
watch): all 9 grids + the chip band + the ArtistDetail per-section wrapper are
correctly wired and target a real focusable element — no selector mismatches.

---

## 4. Fixes

1. **`design-system.css` — `.hx-btn:focus-visible`** (platform-wide). The primary
   button class had `:hover`/`:disabled` but **no** focus ring. Added
   `outline: 2px solid var(--hx-accent); outline-offset: 2px;` so every button
   (Show more, Add, Request, Monitor, action buttons) has a consistent,
   WCAG-2.4.11-compliant ring. The offset seats the outline on the surrounding
   surface, avoiding accent-on-accent for filled variants (e.g. primary).
2. **`RequesterHomePanel.vue` — `.requester-home-discover-card:focus-visible`**.
   This "Find more artists" `RouterLink` is a roving cell in the union selector
   but had **no** focus indicator. Added the standard ring (scoped specificity
   overrides the global `.hx-media-card:focus-visible { outline: none }`).
3. **`OperatorHomePanel.vue` — `.operator-home__discover-card:focus-visible`**.
   Added a clear perimeter outline ring; the existing art-color enhancement is
   retained, so the cell now has both a strong outline and the accent-color cue.

### Intentionally left as-is

- `.hx-media-card:focus-visible { outline: none; box-shadow; border-color }`
  (global) — flagged in Batch J as "never fires" for link-area cards. It still
  fires for whole-card links (discover cards, RequestCard), but each of those now
  has a higher-specificity scoped outline that overrides the `outline: none`, so
  it is harmless. Left unchanged to avoid disturbing unaudited card surfaces.

---

## 5. Security

- **No injection surface.** CSS-only changes; no markup/`v-html`/data-flow change.
- **No behavioral change to roving logic** — the composable/wiring is untouched;
  only the visual focus indicator is added/strengthened.

---

## 6. Files changed

| File | Change |
| --- | --- |
| `src/client/design-system.css` | Added `.hx-btn:focus-visible` ring (platform-wide). |
| `src/client/components/home/RequesterHomePanel.vue` | Added `.requester-home-discover-card:focus-visible` ring. |
| `src/client/components/home/OperatorHomePanel.vue` | Added `.operator-home__discover-card:focus-visible` outline ring. |

---

## 7. Validation

- Lint: `npm run lint:client` (`--max-warnings 0`) → clean.
- Build: `npm run build:client` → succeeds.
- Full client suite: `npm run test:client` → **3660 pass, 0 fail**.
- **Static audit complete:** every roving cell (`.hx-media-card__link-area`,
  `.request-card`, `.discover-monitored-chip`, both discover cards) and every
  `.hx-btn` now has a defined, consistent `:focus-visible` ring meeting WCAG 2.2
  §2.4.11 (≥2px, 3:1 contrast).
- **Remaining (runtime):** a Playwright/axe pass in a seeded environment is the
  final confirmation (arrow-key movement, Tab order across composites, and that
  the rendered ring contrasts 3:1 against each surface's actual background).

---

## 8. Pros / cons & final stack

| Decision | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Static (code-level) audit | Catches real gaps (missing/weak rings) without a running app; deterministic | Cannot prove runtime contrast/Tab-order | **Adopted** (runtime pass noted as remaining). |
| One shared ring spec (2px accent, offset 2px) across all cells + buttons | Consistent, WCAG-compliant, matches the existing card/chip rings | Uniform look (by design) | **Adopted.** |
| Fix `.hx-btn` platform-wide (not just roving buttons) | Closes the button-class focus gap everywhere | Slightly broader than the roving scope | **Adopted** (high leverage). |

**Final stack.** A static audit of all roving surfaces plus the `.hx-btn` class,
three targeted CSS fixes (`.hx-btn`, both discover cards), and a documented
finding that the global `.hx-media-card:focus-visible { outline: none }` is now
consistently overridden by scoped rings. Every keyboard-focusable roving cell and
every button now has a visible, WCAG-2.4.11-compliant focus indicator in source.

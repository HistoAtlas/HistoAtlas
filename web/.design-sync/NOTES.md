# design-sync notes (web/)

Run everything from `web/`. Target project: HistoAtlas (`projectId` in `config.json`).

## Setup quirks

- This is an Astro app, not a component library: no `dist/` entry, no `.d.ts`, no Storybook. The bundle entry is the hand-written barrel `.design-sync/entry.ts`, passed via `cfg.entry`. Component names are enumerated in `componentSrcMap` because there is no `.d.ts` tree to discover them from. **Adding a UI primitive to the sync = one export line in `entry.ts` + one `componentSrcMap` entry + one `previews/<Name>.tsx`.**
- Scope chosen by the user (2026-09-29): `src/components/ui` primitives + tokens only. App components (`atlas`, `cluster`, `histomics`, `slide`, `table`, `layout`, islands) are deliberately not synced.
- CSS: Tailwind v4 has no static stylesheet. `node .design-sync/build-css.mjs` (= `cfg.buildCmd`) compiles `src/index.css` to `.design-sync/.cache/ds.css` using the repo's own `postcss` + `@tailwindcss/postcss`. Run it before every converter/driver run. Tailwind scans the whole package, including `.design-sync/previews/`, so the shipped CSS contains only utility classes used somewhere in the app or the previews.
- Playwright: the machine cache (`~/Library/Caches/ms-playwright`) has `chromium-1208`, which is pinned by `playwright@1.58.0`. Install exactly that in `.ds-sync/`.
- `guidelinesGlob` is `[]`: `docs/astro-component-islands.md` is an internal migration note, not design guidance.

## Excluded components

- `CohortSelector`: fetches the cohorts API through `useCohorts`; nothing to render without the backend.
- `Equation`: imports `katex/dist/katex.min.css`, whose `.ttf` font URLs the converter's esbuild config has no loader for. Including it breaks the whole bundle.

## Provider

- `ProvenanceBar` calls `useBundleVersion` (react-query), so previews are wrapped in `QueryClientProvider` with the `queryClient` exported from `entry.ts` (`cfg.provider` with `$ref`). The fetch to the ready endpoint fails in previews; previews pass `evidence.bundleVersion` so the bar still renders.

## Fonts

- `index.css` names `Inter` first in the font stack but the app never loads it (no `@font-face`, no font link). Production visitors without Inter installed see system fonts. The sync ships system fonts, matching that. `[FONT_MISSING] "Inter"` is therefore expected. Offered to the user 2026-09-29; revisit if they ask for Inter to be shipped (`cfg.extraFonts`).

## Known render warns

- `[FONT_MISSING] "Inter"`: see Fonts above.

## Not previewed

- `InfoTooltip` open state (hover-driven, portal to `document.body`): previews show the trigger icon only.
- `AssumptionChecks` expanded detail row (click-driven).

## Re-sync risks

- `entry.ts` and `componentSrcMap` are hand-maintained lists: a new file in `src/components/ui` is NOT picked up automatically.
- Preview data (stat summaries, version strings) is invented but shaped after `src/types/stats.ts` and `src/types/analysis.ts`; a type change there can break previews at compile time (component drops to the floor card).
- The compiled CSS depends on the installed Tailwind version (`^4.1.18`); a major upgrade can change utility output.
- `.ds-sync/` and `.design-sync/.cache/` are gitignored: on a fresh clone re-stage the scripts, reinstall converter deps, and re-run `buildCmd`.

## Known render warns (additions)

- `[RENDER_THIN]` on `NoResultsIcon` and `NoSelectionIcon`: they are bare SVG icons with no text; screenshots confirmed they paint correctly.

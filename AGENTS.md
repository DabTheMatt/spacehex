# AGENTS.md

## Cursor Cloud specific instructions

SPACE HEX is a **single-service, 100% static frontend** prototype (Vue 3 + TypeScript + Vite + Pinia + Three.js). There is no backend, database, or external service. Standard commands live in [`README.md`](./README.md) and `package.json` scripts (`dev`, `build`, `test`, `lint`, `format`). Requires Node 22.

Non-obvious notes:

- The Vite dev server uses `strictPort` on **port 5188** (not the Vite default 5173) — see `vite.config.ts`. If 5188 is taken, `npm run dev` fails instead of picking another port.
- `npm run build` runs `vue-tsc --noEmit` (typecheck) before `vite build`, so a type error fails the build.
- `npm run lint` currently reports 3 pre-existing errors in `src/components/GameCanvas.vue` (`HTMLInputElement`/`HTMLTextAreaElement`/`HTMLSelectElement` not declared as globals in `eslint.config.js`). This is a pre-existing repo issue, not an environment problem.
- Tests are Vitest and run in a `node` environment (no jsdom); they cover pure game-engine/hex-math logic under `src/tests/`.

Interacting with the 3D game (useful for manual/automated testing of the exploration loop):

- The ship EVA-1 is auto-selected on load. Keyboard: `` ` `` toggles the dev panel; `1` MOVE, `2` EXPLORE, `3` STAY; during tile placement `Q`/`E` rotate and `F` or `Enter` confirm (see `src/components/GameCanvas.vue`).
- After pressing `2` (EXPLORE), six dashed "ghost" hexes appear. Their clickable hit area is a near-invisible mesh (`opacity 0.04`) covering the hex; you must click **dead-center** of a ghost. The canvas treats pointer movement >6px between press and release as a camera pan and cancels the click, so use a crisp single click (no drag) — this trips up automated clicking.
- Full core loop: select ship → `2` EXPLORE → click a ghost hex → `Q`/`E` to rotate the preview → `F`/`Enter` to confirm. On success the tile is placed permanently, the ship moves onto it, `DECK` decrements and `FUEL` decreases.

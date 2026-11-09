# AGENTS.md

## Commands

No package.json, build step, bundler, linter, or tests exist. Verify changes manually in a browser: open `src/index.html` directly (classic scripts only, `file://` works) or serve `src/` statically.

## Workflow

Spec Driven Development learning project (see `README.md`). `skills-lock.json` pins the `spec` and `spec-impl` skills (from `klerith/fernando-skills`) — follow that spec → implement flow for changes.

## Architecture

Four classic (non-module) scripts loaded in this exact order by `src/index.html`; they share state only via `window.*` globals:

1. `maze.js` — static data: maze, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
2. `game.js` — state and rules: `createGame()` returns fresh state, `update(game)` advances one frame. No DOM.
3. `render.js` — canvas drawing; reads `game.grid` (never `MAZE`) so eaten dots disappear.
4. `main.js` — loop, keyboard, overlay. Owns the DOM.

Adding a JS file = adding a `<script>` tag in `src/index.html` in dependency order. Nothing imports anything.

## Maze invariants (`src/js/maze.js`)

- `MAZE_STR`: exactly 31 rows × 28 chars, symmetric across the vertical center (cols 13|14).
- Chars: `#` wall, `.` dot, ` ` walkable, `-` pen door. Parsed to 1/2/0/3.
- Row 14 (`TUNNEL_ROW`) is the wrap-around tunnel — both row ends are intentionally open.
- Pen door (3) blocks Pac-Man only; ghosts pass through (`isWall` in `game.js`).
- `MAZE` is pristine and must never be mutated; each game copies it to `game.grid` where dots get eaten.
- Canvas in `index.html` is 560×620 = 28×31 grid × `TILE` 20 (`render.js`). Any change to maze dimensions must update both.

## Conventions

- Identifiers in English; comments and user-facing text in Spanish (e.g. `GANASTE`, `VIDAS`).
- Formatting: single quotes, 2-space indent, spaces inside parens — `foo( arg )`. Match existing style; don't reformat.

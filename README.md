# Shin_Syndicate

A tiny single-player, real-time tactical squad game in an isometric cyberpunk
city. You command two cybernetic agents of the Shin Syndicate; your objective is
to eliminate the two Halcyon Dynamics security guards posted in the Meridian
Ward business district.

- **Victory:** both guards are eliminated.
- **Defeat:** both of your agents are killed.

The game is built with [Phaser 4](https://phaser.io) (4.2.1), TypeScript in
strict mode and Vite. All artwork (city, characters, portraits, effects) is
generated procedurally at start-up with the Canvas 2D API; there are no image
files and no external assets.

## Prerequisites

- [Node.js](https://nodejs.org) **22.18 or newer** (includes npm). The unit
  tests use Node's built-in test runner and its native TypeScript support.
- A desktop browser with WebGL (current Chrome, Edge, Firefox or Safari).

## Installation

```bash
npm install
```

## Development server

```bash
npm run dev
```

Vite prints a local URL (by default <http://localhost:5173/>). Open it in a
desktop browser.

## Controls

| Input | Action |
| --- | --- |
| Left-click an agent | Select that agent |
| Shift + left-click an agent | Add the agent to / remove it from the selection |
| Left-click empty ground | Clear the selection |
| Right-click ground | Move the selected agents there (a group spreads over neighbouring tiles) |
| Right-click a guard | Attack: the agents close in until they have range and line of sight, then fire automatically |
| Space | Pause / resume the simulation (orders can still be issued while paused) |
| R | Restart the mission |

Tips: guards show their weapon range as a faint red ellipse on the ground.
Idle agents return fire at guards that are already within their range, and
buildings (as well as advertising pillars and vending machines) block bullets.
Engaging both guards at once is dangerous.

## Tests and checks

```bash
npm run typecheck   # TypeScript, strict mode (tsc -b)
npm test            # unit tests (isometric projection, A*, line of sight, simulation rules, selection)
```

## Production build

```bash
npm run build       # type-checks, then writes the static site to dist/
npm run preview     # serves dist/ locally for a final check
```

The build uses relative asset paths (`base: './'` in `vite.config.ts`), so the
contents of `dist/` can be published unchanged to GitHub Pages, including a
project sub-path such as `https://<user>.github.io/Shin_Syndicate/`.

## Project structure

```
index.html                  HTML entry point
vite.config.ts              Vite configuration (relative base path, Phaser chunk)
src/
  main.ts                   Game initialisation (Phaser config, scenes)
  session.ts                Shared per-play-through state: world, selection, pause, HUD notices
  debug.ts                  Optional state hook for automated browser tests (only with ?debug in the URL)
  core/                     Gameplay rules: no Phaser, no DOM
    iso.ts                  Isometric world ↔ screen projection
    cityMap.ts              16 × 16 map layout, walkability and sight blocking
    pathfinding.ts          Four-direction A*, breadth-first search, nearest free tile
    lineOfSight.ts          Grid ray cast used for shots and vision
    units.ts                Unit, weapon and order types
    world.ts                Simulation: commands, movement, combat, guard AI, win/lose
    scenario.ts             Mission data: spawn points and weapon stats
  input/
    selection.ts            Selection state (select, shift-toggle, prune dead agents)
    picking.ts              Which unit is under the cursor
    CommandInput.ts         Mouse → selection and move/attack commands
  render/
    textures/               Procedural texture generation (ground, buildings, props, characters)
    CityView.ts             Places the city and fades buildings that hide units
    UnitView.ts             Unit sprites, health tags, facing, hit flash, death
    Effects.ts              Tracers, impacts, order markers, selection rings
    Rain.ts                 Light rain overlay
    cityStyle.ts, palette.ts, depth.ts, graphics.ts   Look-and-feel data and helpers
  hud/widgets.ts            HUD text and panel helpers
  scenes/
    BootScene.ts            Generates textures, then starts the mission
    GameScene.ts            World rendering, input, simulation loop, keyboard shortcuts
    HudScene.ts             Minimap, objective, squad cards, notices, pause and end overlays
tests/                      Node test runner suites for the core logic
```

The simulation in `src/core` is independent of Phaser: scenes pass it commands
and a frame-rate-independent time step, then render its state and its event
queue (shots, deaths, alerts). This keeps the rules unit-testable without a
browser.

# Task: Build a tiny playable isometric tactical browser game

You are an experienced game developer and TypeScript engineer.

Create a complete, working, single-player browser game inspired by the general concept of classic isometric cyberpunk tactical games.

**Do not merely write a design document or implementation plan. Actually create the project, write the code, install dependencies, run tests, and make the game playable.**

## 1. Technology

- Game engine: Phaser 4 (stable release, preferably 4.2.1)
- Programming language: TypeScript, with strict type checking
- Build tool: Vite
- Platform: Desktop web browsers
- Backend: None
- Multiplayer: None
- Future deployment: GitHub Pages
- Prefer official Phaser 4 APIs and documentation; do not accidentally use unsupported Phaser 3 APIs.

Use npm. If starting from an empty directory, initialize the application yourself.

## 2. Game concept

Create a tiny real-time tactical squad game set in an original futuristic corporate city.

The player commands two cybernetic agents through mouse clicks. Two hostile guards occupy the map.

**Objective: Eliminate both enemy guards.**

The player wins when both enemies are defeated and loses when both friendly agents are defeated.

The game must be fully playable from beginning to end.

## 3. Visual presentation

Create a visually appealing, modern, high-resolution 2D game using an isometric projection.

Requirements:

- A compact isometric city map, approximately 16 × 16 logical tiles.
- Streets, sidewalks, a few buildings and obstacles.
- Two visually distinguishable friendly agents.
- Two hostile guards with a different color scheme.
- Clearly visible selection indicators.
- Health bars and simple shooting effects.
- A clean HUD showing instructions, squad health and remaining enemies.
- A victory or defeat overlay.

Use a consistent futuristic cyberpunk aesthetic with restrained neon accents, lighting cues and shadows.

**Do not use retro low-resolution pixel art.**

For this prototype, create graphics procedurally using Phaser's drawing capabilities. Use geometric shapes, gradients or other compatible rendering techniques.

Do not depend on external image-generation services, paid assets, image downloads or copyrighted game artwork.

Visual quality matters, but gameplay functionality has priority.

## 4. Controls

Implement mouse-controlled tactical squad gameplay.

- Left-click a friendly agent to select it.
- Shift + left-click to select multiple friendly agents.
- Right-click empty ground to command selected agents to move there.
- Right-click an enemy to command selected agents to attack it.
- Press Space to pause or resume the simulation.
- Press R to restart the game.
- Prevent the browser context menu from appearing when right-clicking the game canvas.

When multiple agents receive a movement command, they should move towards nearby positions rather than always occupying precisely the same destination.

Display visual feedback when an order is issued.

## 5. Movement and navigation

Implement simple grid-based A* pathfinding.

- Agents must navigate around buildings and blocked tiles.
- Agents must not walk through obstacles.
- Movement should be animated smoothly between logical positions.
- Movement speed must not depend on frame rate.
- The player must be able to issue a new command while an agent is moving.
- Unreachable destinations must be handled without crashes.

Use a proper isometric world-to-screen coordinate transformation, and correctly convert mouse positions back into world coordinates.

A simple four-direction navigation grid is acceptable for this prototype.

## 6. Combat

Implement very simple real-time combat.

- Friendly agents have health.
- Enemy guards have health.
- Weapons have range, damage and a firing cooldown.
- When commanded to attack, a friendly agent should approach the target if necessary, then fire automatically.
- Enemy guards automatically attack nearby friendly agents within range and unobstructed line of sight.
- Shots must not pass through solid buildings.
- Dead agents stop moving and attacking.
- Display simple shooting effects and update health bars.

Use straightforward combat logic. Do not implement advanced physics, multiple weapon classes or complicated enemy AI.

## 7. Enemy AI

For now, enemies can remain near their initial positions.

They should:

1. Detect nearby friendly agents.
2. Attack visible friendly agents within weapon range.
3. Stop attacking when no valid target is available.

Do not implement sophisticated patrols, reinforcement systems or complex tactical intelligence.

## 8. Architecture

Keep the code reasonably modular without overengineering.

Separate these responsibilities where practical:

- Game initialization
- World/map generation and isometric projection
- Agent state
- Mouse input and selection
- Movement and pathfinding
- Combat and enemy behavior
- HUD and game state

Avoid putting the entire game into one enormous TypeScript file.

Keep gameplay rules separate from rendering and device input where reasonably practical.

Use readable, maintainable TypeScript. Avoid unnecessary frameworks, abstractions and dependencies.

## 9. Scope restrictions

This is deliberately a tiny game.

Do NOT implement:

- Mobile or touch controls
- Multiplayer
- Backend or database
- User accounts
- Inventory or equipment upgrades
- Vehicles
- Campaigns or multiple missions
- Save/load functionality
- Sophisticated animations
- External game asset pipelines
- Procedural mission generation
- Unnecessary architectural infrastructure

Do not implement features merely because they appear in larger Syndicate-inspired game designs.

**Finish the smallest playable game first.**

## 10. Quality and testing

After implementation:

1. Install the required npm dependencies.
2. Run the TypeScript type checker.
3. Run a production build.
4. Add a few focused automated tests for isometric coordinate conversion and navigation, if practical.
5. Fix any errors found.
6. If browser automation is available, launch the game and verify that basic gameplay works.
7. If browser testing is unavailable, explicitly report that manual gameplay testing remains necessary.

Do not claim the game has been visually or interactively tested unless you actually tested it.

## 11. Deliverables

Create all necessary project files, including:

- `package.json`
- TypeScript source code
- Vite configuration
- HTML entry point
- Any locally generated visual assets
- `README.md`
- Appropriate `.gitignore`

Include in the README:

- Prerequisites
- Installation instructions
- How to start the development server
- Controls
- How to build for production
- How the project is structured

## 12. Acceptance criteria

The task is complete only when:

- The game starts in a desktop browser.
- An isometric city map is visible.
- Two friendly agents and two enemies are visible.
- The player can select one or both friendly agents.
- Right-clicking ground makes the selected agents navigate toward it.
- Agents avoid solid obstacles.
- Right-clicking enemies causes combat.
- Enemies can damage player agents.
- Units can die.
- Victory and defeat conditions work.
- The game can be restarted.
- The production build succeeds.

## 13. Execution instructions

Work autonomously.

Make reasonable design decisions where details are unspecified.

Do not repeatedly ask for confirmation about minor implementation choices.

Implement the game rather than stopping after a plan.

If you encounter an error, diagnose it, fix it and repeat verification.

Keep changes limited to the current project directory.

Do not delete unrelated files, publish to external services or create remote repositories without authorization.

At the end, provide:

1. A summary of what you implemented.
2. Commands to run the game locally.
3. Results of the checks you actually performed.
4. Any remaining problems or unverified functionality.

Prioritize a complete and working tiny game over an ambitious but incomplete implementation.

## 90. Note
- Refer to the three images in the img folder for the screen design. (However, this does not mean that the design must be reproduced exactly.)

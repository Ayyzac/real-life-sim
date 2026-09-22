# Real Life Sim

A browser-based life simulation game. Single-player, runs entirely client-side,
no backend and no paid services.

**Live:** https://ayyzac.github.io/real-life-sim/

## Status

Phase 1 of [docs/ROADMAP.md](docs/ROADMAP.md) is complete: a playable life,
from creating a character to the closing summary.

You pick a background, take a job, choose what to spend your weeks on, and
press Advance Week. Money, health, energy and mood move. Life events turn up -
some of them stop the week to ask you something. Neglect yourself and your
health declines, visibly, until it runs out. Then you get a Life Summary and
start again from nothing.

The walkable town map arrives in Phase 2. Until then the world is a menu.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173/real-life-sim/

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build static files into `dist/` |
| `npm run verify` | Typecheck + tests + architecture guard |
| `npm run test` | Vitest, simulation core only |
| `npm run check:core-purity` | Fails if `src/core/` imports React or Phaser |

## Docs

Design and process live in [CLAUDE.md](CLAUDE.md) and [docs/](docs/):
game design, architecture, roadmap, and asset sources.

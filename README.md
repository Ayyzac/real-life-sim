# Real Life Sim

A browser-based life simulation game. Single-player, runs entirely client-side,
no backend and no paid services.

**Live:** https://ayyzac.github.io/real-life-sim/

## Status

Phase 0 of [docs/ROADMAP.md](docs/ROADMAP.md): foundation and deploy pipeline.
There is no gameplay yet - the page only proves that the build ships to a public
URL automatically.

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

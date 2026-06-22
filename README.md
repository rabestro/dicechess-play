# dicechess-play

Public site to **play Dice Chess against our bots** — anonymous, no sign-up. Phase 1 of
the play-site roadmap: a visitor plays a full game in the browser and the finished game
is recorded to `dicechess-analytics` as a new source, `playsite`.

> Private repo. Decisions and roadmap live in the `dicechess-docs` wiki under
> **Play Site** (`00 Overview`, `01 Дорожная карта`, `02 Архитектура`, `03 Фаза 1`,
> `Decisions/ADR-0001…0006`).

## Stack

SvelteKit 2 · Svelte 5 (runes) · Tailwind 4 · `adapter-static` (SPA) · PWA
(`@vite-pwa/sveltekit`). The Dice Chess engine (`@rabestro/dicechess-engine`, Scala.js)
runs **client-side** in a Web Worker — phase 1 is deliberately client-authoritative
(free bot play has nothing to cheat; the analytics replay gate still guarantees
legality). Theme system (7 themes) is shared with `dicechess-analytics-ui`.

## Getting started

```bash
export NODE_AUTH_TOKEN=ghp_xxx   # PAT with read:packages (GitHub Packages — see .env.example)
mise run setup                   # npm install
mise run dev                     # vite dev → http://localhost:5173
mise run check                   # lint + format + svelte-check
```

The engine and chessground are published on GitHub Packages, so `npm install` needs
`NODE_AUTH_TOKEN` (see `.npmrc`).

## Layout

```
src/
├── routes/
│   ├── +layout.svelte        themed shell (theme switcher, toasts)
│   ├── +page.svelte          landing → "Play vs a bot"
│   └── play/+page.svelte     the game: lobby → board → dice → result
├── components/               board + UI (ported from lab, thin store-driven board)
│   ├── Board.svelte          thin wrapper over chessground bound to the play store
│   ├── lib/Chessground.svelte
│   ├── MoveHistory.svelte · PawnPromotionSelector.svelte · ToastContainer.svelte
├── lib/
│   ├── playWithBot/          ported game core (store + engine bot/dice/history/worker)
│   ├── localGamesDB.ts       IndexedDB outbox (pending → synced)
│   ├── authStore.svelte.ts   GUEST stub (no accounts in phase 1)
│   ├── stores/themeStore.svelte.ts
│   └── ingest/               → analytics POST /api/games
│       ├── types.ts          GameIngestWire contract (verbatim from observer/sync)
│       ├── guestIdentity.ts  per-browser guest:<uuidv7> + restore code
│       ├── mapper.ts         LocalGameRecord → GameIngestWire (UUIDv5 id, dice decode)
│       ├── gatewayClient.ts  POST to the ingest gateway (token never in browser)
│       └── outbox.ts         flush pending games → gateway
└── utils/                    fenUtils · pieceImages · formatters
```

## How recording works

Finished games are saved to IndexedDB (`localGamesDB`, `sync_status: 'pending'`), then
`flushOutbox()` maps each to `GameIngestWire` and `POST`s it to the **ingest gateway**
(`VITE_INGEST_GATEWAY_URL`, hosted on Koyeb). The gateway holds the analytics Bearer
token, re-validates via an engine replay, and forwards to `sync.jc.id.lv`. The browser
never holds `INGEST_TOKEN`.

Identity: `source='playsite'`; human = `guest:<uuidv7>` (per-browser), bot =
`bot:<algorithm>` (shared with the extension, disambiguated by `source`); game id =
`UUIDv5('playsite/game/<uuid>')`.

## Phase-1 follow-ups (scaffold TODOs)

- **Ingest gateway** is a separate service (not in this repo) — Koyeb, holds the token,
  local engine pre-validate. Set `VITE_INGEST_GATEWAY_URL` once it exists.
- **Engine version pin**: `^1.4.3` to match the analytics backend replay. Add a
  boot-time client==gateway==backend version assertion + a golden-corpus CI gate.
- **Termination**: `mapper.deriveTermination()` infers from the final board; persist the
  store's `gameEndReason` onto `LocalGameRecord` and consume it instead.
- **Outbox**: add backoff + a `quarantined` state for 422 rejects.
- **UI polish**: clocks, draw/double, richer dice/board (currently a thin slice).
- **Tests**: only the pure-logic unit tests are ported; the engine-dependent
  playWithBot tests need `NODE_AUTH_TOKEN` to install and were left for a later pass.

## License

AGPL-3.0 (inherited from the Dice Chess engine; the public site distributes the engine
bundle). See `LICENSE`.

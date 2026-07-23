# dicechess-play

Public site to **play Dice Chess against our bots** — anonymous, no sign-up. Phase 1 of
the play-site roadmap: a visitor plays a full game in the browser, and the finished game
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
├── routes/                    SPA pages (ssr/prerender disabled in +layout.ts)
│   ├── +layout.svelte         themed shell: nav, theme switcher, toasts, zen chrome
│   ├── +page.svelte           landing — the ways to play
│   ├── play/                  vs-bot game (client-authoritative; engine in a Web Worker)
│   ├── lobby/                 seek list + live-board wall (polls play-api)
│   ├── live/ · live/[id]/     friend-link entry · server-authoritative live board (WebSocket)
│   ├── games/ · games/[id]/   local game history · replay
│   ├── leaderboard/           bot rating ladder (play-api GET /leaderboard)
│   ├── bots/                  human-play bot catalog (play-api GET /lobby/bots, ADR-0014)
│   └── me/                    guest profile + restore code
├── components/                shared UI
│   ├── Board.svelte           thin chessground wrapper driven by either game store
│   ├── lib/Chessground.svelte
│   ├── PlayerStrip · DicePanel · MoveHistory · GameEndModal · BotBadge
│   ├── GameHistoryCard · MiniBoard · TimeControlPicker · PawnPromotionSelector · ToastContainer
│   └── BotCatalogCard · BotTimeControlPicker — the /bots page's card (click → wake → config → start)
├── lib/
│   ├── playWithBot/           bot-play core: store, engine worker, dice/history, opening book
│   ├── live/                  live-play client: liveGameStore, liveClient (WS + reconnect),
│   │                          liveApi/lobbyApi (REST), liveTypes (play-api wire mirror),
│   │                          dfen/board/clock/seat/timeControl/playerLabel helpers
│   ├── leaderboard/           leaderboardApi — rating-ladder read client (play-api wire mirror)
│   ├── catalog/               catalogApi — bot-catalog read/wake/play-bot client (play-api wire mirror)
│   ├── ingest/                → analytics POST /api/games
│   │   ├── types.ts           GameIngestWire contract (verbatim copy — see the file head)
│   │   ├── guestIdentity.ts   per-browser guest:<uuidv7> + restore code
│   │   ├── mapper.ts          LocalGameRecord → GameIngestWire (UUIDv5 id, dice decode)
│   │   ├── gatewayClient.ts   POST to the ingest gateway (token never in browser)
│   │   └── outbox.ts          flush pending games → gateway
│   ├── history/               move-history reconstruction for replays
│   ├── stats/                 local player W-D-L record
│   ├── stores/                singleton rune stores: themeStore (7 themes) · localGamesStore · chromeStore
│   ├── localGamesDB.ts        IndexedDB via idb (sync_status: pending → synced | quarantined)
│   ├── timings.ts             presentation pacing shared by BOTH game surfaces — never fork per surface
│   └── bots.ts · gameOutcome.ts · sound.ts · preferencesStore · toastStore · authStore (guest stub)
└── utils/                     fenUtils · pieceImages · formatters
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

- [ ] **Ingest gateway**: separate service (not in this repo) — Koyeb, holds the token, local engine pre-validate. Set `VITE_INGEST_GATEWAY_URL` once it exists.
- [ ] **Outbox**: add retry backoff (the `quarantined` state for 422 rejects is already implemented).
- [x] **Engine version pin**: updated to `^1.6.6` in `package.json`.
- [x] **Termination**: persisting `gameEndReason` onto `LocalGameRecord` and mapping to analytics is done.
- [x] **UI polish**: clocks, draw/double, and interactive dice/board are done.
- [x] **Tests**: engine-dependent integration tests (`playWithBotStore.test.ts`) are implemented and run in CI with `NODE_AUTH_TOKEN`.

## License

AGPL-3.0 (inherited from the Dice Chess engine; the public site distributes the engine
bundle). See `LICENSE`.

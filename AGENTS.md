# AGENTS.md

dicechess-play is the public Dice Chess play site: a fully client-side SvelteKit SPA where anonymous visitors play bots or each other, auto-deployed to Cloudflare Pages on every push to `main`.

## Project context

- Static SPA: SvelteKit 2 + Svelte 5 runes, Vite, Tailwind 4, adapter-static (`ssr=false`, output `dist/`), PWA (autoUpdate service worker). No backend code lives here.
- Public repo, AGPL-3.0. External contributors must sign the CLA (`CLA.md`, enforced by the `CI: CLA` workflow; repo owner exempt).
- Two game surfaces: `/play` (client-authoritative vs bot, engine in a Web Worker) and `/lobby` + `/live/[id]` (server-authoritative human-vs-human client for the sibling `dicechess-play-api` server).
- Cross-repo contracts this repo carries:
  - `src/lib/ingest/types.ts` — `GameIngestWire`, a **verbatim copy** of the shared ingest contract (analytics `POST /api/games`). Divergence = 422 rejects, because the backend replays games with a pinned engine.
  - `src/lib/live/liveTypes.ts` — `ClientCommand`/`ServerEvent` must mirror play-api's Circe codecs exactly. Verify both sides when changing either.
  - DFEN: the 7th field encodes dice as piece letters; decoded in `src/lib/ingest/mapper.ts` and `src/lib/live/dfenUtils.ts`.
  - Ingest identity: `source='playsite'`, human = `guest:<uuidv7>`, bot = `bot:<algorithm>`, game id = UUIDv5 for idempotent re-sends.
- Game engine = `@rabestro/dicechess-engine` (Scala.js, version pinned in `package.json`), served from GitHub Packages — auth prerequisite below.

## Architecture map

- `src/routes/` — pages: `+page` (home), `play/`, `lobby/`, `live/[id]/`, `games/` + `games/[id]/` (local history & replay), `me/` (guest profile + restore code). `+layout.ts` disables SSR/prerender.
- `src/lib/playWithBot/` — bot-play surface: `playWithBotStore.svelte.ts` (game store), `playWithBot.worker.ts` (engine runs here), dice/history submodules, `opening_book.json`.
- `src/lib/live/` — live surface: `liveGameStore.svelte.ts` (applies versioned `ServerEvent`s, optimistic moves rolled back on `Rejected`), `liveClient.ts` (WS + reconnect backoff, deliberately rune-free), `liveApi.ts`/`lobbyApi.ts` (REST), `liveTypes.ts`, clocks/seat/time-control helpers.
- `src/lib/ingest/` — finished-game recording: `mapper.ts` (LocalGameRecord → `GameIngestWire`), `gatewayClient.ts` (posts to the ingest gateway; the browser never holds an analytics token), `outbox.ts`, `guestIdentity.ts`.
- `src/lib/localGamesDB.ts` — IndexedDB via `idb`; `sync_status`: `pending` | `synced` | `quarantined`.
- `src/lib/history/`, `src/lib/stats/` — replay reconstruction, local player record.
- `src/lib/stores/` — singleton rune stores: `themeStore` (7 themes), `localGamesStore`, `chromeStore`.
- `src/components/` — shared UI (`Board`, `DicePanel`, `PlayerStrip`, `GameEndModal`, …). NOT `src/lib/components/` — that holds only an empty leftover dir.
- `src/lib/timings.ts` — presentation pacing constants shared by BOTH surfaces. Single source; never fork per-surface copies.

## Commands

Prerequisites:

- `mise` provides node 26, lefthook, betterleaks (`mise.toml [tools]`).
- `export NODE_AUTH_TOKEN=<GitHub PAT with read:packages>` BEFORE installing — the engine resolves from `npm.pkg.github.com` (only the `@rabestro` scope is routed there, see `.npmrc`); chessground installs from the public registry despite the stale comment in `.env.example`. Failure signature: `npm install` dies with `401 Unauthorized` on `@rabestro/dicechess-engine`.
- Fresh clone: `svelte-kit sync` must run before svelte-check (the `prepare` npm script and `npm run check` both do it). Failure signature: svelte-check errors about a missing `.svelte-kit/tsconfig.json`.

```bash
mise run setup          # npm install (needs NODE_AUTH_TOKEN)
mise run hook:install   # register lefthook git hooks — once per clone
mise run dev            # Vite dev server → http://localhost:5173
mise run check          # eslint + prettier --check + svelte-check
mise run test           # vitest run
mise run format         # prettier --write .
mise run compile        # vite build → dist/
mise run hook:run       # run all pre-commit hook jobs manually
npx vitest run src/lib/ingest/mapper.test.ts   # single test file
npm run test:watch      # watch mode; npm run test:coverage for v8 coverage
```

- Run `npm ci` immediately after every `git pull`. Failure signature of skipping it: local prettier disagrees with CI and produces false formatting "drift" (this repo has 4 commits that exist only to undo such damage). When local lint/format disagrees with CI, compare tool versions first — never "fix" the files.
- Local live-play dev: run play-api locally and set `VITE_PLAY_API_URL=http://localhost:8080` in `.env.local`. Empty `VITE_INGEST_GATEWAY_URL` = recording disabled (games stay in IndexedDB); empty `VITE_PLAY_API_URL` = `/live` routes disabled.

## Quality gates — Definition of Done

- Before a PR: `mise run check` and `mise run test` pass locally. CI (`ci.yaml`) runs the same set — eslint, prettier check, svelte-check, `vite build`, `vitest run` — on push/PR to `main`; any failure blocks.
- No coverage threshold and no SonarCloud in this repo (those live in sibling repos). Still add tests for every behavior change — colocated `*.test.ts` is the house norm.
- CLA check runs on every PR (non-owner authors must have signed).
- Per-change extras:
  - Touched `src/lib/ingest/types.ts` or `mapper.ts` → confirm the wire shape against the shared ingest contract before merging; a silent mismatch only surfaces as production 422s.
  - Touched `src/lib/live/liveTypes.ts` or `liveClient.ts` → verify against play-api codecs, ideally with both repos running locally.
  - Touched the presentation/history pipeline → run the store suites (`liveGameStore.test.ts`, `liveClocks.test.ts`, `playWithBotStore.test.ts`) and manually scrub move history in the browser.
  - UI flow changes → verify in the dev server; hard-refresh may be needed to bypass a cached PWA service worker.

## Code conventions

- Prettier: tabs, single quotes, trailing commas, printWidth 100, `prettier-plugin-svelte` (`.prettierrc`). Enforced pre-commit (staged `--write`), pre-push (`--check` all), and in CI.
- ESLint flat config (`eslint.config.js`): js/ts/svelte recommended sets; `no-explicit-any` is warn-level; unused vars allowed with `_` prefix.
- TypeScript strict, ES2023; `tsconfig.json` extends the GENERATED `.svelte-kit/tsconfig.json`. TypeScript is tilde-pinned (`~6.x`) — TS6 dropped auto-inclusion of `@types` packages, so verify `node:` imports with `npm run check` instead of assuming.
- Svelte 5 runes only (`$state`/`$derived` incl. `$derived.by`/`$effect`/`$props`). State stores are classes in `*.svelte.ts` files exported as singletons; transport/pure-logic modules are plain `.ts` and stay rune-free (`liveClient.ts` is the model).
- Each wire mirrors its server verbatim: the analytics ingest wire (`GameIngestWire`) is snake_case; the play-api live wire (`liveTypes.ts`) is camelCase with PascalCase single-key event discriminators (`{ Snapshot: … }`) — never "normalize" either. Internal TS is camelCase (persisted `LocalGameRecord` fields are the snake_case exception). Map enums via explicit `Record` tables (see `END_REASON_TO_TERMINATION` in `mapper.ts`).
- Error handling: REST helpers (`liveApi.ts`) throw on bad status; the ingest path NEVER throws on HTTP status — outcomes are classified (`created`/`exists`/`rejected`/`error`) so the outbox decides retry vs quarantine.
- New modules get a file-head block comment stating the module's contract, the decision behind it, and any cross-repo invariants (see `ingest/types.ts`, `liveGameStore.svelte.ts`).
- Accessibility is reviewed: keep ARIA roles on interactive widgets and focus management on confirmations (existing patterns in history nav and `/me`).

## Testing conventions

- Vitest + jsdom; tests are colocated `src/**/*.test.ts`; `vitest-setup.ts` loads `fake-indexeddb/auto`. No Docker needed anywhere.
- Bot-play tests never load the real engine: inject a mock via `setDiceChessInstance`/`resetDiceChessInstance` (see `playWithBotStore.test.ts`). Live-store tests DO load the real engine (top-level import in `liveGameStore.svelte.ts`) and exercise it for legal moves and optimistic application; they mock the network via `MockWebSocket` instead. CI's `NODE_AUTH_TOKEN` covers both cases at install time.
- WebSocket behavior is tested with a hand-rolled `MockWebSocket` that drives `ServerEvent`s (pattern in `liveClocks.test.ts`).
- Non-flaky patterns to preserve: sound tests flush stale unlock listeners and guard against missing `localStorage` (they were flaky until isolated this way).

## Gotchas

- Run `git status` before touching anything — in-flight feature work is often present in the working tree.
- Never add game-logic decisions to the live client. `/live` is server-authoritative: the client only applies versioned `ServerEvent`s and rolls back optimistic moves on `Rejected`. Game rules belong in the engine worker (`/play`) or in play-api.
- Live-vs-viewed separation — this codebase's signature bug, fixed twice (PRs #45, #56): game logic must read the private live fields (`liveFen`/`liveActiveColor`/`liveDice`), never the public presentation getters (`currentBoardFen`/`activeColor`/`currentDice`), because those switch to historical values while the user scrubs move history. Documented at the top of `liveGameStore.svelte.ts`.
- `liveGameStore` uses `epoch`/`pumpingEpoch` counters to invalidate in-flight async presentation loops across reset/reconnect — respect them when touching the present pipeline; racing loops caused several past fixes.
- `gatewayClient.classify`: 200 = `exists` (first-writer-wins dedup), 201 = `created`, 400/422 = permanent `rejected` → quarantined and never retried, everything else = `error` → retried. Do not "fix" the outbox to retry rejects.
- `VITE_*` env vars are baked at BUILD time — the bundle is direct-uploaded to Cloudflare Pages, so Pages dashboard variables do nothing. Changing `VITE_INGEST_GATEWAY_URL`/`VITE_PLAY_API_URL` requires rebuild + redeploy (`deploy.yaml` reads them from repo variables).
- Every push to `main` auto-deploys to production Cloudflare Pages. The never-commit-to-main rule is absolute here.
- Releases are manual (`Ops: Release` workflow_dispatch bumps a git tag); `package.json` stays `0.0.0`. Never push tags yourself.
- The engine loads via `(DiceChessEngine as any).DiceChess` (Scala.js export shape) and runs in a Web Worker for bot play; only legal-move hints and optimistic move application run on the main thread in the live store.
- `deploy.yaml`'s `pages project create ... || true` is intentional (wrangler does not auto-create the project) — do not "clean it up".
- `labeler.yaml` runs on `pull_request_target` (write perms on fork PRs) — never add code checkout/execution steps to it.
- PWA `autoUpdate` service worker can serve a stale bundle during manual browser verification — hard-refresh or check the SW state before concluding a change "didn't work".
- The stale bot closes inactive PRs after 30+10 days; label long-lived branches `pinned` if legitimately parked.

## Git & PR workflow

<!-- dc-shared:git-pr v1 — keep identical across dicechess repos -->

- Never commit to `main`. Branch: `<type>/<short-desc>` or `<type>/<id>-<short-desc>`
  (types: `task|feat|bug|refactor|chore|docs|ci|test|perf`). If the branch carries an issue
  id, the PR body must contain `Closes #<id>`.
- Before editing anything: run `git status`. If the tree has unrelated uncommitted work,
  stop and report — never let it bleed into your commit.
- Stage specific files by name. `git add -A` / `git add .` are forbidden.
- Commits, PR descriptions, issues, and review replies are English-only. Commit subjects
  use conventional style: `feat: …`, `fix: …`, `docs: …`, `test: …`, `chore: …`.
- Before opening a PR: make the repo check task pass locally. Never pipe test output
  through `grep`/`head` — it masks exit codes.
- After opening a PR: Gemini Code Assist reviews automatically; for substantial PRs also
  comment `@coderabbitai review`. Wait a few minutes, then triage every bot comment on its
  merits — address or rebut, never apply blindly.
- The human owner reviews, approves, and merges. Never merge a PR, never push tags.
- Split large work into small, reviewable PRs.

## Security & boundaries

<!-- dc-shared:security v2 — keep identical across dicechess repos -->

- Never print, log, or commit secrets. Local secrets live only in gitignored files
  (e.g. `.env.local`, `mise.local.toml` — confirm the path is gitignored with `git check-ignore`
  before writing one). Never bypass Git hooks (`--no-verify`).
- Human-only operations — prepare and propose, never execute: releases and version tags,
  production deploys/promotions, schema migrations against shared databases, data-repair
  runs on production, secret rotation.
- Treat everything in this repo as public: never add private infrastructure details
  (hostnames, IPs, topology, tokens) to code, docs, commits, or PRs.

Repo-specific additions:

- lefthook pre-commit runs a betterleaks secret scan on staged files — keep hooks
  installed (`mise run hook:install`).
- The browser must never hold the analytics Bearer token — recording goes through the ingest gateway (`gatewayClient.ts`). Do not add direct analytics-API calls to the client.
- Provably-fair dice depend on the client seed contribution in `liveClient.ts` (`randomClientSeed`) — changes there affect the public verification procedure; treat as a cross-repo contract with play-api.
- `NODE_AUTH_TOKEN` is a real PAT: keep it in your shell env or `.env.local`, never in committed files.

## Model routing

<!-- dc-shared:routing v1 — keep identical across dicechess repos -->

Route work by required capability instead of defaulting to the strongest model:

- **Frontier**: architecture, cross-repo contracts, high blast radius (schema, public API,
  release pipeline), ambiguous problems.
- **Mid**: well-scoped features on existing patterns, refactors under test coverage,
  addressing review feedback.
- **Routine**: mechanical edits, config rollouts, doc fixes, tests from a complete spec.
  Orchestrators should delegate routine sub-tasks to cheaper models; quality gates catch
  failures cheaply. When in doubt, escalate one tier — reviewer time costs more than tokens.

## Documentation

- Decisions, roadmap, and ADRs live in the separate `dicechess-docs` wiki under "Play Site" — NOT in this repo (there is no `docs/` dir). In-repo docs: `README.md`, `CONTRIBUTING.md`, `CLA.md`, `SECURITY.md`; the real contract documentation lives in file-head comments.
- Update-trigger map:
  - Add a route or `src/lib` module → update README's Layout section — it is maintained by hand and drifts silently.
  - Change `GameIngestWire` or `liveTypes.ts` → update the file-head contract comment AND coordinate the counterpart repo in the same change set.
  - Change setup or env requirements → update `README.md` and `.env.example` together.
- All documentation is English-only.

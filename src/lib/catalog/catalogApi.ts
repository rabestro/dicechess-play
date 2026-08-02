import { apiBase } from '../live/liveApi';
import type { Seat, TimeControl } from '../live/liveTypes';

// REST client for the human-facing bot catalog (play-api ADR-0014). The wire mirrors
// play-api's `CatalogRoutes.scala` verbatim (camelCase, like the rest of the live wire) —
// do NOT reshape it here. All three endpoints exist only when play-api runs with persistence,
// and on this side only when VITE_PLAY_API_URL is configured (same gate as live play).

/** One catalog card: a bot a visitor can start a game against. `provisional` flags a rating that
 * hasn't converged yet — shown, not hidden (unlike the leaderboard's policy). `available` is
 * advisory: the catalog is fetched once per visit, not polled, so a bot's actual seating state can
 * move before a click — `wakeBot`'s own `busy` and, ultimately, `playBot`'s 409 remain the real gate.
 */
export interface CatalogBot {
	team: string;
	name: string;
	rating: number;
	rd: number;
	provisional: boolean;
	description: string | null;
	available: boolean;
}

export interface BotCatalog {
	bots: CatalogBot[];
}

/** `busy` is true when the bot is at its declared concurrent-game limit — the server never actually
 * probed it in that case, so `alive` is always `false` alongside `busy: true`.
 */
export interface WakeResponse {
	alive: boolean;
	busy: boolean;
}

/** `preferredColor` omitted means a random seat — the server's default. */
export interface PlayBotRequest {
	guestId: string;
	team: string;
	name: string;
	timeControl: TimeControl;
	preferredColor?: Seat;
}

export interface PlayBotMatch {
	gameId: string;
	token: string;
	seat: Seat;
}

/** Thrown by `playBot` so callers can react to specific statuses without parsing anything
 * themselves. `body` is the server's own plain-text reason — play-api writes it specifically to be
 * shown (e.g. "you already have an active game…" vs "that bot is busy…"), so a 409 has TWO distinct
 * causes and this is how a caller tells them apart without hardcoding either message client-side.
 * Every other status collapses to one generic "unavailable" message (same philosophy as `lobbyApi`'s
 * create/accept) because there's nothing more useful to tell the visitor.
 */
export class PlayBotError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
	) {
		super(`playBot failed: ${status}: ${body}`);
	}
}

/** The bots currently open to human play, best rating first. */
export async function fetchCatalog(): Promise<BotCatalog> {
	const res = await fetch(`${apiBase()}/lobby/bots`);
	if (!res.ok) throw new Error(`fetchCatalog failed: ${res.status}`);
	return (await res.json()) as BotCatalog;
}

/** Pings the bot's webhook to force a cold start and confirm it answers, before the visitor commits
 * to a game. Resolves `{ alive: false, busy: false }` for "no webhook" and "didn't answer" alike —
 * there's nothing more specific to tell the visitor about those. `busy: true` is different: the bot
 * is at its declared concurrent-game limit and the server never even probed it — worth a distinct
 * message ("playing right now") rather than folding it into the same "isn't answering" state. Throws
 * only on a genuinely unexpected response (bad name, rate limit, webhooks disabled) — the caller
 * treats that the same as `alive: false, busy: false`.
 */
export async function wakeBot(team: string, name: string): Promise<WakeResponse> {
	const res = await fetch(
		`${apiBase()}/lobby/bots/${encodeURIComponent(team)}/${encodeURIComponent(name)}/wake`,
		{ method: 'POST' },
	);
	if (!res.ok) throw new Error(`wakeBot failed: ${res.status}`);
	return (await res.json()) as WakeResponse;
}

/** Starts a guest-vs-bot game; resolves the guest's own seat (never assume White — the server may
 * have coin-flipped it when no `preferredColor` was given).
 */
export async function playBot(req: PlayBotRequest): Promise<PlayBotMatch> {
	const res = await fetch(`${apiBase()}/lobby/play-bot`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(req),
	});
	if (!res.ok) throw new PlayBotError(res.status, await res.text());
	return (await res.json()) as PlayBotMatch;
}

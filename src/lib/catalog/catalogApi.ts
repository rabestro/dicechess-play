import { apiBase } from '../live/liveApi';
import type { Seat, TimeControl } from '../live/liveTypes';

// REST client for the human-facing bot catalog (play-api ADR-0014). The wire mirrors
// play-api's `CatalogRoutes.scala` verbatim (camelCase, like the rest of the live wire) —
// do NOT reshape it here. All three endpoints exist only when play-api runs with persistence,
// and on this side only when VITE_PLAY_API_URL is configured (same gate as live play).

/** One catalog card: a bot a visitor can start a game against. `provisional` flags a rating that
 * hasn't converged yet — shown, not hidden (unlike the leaderboard's policy). */
export interface CatalogBot {
	team: string;
	name: string;
	rating: number;
	rd: number;
	provisional: boolean;
	description: string | null;
}

export interface BotCatalog {
	bots: CatalogBot[];
}

export interface WakeResponse {
	alive: boolean;
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

/** Thrown by `playBot` so callers can react to specific statuses (e.g. 409 — the guest already has
 * a game) without parsing the message string. Every other catalog call collapses to one generic
 * "unavailable" message (same philosophy as `lobbyApi`'s create/accept) because there's nothing more
 * useful to tell the visitor; 409 is the one status worth surfacing distinctly.
 */
export class PlayBotError extends Error {
	constructor(public readonly status: number) {
		super(`playBot failed: ${status}`);
	}
}

/** The bots currently open to human play, best rating first. */
export async function fetchCatalog(): Promise<BotCatalog> {
	const res = await fetch(`${apiBase()}/lobby/bots`);
	if (!res.ok) throw new Error(`fetchCatalog failed: ${res.status}`);
	return (await res.json()) as BotCatalog;
}

/** Pings the bot's webhook to force a cold start and confirm it answers, before the visitor commits
 * to a game. Resolves `{ alive: false }` for "no webhook" and "didn't answer" alike — there's nothing
 * more specific to tell the visitor. Throws only on a genuinely unexpected response (bad name, rate
 * limit, webhooks disabled) — the caller treats that the same as `alive: false`.
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
	if (!res.ok) throw new PlayBotError(res.status);
	return (await res.json()) as PlayBotMatch;
}

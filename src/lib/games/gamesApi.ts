import { apiBase } from '../live/liveApi';
import type { PublicPlayer, Seat } from '../live/liveTypes';

// REST client for a visitor's own play-api-recorded history: finished lobby/live games (#151,
// `GET /players/{guestId}/games`) and the per-opponent record (#174, `GET
// /players/{guestId}/opponents`). Both wires mirror play-api's `PlayerRoutes.scala` verbatim
// (camelCase) — do NOT reshape either. Both endpoints exist only when play-api runs with
// persistence, and on this side only when VITE_PLAY_API_URL is configured (same gate as live
// play). `timeControl` is a raw string (the server's `TimeControl` ADT toString, e.g.
// `Fischer(300,3)`) — parse it with `parseGameResultsTimeControl` (`$lib/live/timeControls`)
// before displaying it; it is NOT the structured shape the live WebSocket wire uses.

export type PlayerGameResult = 'win' | 'draw' | 'loss' | 'unknown';

export interface PlayerGame {
	gameId: string;
	seat: Seat;
	opponent: PublicPlayer;
	result: PlayerGameResult;
	rated: boolean;
	termination: string;
	timeControl: string;
	finishedAt: string; // ISO-8601
}

export interface PlayerGamesPage {
	games: PlayerGame[];
	/** Whether older games exist beyond this page — the server's own count (`limit + 1` rows
	 * fetched, one held back), not something the client infers. `false` means every remaining
	 * older game for the active filters is already accounted for.
	 */
	hasMore: boolean;
}

export interface PlayerGamesFilters {
	/** `'human'` or `'<team>/<botName>'` — play-api's `OpponentFilter` wire values (#151/#173). Use
	 * `serverVsParam` (`$lib/games/gamesFilters`) to derive this from a parsed `VsFilter`; never
	 * pass a `'local:...'` value here — the server has no such namespace and 400s it.
	 */
	vs?: string;
	result?: 'win' | 'draw' | 'loss';
	/** Keyset cursor (#150/#173): only games strictly older than this ISO-8601 instant. Always the
	 * exact `finishedAt` of the oldest game already fetched under the SAME filters — never
	 * recomputed or rounded, or the server's strict `<` comparison could skip or repeat a row.
	 */
	before?: string;
}

/** One page of the visitor's own finished lobby/live games, newest first. `guestId` is the BARE
 * uuid — the same convention `createGame`/`createSeek`/`acceptSeek` already use; play-api
 * validates and wraps it internally (see the play-api `Principal.guest` boundary). `vs`/`result`
 * are forwarded to the server verbatim (#173) — never filtered client-side, which would make
 * `hasMore` a lie (a client-side match dropped from an already-fetched page looks identical to one
 * that was never fetched).
 */
export async function fetchPlayerGames(
	guestId: string,
	filters: PlayerGamesFilters = {},
): Promise<PlayerGamesPage> {
	const params = new URLSearchParams();
	if (filters.vs) params.set('vs', filters.vs);
	if (filters.result) params.set('result', filters.result);
	if (filters.before) params.set('before', filters.before);
	const query = params.toString();
	const res = await fetch(
		`${apiBase()}/players/${encodeURIComponent(guestId)}/games${query ? `?${query}` : ''}`,
	);
	if (!res.ok) throw new Error(`fetchPlayerGames failed: ${res.status}`);
	return (await res.json()) as PlayerGamesPage;
}

/** One opponent bucket: a specific registered bot (`team`/`botName` populated — the
 * machine-readable key for a `?vs=<team>/<botName>` games-filter link) or the collapsed
 * "every human/guest opponent" row (`team`/`botName` both null). `opponent` is the same
 * `PublicPlayer` shape `PlayerGame.opponent` uses, so existing opponent-rendering logic applies
 * unchanged.
 */
export interface PlayerOpponent {
	opponent: PublicPlayer;
	team: string | null;
	botName: string | null;
	games: number;
	wins: number;
	draws: number;
	losses: number;
	lastPlayedAt: string; // ISO-8601
}

interface PlayerOpponentsResponse {
	opponents: PlayerOpponent[];
}

/** The visitor's aggregate W-D-L against every lobby opponent, most-played first. Same guest-id
 * convention as `fetchPlayerGames`.
 */
export async function fetchPlayerOpponents(guestId: string): Promise<PlayerOpponent[]> {
	const res = await fetch(`${apiBase()}/players/${encodeURIComponent(guestId)}/opponents`);
	if (!res.ok) throw new Error(`fetchPlayerOpponents failed: ${res.status}`);
	const body = (await res.json()) as PlayerOpponentsResponse;
	return body.opponents;
}

import { apiBase } from '../live/liveApi';
import type { PublicPlayer, Seat } from '../live/liveTypes';

// REST client for a visitor's own finished lobby/live games (play-api #151, `GET
// /players/{guestId}/games`). The wire mirrors play-api's `PlayerRoutes.scala` verbatim
// (camelCase) — do NOT reshape it here. The endpoint exists only when play-api runs with
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

interface PlayerGamesResponse {
	games: PlayerGame[];
}

/** The visitor's own finished lobby/live games, newest first. `guestId` is the BARE uuid — the
 * same convention `createGame`/`createSeek`/`acceptSeek` already use; play-api validates and
 * wraps it internally (see the play-api `Principal.guest` boundary).
 */
export async function fetchPlayerGames(guestId: string): Promise<PlayerGame[]> {
	const res = await fetch(`${apiBase()}/players/${encodeURIComponent(guestId)}/games`);
	if (!res.ok) throw new Error(`fetchPlayerGames failed: ${res.status}`);
	const body = (await res.json()) as PlayerGamesResponse;
	return body.games;
}

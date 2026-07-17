import { apiBase } from '../live/liveApi';

// REST client for the public rating-ladder read API (play-api D.2). The wire mirrors
// play-api's `LeaderboardRoutes.scala` verbatim (camelCase, like the rest of the live wire) —
// do NOT reshape it here. Both endpoints exist only when play-api runs with persistence, and
// on this side only when VITE_PLAY_API_URL is configured (same gate as live play).

/** One leaderboard row. `rank` is 1-based within the response; W-D-L counts rated, decided
 * games only (the ladder record). Provisional bots (rating not yet converged) are absent from
 * the board by server policy.
 */
export interface LeaderRow {
	rank: number;
	team: string;
	name: string;
	rating: number;
	rd: number;
	/** False for a bot that left the ladder — its rating is frozen but still listed. */
	onLadder: boolean;
	games: number;
	wins: number;
	draws: number;
	losses: number;
}

export interface Leaderboard {
	leaders: LeaderRow[];
}

/** One recent game from the profiled bot's point of view. `opponent` is a public face — bots by
 * team-qualified name, humans anonymous (name null) — same shape as the live wire's players.
 */
export interface ProfileRecentGame {
	gameId: string;
	seat: 'White' | 'Black';
	opponent: { kind: 'Human' | 'Bot'; name: string | null };
	result: 'win' | 'draw' | 'loss' | 'unknown';
	rated: boolean;
	termination: string;
	finishedAt: string; // ISO-8601
}

export interface BotProfile {
	team: string;
	name: string;
	rating: number;
	rd: number;
	/** Rating not yet converged: counted internally, hidden from the public board. */
	provisional: boolean;
	onLadder: boolean;
	games: number;
	wins: number;
	draws: number;
	losses: number;
	recent: ProfileRecentGame[];
}

/** The public board: converged bots, best rating first. */
export async function fetchLeaderboard(): Promise<Leaderboard> {
	const res = await fetch(`${apiBase()}/leaderboard`);
	if (!res.ok) throw new Error(`fetchLeaderboard failed: ${res.status}`);
	return (await res.json()) as Leaderboard;
}

/** One bot's public card; 404 (thrown) for identities that are not registered bots. */
export async function fetchBotProfile(team: string, name: string): Promise<BotProfile> {
	const res = await fetch(
		`${apiBase()}/bots/${encodeURIComponent(team)}/${encodeURIComponent(name)}`,
	);
	if (!res.ok) throw new Error(`fetchBotProfile failed: ${res.status}`);
	return (await res.json()) as BotProfile;
}

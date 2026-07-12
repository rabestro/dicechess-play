import { apiBase } from './liveApi';
import type { CreatedSeek, LiveGames, Seek, SeekMatch, SeekState, TimeControl } from './liveTypes';

// REST client for the lobby (polling). The list is polled while browsing; a creator polls its seek's
// status until matched. All anonymous — the guest id seats the player, the secret gates the creator's match.

/** The open seeks, for the lobby list. */
export async function listSeeks(): Promise<Seek[]> {
	const res = await fetch(`${apiBase()}/lobby/seeks`);
	if (!res.ok) throw new Error(`listSeeks failed: ${res.status}`);
	return (await res.json()) as Seek[];
}

/** The live games (most action first, capped server-side) — the lobby's board-wall tiles. */
export async function listGames(): Promise<LiveGames> {
	const res = await fetch(`${apiBase()}/games`);
	if (!res.ok) throw new Error(`listGames failed: ${res.status}`);
	return (await res.json()) as LiveGames;
}

/** Post an open seek; returns its id + the creator's secret. The eventual seat is decided at accept
 * time (randomly) — poll status for it, never assume White.
 */
export async function createSeek(
	creator: string,
	timeControl: TimeControl | null,
): Promise<CreatedSeek> {
	const body: { creator: string; timeControl?: TimeControl } = { creator };
	if (timeControl) body.timeControl = timeControl;
	const res = await fetch(`${apiBase()}/lobby/seeks`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`createSeek failed: ${res.status}`);
	return (await res.json()) as CreatedSeek;
}

/** Poll a seek's status with the creator's secret; refreshes its liveness server-side. */
export async function seekStatus(id: string, secret: string): Promise<SeekState> {
	const res = await fetch(`${apiBase()}/lobby/seeks/${id}?secret=${encodeURIComponent(secret)}`);
	if (!res.ok) throw new Error(`seekStatus failed: ${res.status}`);
	return (await res.json()) as SeekState;
}

/** Accept an open seek; returns the game id, the accepter's seat token, and the seat it names (randomly
 * assigned server-side — never assume Black).
 */
export async function acceptSeek(id: string, accepter: string): Promise<SeekMatch> {
	const res = await fetch(`${apiBase()}/lobby/seeks/${id}/accept`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ accepter }),
	});
	if (!res.ok) throw new Error(`acceptSeek failed: ${res.status}`);
	return (await res.json()) as SeekMatch;
}

/** Cancel the creator's own seek (best-effort; the server's TTL also reaps it). */
export async function cancelSeek(id: string, secret: string): Promise<void> {
	await fetch(`${apiBase()}/lobby/seeks/${id}?secret=${encodeURIComponent(secret)}`, {
		method: 'DELETE',
	});
}

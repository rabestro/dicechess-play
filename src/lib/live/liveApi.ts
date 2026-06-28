import type { CreateGameResponse, PublicGameState, TimeControl } from './liveTypes';

// REST + WebSocket-URL helpers against play-api. The base URL is configured via VITE_PLAY_API_URL
// (mirroring VITE_INGEST_GATEWAY_URL); when empty, live play is disabled. Read at call time so it
// is easy to stub in tests.

export function apiBase(): string {
	return (import.meta.env.VITE_PLAY_API_URL as string | undefined) ?? '';
}

/** Whether a play-api base URL is configured (live play available). */
export function isLiveEnabled(): boolean {
	return apiBase() !== '';
}

/**
 * Create a game; returns the game id, the dice commitment, and a join token per seat. A `timeControl`
 * is sent only when given — omitting it lets the server default to Unlimited.
 */
export async function createGame(
	white: string,
	black: string,
	timeControl?: TimeControl | null,
): Promise<CreateGameResponse> {
	const body: { white: string; black: string; timeControl?: TimeControl } = { white, black };
	if (timeControl) body.timeControl = timeControl;
	const res = await fetch(`${apiBase()}/games`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`createGame failed: ${res.status}`);
	return (await res.json()) as CreateGameResponse;
}

/** Fetch the current public state of a game (e.g. before connecting, or for a spectator). */
export async function getState(id: string): Promise<PublicGameState> {
	const res = await fetch(`${apiBase()}/games/${id}`);
	if (!res.ok) throw new Error(`getState failed: ${res.status}`);
	return (await res.json()) as PublicGameState;
}

/** The WebSocket URL for a game; pass the seat token to play, or null to spectate. */
export function wsUrl(id: string, token: string | null): string {
	const base = apiBase().replace(/^http/, 'ws');
	const query = token ? `?token=${encodeURIComponent(token)}` : '';
	return `${base}/games/${id}/ws${query}`;
}

import type { Seat } from './liveTypes';

// The share link a creator hands to the opponent: it carries the seat's opaque join token plus
// the colour, so the joining tab knows its orientation without an extra round-trip. The token is
// the credential; the colour is advisory — the server validates every move regardless.

export function buildJoinUrl(origin: string, gameId: string, token: string, seat: Seat): string {
	// Use the URL API so origin edge cases (trailing slash) and encoding are handled correctly.
	const url = new URL(`/live/${gameId}`, origin);
	url.searchParams.set('seat', token);
	url.searchParams.set('as', seat === 'White' ? 'white' : 'black');
	return url.toString();
}

export interface ParsedSeat {
	/** The join token, or null for a (tokenless) spectator. */
	token: string | null;
	/** The seat colour from the link, or null if absent/invalid. */
	as: 'white' | 'black' | null;
}

export function parseSeat(url: URL): ParsedSeat {
	const token = url.searchParams.get('seat');
	const asRaw = url.searchParams.get('as');
	const as = asRaw === 'white' || asRaw === 'black' ? asRaw : null;
	return { token, as };
}

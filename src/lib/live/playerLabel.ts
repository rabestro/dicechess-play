import type { Players, PublicPlayer, Seat, Seek } from './liveTypes';

// Who the user is looking at: pure display helpers over the server's public player identities
// (PublicGameState.players / Seek.kind+name). Bots show their name; humans stay anonymous.

/** The seat's public face from the game state, when the server sent one. */
export function publicPlayer(players: Players | null | undefined, seat: Seat): PublicPlayer | null {
	if (!players) return null;
	return seat === 'White' ? players.white : players.black;
}

/**
 * Board-strip name for a seat: a named participant (a bot) shows its name; anonymous humans stay
 * "You"/"Opponent" from the player's point of view, or the bare seat for spectators.
 */
export function seatDisplayName(
	players: Players | null | undefined,
	seat: Seat,
	bottomSeat: Seat,
	spectator: boolean,
): string {
	const name = publicPlayer(players, seat)?.name;
	if (name) return name;
	if (spectator) return seat;
	return seat === bottomSeat ? 'You' : 'Opponent';
}

/** Board-strip subtitle: what kind of participant sits there ("bot" for bots, the old labels otherwise). */
export function seatDisplaySub(
	players: Players | null | undefined,
	seat: Seat,
	spectator: boolean,
): string {
	const who = publicPlayer(players, seat)?.kind === 'Bot' ? 'bot' : spectator ? 'live' : 'guest';
	return `${who} · ${seat.toLowerCase()}`;
}

/** Lobby-row label for who is offering a seek. */
export function seekOffer(seek: Seek): { name: string; bot: boolean } {
	const bot = seek.kind === 'Bot';
	return { name: seek.name ?? 'Anonymous player', bot };
}

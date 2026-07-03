// Wire types for the play-api live protocol — a frozen mirror of the server's JSON
// (dicechess-play-api). Do not "clean these up": they must match the server's codecs exactly.

export type Seat = 'White' | 'Black';

export type Termination = 'KingCaptured' | 'Resign' | 'Draw' | 'Aborted' | 'Timeout';

export type GameResultWire = { Win: { side: Seat } } | { Draw: Record<string, never> };

export interface Over {
	result: GameResultWire;
	termination: Termination;
}

export type GameStatusWire = { Active: Record<string, never> } | { Ended: { over: Over } };

// Remaining time per side, in milliseconds, as of the carrying event. `null` for an unlimited game.
export interface Clocks {
	white: number;
	black: number;
}

// A game's time control, chosen at creation (mirrors the server's TimeControl ADT). Omitting it on
// create means Unlimited.
export type TimeControl =
	| { Unlimited: Record<string, never> }
	| { SuddenDeath: { initialSeconds: number } }
	| { Fischer: { initialSeconds: number; incrementSeconds: number } }
	| { PerMove: { secondsPerMove: number } };

// Whether a participant is a human or a bot — the public taxonomy the lobby and boards render.
export type PlayerKind = 'Human' | 'Bot';

// The public face of a participant: bots carry their team-qualified display name; humans stay
// anonymous (guest ids are private and never on the wire).
export interface PublicPlayer {
	kind: PlayerKind;
	name: string | null;
}

// Both seats' public faces, carried on the game state.
export interface Players {
	white: PublicPlayer;
	black: PublicPlayer;
}

export interface PublicGameState {
	version: number;
	dfen: string;
	activeSeat: Seat;
	dicePending: boolean;
	status: GameStatusWire;
	clocks: Clocks | null;
	// Optional so a pre-players server still parses; the current server always sends it.
	players?: Players | null;
}

// Server -> client events on the game WebSocket, discriminated by the (single) case-name key,
// each carrying a monotonic version `v`.
export type ServerEvent =
	| { Snapshot: { v: number; state: PublicGameState } }
	| { DiceRolled: { v: number; seat: Seat; dice: number[]; dfen: string; clocks: Clocks | null } }
	| { TurnPlayed: { v: number; seat: Seat; moves: string[]; fenAfter: string } }
	| { GameEnded: { v: number; over: Over } }
	| { Rejected: { v: number; seat: Seat; reason: string } };

// Client -> server commands.
export type ClientCommand =
	| { SubmitTurn: { moves: string[] } }
	| { SubmitSeed: { seed: string } } // post-commit dice entropy, sent on join (see Provably-Fair Dice)
	| { Resign: Record<string, never> };

export interface SeatToken {
	seat: Seat;
	token: string;
}

export interface CreateGameResponse {
	gameId: string;
	commit: string;
	tokens: SeatToken[];
}

// ── Lobby / open seeks (mirror the play-api lobby DTOs) ───────────────────────

/** A public open seek in the lobby. `kind`/`name` say WHO is offering (bots by name, humans anonymous). */
export interface Seek {
	id: string;
	timeControl: TimeControl;
	// Optional so a pre-identity server still parses; the current server always sends them.
	kind?: PlayerKind;
	name?: string | null;
}

/** Posting a seek returns its id plus the creator's capability secret (to poll status / cancel). */
export interface CreatedSeek {
	seekId: string;
	secret: string;
}

/** A creator's status poll: `matched` is false while open; once matched it carries the game + the creator's seat token. */
export interface SeekState {
	matched: boolean;
	gameId: string | null;
	token: string | null;
}

/** The accept response: the seated game id plus the accepter's seat token. */
export interface SeekMatch {
	gameId: string;
	token: string;
}

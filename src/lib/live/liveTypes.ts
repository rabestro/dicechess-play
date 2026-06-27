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

export interface PublicGameState {
	version: number;
	dfen: string;
	activeSeat: Seat;
	dicePending: boolean;
	status: GameStatusWire;
}

// Server -> client events on the game WebSocket, discriminated by the (single) case-name key,
// each carrying a monotonic version `v`.
export type ServerEvent =
	| { Snapshot: { v: number; state: PublicGameState } }
	| { DiceRolled: { v: number; seat: Seat; dice: number[]; dfen: string } }
	| { TurnPlayed: { v: number; seat: Seat; moves: string[]; fenAfter: string } }
	| { GameEnded: { v: number; over: Over } }
	| { Rejected: { v: number; seat: Seat; reason: string } };

// Client -> server commands.
export type ClientCommand = { SubmitTurn: { moves: string[] } } | { Resign: Record<string, never> };

export interface SeatToken {
	seat: Seat;
	token: string;
}

export interface CreateGameResponse {
	gameId: string;
	commit: string;
	tokens: SeatToken[];
}

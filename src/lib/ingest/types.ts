// Analytics ingest wire format (snake_case) — the POST /api/games contract.
//
// Copied verbatim from the shared contract used by dicechess-observer / dicechess-sync
// (their src/types.ts). Do NOT diverge: a payload either replays cleanly under the
// backend's pinned engine version or it is rejected with 422. See the wiki:
// "Data Acquisition / 07 Контракт ingest и валидация движком" and
// "08 Идентичность, источники и дедупликация".

export type Color = 'w' | 'b';

export type EventType =
	'DOUBLE_OFFER' | 'DOUBLE_ACCEPT' | 'DOUBLE_DECLINE' | 'DRAW_OFFER' | 'DRAW_ACCEPT';

export type Termination =
	'king_captured' | 'timeout' | 'resign' | 'draw_agreement' | 'double_declined' | 'unknown';

export interface PlayerInputWire {
	external_id: string;
	username?: string | null;
	player_type?: string | null;
	rating?: number | null;
}

export interface TurnInputWire {
	turn_number: number;
	active_color: Color;
	dice: number[]; // 1=pawn .. 6=king
	moves: string[]; // UCI micro-moves, e.g. "b1c3", "e7e8q"; [] for a pass
}

export interface GameEventInputWire {
	sequence_number: number;
	turn_number?: number | null;
	event_type: EventType;
	actor_color?: Color | null;
	payload?: Record<string, unknown> | null;
}

export interface GameIngestWire {
	id: string; // UUID — deterministic UUIDv5 for playsite (idempotent re-sends)
	source: string; // 'playsite'
	mode: string; // 'classic' | 'x2'
	result?: number | null; // white-POV: 1 white win, -1 black win, 0 draw, null unknown
	termination?: string | null;
	started_at?: string | null;
	time_initial_sec?: number | null;
	time_increment_sec?: number | null;
	initial_stake_amount?: number | null; // NULL for free guest games
	final_stake_amount?: number | null;
	stake_currency?: string | null;
	white_player?: PlayerInputWire | null;
	black_player?: PlayerInputWire | null;
	initial_fen: string;
	turns: TurnInputWire[];
	events: GameEventInputWire[];
}

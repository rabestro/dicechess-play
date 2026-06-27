import type { Key } from '@lichess-org/chessground/types';
import {
	getPieceFromFen,
	deriveChessgroundDests,
	buildDfen,
	getDieValue,
} from '../../utils/fenUtils';
import type { DieState } from '../playWithBot/playWithBotDice.svelte';
import { LiveClient, type ConnStatus } from './liveClient';
import { wsUrl } from './liveApi';
import { splitDfen, stripDfen } from './dfenUtils';
import type { Over, PublicGameState, Seat, ServerEvent } from './liveTypes';
import * as DiceChessEngine from '@rabestro/dicechess-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DiceChess = (DiceChessEngine as any).DiceChess;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type LiveStatus = 'connecting' | 'waiting' | 'playing' | 'over';
export type LiveOutcome = 'won' | 'lost' | 'draw';

/**
 * Server-authoritative human-vs-human game state. The server owns the truth: this store applies its
 * versioned events (Snapshot/DiceRolled/TurnPlayed/GameEnded/Rejected), and the local engine is used
 * only to show legal dice-moves and apply moves optimistically for instant feedback. A completed turn
 * is sent as SubmitTurn; the server's TurnPlayed confirms it (Rejected rolls the optimistic move back).
 *
 * It exposes the same read-surface Board consumes (see BoardStore), so Board is reused unchanged.
 */
export class LiveGameStore {
	// ── Board read-surface ───────────────────────────────────────────────────
	currentBoardFen = $state<string>(START_FEN);
	activeColor = $state<'w' | 'b'>('w');
	playerColor = $state<'w' | 'b'>('w');
	gameStatus = $state<LiveStatus>('connecting');

	// ── Live UI state ────────────────────────────────────────────────────────
	currentDice = $state<DieState[]>([]);
	isAnimatingRoll = $state<boolean>(false); // server pushes dice; kept for dice-component parity
	pendingPromotion = $state<{
		orig: string;
		dest: string;
		color: 'w' | 'b';
		availablePieces: string[];
		dieIndex: number;
	} | null>(null);
	connection = $state<ConnStatus>('connecting');
	outcome = $state<LiveOutcome | null>(null); // from this player's POV (null for spectators)
	winner = $state<Seat | null>(null); // the winning side, for spectator display
	termination = $state<string | null>(null);

	private mySeat: Seat | null = null;
	private client: LiveClient | null = null;
	private version = -1;
	private pendingMoves: string[] = []; // optimistic UCI buffer for the turn in progress
	private confirmedFen = START_FEN; // last server-confirmed position, for rollback
	private confirmedDice: DieState[] = [];

	/** True while a player (not a spectator) is in a live game. */
	get canResign(): boolean {
		return this.mySeat !== null && this.gameStatus !== 'over';
	}

	get availableDiceValues(): number[] {
		return this.currentDice.filter((d) => d.allowed && !d.used).map((d) => getDieValue(d));
	}

	legalMovesDests = $derived.by<Map<Key, Key[]>>(() => {
		if (this.gameStatus !== 'playing' || this.activeColor !== this.playerColor) return new Map();
		const dice = this.availableDiceValues;
		if (dice.length === 0) return new Map();
		try {
			const uci = DiceChess.getLegalUciMoves(buildDfen(this.currentBoardFen, dice)) || [];
			return deriveChessgroundDests(uci);
		} catch {
			return new Map();
		}
	});

	// ── lifecycle ─────────────────────────────────────────────────────────────
	connect(id: string, token: string | null, as: 'white' | 'black' | null): void {
		this.dispose(); // close any prior socket so a re-connect can't leak it
		this.playerColor = as === 'black' ? 'b' : 'w';
		this.mySeat = as === 'white' ? 'White' : as === 'black' ? 'Black' : null;
		const client = new LiveClient(wsUrl(id, token));
		this.client = client;
		client.onStatus((s) => (this.connection = s));
		client.onEvent((ev) => this.applyEvent(ev));
		client.connect();
	}

	dispose(): void {
		this.client?.close();
		this.client = null;
	}

	resign(): void {
		this.client?.send({ Resign: {} });
	}

	// ── server events ──────────────────────────────────────────────────────────
	private applyEvent(ev: ServerEvent): void {
		if ('Snapshot' in ev) {
			this.version = ev.Snapshot.v;
			this.syncState(ev.Snapshot.state);
			return;
		}
		if ('DiceRolled' in ev) {
			if (ev.DiceRolled.v <= this.version) return;
			this.version = ev.DiceRolled.v;
			this.syncTurn(ev.DiceRolled.dfen, ev.DiceRolled.seat);
			return;
		}
		if ('TurnPlayed' in ev) {
			if (ev.TurnPlayed.v <= this.version) return;
			this.version = ev.TurnPlayed.v;
			this.confirmedFen = stripDfen(ev.TurnPlayed.fenAfter);
			this.currentBoardFen = this.confirmedFen;
			this.pendingMoves = [];
			this.currentDice = [];
			this.gameStatus = 'waiting';
			return;
		}
		if ('GameEnded' in ev) {
			if (ev.GameEnded.v <= this.version) return;
			this.version = ev.GameEnded.v;
			this.endGame(ev.GameEnded.over);
			return;
		}
		if ('Rejected' in ev) {
			if (ev.Rejected.v <= this.version) return;
			this.version = ev.Rejected.v;
			if (ev.Rejected.seat === this.mySeat) this.rollback();
			return;
		}
	}

	private syncState(state: PublicGameState): void {
		if ('Ended' in state.status) {
			this.currentBoardFen = stripDfen(state.dfen);
			this.endGame(state.status.Ended.over);
			return;
		}
		this.syncTurn(state.dfen, state.activeSeat, state.dicePending);
	}

	/** Adopt the authoritative position + dice for the side to move. */
	private syncTurn(dfen: string, activeSeat: Seat, dicePending = true): void {
		const { fen6, dice } = splitDfen(dfen);
		this.confirmedFen = fen6;
		this.currentBoardFen = fen6;
		this.activeColor = activeSeat === 'White' ? 'w' : 'b';
		this.pendingMoves = [];
		this.currentDice = dicePending
			? dice.map((value) => ({ value, allowed: true, used: false }))
			: [];
		this.confirmedDice = this.currentDice.map((d) => ({ ...d }));
		this.gameStatus = dicePending && activeSeat === this.mySeat ? 'playing' : 'waiting';
	}

	private endGame(over: Over): void {
		this.gameStatus = 'over';
		this.termination = over.termination;
		this.currentDice = [];
		this.pendingMoves = [];
		if ('Draw' in over.result) {
			this.outcome = 'draw';
			this.winner = null;
		} else {
			this.winner = over.result.Win.side;
			this.outcome = this.mySeat === null ? null : this.winner === this.mySeat ? 'won' : 'lost';
		}
	}

	private rollback(): void {
		this.currentBoardFen = this.confirmedFen;
		this.currentDice = this.confirmedDice.map((d) => ({ ...d }));
		this.pendingMoves = [];
		this.gameStatus = this.activeColor === this.playerColor ? 'playing' : 'waiting';
	}

	// ── move handling (mirrors the vs-bot store, but submits the turn to the server) ──
	handleBoardMove(orig: string, dest: string): void {
		if (this.gameStatus !== 'playing' || this.activeColor !== this.playerColor) return;
		const piece = getPieceFromFen(this.currentBoardFen, orig);
		if (!piece) return;

		const dieVal = getDieValue(piece);
		const dieIndex = this.currentDice.findIndex(
			(d) => d.allowed && !d.used && getDieValue(d) === dieVal,
		);
		if (dieIndex === -1) return;
		this.currentDice[dieIndex].used = true;

		const isPromotion = piece.toLowerCase() === 'p' && (dest[1] === '8' || dest[1] === '1');
		if (isPromotion) {
			// Capturing the king on the promotion rank ends the game — auto-queen past the popup.
			const target = getPieceFromFen(this.currentBoardFen, dest);
			if (target && target.toLowerCase() === 'k') {
				this.completeMove(orig, dest, 'q', dieIndex);
				return;
			}
			this.pendingPromotion = {
				orig,
				dest,
				color: this.playerColor,
				availablePieces: this.promotionPieces(orig, dest, dieIndex),
				dieIndex,
			};
			return;
		}
		this.completeMove(orig, dest, undefined, dieIndex);
	}

	completePromotion(piece: string): void {
		if (!this.pendingPromotion) return;
		const { orig, dest, dieIndex } = this.pendingPromotion;
		this.pendingPromotion = null;
		this.completeMove(orig, dest, piece, dieIndex);
	}

	cancelPromotion(): void {
		if (!this.pendingPromotion) return;
		this.currentDice[this.pendingPromotion.dieIndex].used = false;
		this.pendingPromotion = null;
		// Snap the piece back by briefly clearing the FEN (same trick as the vs-bot board).
		const fen = this.currentBoardFen;
		this.currentBoardFen = '';
		setTimeout(() => (this.currentBoardFen = fen), 0);
	}

	private promotionPieces(orig: string, dest: string, dieIndex: number): string[] {
		const dice = this.currentDice
			.filter((d, i) => d.allowed && (!d.used || i === dieIndex))
			.map((d) => getDieValue(d));
		try {
			const legal: string[] =
				DiceChess.getLegalUciMoves(buildDfen(this.currentBoardFen, dice)) || [];
			const promos = legal
				.filter((m) => m.startsWith(orig + dest) && m.length === 5)
				.map((m) => m[4].toLowerCase());
			if (promos.length > 0) return Array.from(new Set(promos));
		} catch {
			/* fall through to the default set */
		}
		return ['q', 'r', 'b', 'n'];
	}

	private completeMove(
		orig: string,
		dest: string,
		promo: string | undefined,
		dieIndex: number,
	): void {
		const oldFen = this.currentBoardFen;
		const dice = this.currentDice
			.filter((d, i) => d.allowed && (!d.used || i === dieIndex))
			.map((d) => getDieValue(d));
		const nextRaw = DiceChess.applyMove(buildDfen(oldFen, dice), orig, dest, promo);
		if (!nextRaw) {
			this.currentDice[dieIndex].used = false; // engine rejected; free the die
			return;
		}
		this.currentBoardFen = stripDfen(nextRaw);
		this.consumeCastlingDie(orig, dest, getPieceFromFen(oldFen, orig));
		this.pendingMoves.push(orig + dest + (promo ?? ''));

		const capturedKing = getPieceFromFen(oldFen, dest)?.toLowerCase() === 'k';
		const turnComplete = capturedKing || this.legalMovesDests.size === 0;
		if (turnComplete) this.submitTurn();
	}

	private consumeCastlingDie(orig: string, dest: string, piece: string | null): void {
		if (piece?.toLowerCase() !== 'k') return;
		if (Math.abs(orig.charCodeAt(0) - dest.charCodeAt(0)) !== 2) return;
		const rookDie = getDieValue('r');
		const i = this.currentDice.findIndex((d) => d.allowed && !d.used && getDieValue(d) === rookDie);
		if (i !== -1) this.currentDice[i].used = true;
	}

	private submitTurn(): void {
		this.gameStatus = 'waiting'; // optimistic: turn sent, await the server's TurnPlayed / Rejected
		this.client?.send({ SubmitTurn: { moves: [...this.pendingMoves] } });
	}
}

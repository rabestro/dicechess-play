// src/lib/playWithBot/playWithBotHistory.svelte.ts

import type { TurnBlock } from '../types';
import { logger } from '../utils/logger';
import { getPieceFromFen, PIECE_TO_UNICODE } from '../../utils/fenUtils';
import type { DiceChessTurnHistory } from '../localGamesDB';

/**
 * State representing a single move position in the bot-play history map.
 */
export interface BotMoveHistoryState {
	fen: string;
	active_color: 'w' | 'b';
	dices: { value: string; allowed: boolean; used: boolean }[];
	gameMoveHistoryMove: { from: string; to: string; promotion: string } | null;
	leftTime?: { [playerId: string]: number };
}

/**
 * PlayWithBotHistory manages full offline game history, navigability, and
 * turn grouping logs, isolated from UI and coordinating controllers.
 */
export class PlayWithBotHistory {
	/** The reactive map correlating move indices with their corresponding board and dice states. */
	historyMap = $state<Record<string, BotMoveHistoryState>>({});

	/** The current active move index that the board is displaying. */
	currentMoveIndex = $state<number>(0);

	/** The highest move index reached in the active game. */
	maxMoveIndex = $state<number>(0);

	/** A log of finished turns registered during this game session. */
	turnHistory = $state<DiceChessTurnHistory[]>([]);

	/** The active, partially completed turn record. */
	currentTurnRecord = $state<Partial<DiceChessTurnHistory> | null>(null);

	/**
	 * Initializes state and sets up starting position for a new local game.
	 * @param initialFen The starting FEN position.
	 */
	initializeNewGame(initialFen: string) {
		this.currentMoveIndex = 0;
		this.maxMoveIndex = 0;
		this.turnHistory = [];
		this.currentTurnRecord = null;
		this.historyMap = {
			'0': {
				fen: initialFen,
				active_color: 'w',
				dices: [],
				gameMoveHistoryMove: null,
			},
		};
	}

	/**
	 * Resets all history registers.
	 */
	clear() {
		this.historyMap = {};
		this.currentMoveIndex = 0;
		this.maxMoveIndex = 0;
		this.turnHistory = [];
		this.currentTurnRecord = null;
	}

	/**
	 * Whether the game is navigable backwards.
	 */
	get canGoToStart(): boolean {
		return this.currentMoveIndex > 0;
	}

	/**
	 * Whether the game is navigable forwards.
	 */
	get canGoToEnd(): boolean {
		return this.currentMoveIndex < this.maxMoveIndex;
	}

	/**
	 * Records a new move position in the history map.
	 * @param nextFen The FEN board position after applying the move.
	 * @param activeColor The color active on the turn.
	 * @param dices Snapshot of the current turn's dice pool.
	 * @param move Details of the applied micro-move (from square, to square, promotion piece).
	 * @returns The newly created move index.
	 */
	recordMove(
		nextFen: string,
		activeColor: 'w' | 'b',
		dices: { value: string; allowed: boolean; used: boolean }[],
		move: { from: string; to: string; promotion: string } | null,
	): number {
		const moveIndex = this.maxMoveIndex + 1;
		const newState: BotMoveHistoryState = {
			fen: nextFen,
			active_color: activeColor,
			dices: $state.snapshot(dices),
			gameMoveHistoryMove: move,
		};

		this.historyMap[String(moveIndex)] = newState;
		this.currentMoveIndex = moveIndex;
		this.maxMoveIndex = moveIndex;
		return moveIndex;
	}

	/**
	 * Updates partial state parameters on the most recent history record.
	 * @param update Partial parameters of BotMoveHistoryState to override.
	 */
	updateStateInHistory(update: Partial<BotMoveHistoryState>) {
		const state = this.historyMap[String(this.maxMoveIndex)];
		if (state) {
			Object.assign(state, update);
		}
	}

	/**
	 * A derived reactive getter that groups micro-move history records
	 * into clean, multi-move visual blocks for Svelte components.
	 */
	historyBlocks = $derived.by<TurnBlock[]>(() => {
		const blocks: TurnBlock[] = [];
		let currentTurnBlock: TurnBlock | null = null;
		let prevState: BotMoveHistoryState | null = null;

		try {
			for (let i = 0; i <= this.maxMoveIndex; i++) {
				const state = this.historyMap[String(i)];
				if (!state) continue;

				const activeColor = state.active_color || 'w';
				const isNewTurn =
					!currentTurnBlock || (prevState && activeColor === 'w' && prevState.active_color === 'b');

				if (isNewTurn) {
					currentTurnBlock = {
						turnNumber: blocks.length + 1,
						whiteDice: null,
						blackDice: null,
						whiteMoves: [],
						blackMoves: [],
						events: [],
					};
					blocks.push(currentTurnBlock);
				}

				if (currentTurnBlock && state.dices.length > 0) {
					if (activeColor === 'w' && !currentTurnBlock.whiteDice) {
						currentTurnBlock.whiteDice = {
							index: i,
							diceChars: state.dices.map((d) => d.value),
						};
					} else if (activeColor === 'b' && !currentTurnBlock.blackDice) {
						currentTurnBlock.blackDice = {
							index: i,
							diceChars: state.dices.map((d) => d.value),
						};
					}
				}

				if (state.gameMoveHistoryMove) {
					const fen = prevState?.fen ?? state.fen;
					const from = state.gameMoveHistoryMove.from;
					const to = state.gameMoveHistoryMove.to;
					const pieceChar = from ? getPieceFromFen(fen, from) : null;
					const pieceIcon = pieceChar ? PIECE_TO_UNICODE[pieceChar] : '';

					let text: string;
					if (!from || !to) {
						text = 'PASS';
					} else {
						text = `${from.toLowerCase()}-${to.toLowerCase()}`;
					}

					const moveData = {
						index: i,
						text,
						pieceIcon: pieceIcon || '',
						pieceChar: pieceChar ?? null,
					};

					if (currentTurnBlock) {
						if (activeColor === 'w') {
							currentTurnBlock.whiteMoves.push(moveData);
						} else {
							currentTurnBlock.blackMoves.push(moveData);
						}
					}
				}

				prevState = state;
			}
		} catch (e) {
			logger.error('Error parsing play-with-bot history blocks', e as Error);
			return blocks;
		}
		return blocks;
	});
}

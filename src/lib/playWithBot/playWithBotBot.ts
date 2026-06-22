// src/lib/playWithBot/playWithBotBot.ts

import { buildDfen } from '../../utils/fenUtils';
import * as DiceChessEngine from '@rabestro/dicechess-engine';
import { logger } from '../utils/logger';

/**
 * Wall-clock budget (ms) sent to the engine per bot move. Honoured by
 * time-budgeted bots (Monte-Carlo) to bound their search; ignored by the O(1)
 * bots. Without it, Monte-Carlo runs an unbounded rollout search that can take
 * minutes on a high-branching opening position.
 */
export const BOT_TIME_BUDGET_MS = 2500;

let DiceChess = (DiceChessEngine as any).DiceChess;

/**
 * Statically injects a mock DiceChess instance for unit testing.
 * @param instance The mock DiceChess engine instance.
 */
export function setBotDiceChessInstance(instance: any) {
	DiceChess = instance;
}

/**
 * Resets the injected DiceChess instance back to the original engine library.
 */
export function resetBotDiceChessInstance() {
	DiceChess = (DiceChessEngine as any).DiceChess;
}

/**
 * Details of a recommended bot move returned by the engine.
 */
export interface BotMove {
	/** The starting square coordinate (e.g. 'e2'). */
	from: string;
	/** The destination square coordinate (e.g. 'e4'). */
	to: string;
	/** The promotion piece code if the move is a pawn promotion (e.g. 'q'), otherwise null. */
	promotion: string | null;
}

type WorkerRequest = {
	type: 'getBestMove';
	payload: {
		dfen: string;
		options: { algorithm: string; timeBudgetMs?: number };
	};
};

type WorkerResponse = {
	type: 'getBestMove';
	payload: { moves: BotMove[] };
};

type WorkerError = {
	type: 'error';
	payload: { message: string };
};

type WorkerMessage = WorkerResponse | WorkerError;

/**
 * PlayWithBotBot is a stateless AI service that interfaces with the Chess Engine
 * to evaluate and recommend moves based on random or greedy heuristics.
 */
export class PlayWithBotBot {
	private worker: Worker | null = null;

	/**
	 * Initializes the Web Worker for offloading bot calculations.
	 */
	initializeWorker(): void {
		if (typeof Worker === 'undefined' || typeof window === 'undefined') {
			this.worker = null;
			return;
		}
		try {
			this.worker = new Worker(new URL('./playWithBot.worker.ts', import.meta.url), {
				type: 'module',
			});
			this.worker.onerror = (error) => {
				logger.error('Web Worker error:', error);
				this.worker = null;
			};
		} catch (e) {
			logger.error('Failed to initialize Web Worker for bot calculations', e as Error);
			this.worker = null;
		}
	}

	/**
	 * Terminates the Web Worker.
	 */
	terminateWorker(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}

	/**
	 * Selects an array of recommended micro-moves for the bot.
	 * @param fen The current board FEN position.
	 * @param diceValues The available rolled dice values in the active turn.
	 * @param algorithm The AI strategy to use ('greedy' or 'random').
	 * @returns A promise resolving to an array of recommended BotMoves.
	 */
	async selectBestMove(fen: string, diceValues: number[], algorithm: string): Promise<BotMove[]> {
		const dfen = buildDfen(fen, diceValues);

		if (this.worker) {
			return this.selectBestMoveWithWorker(dfen, algorithm);
		}

		return this.selectBestMoveFallback(dfen, algorithm);
	}

	private async selectBestMoveWithWorker(dfen: string, algorithm: string): Promise<BotMove[]> {
		return new Promise((resolve) => {
			if (!this.worker) {
				resolve([]);
				return;
			}

			const request: WorkerRequest = {
				type: 'getBestMove',
				payload: {
					dfen,
					options: { algorithm, timeBudgetMs: BOT_TIME_BUDGET_MS },
				},
			};

			const messageHandler = (event: MessageEvent<WorkerMessage>) => {
				if (event.data.type === 'getBestMove') {
					this.worker?.removeEventListener('message', messageHandler);
					resolve(event.data.payload.moves);
				} else if (event.data.type === 'error') {
					this.worker?.removeEventListener('message', messageHandler);
					logger.error(
						`Error in Web Worker during bot move calculation: ${event.data.payload.message}`,
					);
					resolve([]);
				}
			};

			this.worker.addEventListener('message', messageHandler);
			this.worker.postMessage(request);
		});
	}

	private async selectBestMoveFallback(dfen: string, algorithm: string): Promise<BotMove[]> {
		try {
			const result = DiceChess.getBestMove(dfen, { algorithm, timeBudgetMs: BOT_TIME_BUDGET_MS });
			return result?.moves || [];
		} catch (e) {
			logger.error(`Error getting bot moves with algorithm: ${algorithm}`, e as Error);
			return [];
		}
	}
}

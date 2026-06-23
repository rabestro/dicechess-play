// src/lib/playWithBot/playWithBot.worker.ts

import * as DiceChessEngine from '@rabestro/dicechess-engine';

const DiceChess = (DiceChessEngine as any).DiceChess;

type ClockOptions = { remainingMs: number; incrementMs: number };

export type WorkerRequest = {
	type: 'getBestMove';
	payload: {
		dfen: string;
		options: { algorithm: string; clock?: ClockOptions; timeBudgetMs?: number };
	};
};

export type WorkerResponse = {
	type: 'getBestMove';
	payload: { moves: Array<{ from: string; to: string; promotion: string | null }> };
};

export type WorkerError = {
	type: 'error';
	payload: { message: string };
};

// Web Worker entry point
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	try {
		if (event.data.type === 'getBestMove') {
			const result = DiceChess.getBestMove(event.data.payload.dfen, event.data.payload.options);
			const response: WorkerResponse = {
				type: 'getBestMove',
				payload: { moves: result?.moves || [] },
			};
			self.postMessage(response);
		}
	} catch (error) {
		const errorResponse: WorkerError = {
			type: 'error',
			payload: { message: (error as Error).message },
		};
		self.postMessage(errorResponse);
	}
};

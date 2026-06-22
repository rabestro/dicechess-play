import { describe, expect, it } from 'vitest';
import { getCburnettPieceImage } from './pieceImages';

describe('pieceImages', () => {
	it.each([
		['Q', '/pieces/cburnett/wQ.svg'],
		['p', '/pieces/cburnett/bP.svg'],
		['wN', '/pieces/cburnett/wN.svg'],
		['bq', '/pieces/cburnett/bQ.svg'],
		['  bR ', '/pieces/cburnett/bR.svg'],
		['', ''],
		['   ', ''],
	])('maps %s to %s', (input, expected) => {
		expect(getCburnettPieceImage(input)).toBe(expected);
	});
});

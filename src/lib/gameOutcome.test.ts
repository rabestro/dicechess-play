import { describe, it, expect } from 'vitest';
import { playerOutcome, outcomeLabel } from './gameOutcome';

describe('playerOutcome', () => {
	it('reads a White win from each color', () => {
		expect(playerOutcome(1, 'WHITE')).toBe('win');
		expect(playerOutcome(1, 'BLACK')).toBe('loss');
	});

	it('reads a Black win from each color', () => {
		expect(playerOutcome(-1, 'WHITE')).toBe('loss');
		expect(playerOutcome(-1, 'BLACK')).toBe('win');
	});

	it('treats a zero result as a draw regardless of color', () => {
		expect(playerOutcome(0, 'WHITE')).toBe('draw');
		expect(playerOutcome(0, 'BLACK')).toBe('draw');
	});
});

describe('outcomeLabel', () => {
	it('maps each outcome to its label', () => {
		expect(outcomeLabel('win')).toBe('Won');
		expect(outcomeLabel('loss')).toBe('Lost');
		expect(outcomeLabel('draw')).toBe('Draw');
	});
});

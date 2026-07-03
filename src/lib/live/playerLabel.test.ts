import { describe, expect, it } from 'vitest';
import { publicPlayer, seatDisplayName, seatDisplaySub, seekOffer } from './playerLabel';
import type { Players, Seek } from './liveTypes';

const botVsHuman: Players = {
	white: { kind: 'Bot', name: 'house greedy' },
	black: { kind: 'Human', name: null },
};

describe('publicPlayer', () => {
	it('resolves each seat, and null when the server sent no players (older server)', () => {
		expect(publicPlayer(botVsHuman, 'White')?.name).toBe('house greedy');
		expect(publicPlayer(botVsHuman, 'Black')?.kind).toBe('Human');
		expect(publicPlayer(null, 'White')).toBeNull();
		expect(publicPlayer(undefined, 'Black')).toBeNull();
	});
});

describe('seatDisplayName', () => {
	it('shows a named participant (a bot) by name, for players and spectators alike', () => {
		expect(seatDisplayName(botVsHuman, 'White', 'Black', false)).toBe('house greedy');
		expect(seatDisplayName(botVsHuman, 'White', 'White', true)).toBe('house greedy');
	});

	it('keeps anonymous humans as You/Opponent from the player point of view', () => {
		expect(seatDisplayName(botVsHuman, 'Black', 'Black', false)).toBe('You');
		expect(seatDisplayName(null, 'White', 'Black', false)).toBe('Opponent');
	});

	it('falls back to the bare seat for spectators of anonymous humans', () => {
		expect(seatDisplayName(botVsHuman, 'Black', 'White', true)).toBe('Black');
		expect(seatDisplayName(null, 'White', 'White', true)).toBe('White');
	});
});

describe('seatDisplaySub', () => {
	it('labels bots as bot, players as guest, spectated humans as live', () => {
		expect(seatDisplaySub(botVsHuman, 'White', false)).toBe('bot · white');
		expect(seatDisplaySub(botVsHuman, 'Black', false)).toBe('guest · black');
		expect(seatDisplaySub(botVsHuman, 'Black', true)).toBe('live · black');
	});
});

describe('seekOffer', () => {
	it('shows a bot seek by name with the bot badge', () => {
		const seek: Seek = {
			id: 's1',
			timeControl: { Unlimited: {} },
			kind: 'Bot',
			name: 'house greedy',
		};
		expect(seekOffer(seek)).toEqual({ name: 'house greedy', bot: true });
	});

	it('keeps human (and pre-identity) seeks anonymous', () => {
		expect(
			seekOffer({ id: 's2', timeControl: { Unlimited: {} }, kind: 'Human', name: null }),
		).toEqual({
			name: 'Anonymous player',
			bot: false,
		});
		expect(seekOffer({ id: 's3', timeControl: { Unlimited: {} } })).toEqual({
			name: 'Anonymous player',
			bot: false,
		});
	});
});

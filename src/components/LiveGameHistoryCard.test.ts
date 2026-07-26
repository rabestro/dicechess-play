import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import LiveGameHistoryCard from './LiveGameHistoryCard.svelte';
import type { PlayerGame } from '$lib/games/gamesApi';

function game(overrides: Partial<PlayerGame> = {}): PlayerGame {
	return {
		gameId: 'g-1',
		seat: 'White',
		opponent: { kind: 'Bot', name: 'acme alice' },
		result: 'win',
		rated: false,
		termination: 'resign',
		timeControl: 'Fischer(300,3)',
		finishedAt: '2026-07-16T12:00:00Z',
		...overrides,
	};
}

describe('LiveGameHistoryCard', () => {
	it('renders a bot opponent with its name and the shared bot badge', () => {
		const { getByText } = render(LiveGameHistoryCard, { game: game() });
		expect(getByText('acme alice')).toBeTruthy();
		expect(getByText('bot')).toBeTruthy();
	});

	it('anonymises a human opponent and shows no bot badge', () => {
		const { getByText, queryByText } = render(LiveGameHistoryCard, {
			game: game({ opponent: { kind: 'Human', name: null } }),
		});
		expect(getByText('Anonymous opponent')).toBeTruthy();
		expect(queryByText('bot')).toBeNull();
	});

	it.each([
		['win', 'Won'],
		['loss', 'Lost'],
		['draw', 'Draw'],
		['unknown', 'Unknown'],
	] as const)('labels a %s result as %s', (result, label) => {
		const { getByText } = render(LiveGameHistoryCard, { game: game({ result }) });
		expect(getByText(label)).toBeTruthy();
	});

	it('shows which seat the guest played', () => {
		const { getByText } = render(LiveGameHistoryCard, { game: game({ seat: 'Black' }) });
		expect(getByText('You played Black')).toBeTruthy();
	});

	it('humanises the snake_case termination and parses the raw time control', () => {
		const { getByText } = render(LiveGameHistoryCard, {
			game: game({ termination: 'draw_agreement', timeControl: 'SuddenDeath(300)' }),
		});
		expect(getByText('Draw agreement')).toBeTruthy();
		expect(getByText('5 min')).toBeTruthy();
	});

	it('is not a clickable link — there is nowhere to navigate (no replay data exists)', () => {
		const { container } = render(LiveGameHistoryCard, { game: game() });
		expect(container.querySelector('a')).toBeNull();
	});
});

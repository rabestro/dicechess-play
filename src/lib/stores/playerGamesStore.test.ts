import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playerGamesStore } from './playerGamesStore.svelte';
import type { PlayerGame } from '$lib/games/gamesApi';

function game(gameId: string, finishedAt: string): PlayerGame {
	return {
		gameId,
		seat: 'White',
		opponent: { kind: 'Bot', name: 'acme alice' },
		result: 'win',
		rated: false,
		termination: 'resign',
		timeControl: 'Fischer(300,3)',
		finishedAt,
	};
}

const okJson = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

describe('playerGamesStore', () => {
	beforeEach(() => {
		// Reset the singleton between tests.
		playerGamesStore.games = [];
		playerGamesStore.loading = false;
		playerGamesStore.loaded = false;
		playerGamesStore.error = null;
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('loads games from play-api and flags loaded', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		vi.stubGlobal('fetch', okJson({ games: [game('g-1', '2026-07-16T12:00:00Z')] }));

		await playerGamesStore.load();

		expect(playerGamesStore.games.map((g) => g.gameId)).toEqual(['g-1']);
		expect(playerGamesStore.loaded).toBe(true);
		expect(playerGamesStore.loading).toBe(false);
		expect(playerGamesStore.error).toBeNull();
	});

	it('is a no-op when live play is disabled — no fetch, nothing loaded, no error', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', '');
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await playerGamesStore.load();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(playerGamesStore.games).toEqual([]);
		expect(playerGamesStore.loaded).toBe(false);
		expect(playerGamesStore.error).toBeNull();
	});

	it('degrades to an honest error on fetch failure, without throwing', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		await expect(playerGamesStore.load()).resolves.toBeUndefined();

		expect(playerGamesStore.error).toBe("Your lobby games aren't available right now.");
		expect(playerGamesStore.loading).toBe(false);
		expect(playerGamesStore.games).toEqual([]);
	});

	it('ignores a concurrent load while one is in flight', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		let resolveFetch: (value: unknown) => void = () => {};
		const pending = new Promise((resolve) => (resolveFetch = resolve));
		const fetchMock = vi.fn().mockReturnValue(pending);
		vi.stubGlobal('fetch', fetchMock);

		// The first call flips `loading` synchronously before its first await; the second must
		// short-circuit on the guard rather than issue a second fetch.
		const first = playerGamesStore.load();
		const second = playerGamesStore.load();
		resolveFetch({
			ok: true,
			json: async () => ({ games: [game('g-1', '2026-07-16T12:00:00Z')] }),
		});
		await Promise.all([first, second]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(playerGamesStore.games.map((g) => g.gameId)).toEqual(['g-1']);
		expect(playerGamesStore.loading).toBe(false);
	});
});

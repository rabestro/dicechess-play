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

	it('forwards vs/result filters to fetchPlayerGames', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		const fetchMock = okJson({ games: [] });
		vi.stubGlobal('fetch', fetchMock);

		await playerGamesStore.load({ vs: 'acme/alice', result: 'win' });

		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('?vs=acme%2Falice&result=win'));
	});

	it('reset clears loaded games back to the initial state', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		vi.stubGlobal('fetch', okJson({ games: [game('g-1', '2026-07-16T12:00:00Z')] }));
		await playerGamesStore.load();

		playerGamesStore.reset();

		expect(playerGamesStore.games).toEqual([]);
		expect(playerGamesStore.loaded).toBe(false);
		expect(playerGamesStore.loading).toBe(false);
		expect(playerGamesStore.error).toBeNull();
	});

	it("a stale request from before reset() can't clobber the newer filter's state, however it resolves", async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		let resolveA: (value: unknown) => void = () => {};
		let resolveB: (value: unknown) => void = () => {};
		const fetchMock = vi
			.fn()
			.mockReturnValueOnce(new Promise((resolve) => (resolveA = resolve)))
			.mockReturnValueOnce(new Promise((resolve) => (resolveB = resolve)));
		vi.stubGlobal('fetch', fetchMock);

		const loadA = playerGamesStore.load(); // unfiltered request starts, still in flight
		playerGamesStore.reset(); // the visitor picks a filter mid-flight
		const loadB = playerGamesStore.load({ vs: 'acme/alice' });

		// B (the filtered request) resolves first, as it normally would...
		resolveB({
			ok: true,
			json: async () => ({ games: [game('filtered', '2026-07-16T12:00:00Z')] }),
		});
		await loadB;
		expect(playerGamesStore.games.map((g) => g.gameId)).toEqual(['filtered']);

		// ...then A's abandoned unfiltered request finally resolves. It must be discarded.
		resolveA({
			ok: true,
			json: async () => ({ games: [game('unfiltered', '2026-07-16T12:00:00Z')] }),
		});
		await loadA;

		expect(playerGamesStore.games.map((g) => g.gameId)).toEqual(['filtered']);
		expect(playerGamesStore.loaded).toBe(true);
		expect(playerGamesStore.loading).toBe(false);
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playerOpponentsStore } from './playerOpponentsStore.svelte';
import type { PlayerOpponent } from '$lib/games/gamesApi';

function opponent(team: string, botName: string, games: number): PlayerOpponent {
	return {
		opponent: { kind: 'Bot', name: `${team} ${botName}` },
		team,
		botName,
		games,
		wins: games,
		draws: 0,
		losses: 0,
		lastPlayedAt: '2026-07-16T12:00:00Z',
	};
}

const okJson = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

describe('playerOpponentsStore', () => {
	beforeEach(() => {
		// Reset the singleton between tests.
		playerOpponentsStore.opponents = [];
		playerOpponentsStore.loading = false;
		playerOpponentsStore.loaded = false;
		playerOpponentsStore.error = null;
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('loads opponents from play-api and flags loaded', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		vi.stubGlobal('fetch', okJson({ opponents: [opponent('acme', 'alice', 30)] }));

		await playerOpponentsStore.load();

		expect(playerOpponentsStore.opponents.map((o) => o.botName)).toEqual(['alice']);
		expect(playerOpponentsStore.loaded).toBe(true);
		expect(playerOpponentsStore.loading).toBe(false);
		expect(playerOpponentsStore.error).toBeNull();
	});

	it('is a no-op when live play is disabled — no fetch, nothing loaded, no error', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', '');
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await playerOpponentsStore.load();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(playerOpponentsStore.opponents).toEqual([]);
		expect(playerOpponentsStore.loaded).toBe(false);
		expect(playerOpponentsStore.error).toBeNull();
	});

	it('degrades to an honest error on fetch failure, without throwing', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		await expect(playerOpponentsStore.load()).resolves.toBeUndefined();

		expect(playerOpponentsStore.error).toBe("Your lobby record isn't available right now.");
		expect(playerOpponentsStore.loading).toBe(false);
		expect(playerOpponentsStore.opponents).toEqual([]);
	});

	it('ignores a concurrent load while one is in flight', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		let resolveFetch: (value: unknown) => void = () => {};
		const pending = new Promise((resolve) => (resolveFetch = resolve));
		const fetchMock = vi.fn().mockReturnValue(pending);
		vi.stubGlobal('fetch', fetchMock);

		const first = playerOpponentsStore.load();
		const second = playerOpponentsStore.load();
		resolveFetch({
			ok: true,
			json: async () => ({ opponents: [opponent('acme', 'alice', 30)] }),
		});
		await Promise.all([first, second]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(playerOpponentsStore.opponents.map((o) => o.botName)).toEqual(['alice']);
		expect(playerOpponentsStore.loading).toBe(false);
	});

	it('reset clears loaded opponents back to the initial state', async () => {
		vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080');
		vi.stubGlobal('fetch', okJson({ opponents: [opponent('acme', 'alice', 30)] }));
		await playerOpponentsStore.load();

		playerOpponentsStore.reset();

		expect(playerOpponentsStore.opponents).toEqual([]);
		expect(playerOpponentsStore.loaded).toBe(false);
		expect(playerOpponentsStore.loading).toBe(false);
		expect(playerOpponentsStore.error).toBeNull();
	});
});

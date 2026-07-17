import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLeaderboard, fetchBotProfile } from './leaderboardApi';

describe('leaderboardApi', () => {
	beforeEach(() => vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080'));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	const okJson = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

	it('fetchLeaderboard GETs the board', async () => {
		const board = {
			leaders: [
				{
					rank: 1,
					team: 'acme',
					name: 'alice',
					rating: 1720.5,
					rd: 85.2,
					onLadder: true,
					games: 42,
					wins: 30,
					draws: 2,
					losses: 10,
				},
			],
		};
		const fetchMock = okJson(board);
		vi.stubGlobal('fetch', fetchMock);
		expect(await fetchLeaderboard()).toEqual(board);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/leaderboard');
	});

	it('fetchBotProfile GETs the profile with URL-encoded identity segments', async () => {
		const profile = { team: 'acme', name: 'alice', recent: [] };
		const fetchMock = okJson(profile);
		vi.stubGlobal('fetch', fetchMock);
		expect(await fetchBotProfile('acme', 'alice')).toEqual(profile);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/bots/acme/alice');
	});

	it('both throw with the status on a non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		await expect(fetchLeaderboard()).rejects.toThrow('fetchLeaderboard failed: 404');
		await expect(fetchBotProfile('ghost', 'nobody')).rejects.toThrow('fetchBotProfile failed: 404');
	});
});

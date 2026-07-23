import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCatalog, wakeBot, playBot, PlayBotError } from './catalogApi';

describe('catalogApi', () => {
	beforeEach(() => vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080'));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	const okJson = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

	it('fetchCatalog GETs the catalog', async () => {
		const catalog = {
			bots: [
				{
					team: 'acme',
					name: 'alice',
					rating: 1720.5,
					rd: 85.0,
					provisional: false,
					description: 'aggressive + book',
				},
			],
		};
		const fetchMock = okJson(catalog);
		vi.stubGlobal('fetch', fetchMock);
		expect(await fetchCatalog()).toEqual(catalog);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/lobby/bots');
	});

	it('wakeBot POSTs to the URL-encoded team/name segments', async () => {
		const fetchMock = okJson({ alive: true });
		vi.stubGlobal('fetch', fetchMock);
		expect(await wakeBot('acme', 'alice')).toEqual({ alive: true });
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/lobby/bots/acme/alice/wake', {
			method: 'POST',
		});
	});

	it('playBot POSTs the request body and resolves the match', async () => {
		const match = { gameId: 'g-1', token: 'seat-secret', seat: 'White' };
		const fetchMock = okJson(match);
		vi.stubGlobal('fetch', fetchMock);
		const req = {
			guestId: '11111111-1111-1111-1111-111111111111',
			team: 'acme',
			name: 'alice',
			timeControl: { Fischer: { initialSeconds: 300, incrementSeconds: 5 } },
		};
		expect(await playBot(req)).toEqual(match);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/lobby/play-bot', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(req),
		});
	});

	it('fetchCatalog and wakeBot throw with the status on a non-OK response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		await expect(fetchCatalog()).rejects.toThrow('fetchCatalog failed: 404');
		await expect(wakeBot('acme', 'ghost')).rejects.toThrow('wakeBot failed: 404');
	});

	it('playBot throws a typed PlayBotError carrying the status, so callers can branch on it', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));
		const req = {
			guestId: '11111111-1111-1111-1111-111111111111',
			team: 'acme',
			name: 'alice',
			timeControl: { SuddenDeath: { initialSeconds: 300 } },
		};
		await expect(playBot(req)).rejects.toThrow(PlayBotError);
		await expect(playBot(req)).rejects.toMatchObject({ status: 409 });
	});
});

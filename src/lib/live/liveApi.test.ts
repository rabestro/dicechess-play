import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGame, getState, isLiveEnabled, wsUrl } from './liveApi';

describe('liveApi', () => {
	beforeEach(() => vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080'));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('isLiveEnabled reflects the configured base', () => {
		expect(isLiveEnabled()).toBe(true);
	});

	it('createGame POSTs white/black and returns the response', async () => {
		const body = {
			gameId: 'g1',
			commit: 'abc',
			tokens: [
				{ seat: 'White', token: 'tw' },
				{ seat: 'Black', token: 'tb' },
			],
		};
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
		vi.stubGlobal('fetch', fetchMock);

		const res = await createGame('alice', 'bob');
		expect(res).toEqual(body);
		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8080/games',
			expect.objectContaining({ method: 'POST' }),
		);
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string)).toEqual({ white: 'alice', black: 'bob' });
	});

	it('createGame includes the time control when given', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ gameId: 'g', commit: 'c', tokens: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		await createGame('a', 'b', { Fischer: { initialSeconds: 300, incrementSeconds: 3 } });
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string)).toEqual({
			white: 'a',
			black: 'b',
			timeControl: { Fischer: { initialSeconds: 300, incrementSeconds: 3 } },
		});
	});

	it('createGame omits the time control when null (unlimited)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ gameId: 'g', commit: 'c', tokens: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		await createGame('a', 'b', null);
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string)).toEqual({ white: 'a', black: 'b' });
	});

	it('getState throws on a non-ok response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		await expect(getState('nope')).rejects.toThrow('404');
	});

	it('wsUrl converts the http base to ws and adds the token', () => {
		expect(wsUrl('g1', 'tok')).toBe('ws://localhost:8080/games/g1/ws?token=tok');
		expect(wsUrl('g1', null)).toBe('ws://localhost:8080/games/g1/ws');
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listSeeks, createSeek, seekStatus, acceptSeek, cancelSeek } from './lobbyApi';

describe('lobbyApi', () => {
	beforeEach(() => vi.stubEnv('VITE_PLAY_API_URL', 'http://localhost:8080'));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	const okJson = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

	it('listSeeks GETs the open seeks', async () => {
		const seeks = [{ id: 'seek-1', timeControl: { Unlimited: {} } }];
		const fetchMock = okJson(seeks);
		vi.stubGlobal('fetch', fetchMock);
		expect(await listSeeks()).toEqual(seeks);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/lobby/seeks');
	});

	it('createSeek includes the time control when given', async () => {
		const fetchMock = okJson({ seekId: 's1', secret: 'x' });
		vi.stubGlobal('fetch', fetchMock);
		await createSeek('alice', { Fischer: { initialSeconds: 300, incrementSeconds: 3 } });
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/lobby/seeks');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body as string)).toEqual({
			creator: 'alice',
			timeControl: { Fischer: { initialSeconds: 300, incrementSeconds: 3 } },
		});
	});

	it('createSeek omits the time control when null (unlimited)', async () => {
		const fetchMock = okJson({ seekId: 's1', secret: 'x' });
		vi.stubGlobal('fetch', fetchMock);
		await createSeek('alice', null);
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string)).toEqual({ creator: 'alice' });
	});

	it('seekStatus polls with the url-encoded secret', async () => {
		const fetchMock = okJson({ matched: false, gameId: null, token: null });
		vi.stubGlobal('fetch', fetchMock);
		const s = await seekStatus('s1', 'sec ret');
		expect(s.matched).toBe(false);
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/lobby/seeks/s1?secret=sec%20ret');
	});

	it('acceptSeek posts the accepter and returns the match', async () => {
		const fetchMock = okJson({ gameId: 'g1', token: 't' });
		vi.stubGlobal('fetch', fetchMock);
		const m = await acceptSeek('s1', 'bob');
		expect(m).toEqual({ gameId: 'g1', token: 't' });
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/lobby/seeks/s1/accept');
		expect(JSON.parse(init.body as string)).toEqual({ accepter: 'bob' });
	});

	it('acceptSeek throws when the seek was taken/expired', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));
		await expect(acceptSeek('s1', 'bob')).rejects.toThrow('409');
	});

	it('cancelSeek DELETEs with the secret', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);
		await cancelSeek('s1', 'sec');
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/lobby/seeks/s1?secret=sec', {
			method: 'DELETE',
		});
	});
});

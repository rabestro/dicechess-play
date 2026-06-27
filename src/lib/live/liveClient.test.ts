import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveClient } from './liveClient';
import type { ServerEvent } from './liveTypes';

class MockWebSocket {
	static last: MockWebSocket | null = null;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	sent: string[] = [];
	closed = false;
	constructor(public url: string) {
		MockWebSocket.last = this;
	}
	send(data: string) {
		this.sent.push(data);
	}
	close() {
		this.closed = true;
		this.onclose?.();
	}
}

describe('LiveClient', () => {
	beforeEach(() => {
		vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
		MockWebSocket.last = null;
	});
	afterEach(() => vi.unstubAllGlobals());

	it('reports status and delivers parsed events', () => {
		const statuses: string[] = [];
		const events: ServerEvent[] = [];
		const client = new LiveClient('ws://x/games/g/ws?token=t');
		client.onStatus((s) => statuses.push(s));
		client.onEvent((e) => events.push(e));
		client.connect();

		expect(statuses).toContain('connecting');
		const ws = MockWebSocket.last!;
		expect(ws.url).toBe('ws://x/games/g/ws?token=t');

		ws.onopen!();
		expect(statuses).toContain('open');

		const event: ServerEvent = {
			DiceRolled: { v: 1, seat: 'White', dice: [2, 3, 6], dfen: 'fen' },
		};
		ws.onmessage!({ data: JSON.stringify(event) });
		expect(events).toEqual([event]);
	});

	it('sends commands as JSON', () => {
		const client = new LiveClient('ws://x');
		client.connect();
		client.send({ Resign: {} });
		expect(MockWebSocket.last!.sent).toEqual(['{"Resign":{}}']);
	});

	it('ignores non-JSON frames', () => {
		const events: ServerEvent[] = [];
		const client = new LiveClient('ws://x');
		client.onEvent((e) => events.push(e));
		client.connect();
		MockWebSocket.last!.onmessage!({ data: 'ping' });
		expect(events).toEqual([]);
	});
});

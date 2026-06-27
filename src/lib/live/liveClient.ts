import type { ClientCommand, ServerEvent } from './liveTypes';

export type ConnStatus = 'connecting' | 'open' | 'closed';

// Thin WebSocket transport to a play-api game socket: parses each text frame into a ServerEvent and
// sends ClientCommands as JSON. No Svelte/runes here (pure + unit-testable). Reconnect/backoff is a
// later slice; for now a close is surfaced via the status callback.
export class LiveClient {
	private socket: WebSocket | null = null;
	private eventCb: ((event: ServerEvent) => void) | null = null;
	private statusCb: ((status: ConnStatus) => void) | null = null;

	constructor(private readonly url: string) {}

	onEvent(cb: (event: ServerEvent) => void): void {
		this.eventCb = cb;
	}

	onStatus(cb: (status: ConnStatus) => void): void {
		this.statusCb = cb;
	}

	connect(): void {
		this.statusCb?.('connecting');
		const socket = new WebSocket(this.url);
		this.socket = socket;
		socket.onopen = () => this.statusCb?.('open');
		socket.onclose = () => this.statusCb?.('closed');
		socket.onerror = () => this.statusCb?.('closed');
		socket.onmessage = (event: MessageEvent) => {
			if (typeof event.data !== 'string') return;
			try {
				this.eventCb?.(JSON.parse(event.data) as ServerEvent);
			} catch {
				// Ignore non-JSON frames (e.g. keep-alives).
			}
		};
	}

	send(command: ClientCommand): void {
		this.socket?.send(JSON.stringify(command));
	}

	close(): void {
		this.socket?.close();
		this.socket = null;
	}
}

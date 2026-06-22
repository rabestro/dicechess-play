// Posts a finished game to the ingest GATEWAY — never directly to analytics.
//
// The browser MUST NOT hold INGEST_TOKEN (ADR-0005). The gateway (hosted on Koyeb)
// holds the Bearer token, re-validates the payload with a local engine replay, and
// forwards to analytics POST /api/games at sync.jc.id.lv. This client therefore sends
// the bare GameIngestWire JSON to the gateway with no Authorization header.
//
// Gateway base URL is configured via VITE_INGEST_GATEWAY_URL (e.g.
// https://ingest.jc.id.lv). In dev it can point at a local gateway stub.

import type { GameIngestWire } from './types';

export type IngestOutcome = 'created' | 'exists' | 'rejected' | 'error';

export interface IngestResult {
	outcome: IngestOutcome;
	status: number;
	body?: unknown;
}

const GATEWAY_URL: string = import.meta.env.VITE_INGEST_GATEWAY_URL ?? '';

function classify(status: number): IngestOutcome {
	if (status === 201) return 'created';
	if (status === 200) return 'exists'; // first-writer-wins: already ingested
	if (status === 422) return 'rejected'; // engine replay / validation reject
	return 'error';
}

/**
 * Send one game to the gateway. Resolves with a classified outcome; never throws on
 * HTTP status (transport errors resolve to 'error' so the caller can retry/quarantine
 * via the localGamesDB outbox).
 *
 * TODO(phase-1): wire this into the IndexedDB outbox — mark 'synced' on created/exists,
 * quarantine on rejected, retry with backoff on error.
 */
export async function postGame(payload: GameIngestWire): Promise<IngestResult> {
	if (!GATEWAY_URL) {
		return { outcome: 'error', status: 0, body: 'VITE_INGEST_GATEWAY_URL is not configured' };
	}
	try {
		const res = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/api/games`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		let body: unknown = undefined;
		try {
			body = await res.json();
		} catch {
			// non-JSON body is fine
		}
		return { outcome: classify(res.status), status: res.status, body };
	} catch (err) {
		return { outcome: 'error', status: 0, body: String(err) };
	}
}

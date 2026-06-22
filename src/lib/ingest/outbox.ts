// Durable ingest outbox: flush finished games from IndexedDB to the gateway.
//
// The play store saves every finished game to localGamesDB with sync_status 'pending'
// (the durable, offline-first outbox). This flush maps each pending record to the
// analytics contract and posts it via the gateway. On 'created'/'exists' the record is
// marked synced; 'rejected'/'error' are left pending for retry/quarantine.
//
// TODO(phase-1): backoff + a dedicated 'quarantined' state for 422 rejects so a bad
// record is surfaced for review instead of retried forever.

import { getPendingGames, markGameAsSynced } from '$lib/localGamesDB';
import { getGuestId } from './guestIdentity';
import { toGameIngest } from './mapper';
import { postGame } from './gatewayClient';

export interface FlushSummary {
	created: number;
	exists: number;
	rejected: number;
	error: number;
}

export async function flushOutbox(): Promise<FlushSummary> {
	const summary: FlushSummary = { created: 0, exists: 0, rejected: 0, error: 0 };
	const pending = await getPendingGames();
	if (pending.length === 0) return summary;

	const guestId = getGuestId();
	for (const record of pending) {
		const res = await postGame(toGameIngest(record, guestId));
		summary[res.outcome]++;
		if (res.outcome === 'created' || res.outcome === 'exists') {
			await markGameAsSynced(record.id);
		}
	}
	return summary;
}

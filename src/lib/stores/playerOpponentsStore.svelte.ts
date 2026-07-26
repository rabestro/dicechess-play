import { fetchPlayerOpponents, type PlayerOpponent } from '$lib/games/gamesApi';
import { getGuestUuid } from '$lib/ingest/guestIdentity';
import { isLiveEnabled } from '$lib/live/liveApi';

/**
 * Loads and holds the guest's aggregate W-D-L record against every lobby opponent from play-api
 * (#174) — the "In the lobby" counterpart to `/me`'s on-device `buildPlayerRecord`.
 *
 * A singleton so the loaded list survives navigation, matching `playerGamesStore`; call
 * {@link load} to (re)fetch. A no-op (empty `opponents`, no error) when live play is off
 * (`VITE_PLAY_API_URL` unset) — same rule that disables `/live`. Any fetch failure degrades to
 * an honest `error` flag rather than throwing: the on-device record on `/me` must always render
 * regardless of play-api's health.
 */
class PlayerOpponentsStore {
	opponents = $state<PlayerOpponent[]>([]);
	loading = $state(false);
	loaded = $state(false);
	error = $state<string | null>(null);

	async load(): Promise<void> {
		if (this.loading || !isLiveEnabled()) return;
		this.loading = true;
		this.error = null;
		try {
			this.opponents = await fetchPlayerOpponents(getGuestUuid());
			this.loaded = true;
		} catch {
			// Any failure here — unreachable server, a bad response — means the same thing to the
			// visitor: their lobby record just isn't available right now. One honest, non-technical
			// message (matching playerGamesStore's convention) instead of a raw fetch exception.
			this.error = "Your lobby record isn't available right now.";
		} finally {
			this.loading = false;
		}
	}
}

export const playerOpponentsStore = new PlayerOpponentsStore();

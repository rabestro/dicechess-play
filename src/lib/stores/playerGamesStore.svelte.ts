import { fetchPlayerGames, type PlayerGame } from '$lib/games/gamesApi';
import { getGuestUuid } from '$lib/ingest/guestIdentity';
import { isLiveEnabled } from '$lib/live/liveApi';

/**
 * Loads and holds the guest's finished lobby/live games from play-api (#151) — the
 * server-authoritative counterpart to `localGamesStore`'s IndexedDB-backed bot games.
 *
 * A singleton so the loaded list survives navigation, matching `localGamesStore`; call
 * {@link load} to (re)fetch. A no-op (empty `games`, no error) when live play is off
 * (`VITE_PLAY_API_URL` unset) — same rule that disables `/live`. Any fetch failure degrades to
 * an honest `error` flag rather than throwing: the local list on `/games` must always render
 * regardless of play-api's health.
 */
class PlayerGamesStore {
	games = $state<PlayerGame[]>([]);
	loading = $state(false);
	loaded = $state(false);
	error = $state<string | null>(null);

	async load(): Promise<void> {
		if (this.loading || !isLiveEnabled()) return;
		this.loading = true;
		this.error = null;
		try {
			this.games = await fetchPlayerGames(getGuestUuid());
			this.loaded = true;
		} catch {
			// Any failure here — unreachable server, a bad response — means the same thing to the
			// visitor: their lobby/live games just aren't available right now. One honest,
			// non-technical message (matching the lobby/leaderboard convention) instead of a raw
			// fetch exception.
			this.error = "Your lobby games aren't available right now.";
		} finally {
			this.loading = false;
		}
	}
}

export const playerGamesStore = new PlayerGamesStore();

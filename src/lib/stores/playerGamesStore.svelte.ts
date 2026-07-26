import { fetchPlayerGames, type PlayerGame, type PlayerGamesFilters } from '$lib/games/gamesApi';
import { getGuestUuid } from '$lib/ingest/guestIdentity';
import { isLiveEnabled } from '$lib/live/liveApi';

/**
 * Loads and holds the guest's finished lobby/live games from play-api (#151) — the
 * server-authoritative counterpart to `localGamesStore`'s IndexedDB-backed bot games.
 *
 * A singleton so the loaded list survives navigation, matching `localGamesStore`; call
 * {@link load} to (re)fetch — pass `vs`/`result` to narrow the server-side query (#151/#173),
 * forwarded to `fetchPlayerGames` verbatim. A no-op (empty `games`, no error) when live play is
 * off (`VITE_PLAY_API_URL` unset) — same rule that disables `/live`. Any fetch failure degrades to
 * an honest `error` flag rather than throwing: the local list on `/games` must always render
 * regardless of play-api's health.
 *
 * `/games`'s filter bar reloads this store every time `vs`/`result` change (a fresh server query,
 * not client-side post-filtering — see `gamesFilters.ts`'s doc comment for why). Call {@link reset}
 * first: it bumps a generation counter so a request from before the filter change can't land after
 * the new one and clobber it, however the two happen to resolve — same pattern as
 * `playerOpponentsStore`.
 */
class PlayerGamesStore {
	games = $state<PlayerGame[]>([]);
	loading = $state(false);
	loaded = $state(false);
	error = $state<string | null>(null);
	#generation = 0;

	reset(): void {
		this.games = [];
		this.loading = false;
		this.loaded = false;
		this.error = null;
		this.#generation++;
	}

	async load(filters: PlayerGamesFilters = {}): Promise<void> {
		if (this.loading || !isLiveEnabled()) return;
		this.loading = true;
		this.error = null;
		const generation = this.#generation;
		try {
			const games = await fetchPlayerGames(getGuestUuid(), filters);
			if (generation !== this.#generation) return;
			this.games = games;
			this.loaded = true;
		} catch {
			if (generation !== this.#generation) return;
			// Any failure here — unreachable server, a bad response — means the same thing to the
			// visitor: their lobby/live games just aren't available right now. One honest,
			// non-technical message (matching the lobby/leaderboard convention) instead of a raw
			// fetch exception.
			this.error = "Your lobby games aren't available right now.";
		} finally {
			if (generation === this.#generation) this.loading = false;
		}
	}
}

export const playerGamesStore = new PlayerGamesStore();

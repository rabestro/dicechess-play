import type { PlayerGame } from '$lib/games/gamesApi';
import { sortTimestamp, type GameHistoryItem } from './gameHistoryMerge';

// "Show more" over mergeGameHistory's output (#150). Local games are always fully loaded
// (IndexedDB reads are cheap; DOM rendering is the bottleneck) but live games arrive in server
// pages with genuinely different economics — so this is a render cap over the merge, not a change
// to how either source is fetched. mergeGameHistory itself stays untouched and fully trusted for
// ordering; this module only decides how much of its output is safe to reveal right now.

export interface HistoryPage {
	/** The items to actually render — already newest-first (inherited from the merged input). */
	visible: GameHistoryItem[];
	/** Whether "Show more" should be shown at all. */
	canShowMore: boolean;
	/** Whether clicking "Show more" must fetch a new live page first — false when there's already
	 * enough safely-ordered material buffered to just raise the render cap.
	 */
	needsFetch: boolean;
}

/** The oldest timestamp among already-fetched live games, below which ordering isn't settled yet —
 * every not-yet-fetched live game is guaranteed (play-api's keyset cursor is a strict `<`) to be
 * OLDER than this, so a local game at or after it can never be displaced by a live game we haven't
 * seen yet. `null` means nothing is held back: every live game has already been fetched
 * (`hasMore` false). `Infinity` is the degenerate opposite — `hasMore` true but no live game
 * fetched yet — which holds back every local game until the first live page arrives.
 */
export function liveBoundary(live: PlayerGame[], hasMore: boolean): number | null {
	if (!hasMore) return null;
	if (live.length === 0) return Infinity;
	return Math.min(...live.map((game) => sortTimestamp({ source: 'live', game })));
}

/** Slices an already-merged, newest-first history down to what's both safe to order and within
 * the current render cap. `live`/`hasMore` are the same live half already folded into `merged` —
 * passed separately only because the boundary is a property of the live fetch, not of the merge.
 */
export function paginateGameHistory(
	merged: GameHistoryItem[],
	live: PlayerGame[],
	hasMore: boolean,
	renderCap: number,
): HistoryPage {
	const boundary = liveBoundary(live, hasMore);
	const safe =
		boundary === null
			? merged
			: merged.filter((item) => item.source === 'live' || sortTimestamp(item) >= boundary);
	const visible = safe.slice(0, Math.max(0, renderCap));
	const moreAlreadySafe = safe.length > visible.length;
	return {
		visible,
		canShowMore: moreAlreadySafe || hasMore,
		needsFetch: !moreAlreadySafe && hasMore,
	};
}

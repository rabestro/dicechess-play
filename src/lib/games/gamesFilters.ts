import type { LocalGameRecord } from '$lib/localGamesDB';
import type { PlayerGame, PlayerOpponent } from './gamesApi';
import { botAlgorithm, botLabel } from '$lib/bots';
import { playerOutcome } from '$lib/gameOutcome';
import { opponentVsQuery, opponentLabel } from '$lib/stats/lobbyRecord';
import { emptyCounts, type OutcomeCounts } from '$lib/stats/playerRecord';

/**
 * `?vs=`/`?result=`/`?source=` filter state for `/games` (#151) — the query string is the source
 * of truth (shareable, back-button friendly), parsed here and nowhere else.
 *
 * `vs` spans two namespaces the server doesn't know about: a `local/<algorithm>` on-device engine
 * bot (this repo's own concept, filtered client-side against `LocalGameRecord.bot_id`), versus a
 * lobby `<team>/<botName>` bot or the collapsed `human` bucket (play-api's `OpponentFilter`,
 * forwarded to the server as-is — see `serverVsParam`). The two are mutually exclusive: selecting
 * one always narrows the list to exactly one source, never both.
 *
 * Parsing is lenient by design: an unrecognised value for any param resolves to "no filter"
 * rather than an error — unlike the server, which 400s a malformed `vs`/`result`, a bad or stale
 * query string here (an old bookmark, a hand-edited URL) must not break the page.
 */
export type VsFilter =
	| { kind: 'human' }
	| { kind: 'bot'; team: string; botName: string }
	| { kind: 'local'; algorithm: string };

export type ResultFilter = 'win' | 'draw' | 'loss';
export type SourceFilter = 'device' | 'lobby';

export interface GamesFilters {
	vs: VsFilter | null;
	result: ResultFilter | null;
	source: SourceFilter | null;
}

const RESULTS: readonly ResultFilter[] = ['win', 'draw', 'loss'];
const SOURCES: readonly SourceFilter[] = ['device', 'lobby'];

export function parseVsParam(raw: string): VsFilter | null {
	if (raw === 'human') return { kind: 'human' };
	if (raw.startsWith('local/')) {
		const algorithm = raw.slice('local/'.length);
		return algorithm ? { kind: 'local', algorithm } : null;
	}
	const slash = raw.indexOf('/');
	if (slash <= 0 || slash === raw.length - 1) return null;
	return { kind: 'bot', team: raw.slice(0, slash), botName: raw.slice(slash + 1) };
}

/** The exact `?vs=` query value for a filter — round-trips through {@link parseVsParam}. */
export function vsParamValue(vs: VsFilter): string {
	switch (vs.kind) {
		case 'human':
			return 'human';
		case 'bot':
			return `${vs.team}/${vs.botName}`;
		case 'local':
			return `local/${vs.algorithm}`;
	}
}

/** The subset of a `VsFilter` play-api's `OpponentFilter` understands (`?vs=` on `GET
 * .../games`) — `undefined` for a `local` filter, which the server has no notion of and would
 * simply 400.
 */
export function serverVsParam(vs: VsFilter | null): string | undefined {
	return vs && vs.kind !== 'local' ? vsParamValue(vs) : undefined;
}

export function parseGamesFilters(url: URL): GamesFilters {
	const params = url.searchParams;
	const vs = params.get('vs');
	const result = params.get('result');
	const source = params.get('source');
	return {
		vs: vs === null ? null : parseVsParam(vs),
		result: RESULTS.includes(result as ResultFilter) ? (result as ResultFilter) : null,
		source: SOURCES.includes(source as SourceFilter) ? (source as SourceFilter) : null,
	};
}

/** Whether the live (lobby/live) half of the merged list should be shown at all: hidden entirely
 * when the visitor asked for on-device games only, or for one specific local bot (which can never
 * have a lobby counterpart) — matches `filterLocalGames`'s complementary rule below.
 */
export function liveGamesVisible(filters: GamesFilters): boolean {
	return filters.source !== 'device' && filters.vs?.kind !== 'local';
}

/** Client-side filtering for on-device games — the local half of the composition rule in #151:
 * `vs`/`result` narrow the *live* half on the server (see `serverVsParam`); local games have no
 * server to ask, so the same two filters (plus `source`) are applied here instead.
 */
export function filterLocalGames(
	games: LocalGameRecord[],
	filters: GamesFilters,
): LocalGameRecord[] {
	const { vs, result, source } = filters;
	if (source === 'lobby') return [];
	if (vs && vs.kind !== 'local') return [];
	return games.filter(
		(game) =>
			(!vs || botAlgorithm(game.bot_id) === vs.algorithm) &&
			(!result || playerOutcome(game.result, game.player_color) === result),
	);
}

/** Aggregate W-D-L across an already-filtered `PlayerGame[]` slice — used as the head-to-head
 * summary's fallback when the opponents-summary endpoint (#174) has no matching row yet (still
 * loading, or a bookmarked `vs=` for an opponent this guest hasn't faced in this session's data).
 * Undercounts once the list is capped by pagination (#150); the opponents-summary row is exact
 * and always preferred when available.
 */
export function aggregatePlayerGames(games: PlayerGame[]): OutcomeCounts {
	return games.reduce<OutcomeCounts>((acc, game) => {
		if (game.result === 'win') return { ...acc, wins: acc.wins + 1 };
		if (game.result === 'draw') return { ...acc, draws: acc.draws + 1 };
		if (game.result === 'loss') return { ...acc, losses: acc.losses + 1 };
		return acc;
	}, emptyCounts());
}

export interface OpponentOption {
	vs: VsFilter;
	label: string;
}

/** Every algorithm actually present in the visitor's on-device history, each labelled and keyed
 * for a `local/<algorithm>` option — never the full bot catalog, so the search never offers a bot
 * this guest hasn't actually played (an always-empty result).
 */
export function localOpponentOptions(games: LocalGameRecord[]): OpponentOption[] {
	const seen = new Map<string, string>();
	for (const game of games) {
		const algorithm = botAlgorithm(game.bot_id);
		if (!seen.has(algorithm)) seen.set(algorithm, botLabel(game.bot_id));
	}
	return [...seen.entries()].map(([algorithm, label]) => ({
		vs: { kind: 'local' as const, algorithm },
		label,
	}));
}

/** The full opponent search list for `/games`'s filter bar: on-device bots actually played, plus
 * every lobby opponent from the opponents-summary endpoint (#174) — one flat, labelled list
 * spanning both `vs=` namespaces.
 */
export function opponentOptions(
	localGames: LocalGameRecord[],
	opponents: PlayerOpponent[],
): OpponentOption[] {
	const lobby = opponents
		.map((opponent) => {
			const vs = parseVsParam(opponentVsQuery(opponent));
			return vs ? { vs, label: opponentLabel(opponent) } : null;
		})
		.filter((option): option is OpponentOption => option !== null);
	return [...localOpponentOptions(localGames), ...lobby];
}
